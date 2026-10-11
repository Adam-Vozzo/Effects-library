import type { EffectDef, RenderContext } from '../../engine/types';
import type { Texture } from '../../engine/gl';
import { bool, float, int, num } from '../helpers';
import { numberedHint } from './common-b';

// Frequency modulation: every image row (or column) is a scan line along which each RGB channel
// drives an oscillator. Its instantaneous frequency (cycles per short side) is
//   wave scale × (0.0366 × signal strength + 0.45 × FM sensitivity × channel value),
// and the phase is the running integral of it along the scan, so lines stay straight over flat areas
// and bend/scramble downstream of detail. A thin line is drawn at every phase wrap in the channel's
// color (effect.app's default: ~50 lines per short side in white, ~3 in black).
// Passes: 1) per-sample phase increments on a `resolution` × rows texture (samples along the scan),
// 2) log2(resolution) Hillis–Steele prefix-sum passes kept modulo 1 (exact for cos/wrap, precise in
// half floats), 3) full-resolution line rendering with the local frequency for anti-aliasing.
// `line width` is in reference pixels (1 px lines at the default, like effect.app).
const DIRECTIONS = ['Left to right', 'Top to bottom', 'Right to left', 'Bottom to top'];
const MAX_ROWS = 4096;

const SCAN_GLSL = /* glsl */ `
uniform vec2 u_scanSize;   // (samples along the scan, rows across it)
uniform float u_scanLenPx; // scan length in output pixels
uniform float u_minPx;     // short side in output pixels
// Scan coordinates (t along the scan, c across it, both 0..1) to image uv.
vec2 scanToUv(float t, float c) {
  if (u_waveDirection < 0.5) return vec2(t, c);
  if (u_waveDirection < 1.5) return vec2(c, 1.0 - t);
  if (u_waveDirection < 2.5) return vec2(1.0 - t, c);
  return vec2(c, t);
}
vec2 uvToScan(vec2 uv) {
  if (u_waveDirection < 0.5) return uv;
  if (u_waveDirection < 1.5) return vec2(1.0 - uv.y, uv.x);
  if (u_waveDirection < 2.5) return vec2(1.0 - uv.x, uv.y);
  return vec2(uv.y, uv.x);
}
// Mean channel values over sample j of row c (4 taps along the scan).
vec3 sampleSignal(float j, float c) {
  vec3 s = vec3(0.0);
  for (int k = 0; k < 4; k++) {
    float t = (j + (float(k) + 0.5) * 0.25) / u_scanSize.x;
    s += texture(u_input, scanToUv(t, c)).rgb;
  }
  return saturate(s * 0.25);
}
// Phase increment per sample (cycles) for channel values s.
vec3 increment(vec3 s) {
  vec3 perShort = u_waveScale * (0.0366 * u_signalStrength + 0.45 * u_fmSensitivity * s);
  return perShort * (u_scanLenPx / u_minPx) / u_scanSize.x;
}
`;

export const modulation: EffectDef = {
  id: 'modulation',
  name: 'Modulation',
  category: 'Effects',
  keywords: 'abstract analog distortion experimental glitch modulation signal visuals wave',
  params: [
    int('samples', 'resolution', 256, 2048, 1024, { step: 16 }),
    int('waveScale', 'wave scale', 10, 500, 420, { step: 5 }),
    float('fmSensitivity', 'FM sensitivity', 0.1, 1, 0.25, 0.05),
    float('signalStrength', 'signal strength', 0.1, 20, 0.2, 0.1),
    int('waveDirection', 'wave direction', 0, 3, 0, { hint: numberedHint(DIRECTIONS) }),
    float('phase', 'phase', 0, 10, 0),
    float('lineWidth', 'line width', 1.05, 10, 1.05, 0.05),
    bool('redChannel', 'red channel', true),
    bool('greenChannel', 'green channel', true),
    bool('blueChannel', 'blue channel', true),
  ],
  shaders: {
    signal: /* glsl */ `
${SCAN_GLSL}
void main() {
  vec2 ij = floor(gl_FragCoord.xy);
  vec3 s = sampleSignal(ij.x, (ij.y + 0.5) / u_scanSize.y);
  fragColor = vec4(fract(increment(s)), 1.0);
}`,
    scan: /* glsl */ `
uniform sampler2D u_prev;
uniform int u_stride;
void main() {
  ivec2 ij = ivec2(gl_FragCoord.xy);
  vec3 v = texelFetch(u_prev, ij, 0).rgb;
  if (ij.x >= u_stride) v += texelFetch(u_prev, ij - ivec2(u_stride, 0), 0).rgb;
  fragColor = vec4(fract(v), 1.0);
}`,
    main: /* glsl */ `
${SCAN_GLSL}
uniform sampler2D u_sum;  // inclusive prefix sums of the increments, modulo 1
float lineCov(float ph, float f, float wPx) {
  // Distance to the nearest phase wrap, in pixels along the scan.
  float cyclesPerPx = max(f * u_scanSize.x / u_scanLenPx, 1e-6);
  float d = abs(fract(ph + 0.5) - 0.5) / cyclesPerPx;
  return saturate(min(wPx, 0.5 * wPx + 0.5 - d));
}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec2 sc = uvToScan(v_uv);
  float tS = sc.x * u_scanSize.x;
  float j = min(floor(tS), u_scanSize.x - 1.0);
  float row = min(floor(sc.y * u_scanSize.y), u_scanSize.y - 1.0);
  vec3 f = increment(sampleSignal(j, (row + 0.5) / u_scanSize.y));
  vec3 incl = texelFetch(u_sum, ivec2(int(j), int(row)), 0).rgb;
  // Phase at this point: exclusive prefix + partial sample, plus the global phase offset.
  vec3 ph = incl - f + f * (tS - j) + u_phase / TAU;
  float w = u_lineWidth * u_pxScale;
  vec3 c = vec3(
    u_redChannel ? lineCov(ph.r, f.r, w) : 0.0,
    u_greenChannel ? lineCov(ph.g, f.g, w) : 0.0,
    u_blueChannel ? lineCov(ph.b, f.b, w) : 0.0);
  fragColor = vec4(c, src.a);
}`,
  },
  render(ctx: RenderContext) {
    const p = ctx.params;
    const dir = Math.round(num(p, 'waveDirection'));
    const horizontal = dir === 0 || dir === 2;
    const scanLenPx = horizontal ? ctx.width : ctx.height;
    const crossPx = horizontal ? ctx.height : ctx.width;
    const n = Math.max(16, Math.round(num(p, 'samples')));
    const rows = Math.min(crossPx, MAX_ROWS);
    const uniforms = { u_scanSize: [n, rows] as [number, number], u_scanLenPx: scanLenPx, u_minPx: Math.min(ctx.width, ctx.height) };
    let sum: Texture = ctx.pass('signal', { width: n, height: rows, uniforms });
    for (let stride = 1; stride < n; stride *= 2) {
      const next = ctx.pass('scan', { width: n, height: rows, inputs: { u_prev: sum }, uniforms: { u_stride: stride } });
      ctx.release(sum);
      sum = next;
    }
    const out = ctx.pass('main', { inputs: { u_sum: sum }, uniforms });
    ctx.release(sum);
    return out;
  },
};
