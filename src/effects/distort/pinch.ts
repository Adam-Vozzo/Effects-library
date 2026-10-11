import type { EffectDef } from '../../engine/types';
import { float, point } from '../helpers';
import { DISTORT_GLSL } from './common';

// Radial bulge/pinch: inside `radius` (short side = 2 units) the sampling radius is scaled by
// 1 - strength * (1 - d / radius)^2, so positive strength magnifies the center, negative shrinks it.
export const pinch: EffectDef = {
  id: 'pinch',
  name: 'Pinch',
  category: 'Distort',
  keywords: 'pinch',
  params: [
    float('strength', 'strength', -1, 1, 0.4),
    float('radius', 'radius', 0.01, 2, 1.5),
    point('center', 'center', [0.1, 0], { min: [-2, -2], max: [2, 2] }),
  ],
  shaders: {
    main: /* glsl */ `
${DISTORT_GLSL}
void main() {
  vec2 c = uvToUnit(pointToUv(u_center));
  vec2 d = uvToUnit(v_uv) - c;
  float t = min(length(d) / max(u_radius, 1e-4), 1.0);
  float k = 1.0 - u_strength * (1.0 - t) * (1.0 - t);
  vec2 uv = unitToUv(c + d * k);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  fragColor = sampleWarp(u_input, uv, dx, dy);
}`,
  },
};
