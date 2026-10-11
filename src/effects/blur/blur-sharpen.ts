import type { EffectDef } from '../../engine/types';
import { float, num } from '../helpers';

// Small-radius blur (blurriness > 0) or unsharp-mask sharpening (blurriness < 0).
// threshold: largest local difference that is fully processed (lower = edge-preserving blur /
// halo-free sharpening). ringing: allowed overshoot past the local min/max when sharpening.
const SIGMA_REF = 1; // kernel sigma in reference px

export const blurSharpen: EffectDef = {
  id: 'blur-sharpen',
  name: 'Blur/sharp',
  category: 'Blur',
  keywords: 'blur sharp',
  params: [
    float('blurriness', 'blurriness', -5, 1, -5),
    float('threshold', 'threshold', 0, 1, 1, 0.001),
    float('ringing', 'ringing', 0, 1, 0.2),
  ],
  shaders: {
    main: /* glsl */ `
uniform sampler2D u_blurred;
uniform float u_spacing; // neighbourhood spacing for the ringing clamp (px)
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = src.rgb;
  vec3 d = texture(u_blurred, v_uv).rgb - c;
  // Threshold: limit the change at strong edges (1 = no limit).
  float mag = max(max(abs(d.r), abs(d.g)), abs(d.b));
  if (u_threshold < 1.0) d *= min(1.0, u_threshold / max(mag, 1e-5));
  float k = u_blurriness < 0.0 ? 0.6 * u_blurriness : u_blurriness;
  vec3 o = c + k * d;
  if (k < 0.0) {
    vec2 st = u_spacing / u_resolution;
    vec3 lo = c, hi = c;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec3 s = texture(u_input, v_uv + vec2(x, y) * st).rgb;
        lo = min(lo, s);
        hi = max(hi, s);
      }
    vec3 r = (hi - lo) * u_ringing;
    o = clamp(o, lo - r, hi + r);
  }
  fragColor = vec4(o, src.a);
}`,
  },
  render(ctx) {
    // Blurring widens the kernel as blurriness approaches 1; keep >= half a pixel for small previews.
    const b = num(ctx.params, 'blurriness');
    const sigma = Math.max(0.5, SIGMA_REF * (1 + 2 * Math.max(0, b)) * ctx.pxScale);
    const blurred = ctx.blur(ctx.input, sigma);
    const out = ctx.pass('main', { inputs: { u_blurred: blurred }, uniforms: { u_spacing: Math.max(1, sigma) } });
    ctx.release(blurred);
    return out;
  },
};
