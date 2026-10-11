import type { EffectDef } from '../../engine/types';
import { bool, color, float } from '../helpers';

// Weighted channel mix on the display (sRGB) values, multiplied by a tint color.
export const monochrome: EffectDef = {
  id: 'monochrome',
  name: 'Monochrome',
  category: 'Color',
  keywords: 'monochrome',
  params: [
    float('redWeight', 'red weight', -1, 2, 0.683, 0.001),
    float('greenWeight', 'green weight', -1, 2, 1.155, 0.001),
    float('blueWeight', 'blue weight', -1, 2, 0.199, 0.001),
    bool('normalizeWeights', 'normalize weights', true),
    color('tintColor', 'tint color', '#ffffff'),
  ],
  shaders: {
    main: /* glsl */ `
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 w = vec3(u_redWeight, u_greenWeight, u_blueWeight);
  if (u_normalizeWeights) {
    float s = w.r + w.g + w.b;
    if (abs(s) > 1e-4) w /= s;
  }
  float y = max(dot(src.rgb, w), 0.0);
  fragColor = vec4(vec3(y) * u_tintColor, src.a);
}`,
  },
};
