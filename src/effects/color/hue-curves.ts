import type { EffectDef } from '../../engine/types';
import { choice, curve, float } from '../helpers';

const FLAT: [number, number][] = [
  [0, 0.5],
  [1, 0.5],
];
const hueCurve = (key: string, label: string) => curve(key, label, FLAT, { periodic: true, hueBackground: true });

// Hue-keyed curves (x = HSV hue, matching the spectrum drawn under the editor; y = 0.5 is neutral).
// Hue vs Hue rotates by up to ±180°, Hue vs Saturation scales chroma 0..2x, Hue vs Luminance shifts
// brightness. Model picks the space the adjustment is applied in (HSV or OKLCh). Hue softness blurs
// the curves along the hue axis; luma softness fades the adjustment out toward black and white.
export const hueCurves: EffectDef = {
  id: 'hue-curves',
  name: 'Hue curves',
  category: 'Color',
  keywords: 'color curves hue hue-curves hue-saturation',
  params: [
    choice('model', 'Model', ['HSV', 'OKLAB'], 0, 'switcher'),
    hueCurve('hueVsHue', 'Hue vs Hue'),
    hueCurve('hueVsSaturation', 'Hue vs Saturation'),
    hueCurve('hueVsLuminance', 'Hue vs Luminance'),
    float('hueSoftness', 'Hue softness', 0, 0.25, 0.025, 0.005),
    float('lumaSoftness', 'Luma softness', 0, 0.35, 0.08, 0.005),
    float('amount', 'Amount', 0, 1, 1),
  ],
  shaders: {
    main: /* glsl */ `
float softCurve(sampler2D t, float h) {
  if (u_hueSoftness < 1e-4) return lut1Periodic(t, h);
  float s = 0.0, ws = 0.0;
  for (int i = -4; i <= 4; i++) {
    float o = float(i) / 4.0;
    float w = exp(-2.5 * o * o);
    s += w * lut1Periodic(t, h + o * u_hueSoftness);
    ws += w;
  }
  return s / ws;
}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = saturate(src.rgb);
  vec3 hsv = rgb2hsv(c);
  float dh = softCurve(u_hueVsHue, hsv.x) - 0.5;
  float sm = 2.0 * softCurve(u_hueVsSaturation, hsv.x);
  float dl = softCurve(u_hueVsLuminance, hsv.x) - 0.5;
  float ls = max(u_lumaSoftness, 1e-4);
  float y = luma(c);
  float w = u_amount * smoothstep(0.0, ls, y) * smoothstep(0.0, ls, 1.0 - y);
  vec3 o;
  if (u_model == 0) {
    float cw = smoothstep(0.0, 0.08, hsv.y * hsv.z);
    hsv.x = fract(hsv.x + dh * w);
    hsv.y = saturate(hsv.y * mix(1.0, sm, w));
    hsv.z *= exp2(2.0 * dl * w * cw);
    o = hsv2rgb(hsv);
  } else {
    vec3 lch = srgbToOklch(c);
    float cw = smoothstep(0.0, 0.04, lch.y);
    lch.z += dh * w * TAU;
    lch.y *= mix(1.0, sm, w);
    lch.x = max(lch.x + dl * 0.5 * w * cw, 0.0);
    o = oklchToSrgb(lch);
  }
  fragColor = vec4(saturate(o), src.a);
}`,
  },
};
