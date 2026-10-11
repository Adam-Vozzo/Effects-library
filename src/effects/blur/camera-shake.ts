import type { EffectDef, ParamValues } from '../../engine/types';
import { float, int, num } from '../helpers';

// Handheld camera motion: periodic pan/tilt/rotation (+ zoom) plus smooth random wander, with
// occasional pauses where the operator holds still. The transform is evaluated on the CPU at
// several instants across the shutter interval and the frames are averaged in linear light.

const MAX_SAMPLES = 64;
const TRANSLATE = 0.03; // image heights per unit amplitude * motion scale
const ROTATE = 0.07; // radians per unit amplitude * motion scale
const ZOOM = 0.1; // relative zoom per unit amplitude * motion scale
const SHUTTER = 1 / 15; // seconds of (scaled) time blurred at Motion Blur = 1

function hash(i: number, seed: number): number {
  let h = Math.imul(i ^ Math.imul(seed + 0x9e37, 0x85ebca6b), 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 1D gradient noise in about [-1, 1]. */
function noise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const g0 = hash(i, seed) * 2 - 1;
  const g1 = hash(i + 1, seed) * 2 - 1;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  return 2 * (g0 * f * (1 - u) + g1 * (f - 1) * u);
}

function fbm1(x: number, seed: number): number {
  return noise1(x, seed) * 0.65 + noise1(x * 2.13 + 17.1, seed + 101) * 0.25 + noise1(x * 4.37 + 3.7, seed + 211) * 0.1;
}

/** Integral of smoothstep(0, 1, s) from 0 to x (x in [0, 1]). */
const rampIntegral = (x: number) => x * x * x - 0.5 * x * x * x * x;

/** Scaled time with pauses removed: motion time stands still while the camera holds. */
function motionTime(T: number, p: ParamValues, seed: number): number {
  const I = Math.max(1, num(p, 'pauseInterval'));
  const len = Math.min(1, Math.max(0, num(p, 'pauseLength')));
  const rnd = num(p, 'pauseRandomness');
  if (len <= 0 || T <= 0) return T;
  const k = Math.min(100000, Math.floor(T / I));
  let paused = 0;
  for (let j = 0; j <= k; j++) {
    // Each interval holds one pause; randomness jitters its length and position.
    const L = Math.min(I, I * len * (1 + (hash(j, seed + 7) - 0.5) * rnd));
    const start = j * I + (I - L) * Math.min(1, Math.max(0, 0.5 + (hash(j, seed + 13) - 0.5) * 2 * rnd));
    const eps = 0.3 * L;
    const tau = Math.min(T - start, L);
    if (tau <= 0 || L <= 0) continue;
    // Ease into and out of the hold (smoothstep-shaped speed ramps).
    let w: number;
    if (tau < eps) w = eps * rampIntegral(tau / eps);
    else if (tau < L - eps) w = eps / 2 + (tau - eps);
    else w = L - eps - eps * rampIntegral((L - tau) / eps);
    paused += w;
  }
  return T - paused;
}

/** Camera transform at time t: [dx, dy] (image heights), rotation (rad), zoom factor. */
function shakeAt(t: number, p: ParamValues): [number, number, number, number] {
  const seed = Math.round(num(p, 'seed')) * 7919;
  const T = t * num(p, 'speedScale');
  const Tm = motionTime(T, p, seed);
  const ms = num(p, 'motionScale');
  const rs = num(p, 'randomnessScale');
  const x = Tm * num(p, 'randomnessSpeed');
  const th = 2 * Math.PI * (num(p, 'ptrSpeed') * Tm + num(p, 'phase'));
  const thz = 2 * Math.PI * (num(p, 'zoomSpeed') * Tm + num(p, 'phase'));
  const pan = num(p, 'panAmplitude') * (Math.sin(th) + rs * fbm1(x, seed + 1));
  const tilt = num(p, 'tiltAmplitude') * (Math.sin(2 * th + 1.1) + rs * fbm1(x + 31.7, seed + 2));
  const rot = num(p, 'rotationAmplitude') * (Math.sin(th + 0.4) + rs * fbm1(x + 63.1, seed + 3));
  const zoom = num(p, 'zoomAmplitude') * (Math.sin(thz) + rs * fbm1(x + 95.3, seed + 4));
  return [pan * ms * TRANSLATE, tilt * ms * TRANSLATE, rot * ms * ROTATE, Math.exp(zoom * ms * ZOOM)];
}

export const cameraShake: EffectDef = {
  id: 'camera-shake',
  name: 'Camera shake',
  category: 'Blur',
  keywords: 'camera shake motion blur pan tilt rotation zoom',
  animated: true,
  params: [
    float('motionScale', 'Motion Scale', 0, 4, 2),
    float('speedScale', 'Speed Scale', 0, 4, 0.899, 0.001),
    float('motionBlur', 'Motion Blur', 0, 1, 1),
    float('panAmplitude', 'Pan Amplitude', 0, 1, 0.597, 0.001),
    float('tiltAmplitude', 'Tilt Amplitude', 0, 1, 0.023, 0.001),
    float('rotationAmplitude', 'Rotation Amplitude', 0, 1, 0.1, 0.001),
    float('ptrSpeed', 'PTR Speed', 0, 4, 0.5, 0.001),
    float('zoomAmplitude', 'Zoom Amplitude', 0, 1, 0, 0.001),
    float('zoomSpeed', 'Zoom Speed', 0, 4, 0, 0.001),
    float('phase', 'Phase', 0, 1, 0.75, 0.001),
    float('randomnessScale', 'Randomness Scale', 0, 2, 1, 0.001),
    float('randomnessSpeed', 'Randomness Speed', 0, 4, 1.457, 0.001),
    float('pauseLength', 'Pause Length', 0, 1, 0.419, 0.001, { hint: 'Fraction of each pause interval the camera holds still' }),
    int('pauseInterval', 'Pause Interval', 1, 60, 18, { hint: 'Seconds between pauses (scaled by Speed Scale)' }),
    float('pauseRandomness', 'Pause Randomness', 0, 1, 0.155, 0.001),
    int('seed', 'Random Seed', 0, 100, 8),
  ],
  shaders: {
    main: /* glsl */ `
uniform vec4 u_xf[${MAX_SAMPLES}]; // per shutter sample: offset (image heights), rotation, zoom
uniform float u_count;
void main() {
  vec2 res = u_resolution;
  vec2 p = centered(v_uv, res);
  int n = int(u_count + 0.5);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < ${MAX_SAMPLES}; i++) {
    if (i >= n) break;
    vec4 xf = u_xf[i];
    // Inverse of: content -> rotate(xf.z) * zoom(xf.w) about the centre, then translate(xf.xy).
    vec2 q = rot2(-xf.z) * (p - xf.xy) / xf.w;
    vec4 s = texture(u_input, mirrorUv(uncentered(q, res)));
    acc += vec4(srgbToLinear(s.rgb) * s.a, s.a);
  }
  fragColor = acc.a > 1e-6 ? vec4(linearToSrgb(acc.rgb / acc.a), acc.a / float(n)) : vec4(0.0);
}`,
  },
  render(ctx) {
    const p = ctx.params;
    const t = ctx.time;
    const shutter = SHUTTER * Math.max(0, num(p, 'motionBlur'));
    // Path length in px decides how many instants we need (about one per pixel of travel).
    const H = ctx.height;
    const W = ctx.width;
    const reach = 0.5 * Math.hypot(W / H, 1); // centre-to-corner distance in image heights
    const a = shakeAt(t - shutter / 2, p);
    const m = shakeAt(t, p);
    const b = shakeAt(t + shutter / 2, p);
    const travel = (u: number[], v: number[]) => Math.hypot(u[0] - v[0], u[1] - v[1]) + Math.abs(u[2] - v[2]) * reach + Math.abs(Math.log(u[3] / v[3])) * reach;
    const px = (travel(a, m) + travel(m, b)) * H;
    const max = ctx.exporting ? MAX_SAMPLES : 32;
    const n = shutter > 0 ? Math.max(1, Math.min(max, Math.ceil(px / 1.5))) : 1;
    const xf = new Float32Array(MAX_SAMPLES * 4);
    for (let i = 0; i < n; i++) {
      const ti = n > 1 ? t + shutter * (i / (n - 1) - 0.5) : t;
      xf.set(shakeAt(ti, p), i * 4);
    }
    return ctx.pass('main', { uniforms: { u_xf: xf, u_count: n } });
  },
};
