import type { EffectDef } from '../../engine/types';
import { bool, float } from '../helpers';

// Per-channel gain of (1 + amount) applied in a gamma-decoded space (exponent = gamma), so a
// channel at -1 is removed entirely and the display-space change is (1 + amount)^(1/gamma).
export const colorBalance: EffectDef = {
  id: 'color-balance',
  name: 'Color balance',
  category: 'Color',
  keywords: 'balance color',
  params: [
    float('red', 'red', -1, 1, 0.4),
    float('green', 'green', -1, 1, -0.7),
    float('blue', 'blue', -1, 1, -1),
    bool('keepLuma', 'keep luma', false),
    float('gamma', 'gamma', 0.2, 5, 2),
  ],
  shaders: {
    main: /* glsl */ `
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = pow(max(src.rgb, 0.0), vec3(u_gamma));
  vec3 g = c * max(1.0 + vec3(u_red, u_green, u_blue), 0.0);
  if (u_keepLuma) {
    float a = luma(c), b = luma(g);
    g = b > 1e-5 ? g * (a / b) : g;
  }
  fragColor = vec4(pow(max(g, 0.0), vec3(1.0 / u_gamma)), src.a);
}`,
  },
};
