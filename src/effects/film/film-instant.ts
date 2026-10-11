import type { EffectDef } from '../../engine/types';
import { choice } from '../helpers';
import { amountOf, amountParam, lookUniforms, pick, stockShader, type FilmLook } from './film-common';

// Integral and peel-apart instant films: compressed highlights, colored blacks, muted palettes;
// the expired variants add strong chemical color shifts and fading.
export const INSTANT_STOCKS: FilmLook[] = [
  {
    name: 'Polaroid 600',
    black: 0, white: 0.88, gamma: 0.83, contrast: 0.18,
    blackRGB: [-0.035, 0.025, 0.01], whiteRGB: [-0.015, -0.025, 0.04], gammaRGB: [0.05, -0.02, -0.04],
    sat: 0.69, satShadows: 1.08, satHighlights: 0.9,
    hue: { orange: [4, 1, -0.035], yellow: [0, 1, -0.05], blue: [-10, 1.15, 0.01], purple: [-12, 0.97, 0.03] },
    shadows: [225, 0.05], highlights: [55, 0.005],
  },
  {
    name: 'Polaroid 600 Golden',
    wb: [1.05, 1, 0.9],
    black: 0.01, white: 0.9, gamma: 0.82, contrast: 0.2,
    blackRGB: [-0.03, 0.015, 0.01], whiteRGB: [0.02, 0, -0.06], gammaRGB: [0, -0.01, 0.03],
    sat: 0.78, satShadows: 1.05,
    hue: { orange: [2, 1, -0.02], yellow: [-4, 1.08, -0.02], green: [-10, 0.85, 0], blue: [-8, 1, 0] },
    shadows: [240, 0.03], highlights: [75, 0.035],
  },
  {
    name: 'Polaroid 600 Expired',
    wb: [1.1, 0.95, 0.85],
    black: 0.1, white: 0.82, gamma: 0.85, contrast: -0.1,
    blackRGB: [0.01, -0.02, 0.02], gammaRGB: [-0.05, 0, 0.08],
    sat: 0.55,
    hue: { green: [-15, 0.6, 0], blue: [-20, 0.7, 0] },
    shadows: [330, 0.04], highlights: [70, 0.05],
  },
  {
    name: 'Polaroid 669',
    wb: [0.92, 1, 1.08],
    black: 0.06, white: 0.9, gamma: 0.9, contrast: 0.15,
    sat: 0.7,
    hue: { orange: [-5, 0.85, 0], green: [10, 0.8, 0], blue: [-10, 0.95, 0] },
    shadows: [220, 0.04], highlights: [180, 0.015],
  },
  {
    name: 'Polaroid 669 Expired',
    wb: [0.9, 1, 1.05],
    black: 0.12, white: 0.85, gamma: 0.88, contrast: -0.15,
    sat: 0.55,
    hue: { orange: [-15, 0.8, 0], blue: [-12, 0.8, 0] },
    shadows: [190, 0.05], highlights: [350, 0.035],
  },
  {
    name: 'Polaroid 690',
    wb: [1.03, 1, 0.97],
    black: 0.03, white: 0.92, gamma: 0.88, contrast: 0.35,
    sat: 0.9,
    hue: { red: [0, 1.05, 0], orange: [2, 1, 0], blue: [-8, 1, 0] },
    shadows: [230, 0.035], highlights: [60, 0.015],
  },
  {
    name: 'Polaroid 690 Expired',
    wb: [1.08, 0.94, 0.98],
    black: 0.1, white: 0.86, gamma: 0.86, contrast: -0.05,
    sat: 0.62,
    hue: { orange: [-8, 0.9, 0], green: [-10, 0.7, 0], blue: [-15, 0.8, 0] },
    shadows: [300, 0.04], highlights: [20, 0.04],
  },
  {
    name: 'Instax Mini',
    wb: [0.97, 1.01, 1.02],
    black: 0.02, white: 0.97, gamma: 0.85, contrast: 0.45,
    sat: 0.95,
    hue: { orange: [-4, 0.95, 0.02], green: [6, 1, 0], blue: [-6, 1, 0] },
    shadows: [190, 0.025], highlights: [150, 0.012],
  },
  {
    name: 'Instax Mini Deep',
    wb: [0.98, 1, 1.02],
    black: 0, white: 0.96, gamma: 0.95, contrast: 0.6,
    sat: 1, satShadows: 0.85,
    hue: { orange: [-3, 1, 0], green: [6, 1.05, -0.01], blue: [-6, 1.05, -0.02] },
    shadows: [210, 0.03], highlights: [80, 0.01],
  },
  {
    name: 'Fuji FP-100C',
    wb: [0.95, 1, 1.06],
    black: 0.06, white: 0.95, gamma: 0.85, contrast: 0.25,
    sat: 0.85,
    hue: { orange: [-8, 0.9, 0.01], yellow: [5, 0.85, 0], green: [10, 0.9, 0], blue: [-5, 1.05, 0] },
    shadows: [235, 0.04], highlights: [200, 0.012],
  },
  {
    name: 'Fuji FP-100C Warm',
    wb: [1.04, 1, 0.95],
    black: 0.06, white: 0.95, gamma: 0.85, contrast: 0.25,
    sat: 0.88,
    hue: { orange: [-4, 0.95, 0.01], yellow: [0, 0.95, 0], green: [6, 0.9, 0], blue: [-5, 1, 0] },
    shadows: [250, 0.025], highlights: [60, 0.025],
  },
  {
    name: 'Fuji FP-100C Cool',
    wb: [0.9, 1, 1.1],
    black: 0.06, white: 0.95, gamma: 0.85, contrast: 0.25,
    sat: 0.82,
    hue: { orange: [-8, 0.88, 0.01], yellow: [6, 0.8, 0], green: [12, 0.9, 0], blue: [-6, 1.05, 0] },
    shadows: [215, 0.05], highlights: [195, 0.025],
  },
  {
    name: 'Fuji FP-100C Expired',
    wb: [0.97, 0.98, 1.06],
    black: 0.12, white: 0.88, gamma: 0.85, contrast: -0.1,
    sat: 0.6,
    hue: { orange: [-12, 0.8, 0], green: [10, 0.75, 0], blue: [-10, 0.85, 0] },
    shadows: [290, 0.045], highlights: [170, 0.03],
  },
];

export const instantFilm: EffectDef = {
  id: 'film-instant',
  name: 'Instant Film',
  category: 'Film',
  keywords: 'instant film filter polaroid instax fuji fp-100c expired retro snapshot film LUT color grading',
  params: [
    choice('stock', 'Film stock', INSTANT_STOCKS.map((s) => s.name), 0, 'slider'),
    amountParam(),
  ],
  uniforms: (p) => ({ ...lookUniforms(pick(INSTANT_STOCKS, p.stock)), u_fAmt: amountOf(p) }),
  shaders: { main: stockShader() },
};
