// Threshold maps for the Dither effect's "pattern type" slider (0..22).
// Procedural noises are evaluated in the shader; every other pattern is a small tile whose values
// are rank-normalized here (ties averaged) so each map has an even threshold distribution.

export type PatternSource =
  | { kind: 'hash' } // white noise per block
  | { kind: 'blue' } // built-in blue-noise texture
  | { kind: 'ign' } // interleaved gradient noise
  | { kind: 'tile'; w: number; h: number; f: (x: number, y: number) => number };

const BAYER_CACHE = new Map<number, number[]>();
/** Bayer matrix value (0..n²-1) for size n = 2^bits. */
function bayer(x: number, y: number, bits: number): number {
  let key = BAYER_CACHE.get(bits);
  if (!key) {
    const n = 1 << bits;
    key = new Array(n * n);
    for (let yy = 0; yy < n; yy++)
      for (let xx = 0; xx < n; xx++) {
        let v = 0;
        for (let b = 0; b < bits; b++) {
          const xb = (xx >> b) & 1;
          const yb = (yy >> b) & 1;
          v |= (((xb ^ yb) << 1) | yb) << (2 * (bits - 1 - b));
        }
        key[yy * n + xx] = v;
      }
    BAYER_CACHE.set(bits, key);
  }
  const n = 1 << bits;
  return key[(y % n) * n + (x % n)];
}
/** Fine tie-breaker in [0, 1) so flat regions of a pattern still ramp smoothly. */
const tie = (x: number, y: number) => bayer(x, y, 3) / 64;

const CLUSTER4 = [12, 5, 6, 13, 4, 0, 1, 7, 11, 3, 2, 8, 15, 10, 9, 14];
const CLUSTER8 = [
  24, 10, 12, 26, 35, 47, 49, 37, 8, 0, 2, 14, 45, 59, 61, 51, 22, 6, 4, 16, 43, 57, 63, 53, 30, 20, 18, 28, 33, 41, 55, 39, 34, 46, 48, 36, 25, 11, 13, 27, 44,
  58, 60, 50, 9, 1, 3, 15, 42, 56, 62, 52, 23, 7, 5, 17, 32, 40, 54, 38, 31, 21, 19, 29,
];

const mod = (a: number, n: number) => ((a % n) + n) % n;
/** Distance from a pixel center to the nearest stripe center of a periodic coordinate. */
const stripe = (u: number, period: number) => Math.abs(mod(u, period) - period / 2);

/** Nearest-point distance to a lattice given by two basis vectors (searches nearby cells). */
function latticeDist(x: number, y: number, a: [number, number], b: [number, number]): number {
  const det = a[0] * b[1] - a[1] * b[0];
  const i0 = Math.floor((x * b[1] - y * b[0]) / det);
  const j0 = Math.floor((a[0] * y - a[1] * x) / det);
  let best = Infinity;
  for (let i = i0 - 2; i <= i0 + 2; i++)
    for (let j = j0 - 2; j <= j0 + 2; j++) {
      const px = i * a[0] + j * b[0];
      const py = i * a[1] + j * b[1];
      best = Math.min(best, Math.hypot(x - px, y - py));
    }
  return best;
}

// Jittered feature points for the stipple pattern: 8x8 cells of 6px wrapping in a 48px tile.
const STIPPLE_PTS: [number, number][] = (() => {
  let s = 1234567;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  const pts: [number, number][] = [];
  for (let cy = 0; cy < 8; cy++) for (let cx = 0; cx < 8; cx++) pts.push([cx * 6 + 0.8 + rnd() * 4.4, cy * 6 + 0.8 + rnd() * 4.4]);
  return pts;
})();

export const PATTERNS: { name: string; src: PatternSource }[] = [
  { name: 'White noise', src: { kind: 'hash' } },
  { name: 'Bayer 2x2', src: { kind: 'tile', w: 2, h: 2, f: (x, y) => bayer(x, y, 1) } },
  { name: 'Bayer 4x4', src: { kind: 'tile', w: 4, h: 4, f: (x, y) => bayer(x, y, 2) } },
  { name: 'Bayer 8x8', src: { kind: 'tile', w: 8, h: 8, f: (x, y) => bayer(x, y, 3) } },
  { name: 'Bayer 16x16', src: { kind: 'tile', w: 16, h: 16, f: (x, y) => bayer(x, y, 4) } },
  { name: 'Blue noise', src: { kind: 'blue' } },
  { name: 'Interleaved gradient noise', src: { kind: 'ign' } },
  { name: 'Cluster dot 4x4', src: { kind: 'tile', w: 4, h: 4, f: (x, y) => CLUSTER4[(y % 4) * 4 + (x % 4)] } },
  { name: 'Cluster dot 8x8', src: { kind: 'tile', w: 8, h: 8, f: (x, y) => CLUSTER8[(y % 8) * 8 + (x % 8)] } },
  {
    name: 'Halftone dots 45°',
    src: { kind: 'tile', w: 8, h: 8, f: (x, y) => latticeDist(x + 0.5, y + 0.5, [4, 4], [4, -4]) + 0.01 * tie(x, y) },
  },
  { name: 'Horizontal lines', src: { kind: 'tile', w: 8, h: 24, f: (x, y) => stripe(y + 0.5, 6) + 0.99 * tie(x, y) } },
  { name: 'Vertical lines', src: { kind: 'tile', w: 24, h: 8, f: (x, y) => stripe(x + 0.5, 6) + 0.99 * tie(x, y) } },
  { name: 'Diagonal lines /', src: { kind: 'tile', w: 24, h: 24, f: (x, y) => stripe(x - y, 6) + 0.99 * tie(x, y) } },
  { name: 'Diagonal lines \\', src: { kind: 'tile', w: 24, h: 24, f: (x, y) => stripe(x + y + 1, 6) + 0.99 * tie(x, y) } },
  {
    name: 'Grid',
    src: { kind: 'tile', w: 6, h: 6, f: (x, y) => Math.min(stripe(x + 0.5, 6), stripe(y + 0.5, 6)) + 0.5 * Math.max(stripe(x + 0.5, 6), stripe(y + 0.5, 6)) / 3 },
  },
  {
    name: 'Crosshatch',
    src: { kind: 'tile', w: 24, h: 24, f: (x, y) => Math.min(stripe(x - y, 6), stripe(x + y + 1, 6)) + 0.99 * tie(x, y) },
  },
  {
    name: 'Diamonds',
    src: { kind: 'tile', w: 8, h: 8, f: (x, y) => Math.abs(mod(x, 8) + 0.5 - 4) + Math.abs(mod(y, 8) + 0.5 - 4) + 0.01 * tie(x, y) },
  },
  {
    name: 'Squares',
    src: { kind: 'tile', w: 8, h: 8, f: (x, y) => Math.max(Math.abs(mod(x, 8) + 0.5 - 4), Math.abs(mod(y, 8) + 0.5 - 4)) + 0.99 * tie(x, y) },
  },
  {
    name: 'Checker',
    src: {
      kind: 'tile',
      w: 8,
      h: 8,
      f: (x, y) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2) * 8 + Math.max(Math.abs(mod(x, 4) + 0.5 - 2), Math.abs(mod(y, 4) + 0.5 - 2)) + 0.1 * tie(x, y),
    },
  },
  {
    name: 'Waves',
    src: { kind: 'tile', w: 24, h: 24, f: (x, y) => stripe(y + 0.5 - 1.6 * Math.sin(((x + 0.5) / 24) * Math.PI * 2), 6) + 0.2 * tie(x, y) },
  },
  {
    name: 'Bricks',
    src: {
      kind: 'tile',
      w: 8,
      h: 8,
      f: (x, y) => {
        const row = Math.floor(y / 4);
        const bx = mod(x + (row % 2) * 4, 8);
        return Math.max(Math.abs(bx + 0.5 - 4) / 4, Math.abs(mod(y, 4) + 0.5 - 2) / 2) + 0.05 * tie(x, y);
      },
    },
  },
  {
    name: 'Hex dots',
    src: { kind: 'tile', w: 8, h: 14, f: (x, y) => latticeDist(x + 0.5, y + 0.5, [8, 0], [4, 7]) },
  },
  {
    name: 'Stipple',
    src: {
      kind: 'tile',
      w: 48,
      h: 48,
      f: (x, y) => {
        let best = Infinity;
        for (const [px, py] of STIPPLE_PTS) {
          const dx = Math.abs(x + 0.5 - px);
          const dy = Math.abs(y + 0.5 - py);
          best = Math.min(best, Math.hypot(Math.min(dx, 48 - dx), Math.min(dy, 48 - dy)));
        }
        return best;
      },
    },
  },
];

/** Rank-normalize to thresholds in (0, 1), averaging tied ranks. */
function rankNormalize(v: number[]): number[] {
  const idx = v.map((_, i) => i).sort((a, b) => v[a] - v[b]);
  const out = new Array<number>(v.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && Math.abs(v[idx[j + 1]] - v[idx[i]]) < 1e-9) j++;
    const r = (i + j) / 2;
    for (let k = i; k <= j; k++) out[idx[k]] = (r + 0.5) / v.length;
    i = j + 1;
  }
  return out;
}

export interface PatternAtlas {
  data: Float32Array;
  width: number;
  height: number;
  /** Per pattern: x offset of its tile in the atlas (tile patterns only). */
  offsets: number[];
}

/** All tile patterns side by side in one RGBA float atlas (rows bottom-up, value in R). */
export function buildPatternAtlas(): PatternAtlas {
  const offsets: number[] = [];
  let width = 0;
  let height = 1;
  for (const p of PATTERNS) {
    offsets.push(width);
    if (p.src.kind === 'tile') {
      width += p.src.w;
      height = Math.max(height, p.src.h);
    }
  }
  const data = new Float32Array(width * height * 4);
  PATTERNS.forEach((p, i) => {
    if (p.src.kind !== 'tile') return;
    const { w, h, f } = p.src;
    const vals: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) vals.push(f(x, y));
    const t = rankNormalize(vals);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const o = (y * width + offsets[i] + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = t[y * w + x];
        data[o + 3] = 1;
      }
  });
  return { data, width, height, offsets };
}
