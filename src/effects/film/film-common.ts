// Shared procedural film-stock pipeline for the LUT-style Film effects (Classic, Vintage, Black & White,
// Infrared, Instant). Every stock is a small set of original, hand-tuned parameters (no LUT files):
//
//   sRGB -> linear: exposure / white balance -> channel cross-talk matrix (+ linear saturation)
//        -> display: per-channel characteristic curve  y = black + (white - black) * S(x^gamma, contrast)
//        -> OKLab: per-hue tweaks (8 bands), luminance-dependent saturation, split toning
//        -> "Amount" mix with the source in OKLab (x = color, y = tone; 1 = stock look, 2 = exaggerated).

import type { ParamValues } from '../../engine/types';
import type { UniformValue } from '../../engine/gl';
import { point } from '../helpers';

export type RGB3 = [number, number, number];
export type HueBand = 'red' | 'orange' | 'yellow' | 'green' | 'aqua' | 'blue' | 'purple' | 'magenta';

const HUE_BANDS: HueBand[] = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'];
const LUMA: RGB3 = [0.2126, 0.7152, 0.0722];

/** A film look; every field is optional and defaults to "no change". */
export interface FilmLook {
  name: string;
  /** Exposure offset in stops (linear light). */
  exposure?: number;
  /** White balance gains in linear light (normalised so luminance is kept). */
  wb?: RGB3;
  /** Row-major 3x3 channel cross-talk in linear light; rows are normalised to sum to 1. */
  matrix?: number[];
  /** Linear-light saturation folded into the matrix (0 = monochrome). */
  saturation?: number;
  /** Characteristic curve (display-referred) shared by all channels, plus per-channel deltas. */
  black?: number;
  white?: number;
  gamma?: number;
  /** S-curve strength in [-1, 1]: > 0 adds midtone contrast, < 0 flattens. */
  contrast?: number;
  blackRGB?: RGB3;
  whiteRGB?: RGB3;
  /** Per-channel gamma multipliers as natural-log offsets (gamma_c = gamma * e^d). */
  gammaRGB?: RGB3;
  contrastRGB?: RGB3;
  /** OKLab chroma multipliers (global, extra factor in shadows / highlights). */
  sat?: number;
  satShadows?: number;
  satHighlights?: number;
  /** Per-hue tweaks: [hue shift in degrees, chroma multiplier, OKLab lightness offset]. */
  hue?: Partial<Record<HueBand, RGB3>>;
  /** Split toning tints: [OKLCh hue in degrees, chroma]. */
  shadows?: [number, number];
  highlights?: [number, number];
}

const rgbOr = (v: RGB3 | undefined): RGB3 => v ?? [0, 0, 0];

/** Uniforms consumed by FILM_GLSL for one look. */
export function lookUniforms(s: FilmLook): Record<string, UniformValue> {
  const wb = s.wb ?? [1, 1, 1];
  const wl = wb[0] * LUMA[0] + wb[1] * LUMA[1] + wb[2] * LUMA[2];
  const ex = Math.pow(2, s.exposure ?? 0);
  const gain = wb.map((v) => (v / wl) * ex);

  // Cross-talk matrix (row-major, rows sum to 1) followed by linear-light saturation.
  const m = s.matrix ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const rows = [0, 1, 2].map((r) => {
    const row = m.slice(r * 3, r * 3 + 3);
    const sum = row[0] + row[1] + row[2] || 1;
    return row.map((v) => v / sum);
  });
  const sat = s.saturation ?? 1;
  const mat = [0, 1, 2].map((r) => [0, 1, 2].map((c) => {
    let acc = 0;
    for (let k = 0; k < 3; k++) acc += ((1 - sat) * LUMA[k] + (r === k ? sat : 0)) * rows[k][c];
    return acc;
  }));
  // GLSL mat3 is column-major.
  const matCols = [mat[0][0], mat[1][0], mat[2][0], mat[0][1], mat[1][1], mat[2][1], mat[0][2], mat[1][2], mat[2][2]];

  const black = rgbOr(s.blackRGB).map((d) => (s.black ?? 0) + d);
  const white = rgbOr(s.whiteRGB).map((d) => (s.white ?? 1) + d);
  const gamma = rgbOr(s.gammaRGB).map((d) => Math.max(0.05, (s.gamma ?? 1) * Math.exp(d)));
  const contrast = rgbOr(s.contrastRGB).map((d) => Math.max(-1, Math.min(1, (s.contrast ?? 0) + d)));

  const band = new Float32Array(24);
  HUE_BANDS.forEach((name, i) => {
    const b = s.hue?.[name];
    if (!b) return;
    band[i * 3] = (b[0] * Math.PI) / 180;
    band[i * 3 + 1] = b[1] - 1;
    band[i * 3 + 2] = b[2];
  });
  const tint = (t?: [number, number]) => (t ? [t[1] * Math.cos((t[0] * Math.PI) / 180), t[1] * Math.sin((t[0] * Math.PI) / 180)] : [0, 0]);
  const base = s.sat ?? 1;
  return {
    u_fGain: gain,
    u_fMat: matCols,
    u_fBlack: black,
    u_fWhite: white,
    u_fGamma: gamma,
    u_fContrast: contrast,
    u_fBand: band,
    u_fSat: [base * (s.satShadows ?? 1), base, base * (s.satHighlights ?? 1)],
    u_fSplit: [...tint(s.shadows), ...tint(s.highlights)],
  };
}

/** effect.app's "Amount" pad: x = color amount, y = tone amount, both 0..2 (pad center = 1). */
export function amountParam(hint = 'x: color strength, y: tone strength (center = 1×, edges 0× … 2×)') {
  return point('amount', 'Amount', [0, 0], { hint });
}

/** Pad value (our [-1, 1] convention) to [color, tone] amounts in 0..2. */
export function amountOf(p: ParamValues): [number, number] {
  const v = (p.amount as [number, number] | undefined) ?? [0, 0];
  const c = (x: number) => Math.max(0, Math.min(2, 1 + (Number.isFinite(x) ? x : 0)));
  return [c(v[0]), c(v[1])];
}

/** Clamp an enum index into a stock list. */
export function pick<T>(list: T[], v: unknown): T {
  const i = Math.round(Number(v));
  return list[Math.max(0, Math.min(list.length - 1, Number.isFinite(i) ? i : 0))];
}

export const FILM_GLSL = /* glsl */ `
uniform vec3 u_fGain;
uniform mat3 u_fMat;
uniform vec3 u_fBlack;
uniform vec3 u_fWhite;
uniform vec3 u_fGamma;
uniform vec3 u_fContrast;
uniform vec3 u_fBand[8];
uniform vec3 u_fSat;
uniform vec4 u_fSplit;
uniform vec2 u_fAmt;

// OKLCh hue centres (radians) of the per-hue bands: red, orange, yellow, green, aqua, blue, purple, magenta.
const float F_BAND_HUE[8] = float[8](0.50615, 1.01229, 1.74533, 2.47837, 3.40339, 4.45059, 5.14872, 5.75959);

// Characteristic curve: power (midtone placement) -> smoothstep-blend S-curve -> black/white points.
vec3 filmTone(vec3 x) {
  vec3 xg = pow(clamp(x, 0.0, 1.0), u_fGamma);
  vec3 s = xg + u_fContrast * (xg * xg * (3.0 - 2.0 * xg) - xg);
  return u_fBlack + (u_fWhite - u_fBlack) * s;
}

// Per-hue tweaks, luminance-dependent saturation and split toning in OKLab.
vec3 filmColor(vec3 lab) {
  float C = length(lab.yz);
  float h = C > 1e-7 ? atan(lab.z, lab.y) : 0.0; // atan(0, 0) is undefined in GLSL
  vec3 adj = vec3(0.0);
  float wsum = 1e-5;
  for (int i = 0; i < 8; i++) {
    float d = abs(mod(h - F_BAND_HUE[i] + PI, TAU) - PI);
    float w = exp(-2.8495 * d * d); // gaussian, sigma = 24 deg
    adj += w * u_fBand[i];
    wsum += w;
  }
  adj /= wsum;
  float cw = smoothstep(0.0, 0.08, C);
  h += adj.x * cw;
  C *= max(1.0 + adj.y * cw, 0.0);
  float L = lab.x + adj.z * cw;
  float sh = 1.0 - smoothstep(0.0, 0.65, L);
  float hi = smoothstep(0.55, 1.0, L);
  C *= max(u_fSat.y + (u_fSat.x - u_fSat.y) * sh + (u_fSat.z - u_fSat.y) * hi, 0.0);
  vec2 ab = C * vec2(cos(h), sin(h)) + u_fSplit.xy * sh + u_fSplit.zw * hi;
  return vec3(L, ab);
}

// Out-of-gamut linear RGB is pulled toward its luminance instead of clipping channels (keeps hue).
vec3 filmGamut(vec3 lin) {
  float y = dot(lin, vec3(0.2126, 0.7152, 0.0722));
  float mn = min(lin.r, min(lin.g, lin.b));
  if (mn < 0.0 && y > 0.0) lin = y + (lin - y) * (y / (y - mn));
  float mx = max(lin.r, max(lin.g, lin.b));
  if (mx > 1.0 && y < 1.0) lin = y + (lin - y) * ((1.0 - y) / (mx - y));
  return clamp(lin, 0.0, 1.0);
}

vec3 filmGradeLinear(vec3 lin) {
  lin = clamp(u_fMat * (lin * u_fGain), 0.0, 1.0);
  vec3 d = filmTone(linearToSrgb(lin));
  vec3 lab = filmColor(linearToOklab(srgbToLinear(clamp(d, 0.0, 1.0))));
  return linearToSrgb(filmGamut(oklabToLinear(lab)));
}

// Blend the graded result with the source: lightness by the tone amount, chroma by the color amount.
vec3 filmAmount(vec3 orig, vec3 graded) {
  if (u_fAmt == vec2(1.0)) return graded;
  vec3 a = linearToOklab(srgbToLinear(clamp(orig, 0.0, 1.0)));
  vec3 b = linearToOklab(srgbToLinear(graded));
  vec3 lab = vec3(mix(a.x, b.x, u_fAmt.y), mix(a.yz, b.yz, u_fAmt.x));
  return linearToSrgb(filmGamut(oklabToLinear(lab)));
}
`;

/** Single-pass shader shared by the stock effects (optionally with an extra pre-grade stage). */
export function stockShader(pre = '', preCall = ''): string {
  return /* glsl */ `
${FILM_GLSL}
${pre}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 lin = srgbToLinear(clamp(src.rgb, 0.0, 1.0));
  ${preCall}
  vec3 graded = filmGradeLinear(lin);
  fragColor = vec4(filmAmount(src.rgb, graded), src.a);
}`;
}
