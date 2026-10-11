import type { EffectDef } from '../../engine/types';
import { angle, float } from '../helpers';
import { DISTORT_GLSL } from './common';

// Streaky scatter glitch. The image is cut into tiny cells (glitch scale ~ size in reference
// pixels, 3x longer along `angle`, measured clockwise on screen); each cell draws a random value n
// and a random length. A channel is dragged along the streak direction when n is below its
// threshold, by up to offset scale * channel strength * 15% of the short side, so the channels
// mostly move together with occasional colored splits. Deterministic for a given random seed.
export const glitch: EffectDef = {
  id: 'glitch',
  name: 'Glitch',
  category: 'Distort',
  keywords: 'aberration broken chromatic digital distortion glitch retro signal vhs',
  params: [
    float('glitchScale', 'glitch scale', 0, 5, 0.38),
    float('offsetScale', 'offset scale', 0, 5, 3.44),
    angle('angle', 'angle', 0, 180, 34),
    float('redStrength', 'red shift strength', 0, 1, 0.29),
    float('greenStrength', 'green shift strength', 0, 1, 0.29),
    float('blueStrength', 'blue shift strength', 0, 1, 0.25),
    float('redThreshold', 'red threshold', 0, 1, 0.76),
    float('greenThreshold', 'green threshold', 0, 1, 0.9),
    float('blueThreshold', 'bleu threshold', 0, 1, 0.66),
    float('seed', 'random seed', 0, 1, 0.365, 0.001),
  ],
  shaders: {
    main: /* glsl */ `
${DISTORT_GLSL}
void main() {
  vec2 px = v_uv * u_resolution / u_pxScale; // reference pixels
  float ang = radians(u_angle);
  vec2 dir = vec2(cos(ang), -sin(ang));
  vec2 perp = vec2(-dir.y, dir.x);
  float w = max(u_glitchScale * 2.6, 0.5);
  float len = w * 3.0;
  float s = floor(u_seed * 1000.0 + 0.5);
  float row = floor(dot(px, perp) / w);
  float seg = floor(dot(px, dir) / len + hash12(vec2(row, s * 7.0 + 3.0)));
  vec3 h = hash32(vec2(row * 1.37 + s * 11.0, seg - s * 5.0));
  float reach = u_offsetScale * 0.15 * shortSide() / u_pxScale * h.y * h.y;
  vec3 thr = vec3(u_redThreshold, u_greenThreshold, u_blueThreshold);
  vec3 k = step(h.x, thr) * vec3(u_redStrength, u_greenStrength, u_blueStrength) * reach;
  vec2 toUv = u_pxScale / u_resolution;
  vec4 col = texture(u_input, v_uv + dir * k.g * toUv);
  col.r = texture(u_input, v_uv + dir * k.r * toUv).r;
  col.b = texture(u_input, v_uv + dir * k.b * toUv).b;
  fragColor = col;
}`,
  },
};
