// GLSL shared by the Generate effects (grain, procedural paper).

/** Smooth, roughly unit-variance grain noise on a lattice with 1-unit cells (two rotated octaves hide the grid). */
export const GRAIN_GLSL = /* glsl */ `
float gaussHash(vec2 cell, float seed) {
  vec3 u = vec3(pcg3d(uvec3(ivec3(ivec2(floor(cell)) + 32768, int(seed) + 4096)))) / 4294967295.0;
  return (u.x + u.y + u.z - 1.5) * 2.0;
}
float grainOctave(vec2 p, float seed) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = gaussHash(i, seed), b = gaussHash(i + vec2(1.0, 0.0), seed);
  float c = gaussHash(i + vec2(0.0, 1.0), seed), d = gaussHash(i + vec2(1.0, 1.0), seed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float grainNoise(vec2 p, float seed) {
  float n = grainOctave(p, seed) * 0.8 + grainOctave(mat2(0.8, 0.6, -0.6, 0.8) * p * 1.6 + 13.7, seed + 7.0) * 0.6;
  return n * 1.35;
}
`;

/**
 * Procedural scanned-paper texture in reference-pixel space (non-periodic, so it never tiles).
 * Returns a signed variation around 0 (roughly unit variance): grain, fibres, mottling and scanner streaks.
 */
export const PAPER_GLSL = /* glsl */ `
// Thin curvy fibres: ridges of stretched gradient noise whose orientation drifts slowly.
float paperFibres(vec2 p, float seed) {
  float a = gradientNoise(p * 0.012 + seed) * 3.0;
  vec2 q = rot2(a) * p;
  float r = 1.0 - abs(gradientNoise(q * vec2(0.035, 0.42) + seed * 3.1));
  return pow(r, 10.0);
}
float paperTexture(vec2 p, int mode) {
  float rough = mode == 1 ? 1.0 : 0.0;
  // Fine grain (~1.5 px) and medium tooth (~5 px).
  float grain = grainNoise(p / mix(1.4, 2.2, rough), 3.0);
  float tooth = gradientNoise(p / mix(5.0, 9.0, rough) + 7.3);
  // Fibres in two populations.
  float fib = paperFibres(p, 1.7) + paperFibres(p * 1.3 + 91.0, 5.3) * 0.8;
  // Low-frequency mottling (pulp density) and blotches.
  float mottle = fbm(p / mix(60.0, 35.0, rough) + 3.1, 4);
  // Scanner: faint horizontal streaks that vary slowly along x.
  float streak = gradientNoise(vec2(p.x * 0.002, p.y * 0.7)) * (0.6 + 0.4 * gradientNoise(vec2(p.x * 0.01, 3.0)));
  float t = grain * mix(0.55, 0.7, rough) + tooth * mix(0.35, 0.6, rough) + (fib - 0.12) * mix(1.6, 2.4, rough)
    + mottle * mix(0.9, 1.6, rough) + streak * 0.25;
  return t;
}
`;
