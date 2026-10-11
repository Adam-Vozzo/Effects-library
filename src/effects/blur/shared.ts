// Shared bits for the blur effects.

import type { ParamValues } from '../../engine/types';
import { angle, bool, float, point } from '../helpers';

/** Generic 1D line blur pass (box or gaussian weights), optionally linearizing straight sRGB input. */
export const LINE_BLUR_GLSL = /* glsl */ `
uniform sampler2D u_src;
uniform vec2 u_dirPx;    // blur direction (unit vector, px space)
uniform float u_start;   // first tap offset along the direction (px)
uniform float u_step;    // tap spacing (px)
uniform float u_count;   // number of taps
uniform float u_sigma;   // gaussian sigma (px); 0 = box weights
uniform bool u_toLinear; // input is straight sRGB: convert to premultiplied linear
void main() {
  vec2 texel = 1.0 / vec2(textureSize(u_src, 0));
  int n = int(u_count + 0.5);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 512; i++) {
    if (i >= n) break;
    float o = u_start + float(i) * u_step;
    float w = u_sigma > 0.0 ? exp(-0.5 * o * o / (u_sigma * u_sigma)) : 1.0;
    vec4 c = texture(u_src, v_uv + u_dirPx * o * texel);
    if (u_toLinear) c = vec4(srgbToLinear(c.rgb) * c.a, c.a);
    acc += c * w;
    wsum += w;
  }
  fragColor = acc / max(wsum, 1e-6);
}`;

/**
 * Elliptical focus mask (1 = in focus / protected, 0 = full effect). The transition runs from
 * r0/k to r0*k around r0 = radius/2 with k = 1 + falloff/2, which matches effect.app's depth of
 * field at its defaults (blur starts well inside the ellipse and saturates at r0*k).
 */
export const FOCUS_MASK_GLSL = /* glsl */ `
float focusMask(vec2 uv, vec2 res, vec2 centerUv, float radius, float falloff, float stretch, float rotDeg) {
  vec2 p = centered(uv, res) - centered(centerUv, res);
  p = rot2(radians(rotDeg)) * p;
  p.x /= 1.0 + stretch;
  float r0 = radius * 0.5;
  float k = 1.0 + 0.5 * falloff;
  return 1.0 - smoothstep(r0 / k, r0 * k, length(p));
}
`;

/** Focus-mask params shared by masked blurs, in effect.app's motion blur order. */
export function focusMaskParams(vis?: (p: ParamValues) => boolean) {
  return [
    point('maskCenter', 'mask center', [0, 0], { visibleIf: vis }),
    float('maskRadius', 'mask radius', 0.01, 4, 0.35, 0.01, { visibleIf: vis }),
    float('maskFalloff', 'mask falloff', 0.5, 6, 2, 0.1, { visibleIf: vis }),
    float('maskStretch', 'mask aspect stretch', 0, 5, 0, 0.05, { visibleIf: vis }),
    angle('maskRotation', 'mask rotation', -180, 180, 0, { visibleIf: vis }),
    bool('maskInvert', 'invert mask', false, { visibleIf: vis }),
    bool('maskDebug', 'debug mask', false, { visibleIf: vis, noRandom: true }),
  ];
}
