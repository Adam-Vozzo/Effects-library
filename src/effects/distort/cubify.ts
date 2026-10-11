import type { EffectDef } from '../../engine/types';
import { angle, bool, float, point } from '../helpers';
import { DISTORT_GLSL } from './common';

// Glass-block tiling. The image is warped per axis by q + c * sin(2pi q) / 2pi (q in cells), so each
// cell shows a minified "window" of its surroundings framed by stretched (and, above c = 1, folded)
// bands along the cell borders; c = 0.56 * depth distortion. Hard edges switch to a per-cell zoom
// with crisp seams. Cells are 0.3 * cube size units (short side = 2), anchored at the top-left
// corner; `position offset` and `animation speed` (units per second) slide the grid.
export const cubify: EffectDef = {
  id: 'cubify',
  name: 'Cubify',
  category: 'Distort',
  keywords: 'abstract art blocky cubify distortion lowfi pixel pixelation visuals',
  animated: true,
  params: [
    float('size', 'cube size', 0, 8, 1.1),
    float('stretch', 'cube stretch', -1, 1, 0),
    float('depth', 'depth distortion', 0, 5, 1.8),
    bool('hardEdges', 'hard edges', false),
    angle('rotation', 'rotation angle', 0, 90, 0),
    point('offset', 'position offset', [0, 0]),
    point('speed', 'animation speed', [0.1, 0], { min: [-5, -5], max: [5, 5] }),
    float('dispersion', 'dispersion', 0, 1, 0, 0.001),
  ],
  uniforms: (p, ctx) => {
    const o = (p.offset as [number, number]) ?? [0, 0];
    const s = (p.speed as [number, number]) ?? [0, 0];
    return { u_gridOffset: [o[0] + s[0] * ctx.time, o[1] + s[1] * ctx.time] };
  },
  shaders: {
    main: /* glsl */ `
${DISTORT_GLSL}
uniform vec2 u_gridOffset;

// Displacement in cells for grid coordinate g (per axis).
vec2 cellWarp(vec2 g, float c) {
  // Hard edges: every cell zooms out around its own center, leaving crisp seams between cubes.
  if (u_hardEdges) return (fract(g) - 0.5) * c;
  return -c * sin(TAU * g) / TAU;
}

void main() {
  vec2 p = uvToUnit(v_uv);
  vec2 flipY = vec2(1.0, -1.0);
  vec2 corner = unitScale() * vec2(-1.0, 1.0); // top-left corner
  vec2 cell = max(u_size, 0.01) * 0.3 * vec2(exp2(u_stretch), exp2(-u_stretch));
  mat2 R = rot2(radians(u_rotation));
  // Grid space in cells, y running down from the top-left corner like image rows.
  vec2 g = (transpose(R) * (p - corner) + u_gridOffset) * flipY / cell;
  float c = 0.56 * u_depth;
  vec2 d = R * (cellWarp(g, c) * cell * flipY);
  vec4 col = textureLod(u_input, mirrorUv(unitToUv(p + d)), 0.0);
  if (u_dispersion > 0.0) {
    vec2 dr = R * (cellWarp(g, c * (1.0 - 0.35 * u_dispersion)) * cell * flipY);
    vec2 db = R * (cellWarp(g, c * (1.0 + 0.35 * u_dispersion)) * cell * flipY);
    col.r = textureLod(u_input, mirrorUv(unitToUv(p + dr)), 0.0).r;
    col.b = textureLod(u_input, mirrorUv(unitToUv(p + db)), 0.0).b;
  }
  fragColor = col;
}`,
  },
};
