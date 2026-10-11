import type { EffectDef, RenderContext } from '../../engine/types';
import { float, int, num } from '../helpers';
import { REFERENCE_LONG_SIDE } from '../../engine/units';

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
void main() {
  vec2 ij = floor(gl_FragCoord.xy);
  float v = (ij.y + 0.5) / u_work.y;
  // Box-filter the input over this working pixel's horizontal footprint.
  vec3 rgb = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float u = (ij.x + (float(k) + 0.5) / 3.0) / u_work.x;
    rgb += texture(u_input, vec2(u, v)).rgb;
  }
  vec3 yiq = rgb2yiq(saturate(rgb / 3.0));
  float ph = carrierPhase(ij.x);
  float comp = yiq.x + yiq.y * cos(ph) + yiq.z * sin(ph);
  // Composite noise: white per sample plus a little per-line level noise.
  float f = frameIndex();
  float n = (hash13(vec3(ij, f)) - 0.5) * 6.0 + (hash12(vec2(lineIndex(ij.y), f + 7.0)) - 0.5) * 1.5;
  n *= u_noise;
  comp += n;
  // Stored range-safe for 8-bit targets: composite and luma scaled, I/Q offset.
  fragColor = vec4(comp * 0.5 + 0.25, (yiq.x + n) * 0.5 + 0.25, yiq.y * 0.8 + 0.5, yiq.z * 0.9 + 0.5);
}`,
    decode: /* glsl */ `
${COMMON}
uniform sampler2D u_enc;
uniform int u_radius;      // taps on each side
uniform float u_lumaHalf;  // luma filter half-length (working px)
uniform float u_lumaCut;   // luma cutoff (cycles per working px)
uniform float u_sigI;
uniform float u_sigQ;
uniform float u_smearTau;  // smear length (working px), signed: + trails right, - trails left
float sinc(float x) { return abs(x) < 1e-4 ? 1.0 : sin(PI * x) / (PI * x); }
void main() {
  ivec2 ij = ivec2(gl_FragCoord.xy);
  int W = int(u_work.x);
  float yd = 0.0, yc = 0.0, wy = 0.0;
  vec2 cd = vec2(0.0), cc = vec2(0.0), wc = vec2(0.0);
  float ys = 0.0, ws = 0.0;
  float sI = 1.0 / (2.0 * u_sigI * u_sigI), sQ = 1.0 / (2.0 * u_sigQ * u_sigQ);
  for (int i = 0; i < 257; i++) {
    int k = i - u_radius;
    if (k > u_radius) break;
    int x = ij.x + k;
    // Outside the active line the signal sits above white (gives effect.app's bright, fringed edges).
    float comp = 1.6, yClean = 1.6;
    vec2 iqClean = vec2(0.0);
    if (x >= 0 && x < W) {
      vec4 e = texelFetch(u_enc, ivec2(x, ij.y), 0);
      comp = (e.x - 0.25) * 2.0;
      yClean = (e.y - 0.25) * 2.0;
      iqClean = vec2((e.z - 0.5) / 0.8, (e.w - 0.5) / 0.9);
    }
    float ph = carrierPhase(float(ij.x + k));
    float fk = float(k);
    // Luma: Lanczos-windowed sinc (sharp cutoff below the subcarrier, with some ringing).
    if (abs(fk) <= u_lumaHalf) {
      float h = 2.0 * u_lumaCut * sinc(2.0 * u_lumaCut * fk) * sinc(fk / (u_lumaHalf + 1.0));
      yd += h * comp; yc += h * yClean; wy += h;
    }
    // Chroma: demodulate, gaussian low-pass.
    vec2 g = exp(-fk * fk * vec2(sI, sQ));
    cd += g * comp * 2.0 * vec2(cos(ph), sin(ph));
    cc += g * iqClean;
    wc += g;
    // Smear: one-sided exponential tail of the clean luma (taps on the upstream side).
    if (u_smearTau != 0.0 && fk * u_smearTau <= 0.0) {
      float s = exp(-abs(fk) / abs(u_smearTau));
      ys += s * yClean; ws += s;
    }
  }
  yd /= wy; yc /= wy; cd /= wc; cc /= wc;
  float y = yc + u_fringes * (yd - yc);
  vec2 iq = cc + u_encoding * (cd - cc);
  if (ws > 0.0) y = mix(y, ys / ws, min(1.0, abs(u_smearTau) / (8.0 * u_unit)));
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
    const enc = ctx.pass('encode', { width: W, height: H, uniforms: common });
    const lumaHalf = Math.max(1, num(p, 'ringing') * unit);
    // Chroma bandwidths: higher = sharper (effect.app's Q is sharper than I at 11 vs 8).
    const sigI = Math.max(0.3, (40 / Math.max(0.5, num(p, 'color1'))) * unit);
    const sigQ = Math.max(0.3, (40 / Math.max(0.5, num(p, 'color2'))) * unit);
    const smear = num(p, 'smear');
    const smearTau = smear * 40 * unit; // ±8 reference px at the ends of the range
    const radius = Math.min(128, Math.ceil(Math.max(lumaHalf, 3 * Math.max(sigI, sigQ), Math.abs(smearTau) * 3)));
    const dec = ctx.pass('decode', {
      width: W,
      height: H,
      inputs: { u_enc: enc },
      uniforms: {
        ...common,
        u_radius: radius,
        u_lumaHalf: lumaHalf,
        u_lumaCut: (FSC * 0.75) / unit,
        u_sigI: sigI,
        u_sigQ: sigQ,
        u_smearTau: smearTau,
      },
    });
    ctx.release(enc);
    const out = ctx.pass('main', { inputs: { u_dec: dec } });
    ctx.release(dec);
    return out;
  },
};
