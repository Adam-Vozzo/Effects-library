import type { CurvePoint, GradientStop } from './types';

export const LUT_SIZE = 256;

export function hexToRgb(hex: string): [number, number, number] {
  let h = (hex || '#000000').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

/**
 * Monotone cubic (Fritsch–Carlson) interpolation through the points; no overshoot.
 * Periodic curves (hue) wrap around x = 0/1.
 */
export function evalCurve(points: CurvePoint[], periodic = false): (x: number) => number {
  let pts = [...points].filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).sort((a, b) => a[0] - b[0]);
  if (pts.length === 0) return (x) => x;
  if (pts.length === 1) {
    const y = pts[0][1];
    return () => y;
  }
  if (periodic) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    pts = [[last[0] - 1, last[1]], ...pts, [first[0] + 1, first[1]]];
  }
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d: number[] = [];
  const m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    d.push(dx > 1e-9 ? (ys[i + 1] - ys[i]) / dx : 0);
  }
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (periodic) x = x - Math.floor(x);
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    if (h < 1e-9) return ys[i + 1];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
    );
  };
}

/** 256x1 float RGBA LUT; the curve value is replicated into all channels. */
export function buildCurveLut(points: CurvePoint[], periodic = false): Float32Array {
  const f = evalCurve(points, periodic);
  const out = new Float32Array(LUT_SIZE * 4);
  for (let i = 0; i < LUT_SIZE; i++) {
    const v = f(i / (LUT_SIZE - 1));
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
    out[i * 4 + 3] = 1;
  }
  return out;
}

/** Evaluate a gradient (sRGB interpolation with Photoshop-style midpoints). */
export function evalGradient(stops: GradientStop[], t: number): [number, number, number] {
  const s = [...stops].sort((a, b) => a.pos - b.pos);
  if (!s.length) return [t, t, t];
  if (t <= s[0].pos) return hexToRgb(s[0].color);
  const last = s[s.length - 1];
  if (t >= last.pos) return hexToRgb(last.color);
  let i = 0;
  while (i < s.length - 2 && t > s[i + 1].pos) i++;
  const a = s[i];
  const b = s[i + 1];
  let f = (t - a.pos) / Math.max(1e-6, b.pos - a.pos);
  const mid = Math.min(0.98, Math.max(0.02, a.mid ?? 0.5));
  if (Math.abs(mid - 0.5) > 1e-3) f = Math.pow(f, Math.log(0.5) / Math.log(mid));
  const ca = hexToRgb(a.color);
  const cb = hexToRgb(b.color);
  return [ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f];
}

export function buildGradientLut(stops: GradientStop[], evaluate: (stops: GradientStop[], t: number) => [number, number, number] = evalGradient): Float32Array {
  const out = new Float32Array(LUT_SIZE * 4);
  for (let i = 0; i < LUT_SIZE; i++) {
    const c = evaluate(stops, i / (LUT_SIZE - 1));
    out.set([c[0], c[1], c[2], 1], i * 4);
  }
  return out;
}

/** Pack selected 8x8 1-bit patterns side by side into an RGBA8 texture (bottom-up rows). */
export function patternsToTexture(patterns: number[][], selected: string[]): { data: Uint8Array; width: number; height: number; count: number } {
  const idx = selected.map((s) => parseInt(s, 10)).filter((i) => i >= 0 && i < patterns.length);
  const list = idx.length ? idx : [0];
  const width = 8 * list.length;
  const height = 8;
  const data = new Uint8Array(width * height * 4);
  list.forEach((pi, k) => {
    const pat = patterns[pi];
    for (let r = 0; r < 8; r++) {
      const bits = pat[r] ?? 0;
      for (let c = 0; c < 8; c++) {
        const on = (bits >> (7 - c)) & 1;
        const glRow = 7 - r;
        const o = (glRow * width + k * 8 + c) * 4;
        const v = on ? 0 : 255; // set bit = ink
        data[o] = data[o + 1] = data[o + 2] = v;
        data[o + 3] = 255;
      }
    }
  });
  return { data, width, height, count: list.length };
}
