import type { EffectDef } from '../../engine/types';
import { bool, float, int, point } from '../helpers';

// Radial zoom streaks: the image is averaged over a range of scales around `center`.
export const zoomBlur: EffectDef = {
  id: 'zoom-blur',
  name: 'Zoom blur',
  category: 'Blur',
  keywords: 'blur zoom',
  params: [
    point('center', 'center', [0, 0], { min: [-2, -2], max: [2, 2] }),
    float('strength', 'strength', 0, 1, 0.2),
    int('samples', 'samples', 1, 100, 45),
    bool('box', 'box', false),
  ],
  shaders: {
    main: /* glsl */ `
void main() {
  vec2 c = pointToUv(u_center);
  vec2 d = v_uv - c;
  int n = int(u_samples + 0.5);
  // Scale offsets: box uniform over +-0.35 s, gaussian sigma 0.2 s with tails to +-0.42 s (same spread).
  float span = (u_box ? 0.35 : 0.42) * u_strength;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 100; i++) {
    if (i >= n) break;
    float t = n > 1 ? float(i) / float(n - 1) * 2.0 - 1.0 : 0.0;
    float z = t * 2.1;
    float w = u_box ? 1.0 : exp(-0.5 * z * z);
    vec4 s = texture(u_input, c + d * max(1.0 + t * span, 0.0));
    acc += vec4(s.rgb * s.a, s.a) * w;
    wsum += w;
  }
  fragColor = acc.a > 1e-6 ? vec4(acc.rgb / acc.a, acc.a / wsum) : vec4(0.0);
}`,
  },
};
