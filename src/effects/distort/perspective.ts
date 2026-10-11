import type { EffectDef } from '../../engine/types';
import { bool, color, float, point } from '../helpers';
import { DISTORT_GLSL } from './common';

// Ray-traces the image as a plane (short side = 2 units) rotated by X/Y/Z and seen by a pinhole
// camera at distance exp(-zoom) (OpenGL convention: camera on +z looking down -z; negative rotate X
// tilts the top away). Depth-based alpha fades the plane by its depth behind the pivot.
export const perspective: EffectDef = {
  id: 'perspective',
  name: 'Perspective',
  category: 'Distort',
  keywords: 'distortion geometric perspective photo transform warp',
  params: [
    float('zoom', 'camera zoom', -5, 5, 0.17),
    float('fov', 'field of view', 10, 170, 60),
    point('camera', 'camera position', [0, 0], { min: [-2, -2], max: [2, 2] }),
    float('rotateX', 'rotate X', -90, 90, -25),
    float('rotateY', 'rotate Y', -90, 90, 0),
    float('rotateZ', 'rotate Z', -90, 90, 0),
    color('bgColor', 'background color', '#000000'),
    float('bgOpacity', 'background opacity', 0, 1, 0),
    bool('depthAlpha', 'depth-based alpha', false),
    float('depthKey', 'depth key value', -3, 3, -0.79, 0.01, { visibleIf: (p) => !!p.depthAlpha }),
    float('depthRange', 'depth range', 0, 3, 1.89, 0.01, { visibleIf: (p) => !!p.depthAlpha }),
    bool('depthInvert', 'invert depth', true, { visibleIf: (p) => !!p.depthAlpha }),
  ],
  uniforms: (p) => {
    const r = (k: string) => (Number(p[k]) * Math.PI) / 180;
    const [cx, sx, cy, sy, cz, sz] = [Math.cos(r('rotateX')), Math.sin(r('rotateX')), Math.cos(r('rotateY')), Math.sin(r('rotateY')), Math.cos(r('rotateZ')), Math.sin(r('rotateZ'))];
    // Plane basis R = Rx * Ry * Rz (columns: local x axis, local y axis, normal), column-major.
    const m = [
      cy * cz, cx * sz + sx * sy * cz, sx * sz - cx * sy * cz,
      -cy * sz, cx * cz - sx * sy * sz, sx * cz + cx * sy * sz,
      sy, -sx * cy, cx * cy,
    ];
    return { u_basis: m };
  },
  shaders: {
    main: /* glsl */ `
${DISTORT_GLSL}
uniform mat3 u_basis;
void main() {
  vec2 s = uvToUnit(v_uv);
  float f = 1.0 / tan(radians(clamp(u_fov, 1.0, 179.0)) * 0.5);
  vec3 ro = vec3(u_camera, exp(-u_zoom));
  vec3 rd = normalize(vec3(s, -f));
  vec3 n = u_basis[2];
  float den = dot(rd, n);
  float t = abs(den) > 1e-6 ? -dot(ro, n) / den : -1.0;
  vec3 hit = ro + rd * t;
  vec2 local = vec2(dot(hit, u_basis[0]), dot(hit, u_basis[1]));
  vec2 uv = unitToUv(local);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec4 col = vec4(0.0);
  if (t > 0.0) {
    col = sampleWarp(u_input, uv, dx, dy);
    col.a *= uvCoverage(uv, dx, dy);
    if (u_depthAlpha) {
      float a = saturate((-hit.z - u_depthKey) / max(u_depthRange, 1e-4));
      col.a *= u_depthInvert ? 1.0 - a : a;
    }
  }
  fragColor = overStraight(col, vec4(u_bgColor, u_bgOpacity));
}`,
  },
};
