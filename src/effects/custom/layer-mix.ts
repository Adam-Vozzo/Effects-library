import type { EffectDef, ParamValues } from '../../engine/types';
import { angle, blendMode, bool, choice, color, curve, float, texture } from '../helpers';
import { CRACKLE_GLSL, DEFAULT_TEX_SIZE, FIT_GLSL, FIT_OPTIONS } from './shared';

const keyOn = (p: ParamValues) => !!p.key;

/**
 * Blend a texture layer over the image: blend modes, Photoshop-style "blend if" ramps, chroma key, track matte.
 * Without a loaded texture a procedural crackle texture stands in for effect.app's default.
 */
export const layerMix: EffectDef = {
  id: 'layer-mix',
  name: 'Layer Mix',
  category: 'Custom',
  keywords: 'blend blend-if curve lut mask mix modes ramp texture',
  params: [
    texture('texture', 'Texture'),
    choice('fitType', 'Fit type', FIT_OPTIONS, 0, 'switcher'),
    blendMode('blendMode', 'Blend mode', 2),
    float('opacity', 'opacity', 0, 1, 1),
    float('scale', 'scale', 0.1, 5, 1, 0.01, { group: 'Edit' }),
    angle('rotation', 'rotation', -180, 180, 0, { group: 'Edit' }),
    curve('rgbCurve', 'RGB curve', [[0, 0], [1, 1]], { group: 'Edit' }),
    choice('channel', 'Channel', ['Gray', 'Red', 'Green', 'Blue'], 0, 'select', { group: 'Blend' }),
    curve('thisLayer', 'This layer', [[0, 1], [1, 1]], { group: 'Blend' }),
    curve('underlyingLayer', 'Underlying layer', [[0, 1], [1, 1]], { group: 'Blend' }),
    bool('key', 'Key', false, { group: 'Key' }),
    color('keyColor', 'key color', '#00c745', { group: 'Key', visibleIf: keyOn }),
    float('tolerance', 'tolerance', 0, 1, 0.05, 0.01, { group: 'Key', visibleIf: keyOn }),
    float('softness', 'softness', 0, 0.5, 0.1, 0.01, { group: 'Key', visibleIf: keyOn }),
    float('despill', 'despill', 0, 1, 1, 0.01, { group: 'Key', visibleIf: keyOn }),
    choice('matte', 'Matte', ['None', 'Alpha', 'Luma'], 0, 'select', { group: 'Matte' }),
    bool('invertMatte', 'Invert matte', false, { group: 'Matte' }),
  ],
  shaders: {
    main: /* glsl */ `
${FIT_GLSL}
${CRACKLE_GLSL}
float channelOf(vec3 c, int ch) {
  return ch == 1 ? c.r : ch == 2 ? c.g : ch == 3 ? c.b : luma(c);
}
void main() {
  vec4 base = texture(u_input, v_uv);
  vec2 texSize = u_textureLoaded ? u_textureSize : vec2(${DEFAULT_TEX_SIZE}.0);
  vec2 tuv = fitTexUv(v_uv, u_resolution, texSize, u_fitType, u_scale, 1.0, u_rotation);
  vec4 tex;
  if (u_textureLoaded) {
    tex = sampleFitted(u_texture, tuv, u_fitType, true);
  } else {
    tex = crackleTexture(tuv);
    if (u_fitType != 2 && (any(lessThan(tuv, vec2(0.0))) || any(greaterThan(tuv, vec2(1.0))))) tex = vec4(0.0);
  }
  // Edit: tone curve on the layer.
  tex.rgb = vec3(lut1(u_rgbCurve, tex.r), lut1(u_rgbCurve, tex.g), lut1(u_rgbCurve, tex.b));
  float a = tex.a;
  if (u_key) {
    // Chroma key in CbCr (luma-independent), then remove the key colour's spill from what remains.
    vec3 t = rgb2ycbcr(saturate(tex.rgb));
    vec2 kc = rgb2ycbcr(u_keyColor).yz - 0.5;
    vec2 cc = t.yz - 0.5;
    float d = length(cc - kc) * 1.6;
    float k = smoothstep(u_tolerance, u_tolerance + u_softness + 1e-4, d);
    a *= k;
    float kl = length(kc);
    if (kl > 1e-4) {
      vec2 kd = kc / kl;
      float s = max(dot(cc, kd), 0.0);
      cc -= kd * min(s, kl) * u_despill;
      tex.rgb = ycbcr2rgb(vec3(t.x, cc + 0.5));
    }
  }
  // Blend if: ramps over this layer's and the underlying layer's channel value.
  float w = lut1(u_thisLayer, channelOf(saturate(tex.rgb), u_channel)) * lut1(u_underlyingLayer, channelOf(saturate(base.rgb), u_channel));
  vec3 blended = blendMode(u_blendMode, saturate(base.rgb), saturate(tex.rgb));
  vec3 rgb = mix(base.rgb, blended, saturate(u_opacity * a * w));
  float outA = base.a;
  if (u_matte > 0) {
    // Track matte: the layer's alpha or luma sets the visibility of the result.
    float m = u_matte == 1 ? a : luma(saturate(tex.rgb)) * a;
    if (u_invertMatte) m = 1.0 - m;
    outA *= m;
  }
  fragColor = vec4(rgb, outA);
}`,
  },
};
