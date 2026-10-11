import type { EffectDef } from '../../engine/types';
import { choice } from '../helpers';
import { amountOf, amountParam, lookUniforms, pick, stockShader, type FilmLook, type RGB3 } from './film-common';

interface BwStock {
  name: string;
  /** Spectral sensitivity (linear-light R/G/B weights, normalised). */
  weights: RGB3;
  look: Omit<FilmLook, 'name' | 'matrix' | 'saturation'>;
}

const LUMA: RGB3 = [0.2126, 0.7152, 0.0722];

// Panchromatic B&W emulsions: spectral mix + characteristic curve (+ a hint of image tone).
export const BW_STOCKS: BwStock[] = [
  { name: 'Agfa Scala 200', weights: [0.236, 0.716, 0.048], look: { black: -0.028, white: 0.965, gamma: 1.035, contrast: 0.17 } },
  { name: 'Ilford Delta 100', weights: [0.27, 0.62, 0.11], look: { black: 0, white: 0.98, gamma: 1, contrast: 0.3 } },
  { name: 'Ilford Delta 400', weights: [0.28, 0.6, 0.12], look: { black: 0.02, white: 0.97, gamma: 0.97, contrast: 0.22 } },
  { name: 'Ilford Delta 3200', weights: [0.3, 0.58, 0.12], look: { black: 0.07, white: 0.94, gamma: 0.92, contrast: 0.05, shadows: [250, 0.004] } },
  { name: 'Ilford FP4', weights: [0.18, 0.65, 0.17], look: { black: 0, white: 0.97, gamma: 1, contrast: 0.35 } },
  { name: 'Ilford HP5', weights: [0.24, 0.62, 0.14], look: { black: 0.03, white: 0.96, gamma: 0.95, contrast: 0.18 } },
  { name: 'Kodak Tri-X 200', weights: [0.32, 0.58, 0.1], look: { black: -0.02, white: 0.98, gamma: 1.05, contrast: 0.55, shadows: [70, 0.005], highlights: [80, 0.004] } },
];

export const blackWhite: EffectDef = {
  id: 'black-white',
  name: 'Black & White',
  category: 'Film',
  keywords: 'black white bw monochrome lut film fuji ilford kodak',
  params: [
    choice('stock', 'Film stock', BW_STOCKS.map((s) => s.name), 0, 'slider'),
    amountParam(),
  ],
  uniforms: (p) => {
    const s = pick(BW_STOCKS, p.stock);
    const [color, tone] = amountOf(p);
    // Color amount below 1 lets the source color back in; above 1 exaggerates the emulsion's spectral
    // response (weights pushed away from plain luminance, like a stronger contrast filter).
    const k = Math.max(1, color);
    const w = s.weights.map((v, i) => Math.max(0, LUMA[i] + (v - LUMA[i]) * k));
    const sum = w[0] + w[1] + w[2] || 1;
    const row = w.map((v) => v / sum);
    const look: FilmLook = { name: s.name, ...s.look, matrix: [...row, ...row, ...row] };
    return { ...lookUniforms(look), u_fAmt: [Math.min(1, color), tone] };
  },
  shaders: { main: stockShader() },
};
