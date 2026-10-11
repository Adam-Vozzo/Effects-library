import type { EffectDef, RenderContext } from '../../engine/types';
import type { Texture } from '../../engine/gl';
import { angle, blendMode, bool, flag, float, num } from '../helpers';
import { FOCUS_MASK_GLSL, focusMaskParams, LINE_BLUR_GLSL } from './shared';

const maskOn = (p: Record<string, unknown>) => !!p.maskEnable;

/**
 * Directional blur along `dir` (unit, px space) covering offsets [a, b] px, in premultiplied linear light.
 * Long kernels are split into a fine box pass and a coarse weighted pass (n1 + n2 taps instead of n1 * n2).
 */
function lineBlur(ctx: RenderContext, src: Texture, dir: [number, number], a: number, b: number, sigma: number, toLinear: boolean): Texture {
  const extent = b - a;
  const fmt = ctx.format;
  if (extent <= 48) {
    const n = Math.max(1, Math.ceil(extent) + 1);
    return ctx.pass('line', {
      inputs: { u_src: src },
      uniforms: { u_dirPx: dir, u_start: n > 1 ? a : (a + b) / 2, u_step: n > 1 ? extent / (n - 1) : 0, u_count: n, u_sigma: sigma, u_toLinear: toLinear },
      format: fmt,
    });
  }
  // Coarse taps at spacing s2 (~sqrt(extent)); each is pre-smeared by a fine box so the comb fills in.
  const n2 = Math.max(2, Math.min(400, Math.round(Math.sqrt(extent))));
  const s2 = extent / n2;
  // Box kernels tile exactly with width s2; gaussian ones overlap 2x for a smoother staircase.
  const fineW = sigma > 0 ? 2 * s2 : s2;
  // Midpoint taps (<= 1px apart) so neighbouring boxes tile without double-counting their seams.
  const n1 = Math.min(400, Math.ceil(fineW));
  const fine = ctx.pass('line', {
    inputs: { u_src: src },
    uniforms: { u_dirPx: dir, u_start: -fineW / 2 + fineW / n1 / 2, u_step: fineW / n1, u_count: n1, u_sigma: 0, u_toLinear: toLinear },
    format: fmt,
  });
  const out = ctx.pass('line', {
    inputs: { u_src: fine },
    uniforms: { u_dirPx: dir, u_start: a + s2 / 2, u_step: s2, u_count: n2, u_sigma: sigma, u_toLinear: false },
    format: fmt,
  });
  ctx.release(fine);
  return out;
}

export const motionBlur: EffectDef = {
  id: 'motion-blur',
  name: 'Motion blur',
  category: 'Blur',
  keywords: 'action blur camera motion movement speed',
  params: [
    float('strength', 'strength', 0.3, 50, 20),
    angle('angle', 'angle', 0, 360, 0),
    bool('box', 'box', false),
    bool('bothDirections', 'both directions', true),
    blendMode(),
    float('opacity', 'opacity', 0, 1, 1),
    bool('maskEnable', 'enable mask', false),
    ...focusMaskParams(maskOn),
  ],
  shaders: {
    line: LINE_BLUR_GLSL,
    main: /* glsl */ `
${FOCUS_MASK_GLSL}
uniform sampler2D u_blurred; // premultiplied linear
void main() {
  vec4 base = texture(u_input, v_uv);
  float amt = 1.0;
  if (u_maskEnable) {
    float m = focusMask(v_uv, u_resolution, pointToUv(u_maskCenter), u_maskRadius, u_maskFalloff, u_maskStretch, u_maskRotation);
    amt = u_maskInvert ? m : 1.0 - m;
    if (u_maskDebug) { fragColor = vec4(vec3(amt), 1.0); return; }
  }
  vec4 b = texture(u_blurred, v_uv);
  vec3 bc = b.a > 1e-6 ? linearToSrgb(b.rgb / b.a) : base.rgb;
  vec3 c = u_blendMode == 0 ? bc : blendMode(u_blendMode, saturate(base.rgb), saturate(bc));
  float k = u_opacity * amt;
  fragColor = vec4(mix(base.rgb, c, k), mix(base.a, b.a, k));
}`,
  },
  render(ctx) {
    const p = ctx.params;
    // effect.app's kernel: gaussian with sigma = strength, truncated at ~2.4 sigma, mixed in linear light.
    const sigma = Math.max(0.05, num(p, 'strength') * ctx.pxScale);
    const L = 2.4 * sigma;
    const th = (num(p, 'angle') * Math.PI) / 180;
    const dir: [number, number] = [Math.cos(th), Math.sin(th)];
    const both = flag(p, 'bothDirections');
    // One direction: sample behind the pixel so content trails along +angle.
    const [a, b] = both ? [-L, L] : [-L, 0];
    const blurred = lineBlur(ctx, ctx.input, dir, a, b, flag(p, 'box') ? 0 : sigma, true);
    const out = ctx.pass('main', { inputs: { u_blurred: blurred } });
    ctx.release(blurred);
    return out;
  },
};
