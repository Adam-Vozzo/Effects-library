import type { EffectDef } from '../../engine/types';
import { textureFromImage, type Texture } from '../../engine/gl';
import { bool, choice, color, float, int, num } from '../helpers';

const MAX_BLOBS = 32;
/** Default cap: keeps the overlay readable; centres closer than MIN_SPACING (uv) are suppressed. */
const MIN_SPACING = 0.045;
/** Analysis grid (long side): fixed relative to the image so detection is identical at any render size. */
const ANALYSIS = 256;
const GLYPHS = '0123456789 .:#-xyIDB';

/** Box blend options; 'Default' = normal alpha compositing, 'Invert' inverts what lies under the overlay. */
const BOX_BLENDS = ['Default', 'Add', 'Screen', 'Multiply', 'Overlay', 'Difference', 'Exclusion', 'Invert'];

const PALETTES = [
  ['#00f2ff', '#39ff14', '#ff2bd6', '#fff200', '#ff6a00', '#8a5cff'],
  ['#ff3b30', '#ff9500', '#ffd60a', '#ff2d55', '#ff7eb6', '#ffffff'],
  ['#a0e7e5', '#b4f8c8', '#fbe7c6', '#ffaebc', '#cdb4db', '#bde0fe'],
  ['#ffffff', '#00ff66', '#b8b8b8', '#ff0044', '#00b3ff', '#ffe600'],
];

interface Blob {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  area: number;
}

/** 4-connected components of a binary mask (rows bottom-up), via union-find. Coordinates returned in uv. */
function findBlobs(mask: Uint8Array, w: number, h: number): Blob[] {
  const parent = new Int32Array(w * h).fill(-1);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      parent[i] = i;
      if (x > 0 && mask[i - 1]) parent[find(i)] = find(i - 1);
      if (y > 0 && mask[i - w]) {
        const a = find(i);
        const b = find(i - w);
        if (a !== b) parent[a] = b;
      }
    }
  }
  const comps = new Map<number, Blob>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const r = find(i);
      let b = comps.get(r);
      if (!b) comps.set(r, (b = { x0: x, y0: y, x1: x + 1, y1: y + 1, cx: 0, cy: 0, area: 0 }));
      b.x0 = Math.min(b.x0, x);
      b.y0 = Math.min(b.y0, y);
      b.x1 = Math.max(b.x1, x + 1);
      b.y1 = Math.max(b.y1, y + 1);
      b.cx += x + 0.5;
      b.cy += y + 0.5;
      b.area++;
    }
  }
  return [...comps.values()].map((b) => ({
    x0: b.x0 / w,
    y0: b.y0 / h,
    x1: b.x1 / w,
    y1: b.y1 / h,
    cx: b.cx / b.area / w,
    cy: b.cy / b.area / h,
    area: b.area / (w * h),
  }));
}

/**
 * Multi-level detection (MSER-like): components of the key-similarity map at a few thresholds above the chosen
 * one, keeping blobs between a minimum and maximum size. Large flat regions (skies, backdrops) are skipped at the
 * base level but their brighter/closer cores still produce nested boxes of varied sizes.
 */
function detect(sim: Float32Array, w: number, h: number, threshold: number): Blob[] {
  const mask = new Uint8Array(w * h);
  const minArea = 10 / (w * h);
  const maxArea = 0.3;
  const out: Blob[] = [];
  const iou = (a: Blob, b: Blob) => {
    const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
    const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const i = ix * iy;
    return i / ((a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - i);
  };
  for (let k = 0; k < 4; k++) {
    const t = threshold + k * 0.07;
    if (k > 0 && t > 0.995) break;
    for (let i = 0; i < w * h; i++) mask[i] = sim[i] >= t ? 1 : 0;
    for (const b of findBlobs(mask, w, h)) {
      if (b.area < minArea || b.area > maxArea) continue;
      if (out.some((o) => iou(o, b) > 0.6)) continue;
      out.push(b);
    }
  }
  // Largest first; suppress blobs crowding an already accepted centre (aspect-corrected distance).
  out.sort((a, b) => b.area - a.area);
  const asp = w / h;
  const kept: Blob[] = [];
  for (const b of out) {
    if (kept.length >= MAX_BLOBS) break;
    if (kept.some((k) => Math.hypot((k.cx - b.cx) * asp, k.cy - b.cy) < MIN_SPACING)) continue;
    kept.push(b);
  }
  return kept;
}

interface Atlas {
  tex: Texture;
  /** Glyph cell aspect (width / height). */
  aspect: number;
}

function buildAtlas(gl: WebGL2RenderingContext, cellH: number): Atlas | null {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const font = `600 ${Math.round(cellH * 0.8)}px "JetBrains Mono", "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace`;
  const m = new OffscreenCanvas(1, 1).getContext('2d')!;
  m.font = font;
  const cellW = Math.ceil(m.measureText('0').width + cellH * 0.04);
  const c = new OffscreenCanvas(cellW * GLYPHS.length, cellH);
  const x = c.getContext('2d')!;
  x.font = font;
  x.fillStyle = '#fff';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (let i = 0; i < GLYPHS.length; i++) x.fillText(GLYPHS[i], (i + 0.5) * cellW, cellH * 0.54);
  const tex = textureFromImage(gl, c, c.width, c.height, { mipmaps: true });
  return { tex, aspect: cellW / cellH };
}

function hexToVec(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Line partner per blob (-1 = none): 1 chain in tracking order, 2 nearest neighbour, 3 hub to the largest blob. */
function links(blobs: Blob[], type: number): number[] {
  const out = blobs.map(() => -1);
  if (type === 1) {
    for (let i = 0; i + 1 < blobs.length; i++) out[i] = i + 1;
  } else if (type === 2) {
    blobs.forEach((a, i) => {
      let best = -1;
      let bd = Infinity;
      blobs.forEach((b, j) => {
        const d = (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2;
        if (j !== i && d < bd) {
          bd = d;
          best = j;
        }
      });
      out[i] = best;
    });
    // Mutual nearest neighbours would draw the same segment twice.
    out.forEach((j, i) => {
      if (j >= 0 && j < i && out[j] === i) out[i] = -1;
    });
  } else if (type === 3) {
    for (let i = 1; i < blobs.length; i++) out[i] = 0;
  }
  return out;
}

export const blobTracker: EffectDef = {
  id: 'blob-tracker',
  name: 'Blob Tracker',
  category: 'Generate',
  keywords: 'blob bounding box detection lightness motion tracking',
  params: [
    color('keyColor', 'key color', '#ffffff'),
    float('threshold', 'threshold', 0, 1, 0.55, 0.001),
    // Temporal smoothing on video; a still image is a single settled frame.
    float('persistence', 'persistence', 0.5, 0.99, 0.82),
    bool('debugMask', 'debug mask', false),
    bool('randomPalette', 'random palette', true),
    color('boxColor', 'box color', '#00f2ff'),
    int('paletteSet', 'palette set', 0, 3, 0),
    int('boxType', 'box type', 0, 3, 1),
    choice('boxBlend', 'box blend', BOX_BLENDS, 0, 'select'),
    float('boxThickness', 'box thickness px', 0.5, 8, 1.5, 0.5),
    float('boxOutlineOpacity', 'box outline opacity', 0, 1, 1, 0.05),
    float('boxFillOpacity', 'box fill opacity', 0, 1, 0.12, 0.02),
    int('centerType', 'center type', 0, 4, 4),
    float('centerSize', 'center size px', 1, 16, 3, 0.5),
    int('captionPosition', 'caption position', 0, 8, 1),
    float('captionSize', 'caption size px', 6, 48, 22, 1),
    float('captionBgOpacity', 'caption bg opacity', 0, 1, 0.45, 0.05),
    int('lineType', 'line type', 0, 3, 1),
    int('lineStyle', 'line style', 0, 3, 2),
  ],
  shaders: {
    down: /* glsl */ `
uniform sampler2D u_src;
uniform vec2 u_srcTexel;
void main() {
  vec2 o = u_srcTexel;
  fragColor = 0.25 * (texture(u_src, v_uv - o) + texture(u_src, v_uv + vec2(o.x, -o.y))
    + texture(u_src, v_uv + vec2(-o.x, o.y)) + texture(u_src, v_uv + o));
}`,
    mask: /* glsl */ `
uniform sampler2D u_src;
float keySimilarity(vec3 c) {
  vec3 a = linearToOklab(srgbToLinear(saturate(c)));
  vec3 k = linearToOklab(srgbToLinear(u_keyColor));
  return 1.0 - length(a - k) / 0.4;
}
void main() {
  fragColor = vec4(saturate(keySimilarity(texture(u_src, v_uv).rgb)), 0.0, 0.0, 1.0);
}`,
    main: /* glsl */ `
uniform vec4 u_blobBox[${MAX_BLOBS}];  // x0, y0, x1, y1 (uv)
uniform vec4 u_blobInfo[${MAX_BLOBS}]; // cx, cy (uv), palette index, linked blob (-1 none)
uniform int u_blobCount;
uniform vec3 u_pal[6];
uniform sampler2D u_atlas;
uniform float u_glyphAspect;
float keySimilarity(vec3 c) {
  vec3 a = linearToOklab(srgbToLinear(saturate(c)));
  vec3 k = linearToOklab(srgbToLinear(u_keyColor));
  return 1.0 - length(a - k) / 0.4;
}
// Coverage of a horizontal/vertical band |d| < w/2 with ~1px anti-aliasing.
float band(float d, float w) { return saturate(w * 0.5 + 0.5 - abs(d)); }
float sdSegment(vec2 p, vec2 a, vec2 b, out float t) {
  vec2 pa = p - a, ba = b - a;
  t = saturate(dot(pa, ba) / max(dot(ba, ba), 1e-6));
  return length(pa - ba * t);
}
// Distance to a quadratic Bezier (A, B control, C) and the curve parameter of the closest point (after IQ).
vec2 sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {
  vec2 a = B - A, b = A - 2.0 * B + C, c = a * 2.0, d = A - pos;
  float kk = 1.0 / max(dot(b, b), 1e-6);
  float kx = kk * dot(a, b);
  float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
  float kz = kk * dot(d, a);
  float p = ky - kx * kx, q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
  float h = q * q + 4.0 * p * p * p;
  if (h >= 0.0) {
    h = sqrt(h);
    vec2 x = (vec2(h, -h) - q) / 2.0;
    vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
    float t = saturate(uv.x + uv.y - kx);
    vec2 e = d + (c + b * t) * t;
    return vec2(length(e), t);
  }
  float z = sqrt(-p);
  float v = acos(clamp(q / (p * z * 2.0), -1.0, 1.0)) / 3.0;
  float m = cos(v), n = sin(v) * 1.732050808;
  vec2 t = saturate(vec2(m + m, -n - m) * z - kx);
  vec2 e1 = d + (c + b * t.x) * t.x, e2 = d + (c + b * t.y) * t.y;
  return dot(e1, e1) < dot(e2, e2) ? vec2(length(e1), t.x) : vec2(length(e2), t.y);
}
float glyph(int ch, vec2 g) {
  // g in [0,1]^2 inside the glyph cell (y up).
  if (g.x < 0.0 || g.y < 0.0 || g.x > 1.0 || g.y > 1.0) return 0.0;
  return texture(u_atlas, vec2((float(ch) + g.x) / ${GLYPHS.length}.0, g.y)).a;
}
// Caption "NN XXX YYY": blob number and centre in thousandths of the image.
int captionChar(int i, int id, vec2 c) {
  if (i == 2 || i == 6) return 10;
  int v = i < 2 ? id : i < 6 ? int(clamp(c.x, 0.0, 0.999) * 1000.0) : int(clamp(1.0 - c.y, 0.0, 0.999) * 1000.0);
  int k = i < 2 ? 1 - i : i < 6 ? 5 - i : 9 - i;
  for (int n = 0; n < 3; n++) { if (n >= k) break; v /= 10; }
  return v - (v / 10) * 10;
}
void over(inout vec4 acc, vec3 c, float a) {
  acc.rgb = mix(acc.rgb, c, a);
  acc.a = a + acc.a * (1.0 - a);
}
void main() {
  vec4 base = texture(u_input, v_uv);
  if (u_debugMask) {
    float m = step(u_threshold, keySimilarity(base.rgb));
    fragColor = vec4(vec3(m), 1.0);
    return;
  }
  vec2 px = v_uv * u_resolution;
  float s = u_pxScale;
  float th = max(u_boxThickness * s, 0.5);
  vec4 acc = vec4(0.0); // overlay colour (straight) + alpha
  int lt = int(u_lineType + 0.5), ls = int(u_lineStyle + 0.5);
  // Connection lines first (underneath the boxes). Styles: straight, straight dashed, arc, arc dashed.
  if (lt > 0) {
    float lw = max(th * 0.7, 0.6);
    for (int i = 0; i < ${MAX_BLOBS}; i++) {
      if (i >= u_blobCount) break;
      int j = int(u_blobInfo[i].w);
      if (j < 0) continue;
      vec2 a = u_blobInfo[i].xy * u_resolution, b = u_blobInfo[j].xy * u_resolution;
      vec2 dt;
      if (ls >= 2) {
        // Arc: quadratic Bezier bowed sideways by a quarter of the span, alternating sides.
        vec2 n = vec2(a.y - b.y, b.x - a.x) * (mod(float(i), 2.0) < 1.0 ? 0.25 : -0.25);
        vec2 c = (a + b) * 0.5 + n;
        vec2 lo = min(min(a, b), c) - lw - 2.0, hi = max(max(a, b), c) + lw + 2.0;
        if (any(lessThan(px, lo)) || any(greaterThan(px, hi))) continue;
        dt = sdBezier(px, a, c, b);
        dt.y *= length(b - a) * 1.15;
      } else {
        float t;
        dt.x = sdSegment(px, a, b, t);
        dt.y = t * length(b - a);
      }
      if (dt.x > lw + 2.0) continue;
      float on = (ls == 1 || ls == 3) ? step(fract(dt.y / (10.0 * s)), 0.55) : 1.0;
      int ci = int(u_blobInfo[i].z);
      over(acc, u_randomPalette ? u_pal[ci] : u_boxColor, band(dt.x, lw) * on * u_boxOutlineOpacity * 0.85);
    }
  }
  int bt = int(u_boxType + 0.5), ct = int(u_centerType + 0.5), cp = int(u_captionPosition + 0.5);
  float capH = u_captionSize * s;
  float capW = capH * u_glyphAspect; // glyph advance
  float capPad = capH * 0.2;
  for (int i = 0; i < ${MAX_BLOBS}; i++) {
    if (i >= u_blobCount) break;
    vec4 bb = u_blobBox[i] * u_resolution.xyxy;
    vec2 bc = u_blobInfo[i].xy;
    vec3 col = u_randomPalette ? u_pal[int(u_blobInfo[i].z)] : u_boxColor;
    // Caption rectangle (9 placements; 0 = off).
    float cw = capW * 10.0 + capPad * 2.0, chh = capH;
    vec2 cmin = vec2(-1e9);
    if (cp == 1) cmin = vec2(bb.x - th * 0.5, bb.w + th * 0.5);
    else if (cp == 2) cmin = vec2(bb.z + th * 0.5 - cw, bb.w + th * 0.5);
    else if (cp == 3) cmin = vec2(bb.x - th * 0.5, bb.y - th * 0.5 - chh);
    else if (cp == 4) cmin = vec2(bb.z + th * 0.5 - cw, bb.y - th * 0.5 - chh);
    else if (cp == 5) cmin = vec2(bb.x + th, bb.w - th - chh);
    else if (cp == 6) cmin = vec2(bb.z - th - cw, bb.w - th - chh);
    else if (cp == 7) cmin = vec2(bb.x + th, bb.y + th);
    else if (cp == 8) cmin = vec2((bb.x + bb.z - cw) * 0.5, (bb.y + bb.w - chh) * 0.5);
    float pad = th + u_centerSize * s * 2.0 + 2.0;
    bool nearBox = px.x > bb.x - pad && px.x < bb.z + pad && px.y > bb.y - pad && px.y < bb.w + pad;
    bool inCap = cp > 0 && px.x >= cmin.x && px.x <= cmin.x + cw && px.y >= cmin.y && px.y <= cmin.y + chh;
    if (!nearBox && !inCap) continue;
    if (nearBox) {
      // Fill.
      float inside = saturate(min(min(px.x - bb.x, bb.z - px.x), min(px.y - bb.y, bb.w - px.y)) + 0.5);
      over(acc, col, inside * u_boxFillOpacity);
      // Outline: distance to the rectangle border.
      vec2 hc = (bb.xy + bb.zw) * 0.5, hs = (bb.zw - bb.xy) * 0.5;
      vec2 q = abs(px - hc) - hs;
      float edge = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      float line = band(edge, th);
      if (bt == 1) {
        // Corner brackets: arms of half the shorter side from each corner.
        float arm = min(hs.x, hs.y) * 0.5 + th;
        vec2 fromCorner = hs - abs(px - hc);
        line *= step(max(fromCorner.x, fromCorner.y), arm);
      } else if (bt == 2) {
        float per = (px.x - bb.x) + (px.y - bb.y);
        line *= step(fract(per / (10.0 * s)), 0.55);
      } else if (bt == 3) {
        float r = min(min(hs.x, hs.y), 8.0 * s);
        vec2 qr = abs(px - hc) - hs + r;
        float er = length(max(qr, 0.0)) + min(max(qr.x, qr.y), 0.0) - r;
        line = band(er, th);
      }
      over(acc, col, line * u_boxOutlineOpacity);
      // Centre marker.
      vec2 cpx = bc * u_resolution;
      vec2 dc = px - cpx;
      float cs = u_centerSize * s;
      float mk = 0.0;
      float lw = max(th * 0.75, 0.75);
      if (ct == 1) mk = saturate(cs - length(dc) + 0.5);
      else if (ct == 2) mk = max(band(dc.x, lw) * step(abs(dc.y), cs * 1.6), band(dc.y, lw) * step(abs(dc.x), cs * 1.6));
      else if (ct == 3) mk = band(length(dc) - cs, lw);
      else if (ct == 4) {
        mk = band(length(dc) - cs, lw);
        mk = max(mk, band(dc.x, lw) * step(cs * 0.4, abs(dc.y)) * step(abs(dc.y), cs * 2.2));
        mk = max(mk, band(dc.y, lw) * step(cs * 0.4, abs(dc.x)) * step(abs(dc.x), cs * 2.2));
      }
      over(acc, col, saturate(mk) * u_boxOutlineOpacity);
    }
    if (inCap) {
      over(acc, col, u_captionBgOpacity);
      vec2 l = (px - cmin - vec2(capPad, 0.0)) / vec2(capW, chh);
      int ci = int(floor(l.x));
      float a = ci >= 0 && ci < 10 ? glyph(captionChar(ci, i + 1, bc), vec2(fract(l.x), l.y)) : 0.0;
      vec3 tc = mix(col, vec3(0.0), smoothstep(0.2, 0.5, u_captionBgOpacity));
      over(acc, tc, a);
    }
  }
  // Composite the overlay with the chosen blend.
  vec3 b = saturate(base.rgb);
  int mode = u_boxBlend;
  vec3 o = acc.rgb;
  vec3 r;
  if (mode == 1) r = b + o;
  else if (mode == 2) r = 1.0 - (1.0 - b) * (1.0 - o);
  else if (mode == 3) r = b * o;
  else if (mode == 4) r = blendOverlay(b, o);
  else if (mode == 5) r = abs(b - o);
  else if (mode == 6) r = b + o - 2.0 * b * o;
  else if (mode == 7) r = 1.0 - b;
  else r = o;
  fragColor = vec4(mix(base.rgb, r, acc.a), base.a);
}`,
  },
  render(ctx) {
    const p = ctx.params;
    // Box-filter pyramid down to about twice the analysis size, then threshold on the analysis grid.
    const long = Math.max(ctx.width, ctx.height);
    const aw = Math.max(1, Math.round((ctx.width / long) * ANALYSIS));
    const ah = Math.max(1, Math.round((ctx.height / long) * ANALYSIS));
    let cur = ctx.input;
    const temps: Texture[] = [];
    while (cur.width > aw * 2 * 1.5 || cur.height > ah * 2 * 1.5) {
      const nw = Math.max(aw * 2, Math.ceil(cur.width / 2));
      const nh = Math.max(ah * 2, Math.ceil(cur.height / 2));
      const next = ctx.pass('down', { width: nw, height: nh, inputs: { u_src: cur }, uniforms: { u_srcTexel: [0.5 / cur.width, 0.5 / cur.height] } });
      temps.push(next);
      cur = next;
    }
    const maskTex = ctx.pass('mask', { width: aw, height: ah, format: 'rgba8', inputs: { u_src: cur } });
    for (const t of temps) ctx.release(t);
    const data = ctx.read(maskTex);
    ctx.release(maskTex);
    const sim = new Float32Array(aw * ah);
    for (let i = 0; i < aw * ah; i++) sim[i] = data[i * 4];
    const blobs = detect(sim, aw, ah, num(p, 'threshold'));
    const lk = links(blobs, Math.round(num(p, 'lineType')));
    const box = new Float32Array(MAX_BLOBS * 4);
    const info = new Float32Array(MAX_BLOBS * 4);
    const pal = PALETTES[Math.max(0, Math.min(3, Math.round(num(p, 'paletteSet'))))];
    blobs.forEach((b, i) => {
      box.set([b.x0, b.y0, b.x1, b.y1], i * 4);
      // Palette index from a hash of the blob number, so colours look random but stay stable.
      const h = Math.imul(i + 1, 2654435761) >>> 0;
      info.set([b.cx, b.cy, (h >>> 7) % pal.length, lk[i]], i * 4);
    });
    const palData = new Float32Array(6 * 3);
    pal.forEach((c, i) => palData.set(hexToVec(c), i * 3));
    // Glyph atlas at about the drawn caption size (power-of-two buckets), capped for huge exports.
    const capPx = num(p, 'captionSize') * ctx.pxScale;
    const cellH = Math.min(256, Math.max(16, 2 ** Math.ceil(Math.log2(capPx * 1.25))));
    const atlas = ctx.cached<Atlas | null>('atlas:' + cellH, () => buildAtlas(ctx.gl, cellH), (a) => a?.tex.dispose());
    return ctx.pass('main', {
      inputs: atlas ? { u_atlas: atlas.tex } : {},
      uniforms: {
        u_blobBox: box,
        u_blobInfo: info,
        u_blobCount: blobs.length,
        u_pal: palData,
        u_glyphAspect: atlas?.aspect ?? 0.6,
      },
    });
  },
};

