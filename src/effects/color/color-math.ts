// CPU-side color helpers shared by the Color effects (OKLab/OKLCh math, LUT building).

import type { GradientStop } from '../../engine/types';
import { hexToRgb } from '../../engine/luts';

export type RGB = [number, number, number];

export const srgbToLinear1 = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((Math.max(c, 0) + 0.055) / 1.055, 2.4));
export const linearToSrgb1 = (c: number): number => {
  c = Math.max(c, 0);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
};

export function linearToOklab(r: number, g: number, b: number): RGB {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToLinear(L: number, a: number, b: number): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export const srgbToOklab = (c: RGB): RGB => linearToOklab(srgbToLinear1(c[0]), srgbToLinear1(c[1]), srgbToLinear1(c[2]));

export function oklabToSrgb(lab: RGB): RGB {
  const l = oklabToLinear(lab[0], lab[1], lab[2]);
  return [linearToSrgb1(l[0]), linearToSrgb1(l[1]), linearToSrgb1(l[2])];
}

/** OKLCh (L, C, h in radians). Achromatic colors get hue 0 (effect.app interpolates them that way). */
function srgbToOklch(c: RGB): RGB {
  const [L, a, b] = srgbToOklab(c);
  const C = Math.hypot(a, b);
  return [L, C, C < 1e-4 ? 0 : Math.atan2(b, a)];
}

/**
 * Evaluate a gradient interpolating in OKLCh along the shortest hue arc (effect.app's gradient
 * map look: e.g. black → blue passes through violet). Midpoints use the Photoshop-style bias.
 */
export function evalGradientOklch(stops: GradientStop[], t: number): RGB {
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
  const A = srgbToOklch(hexToRgb(a.color));
  const B = srgbToOklch(hexToRgb(b.color));
  let dh = B[2] - A[2];
  dh = ((((dh + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  const L = A[0] + (B[0] - A[0]) * f;
  const C = A[1] + (B[1] - A[1]) * f;
  const h = A[2] + dh * f;
  const out = oklabToSrgb([L, C * Math.cos(h), C * Math.sin(h)]);
  return [clamp01(out[0]), clamp01(out[1]), clamp01(out[2])];
}

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** 256x1 RGBA float LUT (same layout as the engine's gradient LUTs) from an evaluator. */
export function buildLut(f: (t: number) => RGB, size = 256): Float32Array {
  const out = new Float32Array(size * 4);
  for (let i = 0; i < size; i++) {
    const c = f(i / (size - 1));
    out[i * 4] = c[0];
    out[i * 4 + 1] = c[1];
    out[i * 4 + 2] = c[2];
    out[i * 4 + 3] = 1;
  }
  return out;
}

/** Piecewise-linear sRGB interpolation of evenly spaced hex colors. */
export function evalStops(colors: string[], t: number): RGB {
  const cs = colors.map(hexToRgb);
  if (cs.length === 1) return cs[0];
  const x = clamp01(t) * (cs.length - 1);
  const i = Math.min(cs.length - 2, Math.floor(x));
  const f = x - i;
  const a = cs[i];
  const b = cs[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
