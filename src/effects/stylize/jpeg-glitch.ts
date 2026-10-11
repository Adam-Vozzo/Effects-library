import type { EffectDef, ParamValues } from '../../engine/types';
import { bool, choice, float, int, num } from '../helpers';
import { mulberry32 } from './common-a';

// A real (GPU) baseline JPEG round trip: RGB → YCbCr → 8×8 DCT → quantization → (corruption) →
// dequantization → inverse DCT → RGB. One "JPEG pixel" is `Block size` reference px, so blocks keep
// their size relative to the image at any render resolution; decoding evaluates the inverse DCT at the
// continuous position inside each block (an upscaled JPEG, not a pixelated one).

const LUMA_Q = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109,
  103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];
const CHROMA_Q = [
  17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99, ...new Array(32).fill(99),
];
/** Zigzag index → raster index (the order tables and coefficients are stored in a JPEG file). */
const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36,
  29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
];
const RASTER_TO_ZZ = (() => {
  const r = new Array<number>(64);
  ZIGZAG.forEach((raster, zz) => (r[raster] = zz));
  return r;
})();

const MAX_EVENTS = 24;

/** IJG quality scaling of a base table. */
function scaleTable(base: number[], quality: number, mul: number): number[] {
  const q = Math.min(100, Math.max(1, quality));
  const s = q < 50 ? 5000 / q : 200 - 2 * q;
  return base.map((b) => Math.min(255, Math.max(1, Math.floor((b * s + 50) / 100 * mul))));
}

/** Encoder + decoder quantization tables packed as vec4(lumaEnc, chromaEnc, lumaDec, chromaDec) per raster index. */
function quantTables(p: ParamValues): Float32Array {
  const quality = 100 - num(p, 'compression');
  const bal = num(p, 'chromaLuma');
  const lumaEnc = scaleTable(LUMA_Q, quality, Math.pow(2, 2 * bal));
  const chromaEnc = scaleTable(CHROMA_Q, quality, Math.pow(2, -2 * bal));
  const lumaDec = lumaEnc.slice();
  const chromaDec = chromaEnc.slice();
  const target = num(p, 'qtTarget'); // 0 luma, 1 chroma, 2 both
  const tables = target === 0 ? [lumaDec] : target === 1 ? [chromaDec] : [lumaDec, chromaDec];
  const rnd = mulberry32(num(p, 'seed') * 7919 + 17);
  // Decoder mismatch: the decoder's table drifts from the encoder's (more at high frequencies).
  const mis = num(p, 'mismatch') / 100;
  if (mis > 0) {
    for (const t of tables) {
      for (let i = 0; i < 64; i++) {
        const hf = 0.4 + 0.6 * (RASTER_TO_ZZ[i] / 63);
        t[i] = Math.min(255, Math.max(1, Math.round(t[i] * Math.pow(2, (rnd() * 2 - 1) * 2.2 * mis * hf))));
      }
    }
  }
  // Breaking bytes: random table bytes overwritten in the file.
  const nBreak = Math.round(num(p, 'breakingBytes'));
  if (nBreak > 0) {
    // Random zigzag positions, biased toward the low frequencies that dominate the picture.
    const keys = Array.from({ length: 64 }, (_, i) => i + rnd() * 40);
    const order = Array.from({ length: 64 }, (_, i) => i).sort((x, y) => keys[x] - keys[y]);
    const maxV = Math.max(1, num(p, 'maxRandom'));
    for (const t of tables) {
      for (let k = 0; k < Math.min(64, nBreak); k++) t[ZIGZAG[order[k]]] = 1 + Math.floor(rnd() * maxV);
    }
  }
  // Single quantization table coefficient edit (zigzag position, as stored in the DQT segment).
  const pos = Math.round(num(p, 'qtcPosition'));
  if (pos >= 0 && pos < 64) for (const t of tables) t[ZIGZAG[pos]] = Math.max(1, num(p, 'qtcValue'));
  const out = new Float32Array(256);
  for (let i = 0; i < 64; i++) out.set([lumaEnc[i], chromaEnc[i], lumaDec[i], chromaDec[i]], i * 4);
  return out;
}

/** Corruption events: scan position, DC drift (Y, Cb, Cr in 0..255 levels) and block desync shift. */
function corruptionEvents(p: ParamValues): { ev: Float32Array; ev2: Float32Array; count: number } {
  const amount = num(p, 'corruption') / 100;
  const count = amount > 0 ? Math.max(1, Math.round(amount * MAX_EVENTS)) : 0;
  const ev = new Float32Array(MAX_EVENTS * 4);
  const ev2 = new Float32Array(MAX_EVENTS * 4);
  const rnd = mulberry32(num(p, 'seed') * 104729 + 3);
  const a = Math.min(num(p, 'start'), num(p, 'end')) / 100;
  const b = Math.max(num(p, 'start'), num(p, 'end')) / 100;
  for (let i = 0; i < count; i++) {
    const pos = a + (b - a) * rnd();
    const big = rnd() < 0.3 ? 2 : 1;
    ev.set([pos, (rnd() * 2 - 1) * 26 * big, (rnd() * 2 - 1) * 20 * big, (rnd() * 2 - 1) * 20 * big], i * 4);
    const shift = rnd() < 0.55 ? Math.round((rnd() * 2 - 1) * 7) : 0;
    ev2.set([shift, rnd() * 1000, 0, 0], i * 4);
  }
  return { ev, ev2, count };
}

const COMMON = /* glsl */ `
uniform vec4 u_qtab[64];
uniform float u_jp;      // render px per JPEG px
uniform vec2 u_jsize;    // padded JPEG plane size (multiple of 8)
uniform vec2 u_outSize;  // render size
// Intermediate planes are stored top-down (row 0 = top), like a JPEG scan.
`;

export const jpegGlitch: EffectDef = {
  id: 'jpeg-glitch',
  name: 'JPEG glitch',
  category: 'Effects',
  keywords: 'jpeg glitch compression',
  params: [
    int('compression', 'Compression', 0, 100, 96),
    int('blockSize', 'Block size', 1, 16, 1),
    float('acGain', 'AC gain', -2, 2, 1),
    int('corruption', 'Corruption', 0, 100, 0, { group: 'Corruption' }),
    int('detailLoss', 'Detail loss', 0, 100, 100, { group: 'Corruption' }),
    float('start', 'Start', 0, 100, 0, 0.1, { group: 'Corruption' }),
    float('end', 'End', 0, 100, 100, 0.1, { group: 'Corruption' }),
    int('seed', 'Seed', 1, 9999, 1, { group: 'Corruption' }),
    int('breakingBytes', 'Breaking bytes', 0, 64, 0, { group: 'Quantization table' }),
    int('maxRandom', 'Max random value', 1, 255, 255, { group: 'Quantization table' }),
    float('chromaLuma', 'Chroma / luma', -1, 1, 0, 0.01, { group: 'Quantization table' }),
    int('mismatch', 'Decoder mismatch', 0, 100, 0, { group: 'Quantization table' }),
    int('qtcPosition', 'QTC position', -1, 63, -1, { group: 'Quantization table' }),
    int('qtcValue', 'QTC value', 1, 255, 16, { group: 'Quantization table' }),
    choice('qtTarget', 'Table', ['Luma', 'Chroma', 'Both'], 2, 'slider', { group: 'Quantization table' }),
    bool('stageIdct', 'Inverse DCT', true, { group: 'Decode stages' }),
    bool('stageYcc', 'YCbCr to RGB', true, { group: 'Decode stages' }),
    bool('stageDequant', 'Dequantize', true, { group: 'Decode stages' }),
  ],
  shaders: {
    // Box-filter the input into the JPEG pixel grid, convert to level-shifted YCbCr.
    down: /* glsl */ `${COMMON}
void main() {
  vec2 p = floor(gl_FragCoord.xy);
  int n = int(clamp(ceil(u_jp * 0.5), 1.0, 4.0));
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    if (j >= n) break;
    for (int i = 0; i < 4; i++) {
      if (i >= n) break;
      vec2 q = (p + (vec2(i, j) + 0.5) / float(n)) * u_jp; // render px, y from the top
      acc += texture(u_input, vec2(q.x, u_outSize.y - q.y) / u_outSize).rgb;
    }
  }
  fragColor = vec4(rgb2ycbcr(saturate(acc / float(n * n))) * 255.0 - 128.0, 1.0);
}`,
    // Forward DCT along rows.
    dctH: /* glsl */ `
uniform sampler2D u_src;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int u = p.x & 7;
  vec3 s = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    s += texelFetch(u_src, ivec2(p.x - u + i, p.y), 0).rgb * cos((2.0 * float(i) + 1.0) * float(u) * PI / 16.0);
  }
  fragColor = vec4(0.5 * (u == 0 ? 0.70710678 : 1.0) * s, 1.0);
}`,
    // Forward DCT along columns + quantization (values become integer coefficient indices).
    dctV: /* glsl */ `${COMMON}
uniform sampler2D u_src;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int v = p.y & 7;
  vec3 s = vec3(0.0);
  for (int j = 0; j < 8; j++) {
    s += texelFetch(u_src, ivec2(p.x, p.y - v + j), 0).rgb * cos((2.0 * float(j) + 1.0) * float(v) * PI / 16.0);
  }
  vec3 F = 0.5 * (v == 0 ? 0.70710678 : 1.0) * s;
  vec4 q = u_qtab[v * 8 + (p.x & 7)];
  fragColor = vec4(round(F / q.xyy), 1.0);
}`,
    // "Entropy domain": corruption of the coefficient stream, then dequantization with the decoder's table.
    coef: /* glsl */ `${COMMON}
uniform sampler2D u_src;
uniform vec4 u_ev[${MAX_EVENTS}];   // scan position (0..1), DC drift Y/Cb/Cr (levels)
uniform vec4 u_ev2[${MAX_EVENTS}];  // block shift, seed
uniform int u_evCount;
uniform vec2 u_region;
uniform float u_keepAc;
uniform float u_garbage;
const int ZZ[64] = int[](${RASTER_TO_ZZ.join(', ')});
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 nb = ivec2(u_jsize) / 8;
  ivec2 b = p / 8;
  ivec2 uv = p - b * 8;
  int ridx = uv.y * 8 + uv.x;
  int total = nb.x * nb.y;
  int k = b.y * nb.x + b.x;
  float fk = (float(k) + 0.5) / float(total);
  vec3 dc = vec3(0.0);
  int shift = 0;
  float hitSeed = -1.0;
  if (fk >= u_region.x && fk <= u_region.y) {
    for (int e = 0; e < ${MAX_EVENTS}; e++) {
      if (e >= u_evCount) break;
      if (u_ev[e].x <= fk) {
        dc += u_ev[e].yzw;
        shift += int(u_ev2[e].x);
        hitSeed = max(hitSeed, u_ev2[e].y);
      }
    }
  }
  int ks = ((k + shift) % total + total) % total;
  ivec2 sb = ivec2(ks % nb.x, ks / nb.x);
  vec3 q = texelFetch(u_src, sb * 8 + uv, 0).rgb;
  vec4 t = u_qtab[ridx];
  if (hitSeed >= 0.0) {
    // DC drift (DPCM decoding keeps adding the error), soft-limited so colors don't run away.
    if (ridx == 0) q += round(70.0 * tanh(dc / 70.0) * 8.0 / t.xyy);
    else if (float(ZZ[ridx]) >= u_keepAc) q = vec3(0.0);
    // Garbage blocks: a few low-frequency coefficients decoded from the wrong bits.
    float blk = hash13(vec3(vec2(sb), hitSeed));
    vec4 h = vec4(hash33(vec3(vec2(p), hitSeed + 1.0)), hash12(vec2(p) * 1.7 + hitSeed));
    if (blk < u_garbage && ZZ[ridx] > 0 && ZZ[ridx] < 21 && h.w < 0.35) q += round((h.xyz - 0.5) * 9.0);
  }
  vec3 F = u_stageDequant ? q * t.zww : q;
  if (ridx != 0) F *= u_acGain;
  fragColor = vec4(F, 1.0);
}`,
    // Inverse DCT along rows, evaluated at each render column (continuous position inside the block).
    idctH: /* glsl */ `${COMMON}
uniform sampler2D u_src;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float xj = (float(p.x) + 0.5) / u_jp;
  float bx = floor(xj / 8.0);
  float xl = xj - bx * 8.0 - 0.5;
  vec3 s = vec3(0.0);
  for (int u = 0; u < 8; u++) {
    vec3 F = texelFetch(u_src, ivec2(int(bx) * 8 + u, p.y), 0).rgb;
    s += (u == 0 ? 0.70710678 : 1.0) * F * cos((2.0 * xl + 1.0) * float(u) * PI / 16.0);
  }
  fragColor = vec4(0.5 * s, 1.0);
}`,
    // Inverse DCT along columns at each render pixel, level shift, YCbCr → RGB.
    main: /* glsl */ `${COMMON}
uniform sampler2D u_rows;
uniform sampler2D u_coef;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float yj = (u_outSize.y - gl_FragCoord.y) / u_jp;
  float by = floor(yj / 8.0);
  float yl = yj - by * 8.0 - 0.5;
  vec3 ycc;
  if (u_stageIdct) {
    vec3 s = vec3(0.0);
    for (int v = 0; v < 8; v++) {
      vec3 R = texelFetch(u_rows, ivec2(p.x, int(by) * 8 + v), 0).rgb;
      s += (v == 0 ? 0.70710678 : 1.0) * R * cos((2.0 * yl + 1.0) * float(v) * PI / 16.0);
    }
    ycc = 0.5 * s;
  } else {
    // Raw coefficient planes (DC shows the block average, AC around mid gray).
    vec2 j = floor(vec2((gl_FragCoord.x) / u_jp, yj));
    ycc = texelFetch(u_coef, ivec2(min(j, u_jsize - 1.0)), 0).rgb / 8.0;
  }
  ycc = (ycc + 128.0) / 255.0;
  vec3 rgb = u_stageYcc ? ycbcr2rgb(ycc) : ycc;
  fragColor = vec4(saturate(rgb), texture(u_input, v_uv).a);
}`,
    // Fallback without float render targets: blocky DC-only approximation.
    fallback: /* glsl */ `${COMMON}
void main() {
  vec2 px = vec2(gl_FragCoord.x, u_outSize.y - gl_FragCoord.y);
  vec2 blk = (floor(px / (8.0 * u_jp)) + 0.5) * 8.0 * u_jp;
  vec3 ycc = rgb2ycbcr(texture(u_input, vec2(blk.x, u_outSize.y - blk.y) / u_outSize).rgb) * 255.0 - 128.0;
  vec4 t = u_qtab[0];
  ycc = round(ycc * 8.0 / t.xyy) * t.zww / 8.0;
  fragColor = vec4(saturate(ycbcr2rgb((ycc + 128.0) / 255.0)), texture(u_input, v_uv).a);
}`,
  },
  render(ctx) {
    const p = ctx.params;
    const W = ctx.width;
    const H = ctx.height;
    // JPEG pixel size in render px; the plane is capped so tiny previews of huge block counts stay cheap.
    let jp = Math.max(0.25, num(p, 'blockSize') * ctx.pxScale);
    jp = Math.max(jp, Math.max(W, H) / 4096);
    const Wp = Math.ceil(W / jp / 8) * 8;
    const Hp = Math.ceil(H / jp / 8) * 8;
    const ev = corruptionEvents(p);
    const a = Math.min(num(p, 'start'), num(p, 'end')) / 100;
    const b = Math.max(num(p, 'start'), num(p, 'end')) / 100;
    const uniforms = {
      u_qtab: quantTables(p),
      u_jp: jp,
      u_jsize: [Wp, Hp],
      u_outSize: [W, H],
      u_ev: ev.ev,
      u_ev2: ev.ev2,
      u_evCount: ev.count,
      u_region: [a, b],
      u_keepAc: Math.round(64 * (1 - num(p, 'detailLoss') / 100)),
      u_garbage: (num(p, 'corruption') / 100) * 0.15,
    };
    if (ctx.format !== 'rgba16f') return ctx.pass('fallback', { uniforms });
    const f = 'rgba16f' as const;
    const down = ctx.pass('down', { width: Wp, height: Hp, format: f, uniforms });
    const rows = ctx.pass('dctH', { width: Wp, height: Hp, format: f, inputs: { u_src: down }, uniforms });
    ctx.release(down);
    const quant = ctx.pass('dctV', { width: Wp, height: Hp, format: f, inputs: { u_src: rows }, uniforms });
    ctx.release(rows);
    const coef = ctx.pass('coef', { width: Wp, height: Hp, format: f, inputs: { u_src: quant }, uniforms });
    ctx.release(quant);
    const idrows = ctx.pass('idctH', { width: W, height: Hp, format: f, inputs: { u_src: coef }, uniforms });
    const out = ctx.pass('main', { inputs: { u_rows: idrows, u_coef: coef }, uniforms });
    ctx.release(idrows);
    ctx.release(coef);
    return out;
  },
};
