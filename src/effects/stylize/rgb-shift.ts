import type { EffectDef } from '../../engine/types';
import { float, point } from '../helpers';

// Lateral chromatic aberration: red and blue are re-sampled with an axis-aligned stretch about the
// aberration center while green stays put. `stretch ratio` is log-anisotropy: the horizontal stretch is
// scaled by e^s and the vertical one by e^-s (0 = radial zoom, + = horizontal, - = vertical smear).
// Matches effect.app's default: 7.3% horizontal / 0.5% vertical magnification about the left edge.
export const rgbShift: EffectDef = {
  id: 'rgb-shift',
  name: 'RGB Shift',
  category: 'Effects',
  keywords: 'aberration channel chromatic color glitch look retro rgb shift vhs tv',
  params: [
    float('redOffset', 'red offset', -0.2, 0.2, 0.2, 0.001),
    float('blueOffset', 'blue offset', -0.2, 0.2, 0.2, 0.001),
    float('stretch', 'stretch ratio', -2, 2, 1.3),
    point('center', 'aberration center', [-1, 0]),
  ],
  shaders: {
    main: /* glsl */ `
void main() {
  vec2 c = pointToUv(u_center);
  vec2 k = 0.1 * vec2(exp(u_stretch), exp(-u_stretch));
  vec2 d = v_uv - c;
  vec4 g = texture(u_input, v_uv);
  float r = texture(u_input, c + d * (1.0 + u_redOffset * k)).r;
  float b = texture(u_input, c + d * (1.0 + u_blueOffset * k)).b;
  fragColor = vec4(r, g.g, b, g.a);
}`,
  },
};
