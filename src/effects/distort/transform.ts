import type { EffectDef } from '../../engine/types';
import { angle, color, float, int, point } from '../helpers';
import { DISTORT_GLSL } from './common';

// Scale (log2: +1 = 2x larger), rotate and optionally kaleidoscope-mirror the image. The
// kaleidoscope folds the output around `output center` into 2 * axes mirrored wedges; the first
// wedge points down (rotated by `axis angle`) and samples the source around `input center`.
// Areas outside the source show the background color at the background opacity.
export const transform: EffectDef = {
  id: 'transform',
  name: 'Transform',
  category: 'Distort',
  keywords: 'flip mirror rotate scale transform',
  params: [
    point('inputCenter', 'input center', [0, 0]),
    point('outputCenter', 'output center', [0, 0]),
    float('scale', 'scale amount', -3, 3, 0.39),
    angle('rotation', 'rotation', 0, 360, 0),
    int('axes', 'symmetry axes', 0, 16, 5),
    angle('axisAngle', 'axis angle', 0, 360, 0),
    color('bgColor', 'background color', '#000000'),
    float('bgOpacity', 'background opacity', 0, 1, 0),
  ],
  shaders: {
    main: /* glsl */ `
${DISTORT_GLSL}
void main() {
  vec2 p = uvToUnit(v_uv) - uvToUnit(pointToUv(u_outputCenter));
  float n = floor(u_axes + 0.5);
  if (n > 0.5) {
    float seg = TAU / n;
    float base = radians(u_axisAngle) - 0.5 * PI;
    float a = mod(atan(p.y, p.x) - base, seg);
    a = a > 0.5 * seg ? seg - a : a;
    p = length(p) * vec2(cos(a + base), sin(a + base));
  }
  p = rot2(-radians(u_rotation)) * p * exp2(-u_scale);
  vec2 uv = unitToUv(p + uvToUnit(pointToUv(u_inputCenter)));
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec4 col = sampleWarp(u_input, uv, dx, dy);
  col.a *= uvCoverage(uv, dx, dy);
  fragColor = overStraight(col, vec4(u_bgColor, u_bgOpacity));
}`,
  },
};
