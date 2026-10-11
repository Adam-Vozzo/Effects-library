import type { EffectDef } from '../../engine/types';
import { float, int, num } from '../helpers';

// VHS playback: per-line timebase errors (wobble, distortion, tape crease, tracking band, vertical jump)
// → YIQ → low horizontal luma resolution + much lower chroma resolution with delay/fringing →
// sharpening halos, saturation / hue drift, tracking noise, sparkles, grain, flicker.
// `resolution` is the number of luma samples across the picture, so the look is resolution independent.

const LINE_GLSL = /* glsl */ `
const float LINES = 480.0;
// Vertical jump: the picture is pushed down, exposing the head-switching band at the top.
float vhsJump() {
  float k = floor(u_time * 0.37);
  float burst = smoothstep(0.88, 0.94, fract(u_time * 0.37)) * (1.0 - smoothstep(0.96, 1.0, fract(u_time * 0.37)));
  // Resting offset saturates at 6 % of the frame; bursts make the picture jump further for a moment.
  return 0.06 * (1.0 - exp(-u_verticalJump * 4.7)) + u_verticalJump * 0.12 * burst * hash11(k + 0.5);
}
float trackingCenter() { return fract(0.5 + u_time * 0.071); }
float creaseCenter() { return fract(0.965 + u_time * 0.043); }
// Weight of a soft horizontal band (y from the top, wrapping).
float bandWeight(float y, float c, float h) {
  float d = abs(y - c);
  d = min(d, 1.0 - d);
  return 1.0 - smoothstep(h * 0.35, h, d);
}
`;

export const vhs: EffectDef = {
  id: 'vhs',
  name: 'VHS',
  category: 'Effects',
  keywords: 'analog distortion filter ntsc retro scanlines vhs tv',
  animated: true,
  params: [
    int('samples', 'resolution', 128, 1024, 320),
    float('distortion', 'distortion', 0, 2.5, 0.23),
    float('colorFringing', 'color fringing', 0, 2, 2),
    float('wobble', 'wobble', 0, 2, 2),
    float('tapeCrease', 'tape crease', 0, 2, 0.5),
    float('trackingNoise', 'tracking noise', 0, 2, 2),
    float('verticalJump', 'vertical jump', 0, 2, 0.05),
    float('sparkle', 'sparkle', 0, 2, 1),
    float('flicker', 'flicker', 0, 2, 0.06),
    float('grain', 'grain', 0, 2, 0.75),
    float('saturation', 'saturation', 0, 2.5, 2),
    float('colorShift', 'color shift', 0, 2, 0.1),
    float('colorBlend', 'color blend', 0, 1, 1),
    float('softness', 'softness', 0.4, 2, 0.5),
    float('colorDelay', 'color delay', 0, 8, 5.8, 0.1),
    float('sharpening', 'sharpening', 0, 2, 0.25),
  ],
  shaders: {
    // Timebase errors + RGB → YIQ (I/Q stored with a +0.5 offset).
    geom: /* glsl */ `
${LINE_GLSL}
void main() {
  float yTop = 1.0 - v_uv.y;
  float L = floor(yTop * LINES);
  float t = u_time;
  float jump = vhsJump();
  float ySrc = yTop - jump;
  // Wobble: fast per-line jitter riding on a slower wave.
  float dx = (valueNoise(vec2(L * 0.11, t * 4.0)) - 0.5) * 0.002 * u_wobble;
  dx += (hash12(vec2(L, floor(t * 29.97))) - 0.5) * 0.0005 * u_wobble;
  // Distortion: slow bending of the whole frame plus head-switching skew in the last lines.
  dx += (valueNoise(vec2(yTop * 2.5, t * 0.6 + 3.0)) - 0.5) * 0.02 * u_distortion;
  float hs = saturate((yTop - 0.955) / 0.045);
  dx += hs * hs * 0.06 * u_distortion * (0.6 + 0.4 * valueNoise(vec2(L * 0.5, t * 8.0)));
  // Tape crease: a narrow band of strongly displaced lines.
  float cw = bandWeight(yTop, creaseCenter(), 0.012 + 0.01 * u_tapeCrease);
  dx += cw * (valueNoise(vec2(L * 0.7, t * 13.0)) - 0.35) * 0.05 * u_tapeCrease;
  // Tracking band: jittery lines.
  float tw = bandWeight(yTop, trackingCenter(), 0.09);
  dx += tw * (hash12(vec2(L * 3.1, floor(t * 29.97) + 7.0)) - 0.5) * 0.0016 * u_trackingNoise;
  vec2 uv = vec2(v_uv.x - dx, 1.0 - ySrc);
  vec4 c = texture(u_input, clamp(uv, 0.0, 1.0));
  vec3 yiq = rgb2yiq(c.rgb);
  if (ySrc < 0.0) yiq = vec3(0.04 + 0.03 * hash12(vec2(gl_FragCoord.x * 0.25, L)), 0.0, 0.0);
  fragColor = vec4(yiq + vec3(0.0, 0.5, 0.5), c.a);
}`,
    main: /* glsl */ `
${LINE_GLSL}
uniform sampler2D u_geo;
uniform sampler2D u_lumaB;
uniform sampler2D u_chromaB;
uniform sampler2D u_chromaW;
void main() {
  vec2 res = u_resolution;
  float samp = res.x / u_samples;
  float yTop = 1.0 - v_uv.y;
  float L = floor(yTop * LINES);
  float t = u_time;
  float frame = floor(t * 29.97);
  float jump = vhsJump();

  vec4 geo = texture(u_geo, v_uv);
  float Ysharp = geo.x;
  float Yb = texture(u_lumaB, v_uv).x;
  float Yw = texture(u_chromaW, v_uv).x;
  // Deck sharpening: unsharp mask against the wide blur (halos).
  float Y = Yb + u_sharpening * 1.6 * (Yb - Yw);
  // Chroma: delayed (smeared to the right) with I/Q fringing.
  float d = u_colorDelay * samp * 0.55 / res.x;
  float f = u_colorFringing * samp * 0.45 / res.x;
  float I = texture(u_chromaB, v_uv - vec2(d + f, 0.0)).y - 0.5;
  float Q = texture(u_chromaB, v_uv - vec2(d - f, 0.0)).z - 0.5;
  vec2 iqSharp = texture(u_geo, v_uv - vec2(d, 0.0)).yz - 0.5;
  vec2 iq = mix(iqSharp, vec2(I, Q), u_colorBlend);
  iq = rot2(u_colorShift * 2.5) * iq * u_saturation;

  // Black level up, white level down.
  Y = 0.05 + 0.9 * Y;

  // Grain: horizontally stretched luma noise + streaky chroma noise.
  vec2 gp = vec2(gl_FragCoord.x / max(samp * 0.6, 1.0), L);
  Y += (hash12(gp + frame * 17.0) - 0.5) * 0.05 * u_grain;
  vec2 cp = vec2(gl_FragCoord.x / max(samp * 2.5, 1.0), L * 0.5 + frame * 3.0);
  iq += (vec2(valueNoise(cp), valueNoise(cp + 41.0)) - 0.5) * 0.08 * u_grain;

  // Tape crease: bright noisy streak.
  float cw = bandWeight(yTop, creaseCenter(), 0.006 + 0.004 * u_tapeCrease);
  Y += cw * u_tapeCrease * 0.2 * (hash12(vec2(gl_FragCoord.x / max(samp, 1.0), L + frame)) - 0.4);

  // Tracking noise band + sparkles: short bright horizontal dashes.
  float tw = bandWeight(yTop, trackingCenter(), 0.1);
  float p = 0.0012 * u_sparkle + tw * (0.006 * u_sparkle + 0.009 * u_trackingNoise);
  float segs = 22.0;
  float xs = v_uv.x * segs + hash12(vec2(L, frame + 3.0)) * 7.0;
  float seg = floor(xs);
  vec4 h = vec4(hash33(vec3(seg, L, frame)), hash12(vec2(seg * 1.3 + L, frame + 11.0)));
  if (h.x < p) {
    float fx = fract(xs);
    float a = h.y * 0.5, b = a + 0.25 + h.z * 0.5;
    float dash = smoothstep(a, a + 0.05, fx) * (1.0 - smoothstep(b - 0.15, b, fx));
    Y += dash * (0.18 + 0.3 * h.w);
    iq += dash * vec2(0.13, 0.1);
  }
  Y += tw * u_trackingNoise * 0.05 * (hash12(vec2(gl_FragCoord.x * 0.5, L + frame * 5.0)) - 0.5);

  // Head-switching band exposed by the vertical jump: dark with a bright line at its edge.
  float ySrc = yTop - jump;
  if (ySrc < 0.0) {
    float edge = smoothstep(-0.006, 0.0, ySrc);
    Y = mix(Y, 0.06, 1.0 - edge * 0.3);
    iq = mix(iq, vec2(-0.15, 0.12), edge);
    Y += edge * 0.25;
  }
  // Unstable chroma at the start of each line (left edge).
  float lw = 0.0075 * res.x;
  if (gl_FragCoord.x < lw) {
    vec3 r = hash33(vec3(L, frame, 5.0));
    iq = mix(iq, (r.xy - 0.5) * 0.5, 0.85 * (1.0 - gl_FragCoord.x / lw * 0.5));
    Y += (r.z - 0.3) * 0.12;
  }

  // Flicker.
  Y *= 1.0 + u_flicker * 0.5 * (valueNoise(vec2(t * 11.0, 0.5)) - 0.5) * 2.0;

  vec3 rgb = yiq2rgb(vec3(Y, iq));
  fragColor = vec4(saturate(rgb), geo.a);
}`,
  },
  render(ctx) {
    const p = ctx.params;
    const W = ctx.width;
    const samp = W / Math.max(16, num(p, 'samples'));
    const geo = ctx.pass('geom');
    const sl = num(p, 'softness') * samp * 1.4;
    const sc = samp * (2.2 + 1.5 * num(p, 'softness'));
    const lumaB = ctx.blur(geo, sl, 0);
    const chromaB = ctx.blur(geo, sc, sc * 0.12);
    const chromaW = ctx.blur(geo, samp * 2.5, 0);
    const out = ctx.pass('main', { inputs: { u_geo: geo, u_lumaB: lumaB, u_chromaB: chromaB, u_chromaW: chromaW } });
    ctx.release(geo);
    ctx.release(lumaB);
    ctx.release(chromaB);
    ctx.release(chromaW);
    return out;
  },
};
