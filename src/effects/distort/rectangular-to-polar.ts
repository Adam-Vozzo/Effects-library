import type { EffectDef } from '../../engine/types';
import { angle, float, point } from '../helpers';
import { DISTORT_GLSL } from './common';

// Wraps the image around `center` ("tiny planet"): the source x runs clockwise from 12 o'clock,
// the source bottom edge sits at the center and the top edge at `radius` (short side = 2 units),
// with v = (r / radius)^exp(distortion). Beyond the radius the top row is repeated. `overlap`
// cross-fades the two ends of the source across the seam.
export const rectangularToPolar: EffectDef = {
  id: 'rectangular-to-polar',
  name: 'Rectangular to polar',
  category: 'Distort',
  keywords: 'circular distortion polar radial rectangular swirl transform tunnel warp',
  params: [
    point('center', 'center', [0, 0], { min: [-2, -2], max: [2, 2] }),
    angle('angle', 'angle', 0, 360, 0),
    float('radius', 'radius', 0, 3, 1),
    float('distortion', 'distortion', -1, 1, 0.2),
    float('overlap', 'overlap', 0, 0.5, 0),
  ],
  shaders: {
    main: /* glsl */ `
${DISTORT_GLSL}
void main() {
  vec2 d = uvToUnit(v_uv) - uvToUnit(pointToUv(u_center));
  float r = length(d);
  float a = fract((radians(90.0 - u_angle) - atan(d.y, d.x)) / TAU);
  float v = pow(r / max(u_radius, 1e-4), exp(u_distortion));
  float o = clamp(u_overlap, 0.0, 0.5);
  float x = a * (1.0 - o);
  vec2 uv = vec2(x, min(v, 1.0));
  // Analytic angular derivatives (dFdx of the wrapped angle would explode at the seam).
  vec2 ddx = dFdx(d), ddy = dFdy(d);
  float k = -(1.0 - o) / (TAU * max(r * r, 1e-8));
  vec2 dx = vec2((d.x * ddx.y - d.y * ddx.x) * k, dFdx(v));
  vec2 dy = vec2((d.x * ddy.y - d.y * ddy.x) * k, dFdy(v));
  vec4 col = sampleWarp(u_input, uv, dx, dy);
  if (o > 0.0) {
    // Fade the start of the source into its end (x + 1 - o) so the 12 o'clock seam disappears.
    vec4 wrap = sampleWarp(u_input, vec2(x + 1.0 - o, uv.y), dx, dy);
    col = mix(wrap, col, smoothstep(0.0, 1.0, min(x / o, 1.0)));
  }
  fragColor = col;
}`,
  },
};
