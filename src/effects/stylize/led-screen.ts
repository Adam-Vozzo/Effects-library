import type { EffectDef } from '../../engine/types';
import { bool, float, num } from '../helpers';

// LED matrix. The image is averaged per square cell (cell = pixel size × 1.055% of the short side,
// grid anchored at the image center; effect.app's default gives ~34 cells across the short side).
// RGB mode splits each cell into three full-height subpixel columns (R, B, G from left to right, as on
// effect.app) lit with that channel's value. Columns are soft-edged intervals that tile the cell
// (partition of unity, so no dark seams between columns); rows keep a thin dark seam. Without RGB mode
// one rounded LED shows the cell color. `gap` insets every LED by a fraction of the cell, `pixel blur`
// softens LED edges (glow-like at high values), `transparent` makes the dark background transparent
// (alpha = LED coverage).
export const ledScreen: EffectDef = {
  id: 'led-screen',
  name: 'LED screen',
  category: 'Effects',
  keywords: 'billboard digital display grid led matrix pixel screen',
  params: [
    float('pixelSize', 'pixel size', 0, 10, 2.82),
    float('gap', 'gap', 0, 0.2, 0),
    float('pixelBlur', 'pixel blur', 0, 5, 0.6),
    bool('rgbMode', 'RGB mode', true),
    bool('transparent', 'transparent', false),
  ],
  shaders: {
    main: /* glsl */ `
// Soft indicator of [a, b] with edge width s (adjacent intervals sum to 1).
float band(float x, float a, float b, float s) {
  return smoothstep(a - 0.5 * s, a + 0.5 * s, x) - smoothstep(b - 0.5 * s, b + 0.5 * s, x);
}
// Same, repeated with period 1 (tails of the neighbouring cells, which reach 2 cells at max blur).
float bandP(float x, float a, float b, float s) {
  float m = 0.0;
  for (int k = -2; k <= 2; k++) m += band(x, a + float(k), b + float(k), s);
  return m;
}
// Rounded square LED (corner radius r) covering [g, 1 - g], soft edge width s.
float roundMask(vec2 f, float g, float r, float s) {
  vec2 q = abs(f - 0.5) - (0.5 - g - r);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  return 1.0 - smoothstep(-0.5 * s, 0.5 * s, d);
}
uniform sampler2D u_soft;  // input pre-blurred by ~cell/6 so 16 taps give a stable cell mean
float cellSize(vec2 res) { return max(u_pixelSize * 0.01055 * min(res.x, res.y), 3.0); }
void main() {
  vec2 res = u_resolution;
  float cell = cellSize(res);
  vec2 g = (v_uv - 0.5) * res / cell;
  vec2 id = floor(g);
  vec2 f = g - id;
  // Cell average (4x4 taps, identical for every pixel of the cell).
  vec4 acc = vec4(0.0);
  for (int j = 0; j < 4; j++)
    for (int i = 0; i < 4; i++) {
      vec2 q = (id + (vec2(i, j) + 0.5) * 0.25) * cell / res + 0.5;
      acc += texture(u_soft, clamp(q, 0.0, 1.0));
    }
  vec4 col = acc / 16.0;
  float px = 1.0 / cell;  // one output pixel in cell units
  float s = max(u_pixelBlur * 0.36, px);
  float gp = 0.5 * u_gap;
  vec3 c;
  float cover;
  if (u_rgbMode) {
    float w = (1.0 - 2.0 * gp) / 3.0;
    float row = bandP(f.y, gp + 0.04, 1.0 - gp - 0.04, s);
    float mr = bandP(f.x, gp, gp + w, s);
    float mb = bandP(f.x, gp + w, gp + 2.0 * w, s);
    float mg = bandP(f.x, gp + 2.0 * w, 1.0 - gp, s);
    c = vec3(mr, mg, mb) * row * col.rgb;
    cover = saturate(mr + mg + mb) * row;
  } else {
    float m = roundMask(f, gp + 0.04, 0.12, s);
    c = col.rgb * m;
    cover = m;
  }
  if (u_transparent) fragColor = vec4(cover > 1e-4 ? c / cover : vec3(0.0), cover * col.a);
  else fragColor = vec4(c, col.a);
}`,
  },
  render(ctx) {
    const cell = Math.max(num(ctx.params, 'pixelSize') * 0.01055 * Math.min(ctx.width, ctx.height), 3);
    const soft = ctx.blur(ctx.input, cell / 6);
    const out = ctx.pass('main', { inputs: { u_soft: soft } });
    ctx.release(soft);
    return out;
  },
};
