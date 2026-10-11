import type { EffectDef } from '../../engine/types';
import { float, int, num, point } from '../helpers';
import { DISTORT_GLSL, loopTime } from './common';

// Elastic mesh warp. The image hangs on an X x Y grid; every grid vertex is pulled toward (stretch
// < 0: the area around the dot is magnified) or pushed away from `dot position` with a gaussian
// falloff of `effect radius` (1 = the whole short side), then jittered by looping gradient noise
// (noise size = features per short side, noise blend = amplitude). Inside each cell the source
// position is interpolated bilinearly between the four vertices, so the warp is piecewise
// bilinear like a real mesh. The noise repeats exactly every `noise loop` seconds.
export const elasticGrid: EffectDef = {
  id: 'elastic-grid',
  name: 'Elastic grid',
  category: 'Distort',
  keywords: 'distortion elastic grid organic pull push warp',
  animated: true,
  params: [
    int('gridX', 'grid X divisions', 1, 64, 8),
    int('gridY', 'grid Y divisions', 1, 64, 8),
    point('dot', 'dot position', [0, 0]),
    float('stretch', 'stretch amount', -1, 1, -0.7),
    float('radius', 'effect radius', 0.01, 1, 0.5),
    float('noiseSize', 'noise size', 0.1, 32, 4),
    float('noiseSpeed', 'noise speed', 0.2, 5, 0.5),
    float('noiseBlend', 'noise blend', 0, 1, 0.5),
    float('noiseLoop', 'noise loop (sec)', 0, 20, 5),
  ],
  uniforms: (p, ctx) => {
    const [z, period] = loopTime(ctx.time, num(p, 'noiseSpeed'), num(p, 'noiseLoop'));
    return { u_noiseZ: z, u_noisePeriod: period };
  },
  shaders: {
    main: /* glsl */ `
${DISTORT_GLSL}
uniform float u_noiseZ;
uniform float u_noisePeriod;

// Source position (unit space) of grid vertex v (in cells).
vec2 vertexSource(vec2 v, vec2 grid, vec2 dotP) {
  vec2 p = uvToUnit(v / grid);
  vec2 d = p - dotP;
  float r = length(d) / max(u_radius * 2.0, 1e-3);
  float w = exp(-2.0 * r * r);
  vec2 s = dotP + d * exp2(1.2 * u_stretch * w);
  vec2 q = p * u_noiseSize * 0.5;
  vec2 n = vec2(loopNoise(vec3(q, u_noiseZ), u_noisePeriod), loopNoise(vec3(q + vec2(31.7, -17.3), u_noiseZ + 0.5 * u_noisePeriod), u_noisePeriod));
  return s + n * u_noiseBlend * 0.25;
}

void main() {
  vec2 grid = max(floor(vec2(u_gridX, u_gridY) + 0.5), vec2(1.0));
  vec2 dotP = uvToUnit(pointToUv(u_dot));
  vec2 c = v_uv * grid;
  vec2 i = min(floor(c), grid - 1.0);
  vec2 f = c - i;
  vec2 s00 = vertexSource(i, grid, dotP);
  vec2 s10 = vertexSource(i + vec2(1.0, 0.0), grid, dotP);
  vec2 s01 = vertexSource(i + vec2(0.0, 1.0), grid, dotP);
  vec2 s11 = vertexSource(i + vec2(1.0, 1.0), grid, dotP);
  vec2 s = mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
  vec2 uv = unitToUv(s);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  fragColor = sampleWarp(u_input, mirrorUv(uv), dx, dy);
}`,
  },
};
