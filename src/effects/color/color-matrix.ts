import type { EffectDef } from '../../engine/types';
import { float } from '../helpers';

// 3x3 channel mixing matrix plus offsets, applied to the display (sRGB) values.
export const colorMatrix: EffectDef = {
  id: 'color-matrix',
  name: 'Color matrix',
  category: 'Color',
  keywords: 'cinematic color grading manipulation matrix transform',
  params: [
    float('redFromRed', 'Red from Red', -2, 2, -0.5),
    float('redFromGreen', 'Red from Green', -2, 2, 1.6),
    float('redFromBlue', 'Red from Blue', -2, 2, 0.33),
    float('greenFromRed', 'Green from Red', -2, 2, -0.75),
    float('greenFromGreen', 'Green from Green', -2, 2, -1.4),
    float('greenFromBlue', 'Green from Blue', -2, 2, 1.8),
    float('blueFromRed', 'Blue from Red', -2, 2, 0.8),
    float('blueFromGreen', 'Blue from Green', -2, 2, -1),
    float('blueFromBlue', 'Blue from Blue', -2, 2, 1),
    float('redOffset', 'Red Offset', -2, 2, 1.35),
    float('greenOffset', 'Green Offset', -2, 2, 1.3),
    float('blueOffset', 'Blue Offset', -2, 2, -0.2),
  ],
  shaders: {
    main: /* glsl */ `
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = src.rgb;
  vec3 o = vec3(
    dot(c, vec3(u_redFromRed, u_redFromGreen, u_redFromBlue)),
    dot(c, vec3(u_greenFromRed, u_greenFromGreen, u_greenFromBlue)),
    dot(c, vec3(u_blueFromRed, u_blueFromGreen, u_blueFromBlue))) + vec3(u_redOffset, u_greenOffset, u_blueOffset);
  fragColor = vec4(saturate(o), src.a);
}`,
  },
};
