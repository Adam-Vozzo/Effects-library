import type { EffectDef } from '../../engine/types';
import { color, float } from '../helpers';

// Each output channel interpolates start → end by the matching input channel (effect.app maps
// channels independently, which is why the reference keeps some of the image's color variation).
export const duotone: EffectDef = {
  id: 'duotone',
  name: 'Duotone',
  category: 'Color',
  keywords: 'color colorization colors glitch gradient map mapping poster',
  params: [
    color('startColor', 'start color', '#e63217'),
    color('endColor', 'end color', '#f4b642'),
    float('redGamma', 'red gamma', 0.3, 3, 1),
    float('greenGamma', 'green gamma', 0.3, 3, 1),
    float('blueGamma', 'blue gamma', 0.3, 3, 1),
  ],
  shaders: {
    main: /* glsl */ `
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 t = pow(saturate(src.rgb), vec3(u_redGamma, u_greenGamma, u_blueGamma));
  fragColor = vec4(mix(u_startColor, u_endColor, t), src.a);
}`,
  },
};
