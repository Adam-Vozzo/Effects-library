import type { EffectDef, ParamValues, PatternsParam } from '../../engine/types';
import { textureFromData, type Texture } from '../../engine/gl';
import { choice, color, float, int, num } from '../helpers';

// 1-bit MacPaint look. The image is reduced to a `Bitmap width` × (proportional) bitmap, softened /
// sharpened, then every bitmap pixel picks the tone level (paper, a selected 8×8 pattern or solid ink)
// whose ink coverage best matches the target coverage. Optional contour lines from a Sobel edge pass. The bitmap is shown with crisp
// (anti-aliased) pixel edges at any render size.
// Lookups only use texture() at texel centres, with sizes passed as uniforms (no texelFetch, textureSize or
// integer maths): the texelFetch version rendered nothing but the paper colour in a user's Firefox.

/** The 38 classic QuickDraw / MacPaint fill patterns (8 rows of 8 bits, set bit = ink), light → dark. */
export const MACPAINT_PATTERNS: number[][] = [
  [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  [0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  [0x80, 0x00, 0x08, 0x00, 0x80, 0x00, 0x08, 0x00],
  [0x80, 0x40, 0x20, 0x00, 0x02, 0x04, 0x08, 0x00],
  [0x40, 0xa0, 0x00, 0x00, 0x04, 0x0a, 0x00, 0x00],
  [0x80, 0x10, 0x02, 0x20, 0x01, 0x08, 0x40, 0x04],
  [0x88, 0x00, 0x22, 0x00, 0x88, 0x00, 0x22, 0x00],
  [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80],
  [0xaa, 0x00, 0x80, 0x00, 0x88, 0x00, 0x80, 0x00],
  [0x08, 0x1c, 0x22, 0xc1, 0x80, 0x01, 0x02, 0x04],
  [0x03, 0x84, 0x48, 0x30, 0x0c, 0x02, 0x01, 0x01],
  [0x20, 0x50, 0x88, 0x88, 0x88, 0x88, 0x05, 0x02],
  [0x88, 0x14, 0x22, 0x41, 0x88, 0x00, 0xaa, 0x00],
  [0x82, 0x44, 0x39, 0x44, 0x82, 0x01, 0x01, 0x01],
  [0xff, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80],
  [0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88],
  [0x55, 0xa0, 0x40, 0x40, 0x55, 0x0a, 0x04, 0x04],
  [0x88, 0x22, 0x88, 0x22, 0x88, 0x22, 0x88, 0x22],
  [0xaa, 0x00, 0xaa, 0x00, 0xaa, 0x00, 0xaa, 0x00],
  [0x11, 0x22, 0x44, 0x88, 0x11, 0x22, 0x44, 0x88],
  [0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00],
  [0x00, 0x08, 0x14, 0x2a, 0x55, 0x2a, 0x14, 0x08],
  [0x80, 0x80, 0x41, 0x3e, 0x08, 0x08, 0x14, 0xe3],
  [0x10, 0x20, 0x54, 0xaa, 0xff, 0x02, 0x04, 0x08],
  [0xff, 0x80, 0x80, 0x80, 0xff, 0x08, 0x08, 0x08],
  [0xb1, 0x30, 0x03, 0x1b, 0xd8, 0xc0, 0x0c, 0x8d],
  [0xff, 0x88, 0x88, 0x88, 0xff, 0x88, 0x88, 0x88],
  [0xf8, 0x74, 0x22, 0x47, 0x8f, 0x17, 0x22, 0x71],
  [0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55],
  [0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa, 0xaa],
  [0xff, 0x00, 0xff, 0x00, 0xff, 0x00, 0xff, 0x00],
  [0xbf, 0x00, 0xbf, 0xbf, 0xb0, 0xb0, 0xb0, 0xb0],
  [0x77, 0x89, 0x8f, 0x8f, 0x77, 0x98, 0xf8, 0xf8],
  [0xdd, 0x77, 0xdd, 0x77, 0xdd, 0x77, 0xdd, 0x77],
  [0x55, 0xff, 0x55, 0xff, 0x55, 0xff, 0x55, 0xff],
  [0xee, 0xdd, 0xbb, 0x77, 0xee, 0xdd, 0xbb, 0x77],
  [0xdd, 0xff, 0x77, 0xff, 0xdd, 0xff, 0x77, 0xff],
  [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
];

// effect.app highlights these 8 swatches (the regular gray ramp) and its default render uses exactly them
// (e.g. the 50 % checkerboard), so they are the default selection.
const DEFAULT_SELECTION = [0, 2, 6, 17, 28, 33, 36, 37];

const patternsParam: PatternsParam = {
  type: 'patterns',
  key: 'patterns',
  label: 'Patterns',
  patterns: MACPAINT_PATTERNS,
  default: DEFAULT_SELECTION.map(String),
};

const bitsOf = (p: number[]) => p.reduce((s, row) => s + ((row & 0xff).toString(2).split('1').length - 1), 0);

/**
 * Tone levels = paper, the selected patterns sorted by ink coverage, solid ink; packed side by side
 * (8 px per level, rows top-down → GL bottom-up). A 256-entry LUT maps a target ink coverage to the level
 * with the nearest coverage; levels sharing a coverage split that coverage's interval, so every selected
 * pattern is used.
 */
function patternAtlas(gl: WebGL2RenderingContext, p: ParamValues): { tex: Texture; lut: Texture; levels: number } {
  const sel = ((p.patterns as string[] | undefined) ?? [])
    .map((s) => parseInt(s, 10))
    .filter((i, k, a) => i >= 0 && i < MACPAINT_PATTERNS.length && a.indexOf(i) === k)
    .sort((a, b) => bitsOf(MACPAINT_PATTERNS[a]) - bitsOf(MACPAINT_PATTERNS[b]) || a - b);
  const levels = [MACPAINT_PATTERNS[0], ...sel.map((i) => MACPAINT_PATTERNS[i]), MACPAINT_PATTERNS[MACPAINT_PATTERNS.length - 1]];
  const n = levels.length;
  const data = new Uint8Array(8 * n * 8 * 4);
  levels.forEach((pat, k) => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const on = (pat[r] >> (7 - c)) & 1;
        const o = ((7 - r) * 8 * n + k * 8 + c) * 4;
        data[o] = data[o + 1] = data[o + 2] = on ? 255 : 0;
        data[o + 3] = 255;
      }
    }
  });
  const cov = levels.map((pat) => bitsOf(pat) / 64);
  const uniq = [...new Set(cov)].sort((a, b) => a - b);
  const lut = new Uint8Array(256 * 4);
  for (let x = 0; x < 256; x++) {
    const c = x / 255;
    let j = 0;
    for (let k = 1; k < uniq.length; k++) if (Math.abs(uniq[k] - c) < Math.abs(uniq[j] - c)) j = k;
    const lo = j > 0 ? (uniq[j - 1] + uniq[j]) / 2 : 0;
    const hi = j < uniq.length - 1 ? (uniq[j] + uniq[j + 1]) / 2 : 1;
    const same = cov.map((v, i) => (v === uniq[j] ? i : -1)).filter((i) => i >= 0);
    const f = hi > lo ? (c - lo) / (hi - lo) : 0;
    const lvl = same[Math.min(same.length - 1, Math.floor(f * same.length))];
    lut[x * 4] = lvl;
    lut[x * 4 + 3] = 255;
  }
  return { tex: textureFromData(gl, data, 8 * n, 8, { nearest: true }), lut: textureFromData(gl, lut, 256, 1, { nearest: true }), levels: n };
}

export const macpaint: EffectDef = {
  id: 'macpaint',
  name: 'MacPaint',
  category: 'Effects',
  keywords: 'macpaint pixel retro style terminal text',
  params: [
    patternsParam,
    int('bitmapWidth', 'Bitmap width', 32, 4096, 342),
    float('threshold', 'Threshold', 0, 1, 0.354, 0.001),
    float('contrast', 'Contrast', 0.1, 4, 2.5),
    float('grain', 'Grain', 0, 1, 0),
    int('smooth', 'Smooth', 0, 3, 1),
    float('sharpen', 'Sharpen', -1, 2, -0.83),
    float('radius', 'Radius', 0.5, 5, 1.2, 0.1),
    choice('edgeMode', 'Edges', ['Off', 'Ink', 'Shade'], 1, 'slider'),
    float('edgeThreshold', 'Edge threshold', 0.01, 1, 0.1),
    float('edgeWidth', 'Edge width', 0.5, 3, 1.1, 0.1),
    color('ink', 'Ink', '#0f0f12'),
    color('paper', 'Paper', '#f7f5eb'),
    float('blend', 'Blend', 0, 1, 1),
  ],
  shaders: {
    // Box-filter the image down to the bitmap; luminance in r.
    down: /* glsl */ `
uniform vec2 u_outSize;
void main() {
  vec2 cell = u_outSize / u_resolution; // render px per bitmap px
  vec2 p0 = floor(gl_FragCoord.xy) * cell;
  int n = int(clamp(ceil(max(cell.x, cell.y) * 0.5), 1.0, 4.0));
  float acc = 0.0;
  for (int j = 0; j < 4; j++) {
    if (j >= n) break;
    for (int i = 0; i < 4; i++) {
      if (i >= n) break;
      acc += luma(texture(u_input, (p0 + (vec2(i, j) + 0.5) / float(n) * cell) / u_outSize).rgb);
    }
  }
  fragColor = vec4(vec3(saturate(acc / float(n * n))), 1.0);
}`,
    // Unsharp mask, tone curve and Sobel edges at bitmap resolution: r = tone (1 = paper), g = edge strength.
    tone: /* glsl */ `
uniform sampler2D u_soft;
uniform sampler2D u_wide;
float L(vec2 o) { return texture(u_soft, (gl_FragCoord.xy + o) / u_resolution).r; }
void main() {
  float s = L(vec2(0.0));
  float w = texture(u_wide, v_uv).r;
  float l = s + u_sharpen * (s - w);
  float t = (l - u_threshold) * u_contrast + 0.5;
  if (u_grain > 0.0) t += (hash12(gl_FragCoord.xy + 17.0) - 0.5) * u_grain;
  float gx = L(vec2(1, -1)) + 2.0 * L(vec2(1, 0)) + L(vec2(1, 1)) - L(vec2(-1, -1)) - 2.0 * L(vec2(-1, 0)) - L(vec2(-1, 1));
  float gy = L(vec2(-1, 1)) + 2.0 * L(vec2(0, 1)) + L(vec2(1, 1)) - L(vec2(-1, -1)) - 2.0 * L(vec2(0, -1)) - L(vec2(1, -1));
  float e = length(vec2(gx, gy)) * 0.25;
  fragColor = vec4(t, e, 0.0, 1.0);
}`,
    // Pattern / edge decision per bitmap pixel: r = 1 for ink.
    bits: /* glsl */ `
uniform sampler2D u_tone;
uniform sampler2D u_pat;
uniform sampler2D u_lut;
uniform float u_levels; // tone levels in the atlas, 8 px each
float levelFor(float coverage) {
  float i = floor(saturate(coverage) * 255.0 + 0.5);
  return floor(texture(u_lut, vec2((i + 0.5) / 256.0, 0.5)).r * 255.0 + 0.5);
}
vec2 toneAt(vec2 px) { return texture(u_tone, (px + 0.5) / u_resolution).rg; }
void main() {
  vec2 p = floor(gl_FragCoord.xy);
  float cover = 1.0 - toneAt(p).x;
  float k = levelFor(cover);
  // Edges: dilate the thresholded edge map by the edge width.
  bool edge = false;
  if (u_edgeMode > 0) {
    float r2 = (u_edgeWidth - 0.5) * (u_edgeWidth - 0.5) + 0.01;
    for (int j = -3; j <= 3; j++) {
      for (int i = -3; i <= 3; i++) {
        vec2 o = vec2(i, j);
        if (dot(o, o) <= r2 && toneAt(clamp(p + o, vec2(0.0), u_resolution - 1.0)).g > u_edgeThreshold) edge = true;
      }
    }
  }
  if (edge) k = u_edgeMode == 1 ? u_levels - 1.0 : levelFor(cover + 0.35);
  // Patterns are anchored to the bitmap's top-left corner.
  vec2 tp = vec2(p.x, u_resolution.y - 1.0 - p.y);
  vec2 texel = vec2(k * 8.0 + mod(tp.x, 8.0), 7.0 - mod(tp.y, 8.0));
  float ink = texture(u_pat, (texel + 0.5) / vec2(u_levels * 8.0, 8.0)).r;
  fragColor = vec4(ink, 0.0, 0.0, 1.0);
}`,
    main: /* glsl */ `
uniform sampler2D u_bits;
uniform vec2 u_bitsSize;
void main() {
  vec4 src = texture(u_input, v_uv);
  vec2 size = u_bitsSize;
  vec2 s = u_resolution / size; // render px per bitmap px
  float ink;
  if (min(s.x, s.y) >= 1.0) {
    // Sharp-bilinear upscale: crisp bitmap pixels with a one-pixel anti-aliased edge.
    vec2 f = v_uv * size - 0.5;
    vec2 fr = saturate((fract(f) - 0.5) * s + 0.5);
    ink = texture(u_bits, (floor(f) + fr + 0.5) / size).r;
  } else {
    // Bitmap finer than the render: box-filter the footprint (up to 8×8 bilinear taps).
    vec2 foot = 1.0 / u_resolution;
    int n = int(clamp(ceil(0.5 / min(s.x, s.y)), 1.0, 8.0));
    ink = 0.0;
    for (int j = 0; j < 8; j++) {
      if (j >= n) break;
      for (int i = 0; i < 8; i++) {
        if (i >= n) break;
        ink += texture(u_bits, v_uv + ((vec2(i, j) + 0.5) / float(n) - 0.5) * foot).r;
      }
    }
    ink /= float(n * n);
  }
  vec3 c = mix(u_paper, u_ink, ink);
  fragColor = vec4(mix(src.rgb, c, u_blend), src.a);
}`,
  },
  render(ctx) {
    const p = ctx.params;
    const W = ctx.width;
    const H = ctx.height;
    const bw = Math.max(8, Math.round(num(p, 'bitmapWidth')));
    const bh = Math.max(8, Math.round((H * bw) / W));
    const key = 'pat:' + ((p.patterns as string[] | undefined) ?? []).join(',');
    const atlas = ctx.cached(key, () => patternAtlas(ctx.gl, p), (a) => (a.tex.dispose(), a.lut.dispose()));
    const down = ctx.pass('down', { width: bw, height: bh, uniforms: { u_outSize: [W, H] } });
    const smooth = ctx.blur(down, num(p, 'smooth') * 0.6);
    ctx.release(down);
    const wide = ctx.blur(smooth, num(p, 'radius'));
    const tone = ctx.pass('tone', { width: bw, height: bh, inputs: { u_soft: smooth, u_wide: wide } });
    ctx.release(smooth);
    ctx.release(wide);
    const bits = ctx.pass('bits', { width: bw, height: bh, inputs: { u_tone: tone, u_pat: atlas.tex, u_lut: atlas.lut }, uniforms: { u_levels: atlas.levels } });
    ctx.release(tone);
    const out = ctx.pass('main', { inputs: { u_bits: bits }, uniforms: { u_bitsSize: [bw, bh] } });
    ctx.release(bits);
    return out;
  },
};
