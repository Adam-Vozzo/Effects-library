import type { EffectDef } from '../../engine/types';
import type { Texture } from '../../engine/gl';
import { angle, bool, flag, float, int, num, point } from '../helpers';
import { FOCUS_MASK_GLSL } from './shared';

// Lens blur with an elliptical focus mask. The bokeh is gathered on a reduced-resolution copy in
// linear light; bright pixels are boosted (invertible "inverse tonemap") before the gather so
// highlights bloom into aperture-shaped discs, then un-boosted and composited with the sharp input.

const COMMON = /* glsl */ `
${FOCUS_MASK_GLSL}
#define GOLDEN 2.39996323
const float BOOST_T = 0.6; // linear luminance where the highlight boost starts
const float BOOST_G = 20.0; // boost gain (white ends up ~4.2x brighter during the gather)
vec3 boostHighlights(vec3 c) {
  float l = luma(c);
  float x = max(l - BOOST_T, 0.0);
  return c * ((l + BOOST_G * x * x) / max(l, 1e-6));
}
vec3 unboostHighlights(vec3 c) {
  float lb = luma(c);
  if (lb <= BOOST_T) return c;
  float x = (sqrt(1.0 + 4.0 * BOOST_G * (lb - BOOST_T)) - 1.0) / (2.0 * BOOST_G);
  return c * ((BOOST_T + x) / lb);
}
// Blur amount (0 = in focus, 1 = full blur) from the elliptical focus mask.
float blurAmount(vec2 uv, vec2 res) {
  float m = focusMask(uv, res, pointToUv(u_center), u_radius, u_falloff, u_stretch, u_maskRotation);
  return u_invert ? m : 1.0 - m;
}
// Distance from the aperture centre to its edge along direction th (circumradius 1).
float apertureEdge(float th) {
  float n = floor(u_blades + 0.5);
  float seg = TAU / n;
  float phi = mod(th - radians(u_apertureRotation) - PI * 0.5, seg) - seg * 0.5;
  float poly = cos(PI / n) / cos(phi);
  return mix(poly, 1.0, u_bladeRoundness);
}
// Aperture transmission at normalized radius r (1 = edge): feathered rim, catadioptric hole.
float apertureTransmission(float r) {
  float f = u_apertureFeather;
  float t = 1.0 - smoothstep(1.0 - f, 1.0 + 1e-4, r);
  float c = u_catadioptric;
  if (c > 0.0) t *= smoothstep(c - 1e-4, c + f * c + 1e-4, r);
  return t;
}
`;

export const depthOfField: EffectDef = {
  id: 'depth-of-field',
  name: 'Depth of field',
  category: 'Blur',
  keywords: 'aperture background blur bokeh cinematic depth field focus',
  params: [
    point('center', 'center', [0, 0]),
    float('radius', 'radius', 0.01, 4, 0.35),
    float('stretch', 'aspect stretch', 0, 5, 0, 0.05),
    angle('maskRotation', 'mask rotation', -180, 180, 0),
    float('falloff', 'falloff', 0.5, 6, 2, 0.1),
    float('blurStrength', 'blur strength', 0, 0.1, 0.01, 0.001),
    int('samples', 'samples', 10, 1000, 150, { step: 10 }),
    int('blades', 'blades', 3, 10, 6),
    float('bladeRoundness', 'blade roundness', 0, 1, 0),
    angle('apertureRotation', 'aperture rotation', -180, 180, 0),
    float('apertureFeather', 'aperture feather', 0, 0.9, 0),
    float('anamorphic', 'anamorphic stretch', 1, 3, 1),
    float('catadioptric', 'catadioptric', 0, 0.7, 0),
    bool('invert', 'invert mask', false),
    bool('debugMask', 'debug mask', false, { noRandom: true }),
    bool('debugAperture', 'debug aperture', false, { noRandom: true }),
  ],
  shaders: {
    // Downsample to the work resolution: premultiplied, linear, highlight-boosted
    // (u_convert = false: plain box downsample of an already converted texture).
    prep: /* glsl */ `
${COMMON}
uniform sampler2D u_src;
uniform vec2 u_factor;  // source px per target texel
uniform float u_taps;   // taps per axis
uniform float u_store;  // scale keeping boosted values in range for 8-bit targets
uniform bool u_convert;
void main() {
  vec2 srcSize = vec2(textureSize(u_src, 0));
  int n = int(u_taps + 0.5);
  vec2 st = u_factor / srcSize / float(n);
  vec4 acc = vec4(0.0);
  for (int y = 0; y < 16; y++) {
    if (y >= n) break;
    for (int x = 0; x < 16; x++) {
      if (x >= n) break;
      vec4 s = texture(u_src, v_uv + (vec2(x, y) - 0.5 * float(n - 1)) * st);
      acc += u_convert ? vec4(boostHighlights(srgbToLinear(s.rgb)) * s.a * u_store, s.a) : s;
    }
  }
  fragColor = acc / float(n * n);
}`,
    // Bokeh gather: golden-angle spiral warped into the aperture polygon, radius = local CoC.
    gather: /* glsl */ `
${COMMON}
uniform sampler2D u_prep;
uniform float u_cocScale; // CoC radius at full blur, in work texels
uniform float u_cocMax;   // largest CoC this level handles (work texels)
uniform float u_count;    // samples at u_cocMax
void main() {
  float coc = min(u_cocScale * blurAmount(v_uv, u_resolution), u_cocMax);
  if (coc < 0.5) { fragColor = texture(u_prep, v_uv); return; }
  float rel = coc / u_cocMax;
  // Fewer samples for smaller discs keeps the sample spacing (and look) constant.
  int n = int(clamp(ceil(u_count * rel * rel), min(u_count, 12.0), u_count));
  float c2 = u_catadioptric * u_catadioptric;
  float jitter = ign(gl_FragCoord.xy) * GOLDEN;
  vec2 texel = 1.0 / u_resolution;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 1000; i++) {
    if (i >= n) break;
    float u = (float(i) + 0.5) / float(n);
    float r = sqrt(c2 + (1.0 - c2) * u);
    float th = float(i) * GOLDEN + jitter;
    float e = apertureEdge(th);
    // e^2 compensates the density change of the radial warp.
    float w = e * e * apertureTransmission(r);
    vec2 off = vec2(cos(th), sin(th)) * (r * e * coc);
    off.y *= u_anamorphic;
    // Explicit LOD: the trip count varies per pixel, so avoid implicit-derivative fetches.
    acc += textureLod(u_prep, v_uv + off * texel, 0.0) * w;
    wsum += w;
  }
  fragColor = acc / max(wsum, 1e-6);
}`,
    main: /* glsl */ `
${COMMON}
uniform sampler2D u_bokeh;  // coarse level
uniform sampler2D u_mid;    // finer level for small CoCs (when u_hasMid)
uniform float u_cocMaxPx;   // max CoC radius in full-res px
uniform float u_factor;     // full-res px per coarse texel
uniform float u_midFactor;  // full-res px per mid texel
uniform float u_store;
uniform bool u_hasBokeh;
uniform bool u_hasMid;
vec4 bokeh(sampler2D t, float factor) {
  vec4 b = factor > 1.01 ? textureBicubic(t, v_uv) : texture(t, v_uv);
  return b.a > 1e-5 ? vec4(unboostHighlights(max(b.rgb / (b.a * u_store), 0.0)), saturate(b.a)) : vec4(0.0);
}
void main() {
  vec4 base = texture(u_input, v_uv);
  if (u_debugAperture) {
    // Aperture kernel, filling ~80% of the image height.
    vec2 p = centered(v_uv, u_resolution) * u_anamorphic / 0.4;
    p.y /= u_anamorphic;
    float th = atan(p.y, p.x);
    float r = length(p) / apertureEdge(th);
    float aa = fwidth(r) + 1e-4;
    float t = apertureTransmission(r);
    t *= 1.0 - smoothstep(1.0 - aa, 1.0 + aa, r);
    fragColor = vec4(vec3(t), 1.0);
    return;
  }
  float amt = blurAmount(v_uv, u_resolution);
  if (u_debugMask) { fragColor = vec4(vec3(amt), 1.0); return; }
  if (!u_hasBokeh) { fragColor = base; return; }
  float coc = u_cocMaxPx * amt;
  vec4 b = bokeh(u_bokeh, u_factor);
  // Fade sharp -> (mid ->) coarse; each level takes over once the CoC spans about one of its texels.
  float t = saturate(coc / u_factor);
  if (u_hasMid) {
    b = mix(bokeh(u_mid, u_midFactor), b, saturate((coc - u_factor) / (0.5 * u_factor)));
    t = saturate(coc / u_midFactor);
  }
  vec3 col = b.a > 0.0 ? linearToSrgb(b.rgb) : base.rgb;
  fragColor = vec4(mix(base.rgb, col, t), mix(base.a, b.a, t));
}`,
  },
  render(ctx) {
    const p = ctx.params;
    const W = ctx.width;
    const H = ctx.height;
    const R = num(p, 'blurStrength') * H; // max CoC radius in full-res px (relative to image height, like the mask)
    const debug = flag(p, 'debugMask') || flag(p, 'debugAperture');
    if (R < 0.5) return debug ? ctx.pass('main', { uniforms: { u_hasBokeh: false, u_hasMid: false, u_factor: 1, u_midFactor: 1, u_cocMaxPx: 0, u_store: 1 } }) : ctx.input;
    const N = Math.round(num(p, 'samples'));
    // Work resolution: about one (export) or 1.5 (preview) texels between neighbouring samples,
    // so no sample budget is wasted on detail the gather cannot resolve anyway.
    const area = Math.PI * R * R * Math.max(1, num(p, 'anamorphic')); // largest bokeh disc, px^2
    const k = ctx.exporting ? 1 : 1.5;
    let f = Math.max(1, Math.sqrt(area / N) / k);
    const needed = (ff: number) => Math.min(N, Math.ceil(area / (ff * ff * k * k)));
    // Keep interactive previews under ~3e8 texture fetches.
    if (!ctx.exporting) while (needed(f) * ((W * H) / (f * f)) > 3e8 && f < 64) f *= 1.15;
    const count = Math.max(1, needed(f));
    const ww = Math.max(1, Math.round(W / f));
    const wh = Math.max(1, Math.round(H / f));
    const fx = W / ww;
    const store = ctx.format === 'rgba8' ? 0.2 : 1;
    // Each bilinear tap averages 2x2 texels; footprints wider than 16 taps go through an intermediate size.
    const down = (src: Texture, tw: number, th: number, convert: boolean) => {
      const sx = src.width / tw;
      const sy = src.height / th;
      const taps = Math.min(16, Math.max(1, Math.ceil(Math.max(sx, sy) / 2)));
      return ctx.pass('prep', { width: tw, height: th, inputs: { u_src: src }, uniforms: { u_factor: [sx, sy], u_taps: taps, u_store: store, u_convert: convert } });
    };
    const prepare = (tw: number, th: number) => {
      const ff = W / tw;
      if (ff <= 32) return down(ctx.input, tw, th, true);
      const f1 = Math.sqrt(ff);
      const half = down(ctx.input, Math.max(tw, Math.round(W / f1)), Math.max(th, Math.round(H / f1)), true);
      const out = down(half, tw, th, false);
      ctx.release(half);
      return out;
    };
    // Gather one level: CoC radius `scale` at full blur, capped at `cap` (both in that level's texels).
    const gather = (tw: number, th: number, scale: number, cap: number, n: number) => {
      const prep = prepare(tw, th);
      const out = ctx.pass('gather', { width: tw, height: th, inputs: { u_prep: prep }, uniforms: { u_cocScale: scale, u_cocMax: cap, u_count: n } });
      ctx.release(prep);
      return out;
    };
    const coarse = gather(ww, wh, R / fx, R / fx, count);
    // Strong blurs run on a coarse grid; a 4x finer level covers small CoCs (up to 1.5 coarse
    // texels) so the focus transition doesn't cross-fade sharp pixels with a much blurrier image.
    let mid: Texture | null = null;
    let fm = 1;
    if (f >= 4) {
      const mw = Math.max(1, Math.round(W / (f / 4)));
      const mh = Math.max(1, Math.round(H / (f / 4)));
      fm = W / mw;
      const cap = Math.min(R, 1.5 * fx);
      mid = gather(mw, mh, R / fm, cap / fm, Math.max(1, Math.min(N, Math.ceil((area * (cap / R) ** 2) / (fm * fm * k * k)))));
    }
    const out = ctx.pass('main', {
      inputs: { u_bokeh: coarse, u_mid: mid ?? coarse },
      uniforms: { u_hasBokeh: true, u_hasMid: !!mid, u_cocMaxPx: R, u_factor: fx, u_midFactor: fm, u_store: store },
    });
    ctx.release(coarse);
    if (mid) ctx.release(mid);
    return out;
  },
};
