import type { EffectDef, RenderContext } from '../../engine/types';
import type { Texture } from '../../engine/gl';
import { blendMode, float, num, point } from '../helpers';

// Motion trails is a video feedback effect on effect.app: highlights above `threshold` (soft `knee`)
// are added every frame to a buffer that is moved by `direction` (+ random `shake`) and faded by
// `dimming`, then blended over the dimmed source. We have no frame history, so we render the
// buffer's steady state for the current frame held still: an exponentially decaying smear of the
// highlights along `direction`, computed exactly with log2(frames) doubling passes
// (S += a^(2^i) · S shifted by 2^i frames), each pass with its own shake jitter. The smear is
// normalized (a flat highlight keeps its level), soft-clipped, scaled by `intensity` and composited
// with `Blend mode` over the source dimmed by `source dim` in linear light.
// Limitation: real motion (moving subjects in video) does not leave trails.
const MAX_PASSES = 12;

export const motionTrails: EffectDef = {
  id: 'motion-trails',
  name: 'Motion trails',
  category: 'Effects',
  keywords: 'accumulation feedback highlights light trails threshold knee overlay motion trails',
  animated: true,
  params: [
    float('threshold', 'threshold', 0, 4, 0.75),
    float('knee', 'knee', 0, 2, 0.12),
    float('dimming', 'dimming', 0, 0.5, 0.06, 0.001),
    point('direction', 'direction', [0, 0.5]),
    float('shake', 'shake', 0, 5, 0.15),
    float('shakeSpeed', 'shake speed', 0, 10, 5),
    float('intensity', 'intensity', 0, 3, 1),
    float('sourceDim', 'source dim', 0, 1, 0.75),
    blendMode('blendMode', 'Blend mode', 6),
  ],
  shaders: {
    bright: /* glsl */ `
void main() {
  vec3 c = srgbToLinear(texture(u_input, v_uv).rgb);
  float l = luma(c);
  float w = smoothstep(u_threshold, u_threshold + max(u_knee, 1e-3), l);
  fragColor = vec4(c * w, 1.0);
}`,
    accum: /* glsl */ `
uniform sampler2D u_prev;
uniform vec2 u_shift;   // uv offset of this doubling step (2^i frames back)
uniform vec2 u_jitter;  // uv shake spread of this step (two symmetric taps)
uniform float u_gain;   // a^(2^i)
vec3 tap(vec2 q) {
  float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
  return inside * texture(u_prev, q).rgb;
}
void main() {
  vec3 s = texture(u_prev, v_uv).rgb;
  vec2 q = v_uv - u_shift;
  s += u_gain * 0.5 * (tap(q + u_jitter) + tap(q - u_jitter));
  fragColor = vec4(s, 1.0);
}`,
    main: /* glsl */ `
uniform sampler2D u_trail;
uniform float u_norm;
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 base = linearToSrgb(srgbToLinear(src.rgb) * u_sourceDim);
  vec3 t = texture(u_trail, v_uv).rgb * u_norm;
  vec3 glow = linearToSrgb(1.0 - exp(-0.64 * u_intensity * t));
  vec3 c = blendMode(u_blendMode, saturate(base), saturate(glow));
  fragColor = vec4(c, src.a);
}`,
  },
  render(ctx: RenderContext) {
    const p = ctx.params;
    const dir = (p.direction as [number, number]) ?? [0, 0.5];
    const a = Math.min(1, Math.max(0, 1 - num(p, 'dimming')));
    // Per-frame displacement: effect.app's ±4 pad range ↔ our ±1, 0.5 reference px per unit.
    const stepPx: [number, number] = [dir[0] * 2 * ctx.pxScale, dir[1] * 2 * ctx.pxScale];
    const stepLen = Math.hypot(stepPx[0], stepPx[1]);
    const diag = Math.hypot(ctx.width, ctx.height);
    // Frames until the trail fades below ~0.5%, and no further than it can travel across the image.
    let frames = a < 1 ? Math.log(0.005) / Math.log(Math.max(a, 1e-6)) : 1e9;
    if (stepLen > 1e-3) frames = Math.min(frames, (1.5 * diag) / stepLen);
    frames = Math.max(1, frames);
    const passes = Math.min(MAX_PASSES, Math.ceil(Math.log2(frames)));
    const n = 2 ** passes;
    const shake = num(p, 'shake') * ctx.pxScale;
    const seed = Math.floor(ctx.time * num(p, 'shakeSpeed') * 4);
    let acc: Texture = ctx.pass('bright');
    for (let i = 0; i < passes; i++) {
      const k = 2 ** i;
      // Shake: random-walk spread over 2^i frames as two symmetric taps in a random direction
      // (varies per pass and per shake tick).
      const j = shake * Math.sqrt(k);
      const ang = hash(i * 7.13 + seed * 1.37) * Math.PI * 2;
      const jx = j * Math.cos(ang);
      const jy = j * Math.sin(ang);
      const next = ctx.pass('accum', {
        inputs: { u_prev: acc },
        uniforms: {
          u_shift: [(stepPx[0] * k) / ctx.width, (stepPx[1] * k) / ctx.height],
          u_jitter: [jx / ctx.width, jy / ctx.height],
          u_gain: a ** k,
        },
      });
      ctx.release(acc);
      acc = next;
    }
    // Normalize the geometric series so a flat highlight keeps its level.
    const norm = a < 1 ? (1 - a) / Math.max(1e-6, 1 - a ** n) : 1 / n;
    const out = ctx.pass('main', { inputs: { u_trail: acc }, uniforms: { u_norm: norm } });
    ctx.release(acc);
    return out;
  },
};

function hash(x: number): number {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
