import type { EffectDef } from '../../engine/types';
import { angle, bool, float } from '../helpers';

// HSV hue rotation (effect.app rotates opposite to the HSV hue direction), saturation scale, and
// "preserve lightness" which restores the original RGB mean.
export const hueSaturation: EffectDef = {
  id: 'hue-saturation',
  name: 'Hue/saturation',
  category: 'Color',
  keywords: 'adjustment color control correction editing grading hue saturation',
  params: [
    angle('hue', 'hue rotation', 0, 360, 262),
    float('saturation', 'saturation', 0, 5, 1),
    bool('invert', 'invert colors', false),
    bool('preserveLightness', 'preserve lightness', true),
  ],
  shaders: {
    main: /* glsl */ `
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = saturate(src.rgb);
  if (u_invert) c = 1.0 - c;
  vec3 hsv = rgb2hsv(c);
  hsv.x = fract(hsv.x - u_hue / 360.0);
  hsv.y = saturate(hsv.y * u_saturation);
  vec3 o = hsv2rgb(hsv);
  if (u_preserveLightness) o += dot(c - o, vec3(1.0 / 3.0));
  fragColor = vec4(saturate(o), src.a);
}`,
  },
};
