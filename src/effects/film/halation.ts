import type { EffectDef } from '../../engine/types';
import { float, num } from '../helpers';

// Halation: light that passes the emulsion, reflects off the film base and re-exposes the red layer,
// leaving a red/orange halo around bright highlights. Passes: highlight extraction (soft knee on display
// luminance, boosted) -> tight + wide gaussian diffusion in linear light -> tinted, compensated add.
export const halation: EffectDef = {
  id: 'halation',
  name: 'Halation',
  category: 'Film',
  keywords: 'analog film halation glow bloom highlight halo lens vintage',
  params: [
    float('threshold', 'Threshold', 0, 1, 0.6),
    float('knee', 'Knee', 0.01, 0.8, 0.25),
    float('boost', 'Boost', 0, 1, 0.5),
    float('localDiffusion', 'Local Diffusion', 0.005, 0.2, 0.04, 0.005, { hint: 'Radius of the tight halo, relative to the image size' }),
    float('globalDiffusion', 'Global Diffusion', 0, 0.4, 0.12, 0.005, { hint: 'Radius of the wide glow, relative to the image size' }),
    float('intensity', 'Intensity', 0, 1, 0.7),
    float('hue', 'Hue', 0, 1, 0.5, 0.01, { hint: '0.5 = red; lower toward magenta, higher toward orange/yellow' }),
    float('backgroundGain', 'Background Gain', 0, 1, 0.85, 0.01, { hint: 'Strength of the wide glow' }),
    float('compensation', 'Compensation', 0, 1, 0.5, 0.01, { hint: 'Holds the halo back on already bright pixels (0 = plain add, 1 = screen)' }),
  ],
  shaders: {
    extract: /* glsl */ `
void main() {
  vec3 c = clamp(texture(u_input, v_uv).rgb, 0.0, 1.0);
  float l = luma(c);
  float k = max(u_knee, 1e-3);
  float x = l - u_threshold;
  float soft = clamp(x + k, 0.0, 2.0 * k);
  float e = max(soft * soft / (4.0 * k), x); // soft-knee excess above the threshold
  // Linear-light energy of the part above the threshold; Boost expands the brightest highlights.
  float energy = srgbToLinear(vec3(l)).x * (e / max(l, 1e-4)) * (1.0 + 8.0 * u_boost * e);
  fragColor = vec4(vec3(max(energy, 0.0)), 1.0);
}`,
    composite: /* glsl */ `
uniform sampler2D u_local;
uniform sampler2D u_global;
uniform float u_globalW;
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 lin = srgbToLinear(clamp(src.rgb, 0.0, 1.0));
  float h = 1.35 * texture(u_local, v_uv).r + u_globalW * texture(u_global, v_uv).r;
  vec3 tint = srgbToLinear(hue2rgb(fract(u_hue + 0.5)));
  vec3 add = tint * h * u_intensity * 0.29;
  lin += add * (1.0 - u_compensation * clamp(lin, 0.0, 1.0));
  fragColor = vec4(linearToSrgb(lin), src.a);
}`,
  },
  render(ctx) {
    const long = Math.max(ctx.width, ctx.height);
    const ex = ctx.pass('extract');
    const local = ctx.blur(ex, 0.19 * num(ctx.params, 'localDiffusion') * long);
    const gd = num(ctx.params, 'globalDiffusion');
    const global = gd > 0 ? ctx.blur(ex, 0.28 * gd * long) : null;
    ctx.release(ex);
    const out = ctx.pass('composite', {
      inputs: { u_local: local, u_global: global ?? local },
      uniforms: { u_globalW: global ? 1.57 * num(ctx.params, 'backgroundGain') : 0 },
    });
    ctx.release(local);
    if (global) ctx.release(global);
    return out;
  },
};
