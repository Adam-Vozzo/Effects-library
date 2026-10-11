import type { EffectDef } from '../../engine/types';
import { float } from '../helpers';
import { GRAIN_GLSL } from './shared';

/** Film-like grain generator. Grain cells are in reference px; speed = new grain frames per second. */
export const noise: EffectDef = {
  id: 'noise',
  name: 'Noise',
  category: 'Generate',
  keywords: 'analog film generator grain noise overlay texture',
  animated: true,
  params: [
    float('amount', 'amount', 0, 3, 0.9),
    float('size', 'size', 0.5, 3, 1),
    float('floor', 'floor', 0, 0.3, 0.02),
    float('chroma', 'chroma', 0, 1, 0.8),
    float('shadow', 'shadow', 0, 1, 1),
    float('midTone', 'mid-tone', 0, 1, 0.5),
    float('highlight', 'highlight', 0, 1, 0.8),
    float('speed', 'speed', 0, 60, 0, 1),
  ],
  shaders: {
    main: /* glsl */ `
${GRAIN_GLSL}
void main() {
  vec4 src = texture(u_input, v_uv);
  // Grain frame: static when speed = 0, otherwise a new pattern 'speed' times per second.
  float frame = u_speed > 0.0 ? floor(u_time * u_speed) : 0.0;
  // Grain cells smaller than a pixel average out: shrink the amplitude instead of aliasing.
  float cellPx = u_size * 1.6 * u_pxScale;
  vec2 p = gl_FragCoord.xy / max(cellPx, 1.0) - 0.5;
  float aa = min(cellPx, 1.0);
  vec3 seed = vec3(17.0, 5.0, 11.0) * mod(frame, 997.0);
  float nl = grainNoise(p, seed.x + 1.0);
  vec3 nc = vec3(grainNoise(p, seed.y + 31.0), grainNoise(p, seed.z + 57.0), grainNoise(p, seed.x + 83.0));
  // Chroma grain keeps its own variance but is decorrelated from luma.
  vec3 n = mix(vec3(nl), nc, u_chroma);
  float L = saturate(luma(src.rgb));
  // Tonal response: quadratic Bezier through shadow / mid-tone / highlight weights, plus a floor.
  float w = u_shadow * (1.0 - L) * (1.0 - L) + u_midTone * 2.0 * L * (1.0 - L) + u_highlight * L * L;
  w = u_floor + (1.0 - u_floor) * w;
  // Grain fades out in channels approaching white, so clipped highlights stay clean.
  vec3 roll = saturate((1.0 - src.rgb) * 8.0);
  vec3 c = src.rgb + n * roll * (u_amount * w * 0.036 * aa);
  fragColor = vec4(max(c, 0.0), src.a);
}`,
  },
};
