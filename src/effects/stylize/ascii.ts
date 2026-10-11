import type { EffectDef } from '../../engine/types';
import { textureFromData, textureFromImage, type Texture } from '../../engine/gl';
import { bool, color, float, int, num } from '../helpers';
import { DOWN2_GLSL, downTo } from './common-a';

// Image → character grid. `density` = rows of characters over the image height, `tile aspect` = cell
// width / height. Glyphs are rasterized once into an atlas (OffscreenCanvas 2D) and sorted by measured ink
// coverage; a LUT maps the wanted coverage (∝ luma³, effect.app's response) to the glyph with the nearest
// coverage, so every character set gives the same tone response.

/** Character sets (unsorted; the atlas builder orders them by measured coverage). */
const CHAR_SETS = [
  ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  ' .:-=+*#%@',
  ' ░▒▓█',
  ' ·:•oO0●',
  ' 01',
];

/** Shade characters rendered procedurally (coverage). */
const SHADES: Record<string, number> = { '░': 0.25, '▒': 0.5, '▓': 0.75, '█': 1 };

const CELL_W = 40;
const CELL_H = 64;
const COLS = 16;

interface Atlas {
  tex: Texture;
  /** 256×1: relative coverage → r = glyph slot at or below it, g = position toward the next slot (0..255). */
  lut: Texture;
  rows: number;
}

function buildAtlas(gl: WebGL2RenderingContext, chars: string): Atlas {
  const glyphs = Array.from(chars);
  // Measure coverage of every glyph, then sort (space stays first).
  const meas = new OffscreenCanvas(CELL_W, CELL_H);
  const mc = meas.getContext('2d', { willReadFrequently: true })!;
  const font = `${Math.round(CELL_H * 0.72)}px ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, monospace`;
  const draw = (cx: OffscreenCanvasRenderingContext2D, ch: string, x: number, y: number) => {
    const shade = SHADES[ch];
    if (shade !== undefined) {
      // Block elements are drawn as cell-filling dither patterns so neighbouring cells join seamlessly.
      cx.fillStyle = '#fff';
      const g = CELL_W / 5;
      for (let j = 0; j < CELL_H / g; j++) {
        for (let i = 0; i < 5; i++) {
          const k = (i & 1) + 2 * (j & 1); // 2x2 ordered dither
          if ((shade >= 1) || (shade >= 0.75 && k !== 3) || (shade >= 0.5 && (k === 0 || k === 3)) || (shade >= 0.25 && k === 0)) {
            cx.fillRect(x + i * g, y + j * g, g, g);
          }
        }
      }
      return;
    }
    cx.font = font;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillStyle = '#fff';
    const m = cx.measureText(ch);
    // Squeeze glyphs wider than the cell (block / full-width characters).
    const sx = m.width > CELL_W ? CELL_W / m.width : 1;
    cx.save();
    cx.translate(x + CELL_W / 2, y + CELL_H / 2 + CELL_H * 0.04);
    cx.scale(sx, 1);
    cx.fillText(ch, 0, 0);
    cx.restore();
  };
  const cov = glyphs.map((ch) => {
    mc.clearRect(0, 0, CELL_W, CELL_H);
    draw(mc, ch, 0, 0);
    const d = mc.getImageData(0, 0, CELL_W, CELL_H).data;
    let s = 0;
    for (let i = 3; i < d.length; i += 4) s += d[i];
    return s;
  });
  const order = glyphs.map((_, i) => i).sort((a, b) => cov[a] - cov[b] || a - b);
  // Relative coverage of each slot (0 … 1), strictly increasing so the LUT can interpolate.
  const maxCov = Math.max(1, cov[order[order.length - 1]]);
  const rel: number[] = [];
  order.forEach((gi, k) => rel.push(Math.max(cov[gi] / maxCov, k > 0 ? rel[k - 1] + 1e-4 : 0)));
  const lutData = new Uint8Array(256 * 4);
  for (let x = 0; x < 256; x++) {
    const u = x / 255;
    let k = 0;
    while (k < rel.length - 1 && rel[k + 1] <= u) k++;
    const f = k < rel.length - 1 ? (u - rel[k]) / (rel[k + 1] - rel[k]) : 0;
    lutData.set([k, Math.round(Math.min(1, Math.max(0, f)) * 255), 0, 255], x * 4);
  }
  const lut = textureFromData(gl, lutData, 256, 1, { nearest: true });
  const rows = Math.ceil(order.length / COLS);
  const cv = new OffscreenCanvas(COLS * CELL_W, rows * CELL_H);
  const cx = cv.getContext('2d')!;
  cx.fillStyle = '#000';
  cx.fillRect(0, 0, cv.width, cv.height);
  order.forEach((gi, k) => draw(cx, glyphs[gi], (k % COLS) * CELL_W, Math.floor(k / COLS) * CELL_H));
  const tex = textureFromImage(gl, cv, cv.width, cv.height, { mipmaps: true });
  return { tex, lut, rows };
}

export const ascii: EffectDef = {
  id: 'ascii',
  name: 'ASCII',
  category: 'Effects',
  keywords: 'art ascii pixel retro style terminal text',
  params: [
    int('charSet', 'charSet', 0, 4, 0),
    int('density', 'density', 14, 70, 60),
    float('tileAspect', 'tile aspect', 0.55, 1.5, 0.6),
    color('charColor', 'character color', '#ffffff'),
    color('bgColor', 'background color', '#000000'),
    bool('invert', 'invert', false),
    float('contrast', 'contrast', 0, 3, 1),
    float('cutDarks', 'cut darks', 0, 0.5, 0.02),
    float('cutLights', 'cut lights', 0, 0.5, 0),
    bool('overlay', 'overlay on image', false),
  ],
  shaders: {
    down2: DOWN2_GLSL,
    main: /* glsl */ `
uniform sampler2D u_atlas;
uniform sampler2D u_lut;
uniform sampler2D u_small; // input reduced to ~4 texels per cell (cell averages stay exact at any size)
uniform float u_atlasRows;
const float COLS = ${COLS}.0;
const vec2 CELL = vec2(${CELL_W}.0, ${CELL_H}.0);
void main() {
  vec4 src = texture(u_input, v_uv);
  float cellH = u_resolution.y / u_density;
  vec2 cellPx = vec2(cellH * u_tileAspect, cellH);
  // Grid anchored at the top-left corner.
  vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec2 cell = floor(p / cellPx);
  vec2 local = (p - cell * cellPx) / cellPx; // 0..1, y down
  // Average luminance of the cell (4x4 bilinear taps).
  float l = 0.0;
  vec3 avg = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      vec2 q = (cell + (vec2(i, j) + 0.5) / 4.0) * cellPx;
      vec3 c = texture(u_small, vec2(q.x, u_resolution.y - q.y) / u_resolution).rgb;
      avg += c;
    }
  }
  avg /= 16.0;
  l = luma(saturate(avg));
  if (u_invert) l = 1.0 - l;
  l = saturate((l - 0.5) * u_contrast + 0.5);
  // Wanted ink coverage relative to the densest glyph → the glyph with the nearest coverage.
  vec2 lk = texelFetch(u_lut, ivec2(int(l * l * l * 255.0 + 0.5), 0), 0).rg * 255.0;
  float k = floor(lk.x + 0.5) + (lk.y > 127.5 ? 1.0 : 0.0);
  if (l < u_cutDarks || l > 1.0 - u_cutLights) k = 0.0;
  // Atlas lookup (atlas rows are stored top-down in the canvas, flipped on upload).
  vec2 slot = vec2(mod(k, COLS), floor(k / COLS));
  vec2 atlasSize = vec2(COLS, u_atlasRows) * CELL;
  vec2 apx = (slot + clamp(local, 0.02, 0.98)) * CELL;
  vec2 auv = vec2(apx.x, atlasSize.y - apx.y) / atlasSize;
  // Slightly under-filtered and re-thresholded so tiny glyphs stay crisp instead of turning gray.
  float lod = max(0.0, log2(CELL.y / max(cellH, 1.0)) - 1.0);
  float g = textureLod(u_atlas, auv, lod).r;
  float crisp = saturate(8.0 / cellH);
  g = mix(g, smoothstep(0.2, 0.6, g), crisp);
  vec3 base = u_overlay ? src.rgb : u_bgColor;
  fragColor = vec4(mix(base, u_charColor, g), src.a);
}`,
  },
  render(ctx) {
    const set = Math.max(0, Math.min(CHAR_SETS.length - 1, Math.round(num(ctx.params, 'charSet'))));
    const atlas = ctx.cached(`atlas:${set}`, () => buildAtlas(ctx.gl, CHAR_SETS[set]), (a) => (a.tex.dispose(), a.lut.dispose()));
    const rows = Math.max(1, num(ctx.params, 'density'));
    const cellH = ctx.height / rows;
    const cellW = cellH * num(ctx.params, 'tileAspect');
    const small = downTo(ctx, ctx.input, (ctx.width / cellW) * 4, rows * 4);
    const out = ctx.pass('main', { inputs: { u_atlas: atlas.tex, u_lut: atlas.lut, u_small: small }, uniforms: { u_atlasRows: atlas.rows } });
    if (small !== ctx.input) ctx.release(small);
    return out;
  },
};
