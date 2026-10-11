import type { EffectDef, ParamDef, ParamValues } from '../../engine/types';
import { bool, choice, color, float, point } from '../helpers';
import { RISO_GLSL, RISO_INK_NAMES } from './common-a';

// Up to four riso drums. Each ink's density comes from a Photoshop-style Black & White mix of the image
// (per-hue weights: reds … magentas), the drum can be misregistered (shift, ±1 % of the image), the ink is
// laid down stochastically through a grain field, and inks multiply over the paper (sRGB, like overprinting).

const HUES = ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas'] as const;
const HUE_KEYS = ['Reds', 'Yellows', 'Greens', 'Cyans', 'Blues', 'Magentas'] as const;

interface InkDefaults {
  on: boolean;
  ink: number;
  w: [number, number, number, number, number, number];
  shift: [number, number];
}

const INKS: InkDefaults[] = [
  { on: true, ink: 20, w: [-0.78, 1.9, 3, 3, 3, 3], shift: [0, 0] },
  { on: true, ink: 4, w: [2.08, 1.5, -2, -0.5, 0.96, -2], shift: [0, 0.2] },
  { on: true, ink: 13, w: [0.44, -2, 3, 3, 3, 3], shift: [0.3, 0.1] },
  { on: false, ink: 0, w: [0.4, 0.6, 0.4, 0.6, 0.2, 0.8], shift: [0, 0] },
];

function inkParams(i: number, d: InkDefaults): ParamDef[] {
  const n = i + 1;
  const vis = (p: ParamValues) => !!p[`ink${n}`];
  return [
    bool(`ink${n}`, `Ink ${n}`, d.on),
    choice(`ink${n}Color`, `Ink ${n} color`, RISO_INK_NAMES, d.ink, 'slider', { visibleIf: vis }),
    ...HUES.map((h, k) => float(`ink${n}${HUE_KEYS[k]}`, `Ink ${n} ${h}`, -2, 3, d.w[k], 0.01, { visibleIf: vis })),
    point(`ink${n}Shift`, `Ink ${n} shift`, d.shift, { visibleIf: vis }),
  ];
}

const inkGlsl = (n: number) => /* glsl */ `
  if (u_ink${n}) {
    vec2 uv = v_uv - u_ink${n}Shift * 0.01;
    vec3 c = texture(u_input, uv).rgb;
    float g = bwMix(c, u_ink${n}Reds, u_ink${n}Yellows, u_ink${n}Greens, u_ink${n}Cyans, u_ink${n}Blues, u_ink${n}Magentas);
    float cov = inkCoverage(saturate(1.0 - g), ${n}.0);
    col *= mix(vec3(1.0), risoInk(u_ink${n}Color), cov);
  }`;

export const risograph: EffectDef = {
  id: 'risograph',
  name: 'Risograph',
  category: 'Effects',
  keywords: 'color separation duotone fluoro grain ink overprint print riso risograph screen print spot color',
  params: [
    color('paperColor', 'Paper color', '#f5f1e8'),
    float('grainScale', 'Grain scale', 0.1, 3, 0.18),
    float('grainOpacity', 'Grain opacity', 0, 1, 0.85),
    float('grainSoftness', 'Grain softness', 0, 0.5, 0.5),
    float('grainContrast', 'Grain contrast', 0.5, 3, 1),
    ...INKS.flatMap((d, i) => inkParams(i, d)),
  ],
  shaders: {
    main: /* glsl */ `
${RISO_GLSL}
// Photoshop "Black & White": gray = min + (mid - min) * secondary weight + (max - mid) * primary weight.
float bwMix(vec3 c, float wr, float wy, float wg, float wc, float wb, float wm) {
  float r = c.r, g = c.g, b = c.b;
  float mx = max(r, max(g, b)), mn = min(r, min(g, b));
  float mid = r + g + b - mx - mn;
  float wPrim, wSec;
  if (mx == r) { wPrim = wr; wSec = g >= b ? wy : wm; }
  else if (mx == g) { wPrim = wg; wSec = r >= b ? wy : wc; }
  else { wPrim = wb; wSec = r >= g ? wm : wc; }
  return mn + (mid - mn) * wSec + (mx - mid) * wPrim;
}

// Grain field in [0,1] per drum: two octaves of value noise, cell size from the grain scale (reference px).
float grainField(vec2 px, float seed) {
  float s = max(u_grainScale * 12.0 * u_pxScale, 0.75);
  vec2 p = px / s + seed * vec2(37.1, 91.7);
  float n = 0.62 * valueNoise(p) + 0.38 * valueNoise(mat2(0.8, 0.6, -0.6, 0.8) * p * 2.31 + 11.0);
  n = (n - 0.5) * 1.6 + 0.5; // normalize the 2-octave sum back toward a uniform-ish spread
  return saturate((n - 0.5) * u_grainContrast + 0.5);
}

// Ink lay-down through the grain: soft grain is a mean-preserving density perturbation (strongest in the
// mid-tones), hard grain thresholds the density against the field (binary specks); softness blends them.
float inkCoverage(float density, float seed) {
  float n = grainField(gl_FragCoord.xy, seed);
  float soft = saturate(density + (n - 0.5) * sqrt(saturate(density * (1.0 - density))) * 0.7);
  float hard = smoothstep(n - 0.04, n + 0.04, density);
  float g = mix(hard, soft, saturate(u_grainSoftness * 2.0));
  // Drum toning: sparse ink specks even where the drum should stay clean.
  vec2 cell = gl_FragCoord.xy / max(u_grainScale * 9.0 * u_pxScale, 0.75);
  float speck = smoothstep(0.88, 0.98, valueNoise(cell + seed * 53.0)) * 0.3;
  g = g + speck * (1.0 - g);
  return mix(density, g, u_grainOpacity);
}

void main() {
  vec4 src = texture(u_input, v_uv);
  // Paper with a faint fiber grain.
  float pg = grainField(gl_FragCoord.xy * 0.7, 9.0) - 0.5;
  vec3 col = u_paperColor * (1.0 + 0.05 * u_grainOpacity * pg);
${[1, 2, 3, 4].map(inkGlsl).join('\n')}
  fragColor = vec4(saturate(col), src.a);
}`,
  },
};
