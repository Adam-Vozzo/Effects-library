import type { EffectDef } from '../../engine/types';
import { angle, float, point } from '../helpers';
import { DISTORT_GLSL } from './common';

// Twirl whose rotation grows linearly with the distance from the center (short side = 2 units),
// optionally modulated by a radial sine wave (amplitude in radians).
export const swirl: EffectDef = {
  id: 'swirl',
  name: 'Swirl',
  category: 'Distort',
  keywords: 'swirl',
  params: [
    float('strength', 'strength', -5, 5, 0.66),
    float('frequency', 'frequency', 1, 100, 41.4, 0.1),
    float('amplitude', 'amplitude', 0, 1.5, 0),
    angle('phase', 'phase', 0, 360, 0),
    point('center', 'center', [0, 0], { min: [-2, -2], max: [2, 2] }),
  ],
  shaders: {
    main: /* glsl */ `
${DISTORT_GLSL}
void main() {
  vec2 c = uvToUnit(pointToUv(u_center));
  vec2 d = uvToUnit(v_uv) - c;
  float r = length(d);
  float a = u_strength * r + u_amplitude * sin(u_frequency * r + radians(u_phase));
  vec2 uv = unitToUv(c + rot2(a) * d);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  fragColor = sampleWarp(u_input, uv, dx, dy);
}`,
  },
};
