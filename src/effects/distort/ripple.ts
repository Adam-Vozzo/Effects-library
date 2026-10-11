import type { EffectDef } from '../../engine/types';
import { angle, float, point } from '../helpers';
import { DISTORT_GLSL } from './common';

// Concentric sine ripples displacing the image radially (amplitude/frequency in short-side units,
// short side = 2). The wave travels outward at `animation speed` cycles per second. Dispersion
// scales the displacement per channel for rainbow fringes along the folds.
export const ripple: EffectDef = {
  id: 'ripple',
  name: 'Ripple',
  category: 'Distort',
  keywords: 'distortion liquid motion ripple water wave',
  animated: true,
  params: [
    float('amplitude', 'amplitude', 0, 0.2, 0.035, 0.001),
    float('frequency', 'frequency', 0, 200, 50),
    angle('phase', 'phase', 0, 360, 0),
    point('center', 'center', [0, 0], { min: [-2, -2], max: [2, 2] }),
    float('speed', 'animation speed', -10, 10, 0.8),
    float('dispersion', 'dispersion', 0, 1, 0, 0.001),
  ],
  shaders: {
    main: /* glsl */ `
${DISTORT_GLSL}
void main() {
  vec2 c = uvToUnit(pointToUv(u_center));
  vec2 d = uvToUnit(v_uv) - c;
  float r = length(d);
  vec2 dir = r > 1e-6 ? d / r : vec2(0.0);
  float w = u_amplitude * sin(u_frequency * r - radians(u_phase) - TAU * u_speed * u_time);
  vec2 uv = unitToUv(c + d + dir * w);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec4 col = sampleWarp(u_input, uv, dx, dy);
  if (u_dispersion > 0.0) {
    // Red refracts least, blue most.
    vec2 off = (unitToUv(c + d + dir * w * (1.0 + 0.6 * u_dispersion)) - uv);
    col.r = sampleWarp(u_input, uv - off, dx, dy).r;
    col.b = sampleWarp(u_input, uv + off, dx, dy).b;
  }
  fragColor = col;
}`,
  },
};
