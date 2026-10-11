import type { EffectDef } from '../../engine/types';
import { bool, float, range } from '../helpers';

// Photoshop-style levels: input black/white remap, midpoint gamma (> 1 brightens), output range.
// "affect luma only" shifts all channels by the luma change (chroma kept, like editing Y in YCbCr).
export const levels: EffectDef = {
  id: 'levels',
  name: 'Levels',
  category: 'Color',
  keywords: 'levels',
  params: [
    range('inputLevels', 'input levels', 0, 1, [0, 1]),
    float('midpoint', 'midpoint', 0.2, 5, 1),
    range('outputLevels', 'output levels', 0, 1, [0, 1]),
    bool('affectLumaOnly', 'affect luma only', false),
  ],
  shaders: {
    main: /* glsl */ `
vec3 levelsMap(vec3 x) {
  float lo = u_inputLevels.x;
  float hi = max(u_inputLevels.y, lo + 1e-4);
  x = saturate((x - lo) / (hi - lo));
  x = pow(x, vec3(1.0 / u_midpoint));
  return mix(vec3(u_outputLevels.x), vec3(u_outputLevels.y), x);
}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 o;
  if (u_affectLumaOnly) {
    float l = luma(src.rgb);
    o = saturate(src.rgb + (levelsMap(vec3(l)).x - l));
  } else {
    o = levelsMap(src.rgb);
  }
  fragColor = vec4(o, src.a);
}`,
  },
};
