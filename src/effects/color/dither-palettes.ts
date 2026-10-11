// Palettes for the Dither effect: named presets (effect.app's preset names, our own colors),
// subset selection for "color count", and the adaptive (image-derived) palette.

import { hexToRgb } from '../../engine/luts';
import { linearToOklab, oklabToSrgb, srgbToLinear1, clamp01, type RGB } from './color-math';

const greys = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const v = Math.round((i / (n - 1)) * 255)
      .toString(16)
      .padStart(2, '0');
    return '#' + v + v + v;
  });

export const PRESET_NAMES = ['Elevate', 'Primaries', 'Imperial', 'Galaxy', 'Ocean', 'Sepia', 'Neon', 'Monochrome', 'Wildberry', 'Crystals', 'Faded', 'Sunny'];

export const PRESETS: Record<string, string[]> = {
  Elevate: ['#1b1530', '#2f2a5c', '#3f5f9c', '#2f8f9d', '#5cc6b0', '#a6e3c0', '#f4f1d0', '#f7c59f', '#ef8a62', '#d6505e', '#8e2f5e', '#ffffff'],
  Primaries: ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#00ffff', '#ff00ff', '#ffff00'],
  Imperial: ['#0d0a14', '#2b1b3d', '#4b1f5c', '#1d2c55', '#7a1f2b', '#b3202a', '#355c4b', '#c9a227', '#e8cf7a', '#f3ead2'],
  Galaxy: ['#05030f', '#140c33', '#2a1460', '#4b1d8f', '#7b2cbf', '#c03fbf', '#ff5ca8', '#ff9ec7', '#3a86ff', '#7fd8ff', '#e0f7ff', '#ffffff'],
  Ocean: ['#021526', '#03346e', '#0b5394', '#0f6b5c', '#1c7cb0', '#2aa1c2', '#4fc3c8', '#8de0d6', '#c9f2ea', '#e6d7b0', '#f3fbf8'],
  Sepia: ['#1a120b', '#2e2014', '#45301e', '#5c4129', '#755436', '#8f6a46', '#a98258', '#c19c70', '#d6b78d', '#e8d2ad', '#f5e9d0', '#fffaf0'],
  Neon: ['#05010d', '#7b2ff7', '#ff00a0', '#ff2a6d', '#00b4ff', '#ffb800', '#00f5d4', '#39ff14', '#f9f871', '#ffffff'],
  Monochrome: greys(18),
  Wildberry: ['#14051c', '#2d0a35', '#4a0d4f', '#6b1364', '#2e3a87', '#8e1a6e', '#2f5a3a', '#b5245f', '#5866c4', '#d63f6a', '#6f9a4f', '#f06e8c', '#f7a8c0', '#fde0ea'],
  Crystals: ['#0b1026', '#1d2b64', '#3c4fa8', '#6d7fd8', '#c9a7ff', '#7fdbff', '#a5b4fc', '#b8f2ff', '#d6dcff', '#ffd6f5', '#f5f7ff', '#ffffff'],
  Faded: ['#2b2b2e', '#45474d', '#5f6b73', '#6b7f99', '#a07f78', '#7d8d8f', '#8fb3b0', '#9aa8a0', '#c9a99a', '#c2c5b5', '#e3dfcf', '#f2ece0'],
  Sunny: ['#2b1406', '#5a2a0a', '#8c3f0e', '#3b8bc2', '#6aa84f', '#c45f12', '#7ec8e3', '#ec8a1c', '#f7b733', '#fcd667', '#fff2b2', '#fffbe8'],
};

/** Default for the editable palette (used by the "Custom" option): PICO-8's 16 colors. */
export const CUSTOM_DEFAULT = [
  '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
  '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa',
];

export const lumaOf = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export const sortByLuma = (cs: RGB[]) => [...cs].sort((a, b) => lumaOf(a) - lumaOf(b));

/** `count` colors spread evenly over the luminance-sorted palette (keeps the darkest and lightest). */
export function spreadSubset(hex: string[], count: number): RGB[] {
  const cs = sortByLuma(hex.map(hexToRgb));
  if (count >= cs.length) return cs;
  const out: RGB[] = [];
  for (let i = 0; i < count; i++) out.push(cs[Math.round((i * (cs.length - 1)) / Math.max(1, count - 1))]);
  return out;
}

/**
 * Palette of `k` colors from RGBA float pixels (alpha-weighted): median cut in OKLab, refined with
 * a few k-means iterations. Deterministic, so a static image always yields the same palette.
 */
export function extractPalette(px: Float32Array, k: number): RGB[] {
  const labs: RGB[] = [];
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 0.5) continue;
    labs.push(linearToOklab(srgbToLinear1(clamp01(px[i])), srgbToLinear1(clamp01(px[i + 1])), srgbToLinear1(clamp01(px[i + 2]))));
  }
  if (!labs.length) return [[0, 0, 0], [1, 1, 1]];
  // Median cut: split the box with the largest squared error along its widest axis.
  let boxes: RGB[][] = [labs];
  const sse = (b: RGB[]) => {
    const m = mean(b);
    let s = 0;
    for (const p of b) s += (p[0] - m[0]) ** 2 + (p[1] - m[1]) ** 2 + (p[2] - m[2]) ** 2;
    return s;
  };
  while (boxes.length < k) {
    let bi = -1;
    let best = 1e-9;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      const s = sse(b);
      if (s > best) {
        best = s;
        bi = i;
      }
    });
    if (bi < 0) break;
    const b = boxes[bi];
    let axis = 0;
    let wid = -1;
    for (let a = 0; a < 3; a++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const p of b) {
        lo = Math.min(lo, p[a]);
        hi = Math.max(hi, p[a]);
      }
      if (hi - lo > wid) {
        wid = hi - lo;
        axis = a;
      }
    }
    const sorted = [...b].sort((p, q) => p[axis] - q[axis]);
    const mid = sorted.length >> 1;
    boxes = [...boxes.slice(0, bi), sorted.slice(0, mid), sorted.slice(mid), ...boxes.slice(bi + 1)];
  }
  let cents = boxes.map(mean);
  // k-means refinement.
  for (let it = 0; it < 6; it++) {
    const sums = cents.map(() => [0, 0, 0, 0]);
    for (const p of labs) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < cents.length; c++) {
        const d = (p[0] - cents[c][0]) ** 2 + (p[1] - cents[c][1]) ** 2 + (p[2] - cents[c][2]) ** 2;
        if (d < bd) {
          bd = d;
          bi = c;
        }
      }
      const s = sums[bi];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    }
    cents = cents.map((c, i) => (sums[i][3] ? ([sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]] as RGB) : c));
  }
  return sortByLuma(cents.map((c) => oklabToSrgb(c).map(clamp01) as RGB));
}

function mean(b: RGB[]): RGB {
  const m: RGB = [0, 0, 0];
  for (const p of b) {
    m[0] += p[0];
    m[1] += p[1];
    m[2] += p[2];
  }
  const n = Math.max(1, b.length);
  return [m[0] / n, m[1] / n, m[2] / n];
}
