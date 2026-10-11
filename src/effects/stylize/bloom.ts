import type { EffectDef } from '../../engine/types';
import type { Texture } from '../../engine/gl';
import { float, int } from '../helpers';
import { KNEE_GLSL } from './common-a';

// Bloom in linear light: bright-pass with a soft knee → six gaussian levels (6…192 reference px) mixed by
// `bloom factor` (low = tight glow around highlights, high = wide haze) → added (or screened) onto the
// image, optionally tone mapped.

const LEVELS = 6;
const BASE_SIGMA = 6; // reference px of the first level, doubling per level

export const TONEMAP_GLSL = /* glsl */ `
vec3 tonemap(int k, vec3 x) {
  x = max(x, 0.0);
  if (k == 1) return x / (1.0 + x);                                                     // Reinhard
  if (k == 2) { float l = luma(x); return x * (1.0 + l / 16.0) / (1.0 + l); }            // Reinhard (luminance, white 4)
  if (k == 3) return saturate((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)); // ACES (Narkowicz)
  if (k == 4) {                                                                          // ACES fitted (Hill)
    const mat3 I = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 O = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    vec3 v = I * x;
    v = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
    return saturate(O * v);
  }
  if (k == 5) {                                                                          // Filmic (Hable)
    vec3 a = ((x * 2.0) * (0.15 * x * 2.0 + 0.05) + 0.004) / ((x * 2.0) * (0.15 * x * 2.0 + 0.5) + 0.06) - 0.0667;
    const float W = 11.2;
    float w = ((W * (0.15 * W + 0.05) + 0.004) / (W * (0.15 * W + 0.5) + 0.06)) - 0.0667;
    return saturate(a / w);
  }
  if (k == 6) {                                                                          // AgX (base contrast)
    const mat3 A = mat3(0.842479, 0.0423282, 0.0423757, 0.0784336, 0.878469, 0.0784336, 0.0792237, 0.0791661, 0.879143);
    const mat3 Ai = mat3(1.196879, -0.0528969, -0.0529716, -0.0980209, 1.151903, -0.0980435, -0.0990297, -0.0989612, 1.151074);
    vec3 l = clamp(log2(max(A * x, 1e-10)), -12.47393, 4.026069);
    l = (l + 12.47393) / 16.499999;
    vec3 l2 = l * l, l4 = l2 * l2;
    vec3 y = 15.5 * l4 * l2 - 40.14 * l4 * l + 31.96 * l4 - 6.868 * l2 * l + 0.4298 * l2 + 0.1191 * l - 0.00232;
    return pow(max(Ai * y, 0.0), vec3(2.2));
  }
  if (k == 7) {                                                                          // Khronos PBR Neutral
    const float s0 = 0.76, d = 0.24, desat = 0.15;
    float m = min(x.r, min(x.g, x.b));
    x -= m < 0.08 ? m - 6.25 * m * m : 0.04;
    float p = max(x.r, max(x.g, x.b));
    if (p < s0) return x;
    float np = 1.0 - d * d / (p + d - s0);
    x *= np / p;
    float g = 1.0 - 1.0 / (desat * (p - np) + 1.0);
    return mix(x, vec3(np), g);
  }
  return x;
}
`;

export const bloom: EffectDef = {
  id: 'bloom',
  name: 'Bloom',
  category: 'Effects',
  keywords: 'bleed bloom cinematic dreamy glow highlights light soft',
  params: [
    float('threshold', 'threshold', 0.1, 2, 0.8),
    float('intensity', 'intensity', 0, 5, 1.5),
    float('knee', 'knee', 0, 2, 0.4),
    float('bloomFactor', 'bloom factor', 0, 1, 0.6),
    int('blendMode', 'blend mode', 0, 1, 0),
    int('tonemapper', 'tonemapper', 0, 7, 0),
  ],
  shaders: {
    prefilter: /* glsl */ `
${KNEE_GLSL}
void main() {
  vec2 o = 0.5 / u_resolution;
  vec3 c = srgbToLinear(texture(u_input, v_uv + vec2(-o.x, -o.y)).rgb) + srgbToLinear(texture(u_input, v_uv + vec2(o.x, -o.y)).rgb)
         + srgbToLinear(texture(u_input, v_uv + vec2(-o.x, o.y)).rgb) + srgbToLinear(texture(u_input, v_uv + vec2(o.x, o.y)).rgb);
  fragColor = vec4(kneeThreshold(c * 0.25, u_threshold, u_knee), 1.0);
}`,
    main: /* glsl */ `
${TONEMAP_GLSL}
uniform sampler2D u_b0;
uniform sampler2D u_b1;
uniform sampler2D u_b2;
uniform sampler2D u_b3;
uniform sampler2D u_b4;
uniform sampler2D u_b5;
void main() {
  vec4 src = texture(u_input, v_uv);
  // Level weights: geometric, tilting from the tight levels (factor 0) to the wide ones (factor 1).
  float r = mix(0.35, 2.2, u_bloomFactor);
  float w0 = 1.0, w1 = r, w2 = r * r, w3 = w2 * r, w4 = w3 * r, w5 = w4 * r;
  vec3 b = texture(u_b0, v_uv).rgb * w0 + texture(u_b1, v_uv).rgb * w1 + texture(u_b2, v_uv).rgb * w2
         + texture(u_b3, v_uv).rgb * w3 + texture(u_b4, v_uv).rgb * w4 + texture(u_b5, v_uv).rgb * w5;
  b *= u_intensity * 0.3 / (w0 + w1 + w2 + w3 + w4 + w5);
  vec3 c = srgbToLinear(src.rgb);
  c = u_blendMode < 0.5 ? c + b : 1.0 - (1.0 - saturate(c)) * (1.0 - saturate(b));
  c = tonemap(int(u_tonemapper + 0.5), c);
  fragColor = vec4(linearToSrgb(c), src.a);
}`,
  },
  render(ctx) {
    const hw = Math.max(1, Math.round(ctx.width / 2));
    const hh = Math.max(1, Math.round(ctx.height / 2));
    const pre = ctx.pass('prefilter', { width: hw, height: hh });
    // Sigmas in half-res texels.
    const levels: Texture[] = [];
    for (let i = 0; i < LEVELS; i++) levels.push(ctx.blur(pre, (BASE_SIGMA * Math.pow(2, i) * ctx.pxScale) / 2));
    ctx.release(pre);
    const inputs: Record<string, Texture> = {};
    levels.forEach((t, i) => (inputs[`u_b${i}`] = t));
    const out = ctx.pass('main', { inputs });
    for (const t of levels) ctx.release(t);
    return out;
  },
};
