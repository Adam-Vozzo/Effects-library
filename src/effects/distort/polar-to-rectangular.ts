import type { EffectDef } from '../../engine/types';
import { angle, float, point } from '../helpers';
import { DISTORT_GLSL } from './common';

// Unwraps the image around `center`: output x sweeps the angle clockwise starting at 12 o'clock,
// output y (bottom -> top) is the radius 0 -> radius (short side = 2 units). `distortion`
// bends the radial mapping (r = radius * y^exp(-distortion)); it is the exact inverse of
// Rectangular to polar with the same settings.
export const polarToRectangular: EffectDef = {
  id: 'polar-to-rectangular',
  name: 'Polar to rectangular',
  category: 'Distort',
  keywords: '360 circular distortion flat panorama polar radial rectangular transform unwrap',
  params: [
    point('center', 'center', [0, 0], { min: [-2, -2], max: [2, 2] }),
    angle('angle', 'angle', 0, 360, 0),
    float('radius', 'radius', 0, 3, 1),
    float('distortion', 'distortion', -1, 1, 0),
  ],
  shaders: {
    main: /* glsl */ `
${DISTORT_GLSL}
void main() {
  vec2 c = uvToUnit(pointToUv(u_center));
  float phi = radians(90.0 - u_angle) - TAU * v_uv.x;
  float r = u_radius * pow(max(v_uv.y, 0.0), exp(-u_distortion));
  vec2 uv = unitToUv(c + r * vec2(cos(phi), sin(phi)));
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  fragColor = sampleWarp(u_input, uv, dx, dy);
}`,
  },
};
