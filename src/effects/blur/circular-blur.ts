import type { EffectDef } from '../../engine/types';
import { float, int, num } from '../helpers';

// Multiple exposures of the image offset around a circle. Every extra pass repeats the ring on the
// previous result with a radius shrunk by `decay` and rotated half a step, filling in the gaps.
export const circularBlur: EffectDef = {
  id: 'circular-blur',
  name: 'Circular blur',
  category: 'Blur',
  keywords: 'blur circular depth field focus radial',
  params: [
    float('radius', 'radius', 0, 100, 54),
    int('repetitions', 'repetitions', 3, 23, 8),
    int('passes', 'passes', 1, 4, 1),
    float('decay', 'decay', 0, 1, 0.4),
  ],
  shaders: {
    ring: /* glsl */ `
uniform sampler2D u_src;
uniform float u_ringRadius; // px
uniform float u_ringRot;    // radians
void main() {
  int n = int(u_repetitions + 0.5);
  vec2 texel = 1.0 / u_resolution;
  vec4 acc = vec4(0.0);
  for (int k = 0; k < 23; k++) {
    if (k >= n) break;
    float a = u_ringRot + TAU * float(k) / float(n);
    vec4 s = texture(u_src, v_uv + vec2(cos(a), sin(a)) * u_ringRadius * texel);
    acc += vec4(s.rgb * s.a, s.a);
  }
  fragColor = acc.a > 1e-6 ? vec4(acc.rgb / acc.a, acc.a / float(n)) : vec4(0.0);
}`,
  },
  render(ctx) {
    const p = ctx.params;
    const n = Math.round(num(p, 'repetitions'));
    const passes = Math.round(num(p, 'passes'));
    const decay = num(p, 'decay');
    let r = num(p, 'radius') * ctx.pxScale;
    let cur = ctx.input;
    for (let i = 0; i < passes; i++) {
      if (r < 0.05) break;
      const next = ctx.pass('ring', { inputs: { u_src: cur }, uniforms: { u_ringRadius: r, u_ringRot: (i * Math.PI) / n } });
      if (cur !== ctx.input) ctx.release(cur);
      cur = next;
      r *= 1 - decay;
    }
    return cur;
  },
};
