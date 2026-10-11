import type { EffectDef } from '../../engine/types';
import { choice, curve } from '../helpers';

// Master RGB curve followed by per-channel curves (display values). The apply mode mirrors
// effect.app's N / C / L switch: Normal, Color (curve colors on the original luminosity) and
// Luminosity (only the luminosity change, original colors kept).
export const curves: EffectDef = {
  id: 'curves',
  name: 'Curves',
  category: 'Color',
  keywords: 'color contrast control curve curves grading highlight rgb shadow tone',
  params: [
    choice('applyMode', 'apply mode', ['Normal', 'Color', 'Luminosity'], 0, 'switcher'),
    curve('rgbCurve', 'RGB curve', [[0, 0], [1, 1]], { color: '#e6e6e6' }),
    curve('redCurve', 'Red channel', [[0, 0], [1, 1]], { color: '#ff5a5a' }),
    curve('greenCurve', 'Green channel', [[0, 0], [1, 1]], { color: '#4fd16b' }),
    curve('blueCurve', 'Blue channel', [[0, 0], [1, 1]], { color: '#4f8dff' }),
  ],
  shaders: {
    main: /* glsl */ `
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = saturate(src.rgb);
  vec3 m = vec3(lut1(u_rgbCurve, c.r), lut1(u_rgbCurve, c.g), lut1(u_rgbCurve, c.b));
  vec3 o = vec3(lut1(u_redCurve, m.r), lut1(u_greenCurve, m.g), lut1(u_blueCurve, m.b));
  if (u_applyMode == 1) o = setLum(o, luma601(c));
  else if (u_applyMode == 2) o = setLum(c, luma601(o));
  fragColor = vec4(saturate(o), src.a);
}`,
  },
};
