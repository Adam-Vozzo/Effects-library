import type { EffectDef } from '../../engine/types';
import { float, gradient, int, num } from '../helpers';
import { KNEE_GLSL } from './common-a';

// Star / anamorphic streak glow: bright-pass (linear light, soft knee, optional hot-spot boost) at half
// resolution, then one pass per streak line (both directions) that gathers the highlights along it with an
// exponential falloff, colorized by the gradient map from the core (left) to the tips (right), added
// together and composited additively in linear light. `alternate` shortens every other streak.

const MAX_SAMPLES = 60;

export const starGlow: EffectDef = {
  id: 'star-glow',
  name: 'Star glow',
  category: 'Effects',
  keywords: 'anamorphic flare glare lens star streaks',
  params: [
    float('threshold', 'threshold', 0, 4, 0.5),
    float('knee', 'knee', 0, 2, 0.05),
    float('intensity', 'intensity', 0, 4, 0.5),
    float('highlightBoost', 'highlight boost', 0, 1, 0),
    int('streaks', 'streaks', 1, 8, 3),
    int('sampleCount', 'sample count', 10, MAX_SAMPLES, 30),
    float('length', 'length', 0.5, 200, 80, 0.1),
    float('alternate', 'alternate', 0.1, 1, 1),
    float('falloff', 'falloff', 0.1, 1.5, 0.45),
    int('angleDeg', 'angle deg', -180, 180, 0, { unit: '°' }),
    float('colorize', 'Colorize', 0, 1, 1),
    gradient('gradientMap', 'Gradient map', [
      { pos: 0, color: '#f4f8ff' },
      { pos: 1, color: '#79adff' },
    ]),
    float('gradientShift', 'Gradient shift', -1, 1, 0),
  ],
  shaders: {
    prefilter: /* glsl */ `
${KNEE_GLSL}
void main() {
  vec2 o = 0.5 / u_resolution;
  vec3 c = srgbToLinear(texture(u_input, v_uv + vec2(-o.x, -o.y)).rgb) + srgbToLinear(texture(u_input, v_uv + vec2(o.x, -o.y)).rgb)
         + srgbToLinear(texture(u_input, v_uv + vec2(-o.x, o.y)).rgb) + srgbToLinear(texture(u_input, v_uv + vec2(o.x, o.y)).rgb);
  c *= 0.25;
  vec3 b = c * kneeWeight(luma(c), u_threshold, u_knee);
  // Highlight boost: hot spots grow faster than the rest of the bright pass.
  float m = max(b.r, max(b.g, b.b));
  b *= 1.0 + u_highlightBoost * 4.0 * m;
  fragColor = vec4(b, 1.0);
}`,
    // One streak line through every pixel: gather along ±dir.
    streak: /* glsl */ `
uniform sampler2D u_bright;
uniform vec2 u_dir;     // streak direction in uv per sample step
// Nothing beyond the frame (clamped edge texels would smear into streaks).
float inImage(vec2 uv) { return step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0); }
void main() {
  int n = int(u_sampleCount);
  float jitter = ign(gl_FragCoord.xy) - 0.5;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  float k = u_falloff * 6.0;
  for (int i = 1; i <= ${MAX_SAMPLES}; i++) {
    if (i > n) break;
    float x = (float(i) + jitter * 0.5) / float(n);
    float w = exp(-x * k);
    vec2 o = u_dir * (float(i) + jitter * 0.5);
    vec3 a = texture(u_bright, v_uv + o).rgb * inImage(v_uv + o) + texture(u_bright, v_uv - o).rgb * inImage(v_uv - o);
    vec3 tint = srgbToLinear(lut3(u_gradientMap, saturate(x + u_gradientShift)));
    vec3 c = mix(a, luma(a) * tint / max(luma(tint), 0.05), u_colorize);
    acc += c * w;
    wsum += w;
  }
  fragColor = vec4(acc / max(wsum, 1e-4) * 0.5, 1.0);
}`,
    main: /* glsl */ `
uniform sampler2D u_streakAcc;
uniform sampler2D u_bright;
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = srgbToLinear(src.rgb);
  vec3 s = texture(u_streakAcc, v_uv).rgb;
  c += s * u_intensity * 1.2;
  // The boosted cores also glow a little on their own.
  c += texture(u_bright, v_uv).rgb * u_highlightBoost * u_intensity;
  fragColor = vec4(linearToSrgb(c), src.a);
}`,
  },
  render(ctx) {
    const p = ctx.params;
    const hw = Math.max(1, Math.round(ctx.width / 2));
    const hh = Math.max(1, Math.round(ctx.height / 2));
    const pre = ctx.pass('prefilter', { width: hw, height: hh });
    const n = Math.max(1, Math.round(num(p, 'sampleCount')));
    const len = num(p, 'length') * ctx.pxScale; // render px
    const step = len / n; // render px per sample
    // Soften the bright pass so sparse samples don't leave dotted streaks.
    const bright = ctx.blur(pre, Math.max(0.5, step * 0.25));
    ctx.release(pre);
    const acc = ctx.target(hw, hh);
    const count = Math.max(1, Math.round(num(p, 'streaks')));
    const base = (num(p, 'angleDeg') * Math.PI) / 180;
    for (let k = 0; k < count; k++) {
      const a = base + (k * Math.PI) / count;
      const l = k % 2 === 1 ? num(p, 'alternate') : 1;
      const st = step * l;
      ctx.pass('streak', {
        target: acc,
        blend: 'add',
        clear: k === 0 ? [0, 0, 0, 0] : undefined,
        inputs: { u_bright: bright },
        uniforms: { u_dir: [(Math.cos(a) * st) / ctx.width, (Math.sin(a) * st) / ctx.height] },
      });
    }
    const out = ctx.pass('main', { inputs: { u_streakAcc: acc, u_bright: bright } });
    ctx.release(acc);
    ctx.release(bright);
    return out;
  },
};
