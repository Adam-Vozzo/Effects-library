// Shared data + GLSL for the first half of the "Effects" category (JPEG glitch … Star glow).

import { hexToRgb } from '../../engine/luts';

/** Deterministic PRNG for CPU-side randomness (quantization tables, glitch events). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const glslVec3 = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return `vec3(${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)})`;
};

// ---------------------------------------------------------------- riso inks

/** Risograph drum inks (approximations of the published RISO swatches), effect.app order. */
export const RISO_INKS: [string, string][] = [
  ['Black', '#1b1b1d'],
  ['Black Simulated', '#3a3a3f'],
  ['Risofederal Blue', '#3d5588'],
  ['Medium Blue', '#3255a4'],
  ['Blue', '#0078bf'],
  ['Cornflower', '#62a8e5'],
  ['Aqua', '#5ec8e5'],
  ['Mint', '#82d8d5'],
  ['Teal', '#00838a'],
  ['Hunter Green', '#407060'],
  ['Green', '#00a95c'],
  ['Kelly Green', '#67b346'],
  ['Moss', '#68724d'],
  ['Yellow', '#ffe800'],
  ['Sunflower', '#ffb511'],
  ['Melon', '#ffae3b'],
  ['Apricot', '#f6a04d'],
  ['Orange', '#ff6c2f'],
  ['Red', '#ff665e'],
  ['Coral', '#ff8e91'],
  ['Bright Red', '#f15060'],
  ['Marine Red', '#d2515e'],
  ['Burgundy', '#914e72'],
  ['Violet', '#9d7ad2'],
  ['Grape', '#6c5d80'],
  ['Purple', '#765ba7'],
  ['Brown', '#925f52'],
  ['Light Grey', '#88898a'],
  ['Flat Gold', '#bb8b41'],
  ['Metallic Gold', '#ac936e'],
  ['Fluorescent Pink', '#ff48b0'],
  ['Fluorescent Orange', '#ff7477'],
  ['Fluorescent Red', '#ff4c65'],
  ['Fluorescent Yellow', '#ffe916'],
  ['Fluorescent Green', '#44d62c'],
];

export const RISO_INK_NAMES = RISO_INKS.map((i) => i[0]);

/** `vec3 risoInk(int i)`: sRGB ink color. */
export const RISO_GLSL = /* glsl */ `
const vec3 RISO_INKS[${RISO_INKS.length}] = vec3[](
  ${RISO_INKS.map((i) => glslVec3(i[1])).join(',\n  ')}
);
vec3 risoInk(int i) { return RISO_INKS[clamp(i, 0, ${RISO_INKS.length - 1})]; }
`;

// ---------------------------------------------------------------- light / glow helpers

/** Soft threshold with a quadratic knee (bright-pass of bloom-like effects), input linear RGB. */
export const KNEE_GLSL = /* glsl */ `
vec3 kneeThreshold(vec3 c, float threshold, float knee) {
  float br = max(max(c.r, c.g), c.b);
  float k = max(knee, 1e-4);
  float rq = clamp(br - threshold + k, 0.0, 2.0 * k);
  rq = rq * rq / (4.0 * k);
  float w = max(rq, br - threshold) / max(br, 1e-4);
  return c * max(w, 0.0);
}
`;

// ---------------------------------------------------------------- materials (Emboss "color", Bevel "material")

interface Material {
  /** Color of a surface facing the viewer (flat areas). */
  base: string;
  /** Lit and shaded colors the surface moves toward as it turns to / away from the light. */
  lit: string;
  shade: string;
  /** Specular color, sharpness (phong exponent) and reflective environment banding (0 = matte, 1 = chrome). */
  spec: string;
  shininess: number;
  metal: number;
}

/** 36 procedural "matcap" materials. Index 2 (bevel default) and 30 (emboss default) are tuned to effect.app's flat tones. */
const MATERIALS: Material[] = [
  { base: '#9a9da3', lit: '#f4f6fa', shade: '#2a2c31', spec: '#ffffff', shininess: 60, metal: 0.8 }, // 0 silver
  { base: '#8d929b', lit: '#ffffff', shade: '#121318', spec: '#ffffff', shininess: 120, metal: 1 }, // 1 chrome
  { base: '#7e848c', lit: '#e9eef8', shade: '#23262d', spec: '#ffffff', shininess: 70, metal: 0.85 }, // 2 steel
  { base: '#b8913c', lit: '#fff1b8', shade: '#3e2a08', spec: '#fff6d0', shininess: 70, metal: 0.85 }, // 3 gold
  { base: '#c4917f', lit: '#ffe4d8', shade: '#4a2a22', spec: '#fff0ea', shininess: 60, metal: 0.8 }, // 4 rose gold
  { base: '#b06a45', lit: '#ffcfae', shade: '#3a1a0c', spec: '#ffe0cc', shininess: 60, metal: 0.8 }, // 5 copper
  { base: '#8f6a3c', lit: '#e9c58e', shade: '#2c1c0a', spec: '#f5dcae', shininess: 40, metal: 0.7 }, // 6 bronze
  { base: '#b39a52', lit: '#fbeaa8', shade: '#3a2f10', spec: '#fff4c8', shininess: 60, metal: 0.8 }, // 7 brass
  { base: '#5d5f63', lit: '#b9bcc2', shade: '#141518', spec: '#d8dce4', shininess: 30, metal: 0.5 }, // 8 iron
  { base: '#8a8a86', lit: '#e2e0d8', shade: '#2b2a28', spec: '#f4f2ea', shininess: 50, metal: 0.7 }, // 9 titanium
  { base: '#4c5056', lit: '#a7adb6', shade: '#0e0f12', spec: '#e6ebf2', shininess: 80, metal: 0.9 }, // 10 gunmetal
  { base: '#e3ddd3', lit: '#ffffff', shade: '#8f8678', spec: '#ffffff', shininess: 40, metal: 0.25 }, // 11 pearl
  { base: '#dcdcdc', lit: '#ffffff', shade: '#7c7c80', spec: '#ffffff', shininess: 30, metal: 0 }, // 12 white plastic
  { base: '#262628', lit: '#5c5c62', shade: '#050506', spec: '#ffffff', shininess: 40, metal: 0 }, // 13 black plastic
  { base: '#c0302a', lit: '#ff8a7a', shade: '#4a0806', spec: '#ffffff', shininess: 40, metal: 0 }, // 14 red plastic
  { base: '#2e5fbf', lit: '#8fb6ff', shade: '#0a1840', spec: '#ffffff', shininess: 40, metal: 0 }, // 15 blue plastic
  { base: '#3a9a4a', lit: '#9fe6a6', shade: '#0b3012', spec: '#ffffff', shininess: 40, metal: 0 }, // 16 green plastic
  { base: '#e2c22a', lit: '#fff3a0', shade: '#5a4a04', spec: '#ffffff', shininess: 40, metal: 0 }, // 17 yellow plastic
  { base: '#e2722a', lit: '#ffc08a', shade: '#5a2404', spec: '#ffffff', shininess: 40, metal: 0 }, // 18 orange plastic
  { base: '#7c46b8', lit: '#c9a2ff', shade: '#240b44', spec: '#ffffff', shininess: 40, metal: 0 }, // 19 purple plastic
  { base: '#e07aa8', lit: '#ffd0e4', shade: '#5a1a36', spec: '#ffffff', shininess: 40, metal: 0 }, // 20 pink plastic
  { base: '#b49a84', lit: '#ead8c6', shade: '#4a3a2c', spec: '#f0e6dc', shininess: 6, metal: 0 }, // 21 clay
  { base: '#b5653f', lit: '#e9a682', shade: '#4a2010', spec: '#f0c8b0', shininess: 6, metal: 0 }, // 22 terracotta
  { base: '#4f9a7a', lit: '#a8e6c8', shade: '#123a2a', spec: '#e8fff4', shininess: 50, metal: 0.2 }, // 23 jade
  { base: '#e6e4df', lit: '#ffffff', shade: '#9a968e', spec: '#ffffff', shininess: 25, metal: 0.1 }, // 24 marble
  { base: '#1c1b22', lit: '#5b5868', shade: '#030305', spec: '#e8e4ff', shininess: 90, metal: 0.6 }, // 25 obsidian
  { base: '#bfe0ee', lit: '#ffffff', shade: '#5a8aa2', spec: '#ffffff', shininess: 80, metal: 0.5 }, // 26 ice
  { base: '#6fb8c4', lit: '#e0fbff', shade: '#174a54', spec: '#ffffff', shininess: 100, metal: 0.6 }, // 27 glass
  { base: '#3a3a3c', lit: '#77777b', shade: '#101011', spec: '#9a9aa0', shininess: 8, metal: 0 }, // 28 rubber
  { base: '#9c9a96', lit: '#d6d4d0', shade: '#4a4946', spec: '#d0cec8', shininess: 4, metal: 0 }, // 29 concrete
  { base: '#5c5e61', lit: '#c4cad3', shade: '#16171a', spec: '#e2e8f0', shininess: 30, metal: 0.4 }, // 30 slate
  { base: '#d2b98c', lit: '#f6e8c8', shade: '#6e5a38', spec: '#fff4dc', shininess: 6, metal: 0 }, // 31 sand
  { base: '#9a6a40', lit: '#dcae80', shade: '#3a2210', spec: '#f0d0b0', shininess: 12, metal: 0 }, // 32 wood
  { base: '#a8a0c8', lit: '#c8fff4', shade: '#3a2060', spec: '#ffffff', shininess: 60, metal: 0.9 }, // 33 holographic
  { base: '#18b8c8', lit: '#b8ffff', shade: '#003a44', spec: '#ffffff', shininess: 60, metal: 0.3 }, // 34 neon cyan
  { base: '#c83cb0', lit: '#ffb8f0', shade: '#44083a', spec: '#ffffff', shininess: 60, metal: 0.3 }, // 35 neon magenta
];

export const MATERIAL_COUNT = MATERIALS.length;

/**
 * `vec3 shadeMaterial(int id, vec3 n, vec3 l)`: sRGB color of a surface with normal n (z toward the viewer)
 * lit from direction l (unit, z toward the viewer). Flat surfaces (n = +z) return the material's base color.
 */
export const MATERIAL_GLSL = /* glsl */ `
const vec3 MAT_BASE[${MATERIALS.length}] = vec3[](${MATERIALS.map((m) => glslVec3(m.base)).join(', ')});
const vec3 MAT_LIT[${MATERIALS.length}] = vec3[](${MATERIALS.map((m) => glslVec3(m.lit)).join(', ')});
const vec3 MAT_SHADE[${MATERIALS.length}] = vec3[](${MATERIALS.map((m) => glslVec3(m.shade)).join(', ')});
const vec3 MAT_SPEC[${MATERIALS.length}] = vec3[](${MATERIALS.map((m) => glslVec3(m.spec)).join(', ')});
const vec2 MAT_PARAM[${MATERIALS.length}] = vec2[](${MATERIALS.map((m) => `vec2(${m.shininess.toFixed(1)}, ${m.metal.toFixed(2)})`).join(', ')});
vec3 shadeMaterial(int id, vec3 n, vec3 l) {
  id = clamp(id, 0, ${MATERIALS.length - 1});
  vec3 base = srgbToLinear(MAT_BASE[id]);
  vec3 lit = srgbToLinear(MAT_LIT[id]);
  vec3 shade = srgbToLinear(MAT_SHADE[id]);
  vec2 prm = MAT_PARAM[id];
  n = normalize(n);
  const vec3 V = vec3(0.0, 0.0, 1.0);
  // Diffuse relative to a flat surface, so flat areas keep the base color exactly.
  float d0 = max(l.z, 0.0);
  float d = max(dot(n, l), 0.0);
  float rel = (d - d0) / max(1.0 - d0, 0.15);
  vec3 c = rel >= 0.0 ? mix(base, lit, saturate(rel)) : mix(base, shade, saturate(-rel * (1.0 - 0.3 * prm.y)));
  // Specular lobe (relative to the flat response).
  vec3 h = normalize(l + V);
  float s = pow(max(dot(n, h), 0.0), prm.x) - pow(max(h.z, 0.0), prm.x);
  c += srgbToLinear(MAT_SPEC[id]) * max(s, 0.0) * (0.35 + 0.65 * prm.y);
  // Metals reflect a horizon-banded environment: tilted surfaces pick up dark ground / bright sky bands.
  vec3 r = reflect(-V, n);
  float tilt = 1.0 - n.z;
  float band = smoothstep(-0.15, 0.25, r.y) - 0.55 * smoothstep(0.55, 0.95, r.y) - 0.35 * (1.0 - smoothstep(-0.7, -0.2, r.y));
  c = mix(c, c * (0.35 + 1.1 * band) + lit * 0.15 * band, prm.y * saturate(tilt * 3.0));
  if (id == 33) c *= 0.6 + 0.6 * hue2rgb(fract(r.x * 0.6 + r.y * 0.4 + 0.5));
  return linearToSrgb(max(c, 0.0));
}
`;
