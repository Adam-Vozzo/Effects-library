import type { EffectDef } from '../../engine/types';
import { choice, float, int, num } from '../helpers';
import { pick, type RGB3 } from './film-common';

interface GrainStock {
  name: string;
  /** Noise cell size in reference pixels (1/720 of the long side); visible grains are roughly half of it. */
  size: number;
  /** Amplitude relative to the reference stock (Agfa APX 400). */
  strength: number;
  /** 0 = monochrome (silver) grain, 1 = independent dye-layer grain per channel. */
  chroma: number;
  /** Weight of the fine octave (crispness) and of the coarse octave (clumping). */
  rough: number;
  clump: number;
  /** Per-channel amplitude of the color grain (the blue-sensitive layer is usually grainiest). */
  rgb?: RGB3;
}

const COLOR_RGB: RGB3 = [1, 0.85, 1.25];

// Grain character per stock, from the stocks' published granularity (ISO, T-grain vs cubic, dye vs silver).
export const GRAIN_STOCKS: GrainStock[] = [
  { name: 'Agfa APX 400', size: 5, strength: 1, chroma: 0, rough: 0.6, clump: 0.5 },
  { name: 'Agfa HDC 100', size: 3.6, strength: 0.55, chroma: 0.5, rough: 0.5, clump: 0.35, rgb: COLOR_RGB },
  { name: 'Agfa HDC 400', size: 4.7, strength: 0.85, chroma: 0.55, rough: 0.55, clump: 0.45, rgb: COLOR_RGB },
  { name: 'Fuji Pro 160S', size: 3.2, strength: 0.45, chroma: 0.4, rough: 0.45, clump: 0.3, rgb: COLOR_RGB },
  { name: 'Fuji Pro 400H', size: 4, strength: 0.65, chroma: 0.45, rough: 0.5, clump: 0.4, rgb: COLOR_RGB },
  { name: 'Fuji Provia 100F', size: 2.9, strength: 0.35, chroma: 0.35, rough: 0.4, clump: 0.25, rgb: COLOR_RGB },
  { name: 'Fuji Superia 200 I', size: 4, strength: 0.7, chroma: 0.55, rough: 0.55, clump: 0.4, rgb: COLOR_RGB },
  { name: 'Fuji Superia 200 II', size: 4.3, strength: 0.8, chroma: 0.6, rough: 0.6, clump: 0.45, rgb: COLOR_RGB },
  { name: 'Fuji Superia Reala 100', size: 3.2, strength: 0.5, chroma: 0.45, rough: 0.45, clump: 0.3, rgb: COLOR_RGB },
  { name: 'Ilford Delta 3200', size: 7.2, strength: 1.6, chroma: 0, rough: 0.7, clump: 0.6 },
  { name: 'Ilford HP5 400', size: 5.4, strength: 1.05, chroma: 0, rough: 0.6, clump: 0.5 },
  { name: 'Ilford Kentmere 400', size: 5.8, strength: 1.2, chroma: 0, rough: 0.65, clump: 0.55 },
  { name: 'Ilford XP2 400', size: 4.3, strength: 0.6, chroma: 0, rough: 0.3, clump: 0.4 },
  { name: 'Kodak Ektachrome E100', size: 2.9, strength: 0.35, chroma: 0.35, rough: 0.4, clump: 0.25, rgb: COLOR_RGB },
  { name: 'Kodak Portra 800', size: 4.7, strength: 0.85, chroma: 0.45, rough: 0.5, clump: 0.45, rgb: COLOR_RGB },
  { name: 'Kodak T-Max 3200', size: 6.8, strength: 1.5, chroma: 0, rough: 0.7, clump: 0.55 },
  { name: 'Kodak Tri-X 400', size: 5.4, strength: 1.15, chroma: 0, rough: 0.75, clump: 0.5 },
  { name: 'Rollei R3 200', size: 4.3, strength: 0.8, chroma: 0, rough: 0.55, clump: 0.45 },
];

/** Grain refresh clock for "Frame Interval" (frames at this rate). */
const FRAME_RATE = 24;

export const filmGrain: EffectDef = {
  id: 'film-grain',
  name: 'Film Grain',
  category: 'Film',
  keywords: 'analog emulsion film grain noise scan texture vintage',
  animated: true,
  params: [
    choice('stock', 'Film stock', GRAIN_STOCKS.map((s) => s.name), 0, 'slider'),
    float('amount', 'Amount', 0, 1, 0.5),
    float('highlights', 'Highlights', 0, 1, 0.5),
    float('midtones', 'Midtones', 0, 1, 1),
    float('shadows', 'Shadows', 0, 1, 0.5),
    int('frameInterval', 'Frame Interval', 0, 60, 0, { hint: 'Frames (24 fps) between grain changes; 0 = static grain' }),
  ],
  uniforms: (p, ctx) => {
    const s = pick(GRAIN_STOCKS, p.stock);
    const interval = Math.round(num(p, 'frameInterval'));
    const frame = interval > 0 ? Math.floor((ctx.time * FRAME_RATE) / interval + 1e-4) : 0;
    const rough = s.rough;
    const clump = s.clump;
    return {
      u_gShape: [s.size, rough, clump, 1 / Math.sqrt(1 + rough * rough + clump * clump)],
      u_gAmp: [s.strength * 0.03, s.chroma],
      u_gRGB: s.rgb ?? [1, 1, 1],
      // Keep the domain offset small so float precision of the noise coordinates stays high.
      u_gSeed: ((frame * 0.6180339887) % 1) * 997,
    };
  },
  shaders: {
    main: /* glsl */ `
uniform vec4 u_gShape;  // cell size (ref px), fine weight, coarse weight, normalisation
uniform vec2 u_gAmp;    // amplitude at Amount = 1 (display units, std), chroma
uniform vec3 u_gRGB;
uniform float u_gSeed;

// Zero-mean, roughly unit-variance grain field (p in noise cells): base + fine + coarse octaves of
// gradient noise, each rotated so the lattices never line up.
float grainField(vec2 p, float k) {
  vec2 o = vec2(k * 131.7 + u_gSeed, k * 71.3 - u_gSeed * 0.7);
  float n = gradientNoise(p + o);
  n += u_gShape.y * gradientNoise(mat2(0.454, 0.891, -0.891, 0.454) * p * 2.07 + o.yx + 19.1);
  n += u_gShape.z * gradientNoise(mat2(0.878, -0.479, 0.479, 0.878) * p * 0.47 + o + 47.9);
  return n * u_gShape.w * 3.27;
}

void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 c = src.rgb;
  // Grain lives in reference pixels; below ~2 render px per cell it is evaluated at 2 px and
  // attenuated like an area average, so downscaled previews keep the same overall texture.
  vec2 px = v_uv * u_resolution;
  float cellPx = u_gShape.x * u_pxScale;
  float cell = max(cellPx, 2.0);
  float atten = cellPx / cell;
  vec2 p = px / cell;

  float l = luma(clamp(c, 0.0, 1.0));
  float sh = 1.0 - smoothstep(0.0, 0.5, l);
  float hi = smoothstep(0.5, 1.0, l);
  float resp = u_shadows * sh + u_midtones * (1.0 - sh - hi) + u_highlights * hi;
  // Grain fades into paper white and slightly into maximum black (print toe / shoulder).
  resp *= (1.0 - 0.95 * smoothstep(0.55, 1.0, l)) * (0.25 + 0.75 * smoothstep(0.0, 0.12, l));
  float amp = u_amount * u_gAmp.x * resp * atten;

  float mono = grainField(p, 0.0);
  vec3 g = vec3(mono);
  if (u_gAmp.y > 0.0) {
    vec3 col = vec3(grainField(p, 1.0), grainField(p, 2.0), grainField(p, 3.0));
    float ch = u_gAmp.y;
    g = (mono * (1.0 - ch) + col * ch) / sqrt((1.0 - ch) * (1.0 - ch) + ch * ch) * u_gRGB;
  }
  fragColor = vec4(max(c + g * amp, 0.0), src.a);
}`,
  },
};
