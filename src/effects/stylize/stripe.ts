import type { EffectDef } from '../../engine/types';
import { angle, bool, float, int } from '../helpers';
import { SHORT_SIDE_GLSL, numberedHint } from './common-b';

// Optical line halftone: a periodic pattern of parallel lines (pattern type 0, oriented by `angle`) or
// concentric rings (type 1) whose dark band widens with darkness, between `minimum thickness` and
// `maximum thickness` of the period, on white. `repetitions` = periods from the center to the
// short edge. In color mode each channel is screened separately with its own phase shift (red shift
// 0.1 gives effect.app's red/cyan edge fringes); otherwise luma drives a black & white pattern.
// `shift` offsets alternate bands of rows by half a period (op-art row shift).
export const stripe: EffectDef = {
  id: 'stripe',
  name: 'Stripe',
  category: 'Effects',
  keywords: 'abstract distortion halftone illusion optical pattern scanline scanlines stripe stripes',
  animated: true,
  params: [
    int('repetitions', 'repetitions', 5, 60, 33),
    float('minThickness', 'minimum thickness', 0.001, 0.1, 0.001, 0.001),
    float('maxThickness', 'maximum thickness', 0.1, 1, 1),
    angle('angle', 'angle', 0, 360, 90),
    float('edgeSoftness', 'edge softness', 0, 1, 0.5),
    int('patternType', 'pattern type', 0, 1, 1, { hint: numberedHint(['Lines', 'Circles']) }),
    float('animationSpeed', 'animation speed', -5, 5, 0),
    bool('colorMode', 'color mode', true),
    float('redShift', 'red shift', 0, 1, 0.1),
    float('greenShift', 'green shift', 0, 1, 0),
    float('blueShift', 'blue shift', 0, 1, 0),
    bool('shift', 'shift', false),
    int('rowShiftFreq', 'row shift freq', 1, 50, 8),
  ],
  shaders: {
    main: /* glsl */ `
${SHORT_SIDE_GLSL}
// Dark-band coverage at phase ph for a band of width th (fraction of a period) with soft edges of
// half-width s. Bands are centered at fract = 0.5; the neighbouring band is added so th = 1 is solid.
// Like effect.app, very thin bands still show as faint soft lines.
float ink(float ph, float th, float s) {
  float d = abs(fract(ph) - 0.5);
  float h = 0.5 * th;
  return saturate(2.0 - smoothstep(h - s, h + s, d) - smoothstep(h - s, h + s, 1.0 - d));
}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec2 p = shortCentered(v_uv, u_resolution);
  float ph;
  if (u_patternType < 0.5) {
    float a = radians(u_angle);
    ph = dot(p, vec2(cos(a), sin(a)));
  } else {
    ph = length(p);
  }
  ph = ph * 2.0 * u_repetitions - u_time * u_animationSpeed;
  // Edge half-width: softness plus the pixel footprint (measured before the row shift's phase jumps).
  float w = 0.29 * u_edgeSoftness + 0.5 * fwidth(ph) + 1e-4;
  if (u_shift) ph += 0.5 * mod(floor((1.0 - v_uv.y) * u_rowShiftFreq), 2.0);
  vec3 v = saturate(src.rgb);
  vec3 th = mix(vec3(u_minThickness), vec3(u_maxThickness), 1.0 - v);
  vec3 c;
  if (u_colorMode) {
    c = 1.0 - vec3(
      ink(ph + u_redShift, th.r, w),
      ink(ph + u_greenShift, th.g, w),
      ink(ph + u_blueShift, th.b, w));
  } else {
    float tl = mix(u_minThickness, u_maxThickness, 1.0 - luma(v));
    c = vec3(1.0 - ink(ph, tl, w));
  }
  fragColor = vec4(c, src.a);
}`,
  },
};
