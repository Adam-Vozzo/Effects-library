import type { EffectDef, ParamValues, RenderContext } from '../../engine/types';
import type { Texture } from '../../engine/gl';
import { BLEND_OPTIONS, angle, bool, choice, color, float, int, num, point } from '../helpers';
import { DISTORT_GLSL } from './common';

// Grid split: the image is cut into a grid of tiles (`Grid density` tiles along the short side)
// that is built as a quadtree from the top-left corner:
//  - Irregularity jitters the split lines of every quadtree block (Strength x/y), gated by an
//    activation from the block's lightness/saturation/edges (+ animated noise), giving a
//    table-like irregular layout.
//  - Merge keeps whole blocks up to `Merge depth` levels when their metric is below the cutoff.
//  - Tile transforms shift/stretch/rotate each tile's content by a per-tile weight in [-1, 1].
//  - Hide tiles replaces tiles with the background color; guides (lattice lines or frames with a
//    gap, plus center markers) are drawn on image tiles ("Guides on hidden tiles") and/or on
//    background tiles ("Guides on revealed tiles").
//  - Background keys pixels (by key color distance / lightness / saturation / edges) and blends
//    the background color onto them.
// Pass 1 averages lightness/saturation/edges per grid cell, then a 2x2 reduction pyramid gives the
// averages (and the max merge metric) of every quadtree block; the main pass walks the quadtree
// per pixel.

const MAX_LEVELS = 8;
const SOURCES = ['Lightness', 'Saturation', 'Edges'];

export const gridSplit: EffectDef = {
  id: 'grid-split',
  name: 'Grid split',
  category: 'Distort',
  keywords:
    'grid split tiles sections table irregular adaptive merge deconstruction cutout mosaic uv shift stretch rotate reactive threshold marker',
  animated: true,
  params: [
    int('density', 'Grid density', 1, 64, 8),
    float('gridAspect', 'Grid aspect', -1, 1, 0),
    int('seed', 'Seed', 0, 1000, 1),
    // Irregularity (effect.app's pad: 0..1 per axis, y measured downward from the top).
    point('irrStrength', 'Strength', [0, 0], { min: [0, 0], max: [1, 1], group: 'Irregularity' }),
    choice('irrSource', 'irregularity source', SOURCES, 0, 'slider', { group: 'Irregularity' }),
    bool('irrInvert', 'Invert', false, { group: 'Irregularity' }),
    float('irrLevel', 'Activation level', 0, 1, 0.3, 0.01, { group: 'Irregularity' }),
    float('irrSoftness', 'Softness', 0, 1, 0.5, 0.01, { group: 'Irregularity' }),
    float('irrNoise', 'Noise', 0, 1, 1, 0.01, { group: 'Irregularity' }),
    float('irrNoiseSize', 'Noise size', 0.02, 2, 0.25, 0.01, { group: 'Irregularity' }),
    float('irrNoiseSpeed', 'Noise speed', 0, 4, 0.5, 0.01, { group: 'Irregularity' }),
    float('mergeCutoff', 'Merge cutoff', 0, 1, 0),
    choice('mergeSource', 'merge source', SOURCES, 0, 'slider'),
    bool('mergeInvert', 'Invert', false),
    int('mergeDepth', 'Merge depth', 0, 8, 5),
    point('uvShift', 'UV shift', [0.47, 0], { min: [-2, -2], max: [2, 2], group: 'Tile transforms' }),
    point('uvStretch', 'UV stretch', [1.49, -0.76], { min: [-3, -3], max: [3, 3], group: 'Tile transforms' }),
    angle('tileRotation', 'Tile rotation', -360, 360, 0, { group: 'Tile transforms' }),
    float('tileVariation', 'Tile variation', 0, 1, 1, 0.01, { group: 'Tile transforms' }),
    choice('tileSource', 'tile transform source', SOURCES, 0, 'slider', { group: 'Tile transforms' }),
    float('tileNoise', 'Noise', 0, 1, 1, 0.01, { group: 'Tile transforms' }),
    float('tileNoiseSize', 'Noise size', 0.02, 2, 0.25, 0.01, { group: 'Tile transforms' }),
    float('tileNoiseSpeed', 'Noise speed', 0, 4, 0.5, 0.01, { group: 'Tile transforms' }),
    float('strokes', 'Grid strokes', 0, 20, 1.5, 0.1, { group: 'Grid guides' }),
    choice('strokeMode', 'stroke mode', ['Lattice', 'Frames'], 0, 'slider', { group: 'Grid guides' }),
    float('tileGap', 'Tile gap', 0, 40, 6, 0.5, { group: 'Grid guides' }),
    color('strokeColor', 'Grid stroke color', '#0f0f12', { group: 'Grid guides' }),
    float('marker', 'Tile center marker', 0, 20, 5.1, 0.1, { group: 'Grid guides' }),
    choice('markerShape', 'marker shape', ['Dot', 'Ring', 'Plus', 'Cross', 'Square', 'Diamond'], 2, 'slider', { group: 'Grid guides' }),
    float('markerStroke', 'Marker stroke', 0.5, 6, 1.5, 0.1, { group: 'Grid guides' }),
    color('markerColor', 'Center marker color', '#75ff38', { group: 'Grid guides' }),
    bool('guidesHidden', 'Guides on hidden tiles', true, { group: 'Grid guides' }),
    bool('guidesRevealed', 'Guides on revealed tiles', false, { group: 'Grid guides' }),
    float('hide', 'Hide tiles', 0, 1, 0, 0.01, { group: 'Hide tiles' }),
    choice('hideSource', 'hide source', [...SOURCES, 'Tile size'], 0, 'slider', { group: 'Hide tiles' }),
    bool('hideInvert', 'Invert', false, { group: 'Hide tiles' }),
    float('hideNoise', 'Noise', 0, 1, 1, 0.01, { group: 'Hide tiles' }),
    float('hideNoiseSize', 'Noise size', 0.02, 2, 0.25, 0.01, { group: 'Hide tiles' }),
    float('hideNoiseSpeed', 'Noise speed', 0, 4, 0.5, 0.01, { group: 'Hide tiles' }),
    color('bgColor', 'Background color', '#09090b', { group: 'Hide tiles' }),
    float('bgCutoff', 'Background cutoff', 0, 1, 0, 0.01, { group: 'Background' }),
    choice('bgSource', 'background source', ['Color', ...SOURCES], 0, 'slider', { group: 'Background' }),
    bool('bgInvert', 'Invert', false, { group: 'Background' }),
    choice('bgBlend', 'background blend', BLEND_OPTIONS, 0, 'slider', { group: 'Background' }),
    float('bgNoise', 'Noise', 0, 1, 0, 0.01, { group: 'Background' }),
    float('bgNoiseSize', 'Noise size', 0.02, 2, 0.25, 0.01, { group: 'Background' }),
    float('bgNoiseSpeed', 'Noise speed', 0, 4, 0.5, 0.01, { group: 'Background' }),
    color('bgKey', 'Background key color', '#ffffff', { group: 'Background' }),
  ],
  shaders: {
    // Per-cell averages: r = lightness, g = saturation, b = edge density, a = merge metric. Rows are
    // stored top-down so the 2x2 pyramid groups cells the same way as the top-left quadtree.
    metrics: /* glsl */ `
uniform vec2 u_cells;
uniform vec2 u_srcRes;
void main() {
  vec2 cell = floor(vec2(v_uv.x, 1.0 - v_uv.y) * u_cells);
  vec2 texel = 1.0 / u_srcRes;
  vec2 e = texel * max(1.5 * u_pxScale, 1.0);
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 8; j++) {
    for (int i = 0; i < 8; i++) {
      vec2 uv = (cell + (vec2(float(i), float(j)) + 0.5) / 8.0) / u_cells;
      uv.y = 1.0 - uv.y;
      vec3 c = saturate(texture(u_input, uv).rgb);
      float l0 = luma(saturate(texture(u_input, uv + vec2(e.x, 0.0)).rgb)) - luma(saturate(texture(u_input, uv - vec2(e.x, 0.0)).rgb));
      float l1 = luma(saturate(texture(u_input, uv + vec2(0.0, e.y)).rgb)) - luma(saturate(texture(u_input, uv - vec2(0.0, e.y)).rgb));
      float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
      acc += vec3(luma(c), mx > 1e-4 ? (mx - mn) / mx : 0.0, saturate(length(vec2(l0, l1)) * 10.0));
    }
  }
  acc /= 64.0;
  float m = u_mergeSource == 0 ? acc.r : (u_mergeSource == 1 ? acc.g : acc.b);
  fragColor = vec4(acc, u_mergeInvert ? 1.0 - m : m);
}`,
    // 2x2 reduction of the previous pyramid level (children inside the grid only): rgb = mean,
    // a = max, so a block merges only when all of its cells are below the merge cutoff.
    reduce: /* glsl */ `
uniform sampler2D u_prev;
void main() {
  ivec2 sz = textureSize(u_prev, 0);
  ivec2 p = ivec2(gl_FragCoord.xy) * 2;
  vec3 acc = vec3(0.0);
  float mx = 0.0, n = 0.0;
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      ivec2 q = p + ivec2(i, j);
      if (q.x < sz.x && q.y < sz.y) {
        vec4 t = texelFetch(u_prev, q, 0);
        acc += t.rgb;
        mx = max(mx, t.a);
        n += 1.0;
      }
    }
  }
  fragColor = vec4(acc / max(n, 1.0), mx);
}`,
    main: /* glsl */ `
${DISTORT_GLSL}
uniform vec2 u_cells;      // grid size in cells (x, y)
uniform int u_levels;      // quadtree levels above the cells
uniform sampler2D u_lv0;
uniform sampler2D u_lv1;
uniform sampler2D u_lv2;
uniform sampler2D u_lv3;
uniform sampler2D u_lv4;
uniform sampler2D u_lv5;
uniform sampler2D u_lv6;
uniform sampler2D u_lv7;
uniform sampler2D u_lv8;

// Block averages at quadtree level L (texel rows count from the top, like the quadtree).
vec4 blockMetric(int L, vec2 b) {
  ivec2 sz;
  vec4 m;
  #define FETCH(S) sz = textureSize(S, 0); m = texelFetch(S, clamp(ivec2(b), ivec2(0), sz - 1), 0)
  if (L <= 0) { FETCH(u_lv0); }
  else if (L == 1) { FETCH(u_lv1); }
  else if (L == 2) { FETCH(u_lv2); }
  else if (L == 3) { FETCH(u_lv3); }
  else if (L == 4) { FETCH(u_lv4); }
  else if (L == 5) { FETCH(u_lv5); }
  else if (L == 6) { FETCH(u_lv6); }
  else if (L == 7) { FETCH(u_lv7); }
  else { FETCH(u_lv8); }
  #undef FETCH
  return m;
}

float pick(vec4 m, int src) { return src == 0 ? m.r : (src == 1 ? m.g : m.b); }

// Smooth animated noise in [0, 1] at a unit-space position.
float noise01(vec2 p, float size, float speed, float salt) {
  float n = gradientNoise3(vec3(p / max(size, 0.01) + salt * 17.31, u_time * speed + salt * 3.7));
  return saturate(0.5 + 1.4 * n);
}

// Unit-space position of a point given in cell units (x from the left, y from the top).
vec2 cellToUnit(vec2 c) { return uvToUnit(vec2(c.x / u_cells.x, 1.0 - c.y / u_cells.y)); }

float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

// Signed distance (reference px) of the tile center marker.
float markerSdf(vec2 p, float r, float t) {
  int shape = u_markerShape;
  if (shape == 0) return length(p) - r;
  if (shape == 1) return abs(length(p) - r) - 0.5 * t;
  if (shape == 3) p = rot2(0.25 * PI) * p;
  if (shape == 2 || shape == 3) return min(sdBox(p, vec2(r, 0.5 * t)), sdBox(p, vec2(0.5 * t, r)));
  if (shape == 4) return abs(sdBox(p, vec2(r))) - 0.5 * t;
  return abs((abs(p.x) + abs(p.y) - r) * 0.70710678) - 0.5 * t;
}

void main() {
  vec2 cellPx = u_resolution / u_cells;
  vec2 pc = vec2(v_uv.x, 1.0 - v_uv.y) * u_cells; // pixel in cell units, y down
  float seed = u_seed;
  vec2 strength = vec2(u_irrStrength.x, u_irrStrength.y);
  // Quadtree roots of 2^levels cells tile the grid (levels is capped, so there may be several).
  float top = exp2(float(u_levels));
  vec2 b = floor(pc / top);
  vec2 lo = b * top, hi = lo + top;
  int leaf = 0;
  for (int L = ${MAX_LEVELS}; L >= 1; L--) {
    if (L > u_levels) continue;
    vec4 m = blockMetric(L, b);
    if (L <= int(u_mergeDepth + 0.5) && m.a < u_mergeCutoff) { leaf = L; break; }
    vec2 split = 0.5 * (lo + hi);
    if (strength.x + strength.y > 0.0) {
      float a = pick(m, u_irrSource);
      a = mix(a, noise01(cellToUnit(split), u_irrNoiseSize, u_irrNoiseSpeed, 1.0 + seed), u_irrNoise);
      if (u_irrInvert) a = 1.0 - a;
      float soft = 0.5 * u_irrSoftness + 1e-3;
      float act = smoothstep(u_irrLevel - soft, u_irrLevel + soft, a);
      vec2 rnd = hash22(b * vec2(1.0, 7.0) + vec2(float(L) * 131.0, seed * 17.0)) - 0.5;
      // Regular split positions (in cells) that fall on or outside the grid stay fixed.
      vec2 reg = (2.0 * b + 1.0) * exp2(float(L - 1));
      vec2 inside = step(reg, u_cells - 0.5);
      split += (hi - lo) * rnd * 0.8 * strength * act * inside;
    }
    vec2 side = step(split, pc);
    lo = mix(lo, split, side);
    hi = mix(split, hi, side);
    b = b * 2.0 + side;
  }
  hi = min(hi, u_cells);
  vec2 tileC = 0.5 * (lo + hi);
  vec2 tileSize = hi - lo;
  vec4 tm = blockMetric(leaf, b);
  vec2 cu = cellToUnit(tileC);

  // Hide tiles.
  float hv = u_hideSource == 3 ? saturate(log2(max(tileSize.x * tileSize.y, 1.0)) / 8.0) : pick(tm, u_hideSource);
  hv = mix(hv, noise01(cu, u_hideNoiseSize, u_hideNoiseSpeed, 5.0 + seed), u_hideNoise);
  if (u_hideInvert) hv = 1.0 - hv;
  bool hidden = hv < u_hide;

  // Tile transform: weight in [-1, 1] from the tile metric / noise.
  float r = mix(pick(tm, u_tileSource), noise01(cu, u_tileNoiseSize, u_tileNoiseSpeed, 9.0 + seed), u_tileNoise);
  float w = mix(1.0, 2.0 * r - 1.0, u_tileVariation);
  // In output pixels (y up) so rotation stays isotropic; shift/stretch are relative to the tile.
  vec2 flipY = vec2(1.0, -1.0);
  vec2 tilePx = tileSize * cellPx;
  vec2 q = (pc - tileC) * cellPx * flipY;
  q *= exp2(-u_uvStretch * w);
  q = rot2(-radians(u_tileRotation) * w) * q;
  q += u_uvShift * w * tilePx;
  vec2 src = tileC + q * flipY / cellPx;
  vec2 uv = vec2(src.x / u_cells.x, 1.0 - src.y / u_cells.y);
  vec4 col = textureLod(u_input, mirrorUv(uv), 0.0);

  // Background keying.
  if (u_bgCutoff > 0.0) {
    vec3 c = saturate(col.rgb);
    float k;
    if (u_bgSource == 0) k = 1.0 - length(c - u_bgKey) / 1.7320508;
    else if (u_bgSource == 1) k = luma(c);
    else if (u_bgSource == 2) { float mx = max(c.r, max(c.g, c.b)); k = mx > 1e-4 ? (mx - min(c.r, min(c.g, c.b))) / mx : 0.0; }
    else {
      vec2 e = vec2(max(u_pxScale, 1.0)) / u_resolution;
      float gx = luma(textureLod(u_input, mirrorUv(uv + vec2(e.x, 0.0)), 0.0).rgb) - luma(textureLod(u_input, mirrorUv(uv - vec2(e.x, 0.0)), 0.0).rgb);
      float gy = luma(textureLod(u_input, mirrorUv(uv + vec2(0.0, e.y)), 0.0).rgb) - luma(textureLod(u_input, mirrorUv(uv - vec2(0.0, e.y)), 0.0).rgb);
      k = saturate(length(vec2(gx, gy)) * 10.0);
    }
    k = mix(k, noise01(uvToUnit(v_uv), u_bgNoiseSize, u_bgNoiseSpeed, 13.0 + seed), u_bgNoise);
    if (u_bgInvert) k = 1.0 - k;
    float keyed = smoothstep(1.0 - u_bgCutoff - 0.01, 1.0 - u_bgCutoff + 0.01, k);
    col.rgb = mix(col.rgb, blendMode(u_bgBlend, c, u_bgColor), keyed);
  }

  // Distances (output px) from the pixel to the tile edges.
  vec2 dLo = (pc - lo) * cellPx, dHi = (hi - pc) * cellPx;
  bool frames = u_strokeMode == 1;
  float gap = frames ? 0.5 * u_tileGap * u_pxScale : 0.0;
  float inner = min(min(dLo.x, dHi.x), min(dLo.y, dHi.y)) - gap; // inside the (inset) tile
  if (hidden) col = vec4(u_bgColor, 1.0);
  if (frames && inner < 0.0) col = vec4(u_bgColor, 1.0);
  else if (frames && gap > 0.0) col.rgb = mix(u_bgColor, col.rgb, saturate(inner + 0.5));

  if (hidden ? u_guidesRevealed : u_guidesHidden) {
    float sw = u_strokes * u_pxScale;
    if (sw > 0.0) {
      float line;
      if (frames) {
        line = (1.0 - smoothstep(sw - 0.5, sw + 0.5, inner)) * saturate(inner + 0.5);
      } else {
        // Lattice: half the stroke on each side of internal boundaries only.
        vec2 bl = mix(dLo, vec2(1e6), step(lo, vec2(1e-4)));
        vec2 bh = mix(dHi, vec2(1e6), step(u_cells - 1e-4, hi));
        float d = min(min(bl.x, bh.x), min(bl.y, bh.y));
        line = 1.0 - smoothstep(0.5 * sw - 0.5, 0.5 * sw + 0.5, d);
      }
      col.rgb = mix(col.rgb, u_strokeColor, line);
    }
    if (u_marker > 0.0) {
      vec2 mp = (pc - tileC) * cellPx * vec2(1.0, -1.0) / u_pxScale;
      float sd = markerSdf(mp, u_marker, u_markerStroke) * u_pxScale;
      col.rgb = mix(col.rgb, u_markerColor, 1.0 - smoothstep(-0.5, 0.5, sd));
    }
  }
  fragColor = col;
}`,
  },
  render(ctx: RenderContext) {
    const p = ctx.params;
    const [nx, ny] = gridCells(p, ctx.width, ctx.height);
    const levels = Math.min(MAX_LEVELS, Math.max(0, Math.ceil(Math.log2(Math.max(nx, ny)))));
    const pyramid: Texture[] = [];
    pyramid.push(ctx.pass('metrics', { width: nx, height: ny, uniforms: { u_cells: [nx, ny], u_srcRes: [ctx.width, ctx.height] } }));
    for (let L = 1; L <= levels; L++) {
      const prev = pyramid[L - 1];
      pyramid.push(ctx.pass('reduce', { width: Math.ceil(prev.width / 2), height: Math.ceil(prev.height / 2), inputs: { u_prev: prev } }));
    }
    const inputs: Record<string, Texture> = {};
    for (let L = 0; L <= MAX_LEVELS; L++) inputs['u_lv' + L] = pyramid[Math.min(L, pyramid.length - 1)];
    const out = ctx.pass('main', { inputs, uniforms: { u_cells: [nx, ny], u_levels: levels } });
    for (const t of pyramid) ctx.release(t);
    return out;
  },
};

/** Grid size in cells: `density` cells along the short side, cells stretched by 2^aspect, fitted to the image. */
function gridCells(p: ParamValues, w: number, h: number): [number, number] {
  const density = Math.max(1, Math.round(num(p, 'density')));
  const aspect = num(p, 'gridAspect');
  const base = Math.min(w, h) / density;
  const nx = Math.max(1, Math.round(w / (base * Math.pow(2, aspect))));
  const ny = Math.max(1, Math.round(h / (base * Math.pow(2, -aspect))));
  return [nx, ny];
}
