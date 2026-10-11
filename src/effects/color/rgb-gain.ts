import type { EffectDef } from '../../engine/types';
import { float } from '../helpers';

// Per channel: gain pivoting around the midpoint, then a gamma (> 1 brightens).
export const rgbGain: EffectDef = {
  id: 'rgb-gain',
  name: 'RGB Gain',
  category: 'Color',
  keywords: 'gain rgb',
  params: [
    float('redMidpoint', 'red midpoint', 0, 1, 0),
    float('greenMidpoint', 'green midpoint', 0, 1, 0),
    float('blueMidpoint', 'blue midpoint', 0, 1, 0),
    float('redGain', 'red gain', 0, 5, 1),
    float('greenGain', 'green gain', 0, 5, 1),
    float('blueGain', 'blue gain', 0, 5, 1),
    float('redGamma', 'red gamma', 0.2, 5, 1),
    float('greenGamma', 'green gamma', 0.2, 5, 1),
    float('blueGamma', 'blue gamma', 0.2, 5, 1),
  ],
  shaders: {
    main: /* glsl */ `
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 mid = vec3(u_redMidpoint, u_greenMidpoint, u_blueMidpoint);
  vec3 c = (src.rgb - mid) * vec3(u_redGain, u_greenGain, u_blueGain) + mid;
  c = pow(max(c, 0.0), 1.0 / vec3(u_redGamma, u_greenGamma, u_blueGamma));
  fragColor = vec4(c, src.a);
}`,
  },
};
