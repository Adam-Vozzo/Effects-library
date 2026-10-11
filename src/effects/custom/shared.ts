// GLSL shared by the Custom effects: texture fitting and procedural stand-ins for effect.app's default textures
// (used while no user texture is loaded, so defaults never look broken).

export const FIT_OPTIONS = ['Fill', 'Stretch', 'Tile'];

/** Nominal size of the procedural default textures (square, like effect.app's sample textures). */
export const DEFAULT_TEX_SIZE = 1024;

export const FIT_GLSL = /* glsl */ `
// Output uv -> texture uv. fit: 0 Fill (cover), 1 Stretch, 2 Tile (contain, repeated).
// zoom > 1 enlarges the texture, reps > 1 repeats it more often; rotation in degrees (counter-clockwise).
vec2 fitTexUv(vec2 uv, vec2 res, vec2 texSize, int fit, float zoom, float reps, float rotDeg) {
  vec2 p = (uv - 0.5) * res;
  p = rot2(-radians(rotDeg)) * p;
  p *= reps / max(zoom, 1e-4);
  if (fit == 1) return p / res + 0.5;
  vec2 r = res / texSize;
  float s = fit == 0 ? max(r.x, r.y) : min(r.x, r.y);
  return p / (texSize * s) + 0.5;
}
// Sample a user texture at an unwrapped texture uv. Tile repeats (sampler wrap = REPEAT); Fill/Stretch either
// mirror (seamless maps) or return transparent outside the texture (layers).
vec4 sampleFitted(sampler2D t, vec2 tuv, int fit, bool clampToClear) {
  vec2 dx = dFdx(tuv), dy = dFdy(tuv);
  if (fit == 2) return textureGrad(t, tuv, dx, dy);
  if (clampToClear) {
    if (any(lessThan(tuv, vec2(0.0))) || any(greaterThan(tuv, vec2(1.0)))) return vec4(0.0);
    return textureGrad(t, tuv, dx, dy);
  }
  return textureGrad(t, mirrorUv(tuv), dx, dy);
}
// Distance from p to the nearest Voronoi cell border (cell units) and the cell id (two-pass, IQ-style).
vec2 voronoiBorder(vec2 p) {
  vec2 n = floor(p), f = fract(p);
  vec2 mg, mr;
  float md = 8.0, id = 0.0;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + hash22(n + g) * 0.9 + 0.05 - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; id = hash12(n + g + 0.5); }
    }
  md = 8.0;
  for (int j = -2; j <= 2; j++)
    for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 r = g + hash22(n + g) * 0.9 + 0.05 - f;
      if (dot(mr - r, mr - r) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
    }
  return vec2(md, id);
}
`;

/** Layer Mix default: dried-mud crackle (light grey base, dark polygonal cracks). Needs FIT_GLSL. */
export const CRACKLE_GLSL = /* glsl */ `
vec4 crackleTexture(vec2 tuv) {
  vec2 p = tuv * vec2(24.0, 21.0);
  // Gentle large warp keeps cells irregular; a fine warp makes the borders jagged but still angular.
  vec2 q = p + vec2(fbm(p * 0.25 + 1.3, 3), fbm(p * 0.25 + 7.1, 3)) * 0.5;
  q += vec2(gradientNoise(q * 3.1 + 2.0), gradientNoise(q * 3.1 + 8.0)) * 0.06;
  // Screen-space footprint in cell units for anti-aliasing.
  float aa = max(length(fwidth(q)), 1e-4) * 0.75;
  vec2 b1 = voronoiBorder(q);
  vec2 q2 = q * 2.2 + 11.0;
  vec2 b2 = voronoiBorder(q2);
  float wob = gradientNoise(q * 2.0) * 0.5 + 0.5;
  float region = fbm(p * 0.12 + 5.0, 3);
  // Main cracks vary in width and darkness along the network; secondary cracks split only some cells
  // and fade out partway.
  float w1 = 0.008 + 0.045 * wob * wob * (0.7 + region);
  float c1 = 1.0 - smoothstep(w1 - aa, w1 + aa, b1.x);
  float split = smoothstep(0.45, 0.6, fract(b1.y * 7.31) * 0.5 + gradientNoise(q * 0.6 + 3.0) * 0.5 + 0.25);
  split *= smoothstep(0.25, 0.55, gradientNoise(q2 * 0.9 + 17.0) * 0.5 + 0.5);
  float aa2 = aa * 2.2;
  float w2 = (0.008 + 0.025 * wob) * 2.2;
  float c2 = (1.0 - smoothstep(w2 - aa2, w2 + aa2, b2.x)) * split;
  // Base: light warm grey with mottling, fine pits, darker grime patches and grime along the cracks.
  float mott = fbm(p * 0.9 + 4.0, 4);
  float fine = valueNoise(p * 11.0) - 0.5;
  float pits = smoothstep(0.8, 0.95, valueNoise(p * 7.0 + 31.0)) * smoothstep(0.0, 0.5, mott + 0.2);
  float grime = smoothstep(0.05, 0.5, region) * (0.5 + 0.5 * fbm(p * 2.5, 3));
  vec3 base = vec3(0.9, 0.9, 0.89) + mott * 0.08 + fine * 0.05 - pits * 0.25 - grime * 0.16;
  base *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.1, b1.x)) * wob;
  vec3 crack = vec3(0.17, 0.17, 0.16) + 0.24 * (1.0 - wob) * (1.0 - region);
  vec3 c = mix(base, crack, max(c1, c2 * 0.75));
  return vec4(saturate(c), 1.0);
}
`;

/** Texture Blur default: dark mottled green with sparse yellowish specks. */
export const SPECKLE_GLSL = /* glsl */ `
vec4 speckleTexture(vec2 tuv) {
  vec2 p = tuv * 40.0;
  float m = fbm(p * 0.22 + 2.0, 4);
  float leaf = valueNoise(p * 2.7) - 0.5;
  vec3 c = vec3(0.13, 0.17, 0.13) + m * vec3(0.06, 0.08, 0.05) + leaf * 0.05;
  vec3 wv = worley(p + vec2(fbm(p * 0.5, 2), fbm(p * 0.5 + 9.0, 2)) * 0.6);
  float speck = (1.0 - smoothstep(0.06, 0.22, wv.x)) * step(0.8, wv.z);
  c = mix(c, vec3(0.46, 0.45, 0.22), speck * (0.5 + 0.5 * fract(wv.z * 13.0)));
  return vec4(saturate(c), 1.0);
}
`;

/** Displacement default: grey cellular veins (soft bright ridges around darker lumps), mean ~0.5. */
export const VEINS_GLSL = /* glsl */ `
vec4 veinsTexture(vec2 tuv) {
  vec2 p = tuv * 8.0;
  vec2 w = vec2(fbm(p * 0.45 + 3.0, 3), fbm(p * 0.45 + 9.0, 3));
  vec3 v = worley(p + w * 0.9);
  float veins = 1.0 - smoothstep(0.0, 0.45, v.y - v.x);
  vec3 v2 = worley(p * 2.3 + w * 1.5 + 4.0);
  float veins2 = 1.0 - smoothstep(0.0, 0.3, v2.y - v2.x);
  float lump = smoothstep(0.0, 0.8, v.x);
  float soft = fbm(p * 0.8 + 1.0, 4);
  float g = 0.42 + 0.34 * veins * veins + 0.18 * veins2 - 0.18 * lump + 0.3 * soft;
  return vec4(vec3(saturate(g)), 1.0);
}
`;
