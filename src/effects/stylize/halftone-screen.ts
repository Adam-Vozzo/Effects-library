import type { EffectDef, ParamDef, ParamValues } from '../../engine/types';
import { textureFromFloat } from '../../engine/gl';
import { bool, choice, color, float, int, num, point } from '../helpers';
import { RISO_GLSL, RISO_INK_NAMES } from './common-a';

// Four-plate AM halftone. The image is separated into C/M/Y/K (gray-component replacement + total ink
// limit), each plate is screened with its own angle / misregistration and printed with a chosen spot ink,
// and the plates overprint (multiply) on the paper. Dot shapes are spot functions whose thresholds come
// from their area CDF, so every shape reproduces tone correctly. `Frequency` = screen lines per image height.

const SHAPES = ['Round', 'Euclidean', 'Elliptical', 'Square', 'Diamond', 'Lines', 'Cross-hatch'];

/** Spot functions in [0,1] (0 = inked first); must match spotValue() in GLSL. */
function spot(shape: number, x: number, y: number): number {
  const a = Math.abs(x);
  const b = Math.abs(y);
  switch (shape) {
    case 1: {
      const ps = a + b <= 1 ? 1 - (a * a + b * b) : (a - 1) * (a - 1) + (b - 1) * (b - 1) - 1;
      return (1 - ps) / 2;
    }
    case 2:
      return Math.min(1, Math.sqrt(0.62 * a * a + 1.38 * b * b) / Math.SQRT2);
    case 3:
      return Math.max(a, b);
    case 4:
      return (a + b) / 2;
    case 5:
      return b;
    case 6:
      return Math.min(a, b);
    default:
      return Math.sqrt(a * a + b * b) / Math.SQRT2;
  }
}

/** Per shape: spot value → fraction of the cell area with a smaller value (256 bins, one row per shape). */
function buildCdf(): Float32Array {
  const N = 256;
  const BINS = 256;
  const out = new Float32Array(BINS * SHAPES.length * 4);
  for (let sh = 0; sh < SHAPES.length; sh++) {
    const hist = new Float64Array(BINS);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const v = spot(sh, ((i + 0.5) / N) * 2 - 1, ((j + 0.5) / N) * 2 - 1);
        hist[Math.min(BINS - 1, Math.floor(v * BINS))]++;
      }
    }
    let acc = 0;
    for (let k = 0; k < BINS; k++) {
      // CDF at the bin center (half of the bin's own mass).
      const c = (acc + hist[k] * 0.5) / (N * N);
      acc += hist[k];
      out.set([c, c, c, 1], (sh * BINS + k) * 4);
    }
  }
  return out;
}

interface InkDefaults {
  ink: number;
  angle: number;
}
const INKS: InkDefaults[] = [
  { ink: 4, angle: 15 },
  { ink: 30, angle: 75 },
  { ink: 13, angle: 0 },
  { ink: 0, angle: 45 },
];

function inkParams(i: number, d: InkDefaults): ParamDef[] {
  const g = `Ink ${i + 1}`;
  const k = `ink${i + 1}`;
  const vis = (p: ParamValues) => !!p[`${k}Enable`];
  return [
    bool(`${k}Enable`, 'Enable', true, { group: g }),
    choice(`${k}Color`, 'Ink', RISO_INK_NAMES, d.ink, 'slider', { group: g, visibleIf: vis }),
    float(`${k}Angle`, 'Angle', -90, 90, d.angle, 0.5, { group: g, unit: '°', visibleIf: vis }),
    point(`${k}Shift`, 'Shift', [0, 0], { group: g, visibleIf: vis }),
  ];
}

const plate = (n: number, channel: string) => /* glsl */ `
  if (u_ink${n}Enable) {
    vec2 sh = u_ink${n}Shift * 1.5 * cell;
    vec4 cmyk = separate(texture(u_tone, (gl_FragCoord.xy - sh) / u_resolution).rgb);
    float a = screen(gl_FragCoord.xy - sh, radians(u_ink${n}Angle), cell, cmyk.${channel}, ${n}.0);
    col *= mix(vec3(1.0), risoInk(u_ink${n}Color), a * u_inkDensity);
  }`;

export const halftoneScreen: EffectDef = {
  id: 'halftone-screen',
  name: 'Halftone screen',
  category: 'Effects',
  keywords: 'dot filter halftone pattern photo print retro screen cmyk offset rosette ink',
  params: [
    choice('dotShape', 'Dot shape', SHAPES, 0, 'slider'),
    int('frequency', 'Frequency', 10, 300, 80),
    color('paperColor', 'Paper color', '#eff1f5'),
    float('blackGeneration', 'Black generation', 0, 1, 0.5, 0.01, { group: 'Separation' }),
    float('totalInk', 'Total ink', 200, 400, 300, 5, { group: 'Separation', unit: '%' }),
    float('dotGain', 'Dot gain', 0, 0.4, 0.05, 0.01, { group: 'Press' }),
    float('inkDensity', 'Ink density', 0, 1, 1, 0.01, { group: 'Press' }),
    float('edgeRoughness', 'Edge roughness', 0, 1, 0.3, 0.01, { group: 'Press' }),
    int('seed', 'Seed', 0, 100, 0, { group: 'Press' }),
    ...INKS.flatMap((d, i) => inkParams(i, d)),
  ],
  shaders: {
    main: /* glsl */ `
${RISO_GLSL}
uniform sampler2D u_tone; // slightly blurred source (tone per dot, not per pixel)
uniform sampler2D u_cdf;  // spot value → area fraction, one row per shape

float spotValue(int shape, vec2 f) {
  float a = abs(f.x), b = abs(f.y);
  if (shape == 1) {
    float ps = a + b <= 1.0 ? 1.0 - (a * a + b * b) : (a - 1.0) * (a - 1.0) + (b - 1.0) * (b - 1.0) - 1.0;
    return (1.0 - ps) * 0.5;
  }
  if (shape == 2) return min(1.0, sqrt(0.62 * a * a + 1.38 * b * b) / 1.41421356);
  if (shape == 3) return max(a, b);
  if (shape == 4) return (a + b) * 0.5;
  if (shape == 5) return b;
  if (shape == 6) return min(a, b);
  return length(f) / 1.41421356;
}

// C, M, Y, K with gray component replacement and a total ink limit.
vec4 separate(vec3 rgb) {
  vec3 cmy = 1.0 - pow(saturate(rgb), vec3(1.2));
  float k = u_blackGeneration * min(cmy.x, min(cmy.y, cmy.z));
  cmy = (cmy - k) / max(1.0 - k, 1e-4);
  float lim = u_totalInk / 100.0;
  float sum = cmy.x + cmy.y + cmy.z;
  if (sum + k > lim) cmy *= max(lim - k, 0.0) / max(sum, 1e-4);
  return vec4(cmy, k);
}

float plateThreshold(vec2 px, float ang, float cell, float seed) {
  vec2 p = rot2(-ang) * px / cell;
  vec2 f = fract(p) * 2.0 - 1.0;
  float s = spotValue(u_dotShape, f);
  float thr = texture(u_cdf, vec2((s * 255.0 + 0.5) / 256.0, (float(u_dotShape) + 0.5) / 7.0)).r;
  // Press: ragged dot edges.
  vec2 q = px / max(cell * 0.3, 1.5) + seed * 19.7 + float(u_seed) * 7.31;
  return thr + (valueNoise(q) + 0.5 * valueNoise(q * 2.3) - 0.75) * u_edgeRoughness * 0.12;
}

// Ink coverage (0..1) of one screened plate at pixel px, 4× supersampled (rotated grid).
float screen(vec2 px, float ang, float cell, float tone, float seed) {
  // Dot gain: mid-tones grow most.
  float t = saturate(tone + u_dotGain * 4.0 * tone * (1.0 - tone));
  float w = clamp(fwidth(plateThreshold(px, ang, cell, seed)), 1e-3, 0.25);
  float a = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(i == 0 ? 0.125 : i == 1 ? 0.375 : i == 2 ? -0.125 : -0.375, i == 0 ? 0.375 : i == 1 ? -0.125 : i == 2 ? -0.375 : 0.125);
    float thr = plateThreshold(px + o, ang, cell, seed);
    a += smoothstep(thr - w * 0.35, thr + w * 0.35, t);
  }
  a *= 0.25;
  // Cells smaller than ~2 px can't hold a dot: fade to the flat tint.
  return mix(t, a, smoothstep(1.2, 2.5, cell));
}

void main() {
  vec4 src = texture(u_input, v_uv);
  float cell = u_resolution.y / u_frequency;
  vec3 col = u_paperColor;
${plate(1, 'x')}
${plate(2, 'y')}
${plate(3, 'z')}
${plate(4, 'w')}
  fragColor = vec4(col, src.a);
}`,
  },
  render(ctx) {
    const cdf = ctx.cached('cdf', () => textureFromFloat(ctx.gl, buildCdf(), 256, SHAPES.length), (t) => t.dispose());
    const cell = ctx.height / Math.max(1, num(ctx.params, 'frequency'));
    const tone = ctx.blur(ctx.input, cell * 0.22);
    const out = ctx.pass('main', { inputs: { u_tone: tone, u_cdf: cdf } });
    ctx.release(tone);
    return out;
  },
};
