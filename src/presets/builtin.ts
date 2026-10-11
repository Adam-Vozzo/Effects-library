import type { Preset } from '../state/presets';

// Curated looks built from the effect library. Params not listed fall back to the effect's
// defaults, so presets stay valid when effects gain new parameters.

export const BUILTIN_PRESETS: Preset[] = [
  {
    id: 'b-portra-glow',
    name: 'Portra glow',
    layers: [
      { effectId: 'film-classic', params: { stock: 1 } },
      { effectId: 'halation', params: {} },
      { effectId: 'film-grain', params: {} },
    ],
  },
  {
    id: 'b-tilt-shift',
    name: 'Tilt shift',
    layers: [
      { effectId: 'depth-of-field', params: { center: [0, -0.1], radius: 0.5, stretch: 4, blurStrength: 0.02, falloff: 1.2 } },
      { effectId: 'hue-saturation', params: { hue: 0, saturation: 1.35 } },
      { effectId: 'contrast', params: { strength: 0.3 } },
    ],
  },
  {
    id: 'b-gameboy',
    name: 'Pocket camera',
    layers: [
      { effectId: 'dither', params: { patternType: 1, palettePreset: 13, palette: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'], colorCount: 4, pixelStep: 3, ditherStrength: 1 } },
    ],
  },
  {
    id: 'b-heat',
    name: 'Heat signature',
    layers: [{ effectId: 'thermal', params: {} }],
  },
  {
    id: 'b-riso-zine',
    name: 'Riso zine',
    layers: [
      { effectId: 'risograph', params: {} },
      { effectId: 'paper-scan', params: { opacity: 0.6 } },
    ],
  },
  {
    id: 'b-tape',
    name: 'Rental tape',
    layers: [
      { effectId: 'vhs', params: {} },
      { effectId: 'noise', params: { amount: 0.4 } },
    ],
  },
  {
    id: 'b-terminal',
    name: 'Green terminal',
    layers: [{ effectId: 'ascii', params: { charColor: '#39ff7a', bgColor: '#020a04', density: 70, contrast: 1.6 } }],
  },
  {
    id: 'b-kaleido',
    name: 'Kaleidoscope',
    layers: [
      { effectId: 'transform', params: { axes: 6, scale: 0.2 } },
      { effectId: 'hue-saturation', params: { hue: 40, saturation: 1.3 } },
    ],
  },
  {
    id: 'b-crushed-jpeg',
    name: 'Crushed JPEG',
    layers: [{ effectId: 'jpeg-glitch', params: { compression: 10, blockSize: 1, corruption: 12, seed: 7 } }],
  },
  {
    id: 'b-spin',
    name: 'Spin cycle',
    layers: [
      { effectId: 'swirl', params: { strength: 1.4 } },
      { effectId: 'radial-blur', params: { angle: 10 } },
    ],
  },
  {
    id: 'b-blue-hour',
    name: 'Blue hour',
    layers: [
      { effectId: 'color-temperature', params: { shadowTemperature: 9800, highlightTemperature: 6500 } },
      { effectId: 'gradient-map', params: { gradientMap: [{ pos: 0, color: '#05070f' }, { pos: 0.55, color: '#2b4a8c' }, { pos: 1, color: '#e9f0ff' }] } },
    ],
  },
  {
    id: 'b-torn-collage',
    name: 'Torn collage',
    layers: [{ effectId: 'paper-cutout', params: { columns: 3, rows: 3, missing: 12, rotation: 8, seed: 4 } }],
  },
  {
    id: 'b-broadcast',
    name: 'Broadcast 1987',
    layers: [
      { effectId: 'ntsc', params: {} },
      { effectId: 'crt-screen', params: { curvature: 0.15, vignette: 3, brightness: 1.6 } },
    ],
  },
  {
    id: 'b-dreamy',
    name: 'Dreamy bloom',
    layers: [
      { effectId: 'bloom', params: { threshold: 0.6, intensity: 1.2 } },
      { effectId: 'halation', params: { intensity: 0.5 } },
      { effectId: 'vignette', params: { size: 0.85, transparency: 0.6 } },
    ],
  },
  {
    id: 'b-newsprint',
    name: 'Newsprint',
    layers: [
      { effectId: 'halftone-screen', params: { frequency: 60 } },
      { effectId: 'paper-scan', params: { opacity: 0.7 } },
    ],
  },
  {
    id: 'b-billboard',
    name: 'LED billboard',
    layers: [{ effectId: 'led-screen', params: { pixelSize: 1.6 } }],
  },
  {
    id: 'b-mac',
    name: '1-bit Mac',
    layers: [{ effectId: 'macpaint', params: {} }],
  },
  {
    id: 'b-star-filter',
    name: 'Star filter',
    layers: [
      { effectId: 'star-glow', params: { threshold: 0.45, intensity: 0.7 } },
      { effectId: 'bloom', params: { threshold: 0.75, intensity: 0.8 } },
    ],
  },
  {
    id: 'b-noir',
    name: 'Noir',
    layers: [
      { effectId: 'film-bw', params: {} },
      { effectId: 'contrast', params: { strength: 0.4 } },
      { effectId: 'vignette', params: { size: 0.75 } },
      { effectId: 'film-grain', params: { amount: 0.7 } },
    ],
  },
  {
    id: 'b-chromatic',
    name: 'Chromatic stripes',
    layers: [
      { effectId: 'rgb-shift', params: { redOffset: 0.35, blueOffset: 0.35 } },
      { effectId: 'stripe', params: { patternType: 0, repetitions: 60 } },
    ],
  },
];
