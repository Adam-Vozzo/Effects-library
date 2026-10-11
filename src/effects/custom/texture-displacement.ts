import type { EffectDef } from '../../engine/types';
import { bool, choice, curve, float, num, texture } from '../helpers';
import { DEFAULT_TEX_SIZE, FIT_GLSL, FIT_OPTIONS, VEINS_GLSL } from './shared';

/** Longest side of the displacement map: fixed relative to the image so the look is identical at any export size. */
const MAP_MAX = 2048;

/**
 * Displace the image by a map (user texture, or a procedural vein texture): red drives x, green drives y, mid grey
 * = no shift. Passes: map (fit + curve) → separable blur → displace.
 */
export const textureDisplacement: EffectDef = {
  id: 'texture-displacement',
  name: 'Displacement',
  category: 'Custom',
  keywords: 'displace distort map offset texture warp',
  params: [
    texture('texture', 'Texture'),
    choice('fitType', 'Fit type', FIT_OPTIONS, 0, 'switcher'),
    float('textureScale', 'texture scale', 1, 5, 1),
    curve('mapCurve', 'map curve'),
    choice('direction', 'Direction', ['XY', 'X', 'Y'], 0, 'switcher'),
    float('mapBlur', 'map blur', 0, 50, 0, 0.1),
    float('amount', 'amount', 0, 10, 1),
    bool('debugMap', 'debug map', false),
  ],
  shaders: {
    map: /* glsl */ `
${FIT_GLSL}
${VEINS_GLSL}
void main() {
  vec2 texSize = u_textureLoaded ? u_textureSize : vec2(${DEFAULT_TEX_SIZE}.0);
  vec2 tuv = fitTexUv(v_uv, u_resolution, texSize, u_fitType, 1.0, u_textureScale, 0.0);
  vec3 m = u_textureLoaded ? sampleFitted(u_texture, tuv, u_fitType, false).rgb : veinsTexture(tuv).rgb;
  fragColor = vec4(lut1(u_mapCurve, m.r), lut1(u_mapCurve, m.g), lut1(u_mapCurve, m.b), 1.0);
}`,
    main: /* glsl */ `
uniform sampler2D u_map;
void main() {
  vec3 m = textureBicubic(u_map, v_uv).rgb;
  if (u_debugMap) {
    fragColor = vec4(saturate(m), 1.0);
    return;
  }
  // Map in image orientation: red pushes along +x, green along -y (down), as in top-left-origin maps.
  vec2 d = (m.rg - 0.5) * vec2(1.0, -1.0);
  if (u_direction == 1) d.y = 0.0;
  if (u_direction == 2) d.x = 0.0;
  // amount 1 shifts up to ~21 reference px at the map extremes.
  vec2 off = d * u_amount * 42.0 * u_pxScale / u_resolution;
  fragColor = texture(u_input, mirrorUv(v_uv - off));
}`,
  },
  render(ctx) {
    const s = Math.min(1, MAP_MAX / Math.max(ctx.width, ctx.height));
    const mw = Math.max(1, Math.round(ctx.width * s));
    const mh = Math.max(1, Math.round(ctx.height * s));
    const map = ctx.pass('map', { width: mw, height: mh });
    const sigma = num(ctx.params, 'mapBlur') * ctx.pxScale * s;
    let blurred = map;
    if (sigma > 0.3) {
      blurred = ctx.blur(map, sigma);
      ctx.release(map);
    }
    const out = ctx.pass('main', { inputs: { u_map: blurred } });
    ctx.release(blurred);
    return out;
  },
};
