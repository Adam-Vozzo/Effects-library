import type { EffectDef } from '../../engine/types';
import { choice } from '../helpers';
import { amountOf, amountParam, lookUniforms, pick, stockShader, type FilmLook } from './film-common';

// Historic color processes: faded early Agfacolor, Kodachrome eras, Lumière Autochrome and two-strip
// Technicolor (red-orange / blue-green records only, built with the cross-talk matrix).
export const VINTAGE_STOCKS: FilmLook[] = [
  {
    name: 'Agfacolor 40s',
    black: 0.06, white: 0.9, gamma: 1.02, contrast: 0.65,
    blackRGB: [-0.02, 0.01, 0.01], whiteRGB: [0.015, 0.015, -0.03], gammaRGB: [0.09, -0.05, -0.04],
    sat: 0.62,
    hue: { yellow: [-2, 0.9, -0.03], blue: [-10, 1.05, -0.01] },
    shadows: [140, 0.04], highlights: [300, 0.03],
  },
  {
    name: 'Agfacolor 50s',
    black: 0.05, white: 0.92, gamma: 0.95, contrast: 0.55,
    gammaRGB: [0.03, -0.02, -0.02],
    sat: 0.75,
    hue: { red: [-6, 1.05, 0], orange: [-3, 0.95, 0], yellow: [-4, 0.85, -0.02], green: [10, 0.8, 0], blue: [-12, 0.95, 0] },
    shadows: [170, 0.03], highlights: [60, 0.02],
  },
  {
    name: 'Agfacolor 60s',
    black: 0.04, white: 0.94, gamma: 0.95, contrast: 0.7,
    sat: 0.9,
    hue: { red: [-4, 1.1, -0.01], orange: [-2, 1.02, 0], yellow: [-6, 0.95, 0], green: [8, 0.85, -0.01], blue: [-14, 1, -0.01] },
    shadows: [190, 0.025], highlights: [45, 0.02],
  },
  {
    name: 'Autochrome',
    wb: [1.05, 1, 0.85],
    black: 0.08, white: 0.86, gamma: 1.05, contrast: 0.2,
    sat: 0.6,
    hue: { red: [10, 0.9, 0], green: [-10, 1, -0.02], blue: [15, 0.8, 0], purple: [0, 0.9, 0] },
    shadows: [70, 0.03], highlights: [80, 0.03],
  },
  {
    name: 'Kodachrome 1958',
    wb: [1.04, 1, 0.92],
    black: 0, white: 0.96, gamma: 0.95, contrast: 0.75,
    sat: 1.05,
    hue: { red: [-2, 1.15, -0.02], orange: [2, 1.05, 0], yellow: [-6, 1.1, 0], green: [-8, 0.85, -0.02], aqua: [-5, 0.9, 0], blue: [-6, 0.95, -0.03] },
    shadows: [30, 0.012], highlights: [75, 0.02],
  },
  {
    name: 'Kodachrome 70s',
    wb: [1.05, 0.98, 0.92],
    black: 0.07, white: 0.92, gamma: 0.92, contrast: 0.45,
    sat: 0.8,
    hue: { red: [0, 1.05, 0], yellow: [-8, 0.9, 0], green: [-10, 0.75, 0], blue: [-8, 0.75, 0] },
    shadows: [340, 0.02], highlights: [55, 0.03],
  },
  {
    name: 'Kodachrome Classic',
    black: 0, white: 0.97, gamma: 0.92, contrast: 0.8,
    sat: 1.12, satShadows: 0.9,
    hue: { red: [-2, 1.12, -0.02], orange: [0, 1.05, 0], yellow: [-4, 1.1, 0], green: [-4, 0.95, -0.02], blue: [-2, 1.08, -0.04] },
    shadows: [240, 0.008], highlights: [70, 0.01],
  },
  {
    name: 'Technicolor 2',
    matrix: [1, 0, 0, 0.05, 0.75, 0.2, 0, 0.75, 0.25],
    black: 0.03, white: 0.94, gamma: 0.95, contrast: 0.55,
    hue: { red: [8, 1, 0], aqua: [-15, 0.9, 0] },
    shadows: [200, 0.015], highlights: [50, 0.02],
  },
  {
    name: 'Technicolor 2 v2',
    matrix: [1, 0, 0, 0.1, 0.7, 0.2, 0.05, 0.55, 0.4],
    black: 0.02, white: 0.95, gamma: 0.92, contrast: 0.65,
    hue: { red: [-6, 1.05, 0], aqua: [10, 1, 0] },
    shadows: [210, 0.012], highlights: [20, 0.015],
  },
];

export const vintageFilm: EffectDef = {
  id: 'vintage-film',
  name: 'Vintage Film',
  category: 'Film',
  keywords: 'vintage film filter retro photo old film analog kodachrome technicolor agfacolor color grading',
  params: [
    choice('stock', 'Film stock', VINTAGE_STOCKS.map((s) => s.name), 0, 'slider'),
    amountParam(),
  ],
  uniforms: (p) => ({ ...lookUniforms(pick(VINTAGE_STOCKS, p.stock)), u_fAmt: amountOf(p) }),
  shaders: { main: stockShader() },
};
