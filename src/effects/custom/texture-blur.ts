import type { EffectDef } from '../../engine/types';
import type { Texture } from '../../engine/gl';
import { bool, choice, curve, float, num, texture } from '../helpers';
import { DEFAULT_TEX_SIZE, FIT_GLSL, FIT_OPTIONS, SPECKLE_GLSL } from './shared';

const LEVELS = 10;
/** Blur sigma (reference px) at blur strength 1 and texture strength 1. */
const SIGMA_REF = 72;
/** Effective gaussian sigma of pyramid level k is about LEVEL_SIGMA * 2^k render px. */
const LEVEL_SIGMA = 0.9;

const levelUniforms = Array.from({ length: LEVELS }, (_, i) => `uniform sampler2D u_l${i + 1};`).join('\n');
const levelSwitch = Array.from({ length: LEVELS }, (_, i) => `  if (k == ${i + 1}) return textureBSpline(u_l${i + 1}, uv);`).join('\n');

/**
 * Blur whose radius per pixel comes from a texture (or a procedural speckle texture). A box-filtered pyramid in
 * linear light is sampled with smooth B-spline upsampling and blended between levels, so the cost does not
 * depend on the radius and the look holds at any export size.
 */
export const textureBlur: EffectDef = {
  id: 'texture-blur',
  name: 'Texture Blur',
  category: 'Custom',
  params: [
    texture('texture', 'Texture'),
    choice('fitType', 'Fit type', FIT_OPTIONS, 0, 'switcher'),
    float('textureScale', 'texture scale', 1, 5, 1),
    float('blurStrength', 'blur strength', 0, 0.5, 0.5, 0.001),
    float('highlightBoost', 'highlight boost', 0, 1, 0),
    float('textureInfluence', 'texture influence', 0, 1, 1, 0.1),
    curve('strengthCurve', 'Strength curve'),
    bool('previewTexture', 'Preview texture', false),
  ],
  shaders: {
    // Full res -> half res, linear light with highlight boost.
    prep: /* glsl */ `
uniform vec2 u_srcTexel;
vec3 boosted(vec2 uv) {
  vec3 c = srgbToLinear(texture(u_input, uv).rgb);
  float h = smoothstep(0.45, 1.0, luma(c));
  return c * (1.0 + u_highlightBoost * 6.0 * h * h);
}
void main() {
  vec2 o = u_srcTexel;
  vec3 c = boosted(v_uv + vec2(-o.x, -o.y)) + boosted(v_uv + vec2(o.x, -o.y)) + boosted(v_uv + vec2(-o.x, o.y)) + boosted(v_uv + o);
  fragColor = vec4(c * 0.25, 1.0);
}`,
    down: /* glsl */ `
uniform sampler2D u_src;
uniform vec2 u_srcTexel;
void main() {
  vec2 o = u_srcTexel;
  vec4 c = texture(u_src, v_uv + vec2(-o.x, -o.y)) + texture(u_src, v_uv + vec2(o.x, -o.y))
         + texture(u_src, v_uv + vec2(-o.x, o.y)) + texture(u_src, v_uv + o);
  fragColor = c * 0.25;
}`,
    main: /* glsl */ `
${FIT_GLSL}
${SPECKLE_GLSL}
${levelUniforms}
uniform int u_levels;
uniform float u_levelSigma;
// Cubic B-spline (smooth, no ringing) reconstruction from 4 bilinear taps.
vec4 textureBSpline(sampler2D t, vec2 uv) {
  vec2 size = vec2(textureSize(t, 0));
  vec2 st = uv * size - 0.5;
  vec2 i = floor(st), f = st - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i - 0.5 + w1 / g0) / size;
  vec2 h1 = (i + 1.5 + w3 / g1) / size;
  return (textureLod(t, vec2(h0.x, h0.y), 0.0) * g0.x + textureLod(t, vec2(h1.x, h0.y), 0.0) * g1.x) * g0.y
       + (textureLod(t, vec2(h0.x, h1.y), 0.0) * g0.x + textureLod(t, vec2(h1.x, h1.y), 0.0) * g1.x) * g1.y;
}
vec4 level(int k, vec2 uv) {
${levelSwitch}
  return textureBSpline(u_l1, uv);
}
vec3 boostedInput(vec2 uv) {
  vec3 c = srgbToLinear(texture(u_input, uv).rgb);
  float h = smoothstep(0.45, 1.0, luma(c));
  return c * (1.0 + u_highlightBoost * 6.0 * h * h);
}
void main() {
  vec2 texSize = u_textureLoaded ? u_textureSize : vec2(${DEFAULT_TEX_SIZE}.0);
  vec2 tuv = fitTexUv(v_uv, u_resolution, texSize, u_fitType, 1.0, u_textureScale, 0.0);
  vec3 tc = u_textureLoaded ? sampleFitted(u_texture, tuv, u_fitType, false).rgb : speckleTexture(tuv).rgb;
  if (u_previewTexture) {
    fragColor = vec4(tc, 1.0);
    return;
  }
  float s = mix(1.0, lut1(u_strengthCurve, luma(saturate(tc))), u_textureInfluence);
  float sigma = u_blurStrength * s * ${SIGMA_REF}.0 * u_pxScale;
  // Pyramid level with the matching sigma; below level 1 fade from the sharp input.
  float f = log2(max(sigma, 1e-4) / u_levelSigma);
  vec4 src = texture(u_input, v_uv);
  vec3 c;
  if (f < 1.0) {
    float t = saturate(sigma / (u_levelSigma * 2.0));
    c = mix(boostedInput(v_uv), level(1, v_uv).rgb, t);
  } else {
    float lf = min(f, float(u_levels));
    int k = int(floor(lf));
    vec3 a = level(k, v_uv).rgb;
    vec3 b = k < u_levels ? level(k + 1, v_uv).rgb : a;
    c = mix(a, b, lf - float(k));
  }
  // Boosted highlights roll off smoothly instead of clipping.
  c = linearToSrgb(c);
  float knee = 1.0 - 0.25 * u_highlightBoost;
  c = min(c, knee) + (1.0 - knee) * (1.0 - exp(-max(c - knee, 0.0) / max(1.0 - knee, 1e-4)));
  fragColor = vec4(c, src.a);
}`,
  },
  render(ctx) {
    const p = ctx.params;
    const maxSigma = num(p, 'blurStrength') * SIGMA_REF * ctx.pxScale;
    // Levels needed for the largest possible sigma (texture strength 1), limited by the image size.
    let n = 1;
    while (n < LEVELS && LEVEL_SIGMA * 2 ** n < maxSigma && Math.min(ctx.width, ctx.height) / 2 ** (n + 1) >= 2) n++;
    const levels: Texture[] = [];
    let w = Math.max(1, Math.ceil(ctx.width / 2));
    let h = Math.max(1, Math.ceil(ctx.height / 2));
    levels.push(ctx.pass('prep', { width: w, height: h, uniforms: { u_srcTexel: [1 / ctx.width, 1 / ctx.height] } }));
    for (let i = 1; i < n; i++) {
      const src = levels[i - 1];
      w = Math.max(1, Math.ceil(w / 2));
      h = Math.max(1, Math.ceil(h / 2));
      levels.push(ctx.pass('down', { width: w, height: h, inputs: { u_src: src }, uniforms: { u_srcTexel: [1 / src.width, 1 / src.height] } }));
    }
    const inputs: Record<string, Texture> = {};
    for (let i = 0; i < LEVELS; i++) inputs[`u_l${i + 1}`] = levels[Math.min(i, levels.length - 1)];
    const out = ctx.pass('main', { inputs, uniforms: { u_levels: levels.length, u_levelSigma: LEVEL_SIGMA } });
    for (const t of levels) ctx.release(t);
    return out;
  },
};
