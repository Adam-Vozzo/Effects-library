import type { EffectDef } from '../../engine/types';
import { blendMode, float, num } from '../helpers';

export const gaussianBlur: EffectDef = {
  id: 'gaussian-blur',
  name: 'Gaussian blur',
  category: 'Blur',
  keywords: 'background blur filter gaussian noise reduction soft',
  params: [
    float('strength', 'strength', 0.3, 50, 14),
    float('aspect', 'aspect', -2, 2, 0),
    float('opacity', 'opacity', 0, 1, 1),
    blendMode(),
  ],
  shaders: {
    main: /* glsl */ `
uniform sampler2D u_blurred;
void main() {
  vec4 base = texture(u_input, v_uv);
  vec4 b = texture(u_blurred, v_uv);
  vec3 c = blendMode(u_blendMode, base.rgb, b.rgb);
  fragColor = vec4(mix(base.rgb, c, u_opacity), mix(base.a, b.a, u_opacity));
}`,
  },
  render(ctx) {
    const s = num(ctx.params, 'strength') * ctx.pxScale;
    const a = num(ctx.params, 'aspect');
    const blurred = ctx.blur(ctx.input, s * Math.pow(2, a), s * Math.pow(2, -a));
    const out = ctx.pass('main', { inputs: { u_blurred: blurred } });
    ctx.release(blurred);
    return out;
  },
};
