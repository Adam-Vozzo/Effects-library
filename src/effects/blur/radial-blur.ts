import type { EffectDef } from '../../engine/types';
import { angle, bool, int, point } from '../helpers';

// Spin blur: the image is averaged over a small arc of rotations around `center`.
// effect.app's center pad spans [-2, 2] in image half-extents (1 = image edge), like ours scaled up.
export const radialBlur: EffectDef = {
  id: 'radial-blur',
  name: 'Radial blur',
  category: 'Blur',
  keywords: 'blur motion radial spin swirl zoom',
  params: [
    point('center', 'center', [0, 0.5], { min: [-2, -2], max: [2, 2] }),
    angle('angle', 'angle', 0, 90, 16),
    int('samples', 'samples', 1, 100, 45),
    bool('box', 'box', false),
  ],
  shaders: {
    main: /* glsl */ `
void main() {
  vec2 res = u_resolution;
  vec2 c = pointToUv(u_center) * res;
  vec2 p = v_uv * res - c;
  int n = int(u_samples + 0.5);
  float ang = radians(u_angle);
  // Box: uniform over +-angle/2. Gaussian: same spread (sigma = 0.29 angle), tails out to +-0.64 angle.
  float span = u_box ? 0.5 * ang : 0.64 * ang;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 100; i++) {
    if (i >= n) break;
    float t = n > 1 ? float(i) / float(n - 1) * 2.0 - 1.0 : 0.0;
    float z = t * 0.64 / 0.29;
    float w = u_box ? 1.0 : exp(-0.5 * z * z);
    vec4 s = texture(u_input, (c + rot2(t * span) * p) / res);
    acc += vec4(s.rgb * s.a, s.a) * w;
    wsum += w;
  }
  fragColor = acc.a > 1e-6 ? vec4(acc.rgb / acc.a, acc.a / wsum) : vec4(0.0);
}`,
  },
};
