import type { EffectDef } from '../../engine/types';
import { bool, color, float, flag, int, num } from '../helpers';
import { THRESHOLD_BLEND_LABELS, THRESHOLD_BLEND_LIB, libBlend, numberedHint } from './common-b';

// Threshold → optional outlines → blend with the image.
// 1. ink mask: Rec.601 luma below `threshold` (effect.app's luma); in edge mode an adaptive threshold
//    (contrast-boosted luma minus its local gaussian mean over `distance` px, biased by `offset amount`)
//    gives a sketchy edge drawing.
// 2. `outline` px: the ink mask is blurred and its level sets give an outer / inner / centered contour
//    stroke (outline type 0 / 1 / 2); `outline strength` fades the fill out so 1 = pure line art.
// 3. ink is painted with `color` on white and blended over the image (numeric blend mode slider as on
//    effect.app; the default 5 = Multiply keeps bright areas and inks the dark ones).
const OUTLINE_TYPES = ['Outer', 'Inner', 'Center'];

export const threshold: EffectDef = {
  id: 'threshold',
  name: 'Threshold',
  category: 'Effects',
  keywords: 'black contrast detection edge graphic high posterization threshold white',
  params: [
    int('threshold', 'threshold', 0, 255, 128),
    bool('edgeMode', 'edge mode', false),
    int('offsetAmount', 'offset amount', 0, 10, 0),
    int('distance', 'distance', 1, 50, 1),
    int('outline', 'outline', 0, 10, 0),
    float('outlineStrength', 'outline strength', 0, 1, 1),
    int('outlineType', 'outline type', 0, 2, 0, { hint: numberedHint(OUTLINE_TYPES) }),
    float('blendStrength', 'blend strength', 0, 1, 1),
    int('blendMode', 'blend mode', 0, 6, 5, { hint: numberedHint(THRESHOLD_BLEND_LABELS) }),
    color('color', 'color', '#000000'),
  ],
  uniforms: (p) => ({ u_libMode: libBlend(THRESHOLD_BLEND_LIB, num(p, 'blendMode')) }),
  shaders: {
    // Luma (and, in edge mode, its local mean) → ink mask in r.
    luma: /* glsl */ `
void main() {
  float l = luma601(saturate(texture(u_input, v_uv).rgb));
  fragColor = vec4(l, l, l, 1.0);
}`,
    mask: /* glsl */ `
uniform sampler2D u_luma;
uniform sampler2D u_mean;
uniform bool u_adaptive;
void main() {
  float l = texture(u_luma, v_uv).r;
  float t = u_threshold / 255.0;
  float ink;
  if (u_adaptive) {
    float m = texture(u_mean, v_uv).r;
    float hp = (l - m) * 4.0 + 0.5 + u_offsetAmount * 0.02;
    ink = step(hp, t - 1e-4);
  } else {
    ink = step(l, t - 1e-4);
  }
  fragColor = vec4(ink, ink, ink, 1.0);
}`,
    main: /* glsl */ `
uniform sampler2D u_mask;
uniform sampler2D u_maskBlur;
uniform bool u_hasOutline;
uniform int u_libMode;
void main() {
  vec4 src = texture(u_input, v_uv);
  float ink = texture(u_mask, v_uv).r;
  if (u_hasOutline) {
    // Blurred binary mask: level set b = Phi(d / sigma) for signed distance d into the ink, sigma = r / 2.
    float b = texture(u_maskBlur, v_uv).r;
    float band;
    if (u_outlineType < 0.5) band = smoothstep(0.012, 0.035, b) * (1.0 - ink);            // 0..r outside
    else if (u_outlineType < 1.5) band = (1.0 - smoothstep(0.965, 0.988, b)) * ink;       // 0..r inside
    else band = smoothstep(0.13, 0.19, b) * (1.0 - smoothstep(0.81, 0.87, b));            // r/2 each side
    ink = max(band, ink * (1.0 - u_outlineStrength));
  }
  vec3 art = mix(vec3(1.0), u_color, ink);
  vec3 c = blendMode(u_libMode, saturate(src.rgb), art);
  fragColor = vec4(mix(src.rgb, c, u_blendStrength), src.a);
}`,
  },
  render(ctx) {
    const p = ctx.params;
    const adaptive = flag(p, 'edgeMode');
    const luma = ctx.pass('luma');
    let mean = luma;
    if (adaptive) mean = ctx.blur(luma, Math.max(0.5, num(p, 'distance') * ctx.pxScale));
    const mask = ctx.pass('mask', { inputs: { u_luma: luma, u_mean: mean }, uniforms: { u_adaptive: adaptive } });
    if (mean !== luma) ctx.release(mean);
    ctx.release(luma);
    const r = num(p, 'outline') * ctx.pxScale;
    const hasOutline = r > 0.25;
    const maskBlur = hasOutline ? ctx.blur(mask, r * 0.5) : mask;
    const out = ctx.pass('main', { inputs: { u_mask: mask, u_maskBlur: maskBlur }, uniforms: { u_hasOutline: hasOutline } });
    if (maskBlur !== mask) ctx.release(maskBlur);
    ctx.release(mask);
    return out;
  },
};
