import type { EffectDef } from '../../engine/types';
import { float, gradient, int } from '../helpers';
import { evalGradientOklch } from './color-math';

// Luma → gradient lookup. Like effect.app, the gradient is interpolated in OKLCh (shortest hue arc,
// achromatic stops at hue 0), so the default red → black → blue passes through dark magenta/violet.
// The param's evaluator makes both the LUT and the editor preview use that interpolation.
export const gradientMap: EffectDef = {
  id: 'gradient-map',
  name: 'Gradient map',
  category: 'Color',
  keywords: 'gradient gradient map',
  params: [
    gradient('gradientMap', 'Gradient map', [
      { pos: 0, color: '#ff0000', mid: 0.5 },
      { pos: 0.5, color: '#000000', mid: 0.5 },
      { pos: 1, color: '#0080ff', mid: 0.5 },
    ], { evaluate: evalGradientOklch }),
    float('gradientShift', 'Gradient shift', -1, 1, 0),
    int('gradientRepeat', 'Gradient repeat', 1, 8, 1),
  ],
  shaders: {
    main: /* glsl */ `
void main() {
  vec4 src = texture(u_input, v_uv);
  float x = saturate(luma(src.rgb)) * u_gradientRepeat + u_gradientShift;
  // Wrap into (0, 1] for positive values so pure white keeps the last stop.
  float t = x > 0.0 ? x - ceil(x) + 1.0 : x - floor(x);
  fragColor = vec4(lut3(u_gradientMap, t), src.a);
}`,
  },
};
