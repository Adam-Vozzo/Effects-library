import type { EffectDef } from '../../engine/types';
import { float } from '../helpers';

// Contrast in a gamma-decoded space (exponent = gamma; 2.2 ≈ linear light): values are blended
// toward a smoothstep S-curve through the pivot by the strength (negative flattens). Output mapping
// chooses how the curve reaches the color: 0 = per channel (also boosts saturation), 1 = on luminance
// with the RGB ratios kept (effect.app's default look).
export const contrast: EffectDef = {
  id: 'contrast',
  name: 'Contrast',
  category: 'Color',
  keywords: 'contrast',
  params: [
    float('strength', 'contrast strength', -2, 2, 0.2, 0.1),
    float('pivot', 'pivot point', 0, 1, 0.5),
    float('outputMapping', 'output mapping', 0, 1, 1),
    float('gamma', 'gamma', 0.2, 5, 2.2),
  ],
  shaders: {
    main: /* glsl */ `
// Smoothstep S-curve with its fixed point (slope 1.5) at the pivot p; values above 1 pass through.
vec3 contrastCurve(vec3 x, float p) {
  vec3 xc = clamp(x, 0.0, 1.0);
  vec3 lo = 2.0 * p * smoothstep(0.0, 1.0, 0.5 * xc / p);
  vec3 hi = p + (1.0 - p) * 2.0 * (smoothstep(0.0, 1.0, 0.5 + 0.5 * (xc - p) / (1.0 - p)) - 0.5);
  vec3 s = mix(lo, hi, step(p, xc));
  return mix(xc, s, u_strength) + (x - xc);
}
void main() {
  vec4 src = texture(u_input, v_uv);
  float p = clamp(u_pivot, 0.001, 0.999);
  vec3 x = pow(max(src.rgb, 0.0), vec3(u_gamma));
  float y = luma(x);
  float yc = contrastCurve(vec3(y), p).x;
  vec3 viaLuma = x * (y > 1e-6 ? max(yc, 0.0) / y : 1.0);
  vec3 perChannel = contrastCurve(x, p);
  vec3 o = mix(perChannel, viaLuma, u_outputMapping);
  fragColor = vec4(pow(max(o, 0.0), vec3(1.0 / u_gamma)), src.a);
}`,
  },
};
