import type { EffectDef } from '../../engine/types';
import { choice } from '../helpers';
import { amountOf, amountParam, lookUniforms, pick, stockShader, type FilmLook, type RGB3 } from './film-common';

interface IrStock extends FilmLook {
  ir: {
    /** Near-infrared estimate from linear R/G/B. */
    weights: RGB3;
    /** Extra IR reflectance given to vegetation (chlorophyll glows in near-IR). */
    foliage: number;
    /** How far vegetation is pushed through the false-color shift (0..1). */
    mix: number;
    /** False-color composition of the output green and blue channels from (IR, red, green). */
    green?: RGB3;
    blue?: RGB3;
  };
}

// Aerochrome-style false color. RGB has no infrared channel, so vegetation is detected with a
// hue/saturation heuristic (yellow-green..green) and given a bright IR estimate; vegetation is then
// remapped like color-infrared film (IR -> red, red -> green, green -> blue) while the per-hue grade
// turns warm tones pink/salmon, skies teal and highlights cyan.
export const IR_STOCKS: IrStock[] = [
  {
    name: 'Infrared Classic',
    ir: { weights: [0.4, 0.6, 0], foliage: 1.5, mix: 1 },
    black: 0.03, white: 1, gamma: 0.88, contrast: 0.35, blackRGB: [0.05, 0, 0],
    sat: 1.15, satHighlights: 0.7,
    hue: { red: [10, 1, 0], orange: [-55, 1.2, 0.02], yellow: [-75, 0.5, 0.02], aqua: [10, 1, 0], blue: [-45, 0.45, -0.02], purple: [-75, 0.8, 0], magenta: [-45, 0.9, 0] },
    shadows: [200, 0.02], highlights: [215, 0.022],
  },
  {
    name: 'Infrared Pastel',
    ir: { weights: [0.4, 0.6, 0], foliage: 1.3, mix: 1, blue: [0.25, 0, 0.75] },
    black: 0.09, white: 0.96, gamma: 0.78, contrast: 0,
    sat: 0.72, satHighlights: 0.6,
    hue: { red: [0, 0.9, 0.02], orange: [-50, 0.9, 0.03], yellow: [-80, 0.5, 0.02], aqua: [5, 0.9, 0.02], blue: [-40, 0.8, 0.02], purple: [-40, 0.9, 0.02], magenta: [-20, 1, 0.03] },
    shadows: [285, 0.025], highlights: [210, 0.02],
  },
  {
    name: 'Infrared Muted',
    ir: { weights: [0.4, 0.6, 0], foliage: 1.2, mix: 0.85 },
    black: 0.06, white: 0.92, gamma: 0.92, contrast: 0.25,
    sat: 0.6, satHighlights: 0.6,
    hue: { orange: [-45, 0.9, 0.01], yellow: [-70, 0.5, 0], blue: [-45, 0.8, -0.01], purple: [-45, 0.85, 0], magenta: [-20, 0.9, 0] },
    shadows: [210, 0.02], highlights: [60, 0.012],
  },
  {
    name: 'Infrared Rust',
    ir: { weights: [0.45, 0.55, 0], foliage: 1.4, mix: 1, green: [0.3, 0.7, 0], blue: [0, 0.75, 0.25] },
    black: 0.03, white: 0.95, gamma: 0.95, contrast: 0.5,
    sat: 1.2, satHighlights: 0.8,
    hue: { red: [12, 1.05, 0], orange: [-6, 1.1, -0.01], yellow: [-35, 0.9, 0], aqua: [0, 0.9, 0], blue: [-35, 0.85, -0.02], purple: [-30, 0.85, 0] },
    shadows: [50, 0.02], highlights: [60, 0.02],
  },
  {
    name: 'Infrared Deep',
    ir: { weights: [0.4, 0.6, 0], foliage: 1.4, mix: 1 },
    black: 0, white: 0.97, gamma: 1.05, contrast: 0.7,
    sat: 1.25, satHighlights: 0.7,
    hue: { red: [5, 1.05, -0.02], orange: [-55, 1.1, 0], yellow: [-75, 0.7, -0.02], aqua: [8, 1.05, -0.03], blue: [-55, 1, -0.06], purple: [-55, 1, -0.04], magenta: [-30, 1.05, -0.03] },
    shadows: [215, 0.035], highlights: [200, 0.02],
  },
];

const IR_GLSL = /* glsl */ `
uniform vec3 u_irW;
uniform vec2 u_irP;   // x: vegetation IR boost, y: false-color mix
uniform vec3 u_irG;   // output green from (IR, R, G)
uniform vec3 u_irB;   // output blue from (IR, R, G)

// Vegetation heuristic: yellow-green..green hues with some saturation, not black.
float foliageMask(vec3 s) {
  vec3 hsv = rgb2hsv(clamp(s, 0.0, 1.0));
  float d = abs(fract(hsv.x - 0.31 + 0.5) - 0.5);
  return (1.0 - smoothstep(0.10, 0.20, d)) * smoothstep(0.05, 0.3, hsv.y) * smoothstep(0.02, 0.15, hsv.z);
}

vec3 irStage(vec3 lin) {
  float fol = foliageMask(linearToSrgb(lin));
  float lum = dot(lin, vec3(0.2126, 0.7152, 0.0722));
  float ir = dot(lin, u_irW) + u_irP.x * fol * (0.1 + lum);
  vec3 src3 = vec3(ir, lin.r, lin.g);
  vec3 cir = vec3(ir, dot(src3, u_irG), dot(src3, u_irB));
  return clamp(mix(lin, cir, u_irP.y * fol), 0.0, 1.0);
}
`;

export const infraredFilm: EffectDef = {
  id: 'film-infrared',
  name: 'Infrared Film',
  category: 'Film',
  keywords: 'infrared filter aerochrome false color IR red foliage surreal film LUT color grading',
  params: [
    choice('stock', 'Style', IR_STOCKS.map((s) => s.name), 0, 'slider'),
    amountParam(),
  ],
  uniforms: (p) => {
    const s = pick(IR_STOCKS, p.stock);
    return {
      ...lookUniforms(s),
      u_irW: s.ir.weights,
      u_irP: [s.ir.foliage, s.ir.mix],
      u_irG: s.ir.green ?? [0, 1, 0],
      u_irB: s.ir.blue ?? [0, 0, 1],
      u_fAmt: amountOf(p),
    };
  },
  shaders: { main: stockShader(IR_GLSL, 'lin = irStage(lin);') },
};
