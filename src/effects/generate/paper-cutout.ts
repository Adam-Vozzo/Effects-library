import type { EffectDef } from '../../engine/types';
import { bool, color, float, int, num } from '../helpers';
import { GRAIN_GLSL } from './shared';

/**
 * The image cut into torn paper pieces on a grid. Each pixel tests the pieces of the nearby cells (search radius
 * from the largest possible piece), keeps the topmost two for anti-aliased edges, adds the white torn rim and the
 * drop shadows of pieces stacked above.
 */
export const paperCutout: EffectDef = {
  id: 'paper-cutout',
  name: 'Paper cutout',
  category: 'Generate',
  keywords: 'paper cutout texture tear',
  params: [
    int('columns', 'Columns', 1, 16, 4),
    int('rows', 'Rows', 1, 16, 4),
    int('missing', 'Missing pieces', 0, 100, 0),
    int('seed', 'Seed', 0, 100, 0),
    float('rotation', 'Rotation', 0, 180, 4, 0.1, { group: 'variation' }),
    float('sizeVariation', 'Size variation', 0, 2, 0, 0.01, { group: 'variation' }),
    float('widthVariation', 'Width variation', 0, 2, 0, 0.01, { group: 'variation' }),
    float('heightVariation', 'Height variation', 0, 2, 0, 0.01, { group: 'variation' }),
    float('uvShift', 'UV shift', 0, 1, 0.15, 0.01, { group: 'variation' }),
    float('colorVariation', 'Color variation', 0, 1, 0.3, 0.01, { group: 'variation' }),
    float('tearSize', 'Tear size', 0, 1, 0.65, 0.01, { group: 'edges' }),
    float('chunkSize', 'Chunk size', 0, 1, 0.7, 0.01, { group: 'edges' }),
    float('roughness', 'Roughness', 0, 5, 0.7, 0.01, { group: 'edges' }),
    float('whiteEdge', 'White edge', 0, 1, 0.25, 0.01, { group: 'edges' }),
    float('unevenness', 'Unevenness', 0, 1, 0.5, 0.01, { group: 'edges' }),
    float('shadow', 'Shadow', 0, 1, 0.5, 0.01, { group: 'background' }),
    bool('backgroundImage', 'Background image', true, { group: 'background' }),
    color('backgroundColor', 'Background color', '#000000', { group: 'background' }),
  ],
  shaders: {
    main: /* glsl */ `
${GRAIN_GLSL}
uniform int u_reach; // neighbour cells to search on each side
struct Piece {
  vec2 c;      // centre (render px)
  vec2 hs;     // half size (render px)
  float ang;   // radians
  float z;     // stacking order
  vec4 rnd;    // colour variation randoms
  float sd;    // per-piece noise seed
  bool missing;
};
Piece piece(ivec2 cell, vec2 cs) {
  Piece P;
  uint s = uint(u_seed) * 2654435761u;
  vec3 a = vec3(pcg3d(uvec3(uvec2(cell + 4096), s))) / 4294967295.0;
  vec3 b = vec3(pcg3d(uvec3(uvec2(cell + 4096), s + 1013904223u))) / 4294967295.0;
  vec3 d = vec3(pcg3d(uvec3(uvec2(cell + 4096), s + 374761393u))) / 4294967295.0;
  vec3 e = vec3(pcg3d(uvec3(uvec2(cell + 4096), s + 668265263u))) / 4294967295.0;
  // UV shift jitters where each piece is cut; pieces grow with it so neighbours always overlap.
  P.c = (vec2(cell) + 0.5 + (d.xy * 2.0 - 1.0) * u_uvShift) * cs;
  float sz = max(0.05, 1.0 + u_sizeVariation * (a.x - 0.5));
  vec2 wh = vec2(max(0.05, 1.0 + u_widthVariation * (a.y - 0.5)), max(0.05, 1.0 + u_heightVariation * (a.z - 0.5)));
  P.hs = cs * 0.5 * (1.06 + 2.0 * u_uvShift) * sz * wh;
  P.ang = radians((b.x * 2.0 - 1.0) * 0.5 * u_rotation);
  P.z = b.y;
  P.missing = b.z < u_missing / 100.0;
  P.rnd = vec4(d.z, e);
  P.sd = e.x * 97.0;
  return P;
}
float sdBox(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
// Torn edge: box distance displaced by multi-scale noise in piece-local reference px.
float tornDist(vec2 l, Piece P) {
  vec2 lr = l / u_pxScale;
  float fs = mix(3.0, 45.0, u_chunkSize);
  vec2 q = lr / fs + P.sd;
  float r = u_roughness;
  float n = gradientNoise(q) + r * 0.4 * gradientNoise(q * 3.3 + 7.0) + r * 0.2 * gradientNoise(lr / 1.6 + 3.0)
    + r * 0.15 * (valueNoise(lr / 0.7 + P.sd) - 0.5);
  n /= 1.0 + r * 0.6;
  float amp = u_tearSize * 7.0 * (1.0 + u_unevenness * gradientNoise(lr / 140.0 + P.sd + 31.0));
  return sdBox(l, P.hs) + amp * n * u_pxScale;
}
vec2 localOf(vec2 p, Piece P) {
  return rot2(-P.ang) * (p - P.c);
}
vec3 pieceColor(vec2 p, Piece P, float dist) {
  vec2 l = localOf(p, P);
  // The piece carries the image region it was cut from (rotated with it).
  vec2 uv = (P.c + l) / u_resolution;
  vec3 col = texture(u_input, mirrorUv(uv)).rgb;
  // Colour variation: exposure, warmth and saturation per piece.
  float cv = u_colorVariation;
  col = mix(vec3(luma(col)), col, 1.0 + (P.rnd.x - 0.5) * 0.9 * cv);
  col *= 1.0 + (P.rnd.y - 0.5) * 0.5 * cv;
  col += (P.rnd.z - 0.5) * 0.14 * cv * vec3(1.0, 0.25, -0.7);
  col = mix(col, vec3(0.97, 0.96, 0.93), smoothstep(0.55, 1.0, P.rnd.w) * 0.55 * cv);
  vec2 lr = l / u_pxScale;
  // Paper tooth.
  col *= 1.0 + grainNoise(lr / 1.5, 5.0) * 0.018;
  // White torn rim: width varies along the edge, inner boundary is fibrous.
  float seg = smoothstep(-0.35, 0.55, gradientNoise(lr / 70.0 + P.sd + 13.0));
  float fib = 0.4 + 0.7 * valueNoise(lr / 3.0 + P.sd) + 0.5 * valueNoise(lr / 1.1 + P.sd + 17.0);
  float ww = u_whiteEdge * 22.0 * (0.15 + 1.1 * seg) * fib * u_pxScale;
  float rim = smoothstep(-ww - 0.6, -ww + 0.6, dist);
  vec3 paper = vec3(0.97, 0.965, 0.94) * (1.0 - 0.06 * valueNoise(lr / 2.0 + 5.0));
  return mix(col, paper, rim * step(0.001, u_whiteEdge));
}
void main() {
  vec2 cs = u_resolution / vec2(u_columns, u_rows);
  vec2 p = v_uv * u_resolution;
  ivec2 cell = ivec2(floor(p / cs));
  float aa = 0.75;
  // Topmost and second piece covering this pixel.
  Piece top = piece(cell, cs);
  Piece second = top;
  float zt = -1.0, zs = -1.0, at = 0.0, dt = 0.0, ds = 0.0;
  for (int j = -3; j <= 3; j++) {
    if (abs(j) > u_reach) continue;
    for (int i = -3; i <= 3; i++) {
      if (abs(i) > u_reach) continue;
      ivec2 cc = cell + ivec2(i, j);
      if (cc.x < 0 || cc.y < 0 || cc.x >= int(u_columns) || cc.y >= int(u_rows)) continue;
      Piece P = piece(cc, cs);
      if (P.missing) continue;
      vec2 l = localOf(p, P);
      if (sdBox(l, P.hs) > u_tearSize * 18.0 * u_pxScale + 2.0) continue;
      float d = tornDist(l, P);
      float a = 1.0 - smoothstep(-aa, aa, d);
      if (a <= 0.0) continue;
      if (P.z > zt) {
        if (at > 0.5) { second = top; zs = zt; ds = dt; }
        top = P; zt = P.z; at = a; dt = d;
      } else if (a > 0.5 && P.z > zs) {
        second = P; zs = P.z; ds = d;
      }
    }
  }
  vec3 bg = u_backgroundImage ? texture(u_input, v_uv).rgb : u_backgroundColor;
  vec3 below = zs >= 0.0 ? pieceColor(p, second, ds) : bg;
  vec3 col = zt >= 0.0 ? mix(below, pieceColor(p, top, dt), at) : bg;
  // Drop shadows from pieces stacked above the visible surface (soft, offset down-right).
  float surfaceZ = at > 0.5 ? zt : zs;
  vec2 off = vec2(2.0, -3.0) * u_pxScale;
  float soft = 6.0 * u_pxScale;
  float sh = 0.0;
  if (u_shadow > 0.0) {
    for (int j = -3; j <= 3; j++) {
      if (abs(j) > u_reach) continue;
      for (int i = -3; i <= 3; i++) {
        if (abs(i) > u_reach) continue;
        ivec2 cc = cell + ivec2(i, j);
        if (cc.x < 0 || cc.y < 0 || cc.x >= int(u_columns) || cc.y >= int(u_rows)) continue;
        Piece P = piece(cc, cs);
        if (P.missing || P.z <= surfaceZ) continue;
        float d = sdBox(localOf(p - off, P), P.hs);
        sh = max(sh, 1.0 - smoothstep(-soft, soft, d));
      }
    }
  }
  col *= 1.0 - u_shadow * 0.65 * sh;
  fragColor = vec4(col, texture(u_input, v_uv).a);
}`,
  },
  render(ctx) {
    const p = ctx.params;
    // Search radius: how many cells the largest possible piece (scaled, rotated, torn) can reach beyond its own.
    const cols = Math.max(1, num(p, 'columns'));
    const rows = Math.max(1, num(p, 'rows'));
    const shift = num(p, 'uvShift');
    const scale = (1.06 + 2 * shift) * (1 + num(p, 'sizeVariation') * 0.5) * (1 + Math.max(num(p, 'widthVariation'), num(p, 'heightVariation')) * 0.5);
    // Pieces turn by up to ±rotation/2; cos + sin peaks at 45°.
    const rot = Math.min(num(p, 'rotation') * 0.5, 45) * (Math.PI / 180);
    const tear = (num(p, 'tearSize') * 14 * ctx.pxScale) / Math.min(ctx.width / cols, ctx.height / rows);
    const ext = 0.5 * scale * (Math.cos(rot) + Math.sin(rot)) + shift + tear;
    const reach = Math.min(3, Math.max(1, Math.ceil(ext - 0.5)));
    return ctx.pass('main', { uniforms: { u_reach: reach } });
  },
};
