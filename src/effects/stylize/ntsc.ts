import type { EffectDef, RenderContext } from '../../engine/types';
import { float, int, num } from '../helpers';
import { REFERENCE_LONG_SIDE } from '../../engine/units';
import { textureFromFloat } from '../../engine/gl';

// Composite video (NTSC) encode → decode, simulated along each scan line:
// 1) encode: RGB → YIQ, I/Q quadrature-modulated onto a color subcarrier (0.148 cycles per reference
//    px, crawling over time) and added to luma, plus composite noise (per sample and per line of a
//    480-line raster);
// 2) decode (horizontal FIR filters): luma = Lanczos-windowed sinc low-pass of the composite (`ringing` =
//    half-length in reference px: longer = sharper cutoff with more ringing), chroma = composite ×
//    subcarrier, gaussian low-passed with sigma = 40 / `color 1` (I) and 40 / `color 2` (Q) reference px
//    (higher = more chroma detail). The same filters on the clean Y/I/Q give an artifact-free
//    reference; `fringes` scales the chroma→luma crosstalk (dot crawl, edge fringes) and `encoding` the
//    luma→chroma crosstalk (rainbow cross-color on fine detail). `smear` trails luma right (+) or left (-);
// 3) upsample, `saturation` (2 = unity, demodulation halves chroma), YIQ → RGB.
// Passes 1–2 run at a fixed working resolution (≤ 2× reference long side, rows ≤ 4096), so the look
// does not depend on the output size; filter sizes are in reference pixels.
const MAX_ROWS = 4096;
const FSC = 0.148; // subcarrier, cycles per reference pixel (≈107 cycles over a 720 px line)

const COMMON = /* glsl */ `
uniform float u_unit;      // working pixels per reference pixel
uniform vec2 u_work;       // working texture size
float lineIndex(float row) { return floor((row + 0.5) / u_work.y * 480.0); }
float frameIndex() { return floor(u_time * 29.97); }
// Subcarrier phase at working column x (pixel center). Same on every line (vertically coherent
// cross-color, as on effect.app), advancing a quarter turn per frame (dot crawl).
float carrierPhase(float x) {
  return TAU * ${FSC} * (x + 0.5) / u_unit + PI * (1.0 + 0.5 * mod(frameIndex(), 4.0));
}
`;

export const ntsc: EffectDef = {
  id: 'ntsc',
  name: 'NTSC',
  category: 'Effects',
  keywords: 'analog bleed color distortion filter ntsc retro scanlines vhs tv',
  animated: true,
  params: [
    int('ringing', 'ringing', 5, 30, 20),
    float('encoding', 'encoding', 0.5, 5, 1, 0.1),
    float('noise', 'noise', 0, 1, 0.01),
    float('saturation', 'saturation', 0, 5, 2, 0.1),
    float('smear', 'smear', -0.2, 0.2, 0),
    float('fringes', 'fringes', 1, 20, 1, 0.5),
    float('color1', 'color 1', 1, 20, 8, 0.5),
    float('color2', 'color 2', 1, 20, 11, 0.5),
  ],
  shaders: {
    encode: /* glsl */ `
${COMMON}
uniform sampler2D u_src;  // input, horizontally pre-blurred when the working res is lower
void main() {
  vec2 ij = floor(gl_FragCoord.xy);
  float v = (ij.y + 0.5) / u_work.y;
  // Box-filter the input over this working pixel's horizontal footprint.
  vec3 rgb = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float u = (ij.x + (float(k) + 0.5) / 3.0) / u_work.x;
    rgb += texture(u_src, vec2(u, v)).rgb;
  }
  vec3 yiq = rgb2yiq(saturate(rgb / 3.0));
  float ph = carrierPhase(ij.x);
  float comp = yiq.x + yiq.y * cos(ph) + yiq.z * sin(ph);
  // Composite noise on a fixed raster (1 reference px × 1/480 of the height, so it looks the same at any
  // output size): white per sample plus a little per-line level noise.
  float f = frameIndex();
  float L = lineIndex(ij.y);
  float n = (hash13(vec3(floor((ij.x + 0.5) / u_unit), L, f)) - 0.5) * 6.0 + (hash12(vec2(L, f + 7.0)) - 0.5) * 1.5;
  n *= u_noise;
  comp += n;
  // Stored range-safe for 8-bit targets: composite and luma scaled, I/Q offset.
  fragColor = vec4(comp * 0.5 + 0.25, (yiq.x + n) * 0.5 + 0.25, yiq.y * 0.8 + 0.5, yiq.z * 0.9 + 0.5);
}`,
    decode: /* glsl */ `
${COMMON}
uniform sampler2D u_enc;
uniform sampler2D u_taps;  // per-tap weights: luma, I, Q, smear (each normalized)
uniform int u_radius;      // taps on each side
uniform float u_smearMix;
void main() {
  ivec2 ij = ivec2(gl_FragCoord.xy);
  int W = int(u_work.x);
  float yd = 0.0, yc = 0.0, ys = 0.0;
  vec2 cd = vec2(0.0), cc = vec2(0.0);
  // Subcarrier at the first tap, then rotated one working pixel per tap.
  float ph0 = carrierPhase(float(ij.x - u_radius));
  vec2 rot = vec2(cos(ph0), sin(ph0));
  float dph = TAU * ${FSC} / u_unit;
  vec2 step1 = vec2(cos(dph), sin(dph));
  for (int i = 0; i < 257; i++) {
    if (i > 2 * u_radius) break;
    int x = ij.x - u_radius + i;
    // Outside the active line the signal sits above white (gives effect.app's bright, fringed edges).
    float comp = 1.6, yClean = 1.6;
    vec2 iqClean = vec2(0.0);
    if (x >= 0 && x < W) {
      vec4 e = texelFetch(u_enc, ivec2(x, ij.y), 0);
      comp = (e.x - 0.25) * 2.0;
      yClean = (e.y - 0.25) * 2.0;
      iqClean = vec2((e.z - 0.5) / 0.8, (e.w - 0.5) / 0.9);
    }
    vec4 w = texelFetch(u_taps, ivec2(i, 0), 0);
    yd += w.x * comp;
    yc += w.x * yClean;
    cd += w.yz * comp * 2.0 * rot;   // demodulate (I with cos, Q with sin)
    cc += w.yz * iqClean;
    ys += w.w * yClean;
    rot = vec2(rot.x * step1.x - rot.y * step1.y, rot.y * step1.x + rot.x * step1.y);
  }
  float y = yc + u_fringes * (yd - yc);
  vec2 iq = cc + u_encoding * (cd - cc);
  y = mix(y, ys, u_smearMix);
  fragColor = vec4(y * 0.5 + 0.25, iq.x * 0.8 + 0.5, iq.y * 0.9 + 0.5, 1.0);
}`,
    main: /* glsl */ `
uniform sampler2D u_dec;
void main() {
  vec4 src = texture(u_input, v_uv);
  vec4 d = texture(u_dec, v_uv);
  float y = (d.x - 0.25) * 2.0;
  vec2 iq = vec2((d.y - 0.5) / 0.8, (d.z - 0.5) / 0.9) * (u_saturation * 0.5);
  fragColor = vec4(yiq2rgb(vec3(y, iq)), src.a);
}`,
  },
  render(ctx: RenderContext) {
    const p = ctx.params;
    const long = Math.max(ctx.width, ctx.height);
    const workLong = Math.min(long, 2 * REFERENCE_LONG_SIDE);
    const unit = workLong / REFERENCE_LONG_SIDE;
    const W = Math.max(8, Math.round((ctx.width * workLong) / long));
    const H = Math.max(8, Math.min(ctx.height, MAX_ROWS));
    const common = { u_unit: unit, u_work: [W, H] as [number, number] };
    const footprint = ctx.width / W;
    const src = footprint > 1.5 ? ctx.blur(ctx.input, footprint * 0.4, 0) : ctx.input;
    const enc = ctx.pass('encode', { width: W, height: H, inputs: { u_src: src }, uniforms: common });
    if (src !== ctx.input) ctx.release(src);
    const f = filterTaps(num(p, 'ringing'), num(p, 'color1'), num(p, 'color2'), num(p, 'smear'), unit);
    const taps = ctx.cached(`ntsc-taps:${f.key}`, () => textureFromFloat(ctx.gl, f.data, f.data.length / 4, 1, { nearest: true }), (t) => t.dispose());
    const dec = ctx.pass('decode', {
      width: W,
      height: H,
      inputs: { u_enc: enc, u_taps: taps },
      uniforms: { ...common, u_radius: f.radius, u_smearMix: f.smearMix },
    });
    ctx.release(enc);
    const out = ctx.pass('main', { inputs: { u_dec: dec } });
    ctx.release(dec);
    return out;
  },
};

const sinc = (x: number) => (Math.abs(x) < 1e-6 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));

/**
 * Decoder FIR taps (RGBA per tap, each channel normalized to sum 1):
 * luma = Lanczos-windowed sinc cut at 0.75 × subcarrier, half-length `ringing` reference px;
 * I / Q = gaussians, sigma = 40 / color reference px (higher = more chroma detail);
 * smear = one-sided exponential tail (±8 reference px at the ends of the range).
 */
function filterTaps(ringing: number, color1: number, color2: number, smear: number, unit: number) {
  const lumaHalf = Math.max(1, ringing * unit);
  const cut = (FSC * 0.75) / unit;
  const sigI = Math.max(0.3, (40 / Math.max(0.5, color1)) * unit);
  const sigQ = Math.max(0.3, (40 / Math.max(0.5, color2)) * unit);
  const tau = smear * 40 * unit;
  const radius = Math.min(128, Math.ceil(Math.max(lumaHalf, 3 * Math.max(sigI, sigQ), Math.abs(tau) * 3)));
  const n = 2 * radius + 1;
  const data = new Float32Array(n * 4);
  const sums = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const k = i - radius;
    const w = [
      Math.abs(k) <= lumaHalf ? 2 * cut * sinc(2 * cut * k) * sinc(k / (lumaHalf + 1)) : 0,
      Math.exp((-k * k) / (2 * sigI * sigI)),
      Math.exp((-k * k) / (2 * sigQ * sigQ)),
      tau !== 0 && k * tau <= 0 ? Math.exp(-Math.abs(k) / Math.abs(tau)) : 0,
    ];
    for (let c = 0; c < 4; c++) {
      data[i * 4 + c] = w[c];
      sums[c] += w[c];
    }
  }
  for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) if (sums[c] !== 0) data[i * 4 + c] /= sums[c];
  const key = [ringing, color1, color2, smear, unit.toFixed(4)].join(',');
  return { data, radius, smearMix: Math.min(1, Math.abs(smear) / 0.2), key };
}
