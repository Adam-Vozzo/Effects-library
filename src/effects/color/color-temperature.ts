import type { EffectDef } from '../../engine/types';
import { float } from '../helpers';

// White balance like a camera/raw "temperature" slider: higher kelvin = warmer image (it compensates
// for bluer light). Gains are kelvinToRgb(6500) / kelvinToRgb(K), mean-normalized, applied in a
// gamma-decoded space (exponent = gamma); the shadow/highlight gains are blended by the luminance
// in that space, so gamma also moves the shadow/highlight split.
export const colorTemperature: EffectDef = {
  id: 'color-temperature',
  name: 'Color temperature',
  category: 'Color',
  keywords: 'color temperature',
  params: [
    float('shadowTemperature', 'shadow temperature', 2000, 10000, 9249, 1, { unit: 'K' }),
    float('highlightTemperature', 'highlight temperature', 2000, 10000, 8026, 1, { unit: 'K' }),
    float('gamma', 'gamma', 0.5, 10, 2.2),
  ],
  shaders: {
    main: /* glsl */ `
vec3 wbGain(float k) {
  vec3 g = kelvinToRgb(6500.0) / max(kelvinToRgb(k), vec3(1e-3));
  return g / dot(g, vec3(1.0 / 3.0));
}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 lin = pow(max(src.rgb, 0.0), vec3(u_gamma));
  float w = saturate(luma(lin));
  vec3 g = mix(wbGain(u_shadowTemperature), wbGain(u_highlightTemperature), w);
  fragColor = vec4(pow(lin * g, vec3(1.0 / u_gamma)), src.a);
}`,
  },
};
