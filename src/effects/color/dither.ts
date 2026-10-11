import type { EffectDef, RenderContext } from '../../engine/types';
import { textureFromFloat } from '../../engine/gl';
import { choice, float, int, num, palette } from '../helpers';
import { linearToOklab, srgbToLinear1, type RGB } from './color-math';
import { buildPatternAtlas, PATTERNS } from './dither-patterns';
import { CUSTOM_DEFAULT, PRESET_NAMES, PRESETS, extractPalette, sortByLuma, spreadSubset } from './dither-palettes';

const MAXC = 18;
const OPTIONS = ['Adaptive', ...PRESET_NAMES, 'Custom'];
const CUSTOM = OPTIONS.length - 1;

/** Palette (luminance-sorted sRGB) for the current settings. */
function currentPalette(ctx: RenderContext, count: number): RGB[] {
  const p = ctx.params;
  const preset = Math.round(num(p, 'palettePreset'));
  if (preset === CUSTOM) {
    const cols = (p.palette as string[] | undefined)?.length ? (p.palette as string[]) : CUSTOM_DEFAULT;
    return spreadSubset(cols.slice(0, MAXC), count);
  }
  if (preset >= 1 && preset < CUSTOM) return spreadSubset(PRESETS[PRESET_NAMES[preset - 1]], count);
  // Adaptive: k-means on a ~64px copy, cached by a coarse hash so it only reruns when the image changes.
  const s = 64 / Math.max(ctx.width, ctx.height);
  const rw = Math.max(1, Math.round(ctx.width * s));
  const rh = Math.max(1, Math.round(ctx.height * s));
  // Pre-blur to about a tile footprint so the average (and the palette) is the same at any render size.
  const pre = ctx.blur(ctx.input, 0.5 / s);
  const small = ctx.pass('reduce', { width: rw, height: rh, inputs: { u_src: pre } });
  ctx.release(pre);
  const px = ctx.read(small);
  ctx.release(small);
  let h = 2166136261;
  for (let i = 0; i < px.length; i++) h = Math.imul(h ^ Math.round(px[i] * 63), 16777619);
  return ctx.cached(`adaptive:${count}:${rw}x${rh}:${h >>> 0}`, () => extractPalette(px, count));
}

// Ordered dithering to a palette: each pixel block (quantized in a low-res pass) is brightened by
// 1/gamma, offset by (threshold - 0.5) × amplitude and snapped to the nearest palette color under the
// chosen distance (0 RGB, 1 weighted "redmean" RGB, 2 OKLab). Amplitude = strength × max(0.1, half the
// mean nearest-neighbour palette spacing): dense adaptive palettes get effect.app's grainy look while
// sparse palettes (e.g. black/white) dither over their full range at the default strength 2.
// Adaptive palettes are extracted from the unadjusted image.
export const dither: EffectDef = {
  id: 'dither',
  name: 'Dither',
  category: 'Color',
  keywords: 'art color dither dithering halftone pixel print reduction retro vintage palette adaptive',
  params: [
    int('patternType', 'pattern type', 0, PATTERNS.length - 1, 0, { hint: PATTERNS.map((x, i) => `${i} ${x.name}`).join(' · ') }),
    choice('palettePreset', 'palette preset', OPTIONS, 0, 'slider'),
    palette('palette', 'Palette', CUSTOM_DEFAULT, { maxColors: MAXC, visibleIf: (p) => Number(p.palettePreset) === CUSTOM }),
    int('colorCount', 'color count', 2, MAXC, MAXC),
    int('distanceMode', 'distance mode', 0, 2, 2, { hint: '0 = RGB, 1 = weighted RGB, 2 = OKLab' }),
    float('ditherStrength', 'dither strength', 0, 2, 2, 0.1),
    float('gamma', 'gamma', 0.5, 5, 1.6, 0.1),
    int('pixelStep', 'pixelStep', 1, 4, 2),
  ],
  shaders: {
    // Palette extraction source: box-filtered small copy of the (unadjusted) input.
    reduce: /* glsl */ `
uniform sampler2D u_src;
void main() {
  vec4 acc = vec4(0.0);
  for (int j = 0; j < 6; j++)
    for (int i = 0; i < 6; i++) {
      vec2 uv = (gl_FragCoord.xy - 0.5 + (vec2(i, j) + 0.5) / 6.0) / u_resolution;
      acc += saturate(texture(u_src, uv));
    }
  fragColor = acc / 36.0;
}`,
    quantize: /* glsl */ `
#define MAXC ${MAXC}
uniform sampler2D u_src;
uniform sampler2D u_atlas;
uniform sampler2D u_blue;
uniform vec2 u_full;
uniform float u_block;
uniform float u_amp;
uniform int u_patMode;
uniform int u_patOffset;
uniform ivec2 u_patSize;
uniform vec3 u_pal[MAXC];
uniform vec3 u_palLab[MAXC];
uniform int u_palCount;

float threshold(ivec2 p) {
  if (u_patMode == 0) return hash12(vec2(p));
  if (u_patMode == 1) return texelFetch(u_blue, p & 127, 0).r;
  if (u_patMode == 2) return ign(vec2(p));
  ivec2 q = ivec2(p.x % u_patSize.x, p.y % u_patSize.y);
  return texelFetch(u_atlas, ivec2(u_patOffset + q.x, q.y), 0).r;
}
int nearest(vec3 c) {
  vec3 lab = u_distanceMode > 1.5 ? linearToOklab(srgbToLinear(c)) : c;
  float best = 1e20;
  int bi = 0;
  for (int k = 0; k < MAXC; k++) {
    if (k >= u_palCount) break;
    vec3 e = c - u_pal[k];
    float d;
    if (u_distanceMode < 0.5) {
      d = dot(e, e);
    } else if (u_distanceMode < 1.5) {
      float rm = 0.5 * (c.r + u_pal[k].r);
      d = (2.0 + rm) * e.r * e.r + 4.0 * e.g * e.g + (3.0 - rm) * e.b * e.b;
    } else {
      vec3 el = lab - u_palLab[k];
      d = dot(el, el);
    }
    if (d < best) { best = d; bi = k; }
  }
  return bi;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 4; j++)
    for (int i = 0; i < 4; i++) {
      vec2 px = (vec2(p) + (vec2(i, j) + 0.5) / 4.0) * u_block;
      acc += texture(u_src, min(px, u_full - 0.5) / u_full).rgb;
    }
  vec3 c = pow(saturate(acc / 16.0), vec3(1.0 / u_gamma));
  c = saturate(c + (threshold(p) - 0.5) * u_amp);
  fragColor = vec4(u_pal[nearest(c)], 1.0);
}`,
    main: /* glsl */ `
uniform sampler2D u_small;
uniform float u_block;
void main() {
  vec3 c = texelFetch(u_small, ivec2(floor(gl_FragCoord.xy / u_block)), 0).rgb;
  fragColor = vec4(c, texture(u_input, v_uv).a);
}`,
  },
  render(ctx) {
    const p = ctx.params;
    const count = Math.max(2, Math.min(MAXC, Math.round(num(p, 'colorCount'))));
    const cols = sortByLuma(currentPalette(ctx, count));
    const pal = new Float32Array(MAXC * 3);
    const lab = new Float32Array(MAXC * 3);
    cols.slice(0, MAXC).forEach((c, i) => {
      pal.set(c, i * 3);
      lab.set(linearToOklab(srgbToLinear1(c[0]), srgbToLinear1(c[1]), srgbToLinear1(c[2])), i * 3);
    });

    // Mean distance to the nearest other palette color, per channel (Euclidean / sqrt 3).
    let nn = 0;
    for (const a of cols) {
      let best = Infinity;
      for (const b of cols) if (a !== b) best = Math.min(best, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
      nn += Number.isFinite(best) ? best : 0;
    }
    const spacing = nn / Math.max(1, cols.length) / Math.sqrt(3);
    const amp = num(p, 'ditherStrength') * Math.max(0.1, 0.5 * spacing);

    const atlas = ctx.cached('dither-atlas', () => {
      const a = buildPatternAtlas();
      return { tex: textureFromFloat(ctx.gl, a.data, a.width, a.height, { nearest: true }), offsets: a.offsets };
    }, (a) => a.tex.dispose());
    const type = Math.max(0, Math.min(PATTERNS.length - 1, Math.round(num(p, 'patternType'))));
    const src = PATTERNS[type].src;
    const patMode = src.kind === 'hash' ? 0 : src.kind === 'blue' ? 1 : src.kind === 'ign' ? 2 : 3;
    const patSize = src.kind === 'tile' ? [src.w, src.h] : [1, 1];

    // Block size: pixelStep is in effect.app preview pixels (~640px long side) → reference px × 1.5625.
    const block = Math.max(1, Math.round(num(p, 'pixelStep') * ctx.pxScale * 1.5625));
    const bw = Math.ceil(ctx.width / block);
    const bh = Math.ceil(ctx.height / block);
    const blurred = block >= 6 ? ctx.blur(ctx.input, block * 0.25) : null;
    const small = ctx.pass('quantize', {
      width: bw,
      height: bh,
      inputs: { u_src: blurred ?? ctx.input, u_atlas: atlas.tex, u_blue: ctx.builtin('blueNoise') },
      uniforms: {
        u_full: [ctx.width, ctx.height],
        u_block: block,
        u_amp: amp,
        u_patMode: patMode,
        u_patOffset: atlas.offsets[type],
        u_patSize: patSize,
        u_pal: pal,
        u_palLab: lab,
        u_palCount: cols.length,
      },
    });
    if (blurred) ctx.release(blurred);
    const out = ctx.pass('main', { inputs: { u_small: small }, uniforms: { u_block: block } });
    ctx.release(small);
    return out;
  },
};
