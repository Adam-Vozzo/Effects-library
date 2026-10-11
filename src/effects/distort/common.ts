// Shared GLSL for the Distort effects.
//
// Coordinate convention ("unit" space, matching effect.app's distortion math): aspect-correct,
// origin at the image center, the SHORT side spans [-1, 1]. Radii, amplitudes and frequencies of
// the warps are expressed in this space so they look the same at any resolution / orientation.

export const DISTORT_GLSL = /* glsl */ `
float shortSide() { return min(u_resolution.x, u_resolution.y); }
vec2 unitScale() { return u_resolution / min(u_resolution.x, u_resolution.y); }
vec2 uvToUnit(vec2 uv) { return (uv - 0.5) * 2.0 * unitScale(); }
vec2 unitToUv(vec2 p) { return p * 0.5 / unitScale() + 0.5; }

// Catmull-Rom bicubic (9 bilinear taps) with explicit LOD, safe in non-uniform control flow.
vec4 bicubicLod(sampler2D tex, vec2 uv) {
  vec2 size = vec2(textureSize(tex, 0));
  vec2 sp = uv * size;
  vec2 t1 = floor(sp - 0.5) + 0.5;
  vec2 f = sp - t1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 p0 = (t1 - 1.0) / size, p3 = (t1 + 2.0) / size, p12 = (t1 + w2 / w12) / size;
  vec4 r = (textureLod(tex, vec2(p0.x, p0.y), 0.0) * w0.x + textureLod(tex, vec2(p12.x, p0.y), 0.0) * w12.x + textureLod(tex, vec2(p3.x, p0.y), 0.0) * w3.x) * w0.y;
  r += (textureLod(tex, vec2(p0.x, p12.y), 0.0) * w0.x + textureLod(tex, vec2(p12.x, p12.y), 0.0) * w12.x + textureLod(tex, vec2(p3.x, p12.y), 0.0) * w3.x) * w12.y;
  r += (textureLod(tex, vec2(p0.x, p3.y), 0.0) * w0.x + textureLod(tex, vec2(p12.x, p3.y), 0.0) * w12.x + textureLod(tex, vec2(p3.x, p3.y), 0.0) * w3.x) * w3.y;
  return max(r, vec4(0.0));
}

// Resample a texture at a warped uv. dx/dy are the uv derivatives (computed by the caller in
// uniform control flow). Strong magnification uses Catmull-Rom; minification is box filtered over
// the pixel footprint (pooled render targets have no mipmaps). Huge derivatives (seams/folds of the
// mapping) fall back to a single tap instead of smearing across the discontinuity.
vec4 sampleWarp(sampler2D tex, vec2 uv, vec2 dx, vec2 dy) {
  vec2 sz = vec2(textureSize(tex, 0));
  float lx = length(dx * sz), ly = length(dy * sz);
  float lm = max(lx, ly);
  if (lm > 48.0) return textureLod(tex, uv, 0.0);
  if (lm < 0.75) return bicubicLod(tex, uv);
  int nx = int(clamp(ceil(lx - 0.25), 1.0, 4.0));
  int ny = int(clamp(ceil(ly - 0.25), 1.0, 4.0));
  if (nx * ny == 1) return textureLod(tex, uv, 0.0);
  vec4 acc = vec4(0.0);
  for (int j = 0; j < 4; j++) {
    if (j >= ny) break;
    for (int i = 0; i < 4; i++) {
      if (i >= nx) break;
      vec2 o = (vec2(float(i), float(j)) + 0.5) / vec2(float(nx), float(ny)) - 0.5;
      acc += textureLod(tex, uv + dx * o.x + dy * o.y, 0.0);
    }
  }
  return acc / float(nx * ny);
}

// Antialiased coverage of the [0,1]^2 image rectangle at uv (1 inside, 0 outside).
float uvCoverage(vec2 uv, vec2 dx, vec2 dy) {
  vec2 w = max(abs(dx) + abs(dy), vec2(1e-7));
  vec2 d = min(uv, 1.0 - uv) / w;
  return saturate(min(d.x, d.y) + 0.5);
}

// Straight-alpha "over".
vec4 overStraight(vec4 top, vec4 bottom) {
  float a = top.a + bottom.a * (1.0 - top.a);
  vec3 c = (top.rgb * top.a + bottom.rgb * bottom.a * (1.0 - top.a)) / max(a, 1e-6);
  return vec4(c, a);
}

// 3D gradient noise whose z axis repeats every \`period\` lattice units (period <= 0: no repeat).
// Used for animations that loop seamlessly over a number of seconds.
vec3 gradDirP(vec3 i, float period) {
  if (period > 0.5) i.z = mod(i.z, period);
  return gradDir3(i);
}
float loopNoise(vec3 p, float period) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(gradDirP(i, period), f);
  float n100 = dot(gradDirP(i + vec3(1, 0, 0), period), f - vec3(1, 0, 0));
  float n010 = dot(gradDirP(i + vec3(0, 1, 0), period), f - vec3(0, 1, 0));
  float n110 = dot(gradDirP(i + vec3(1, 1, 0), period), f - vec3(1, 1, 0));
  float n001 = dot(gradDirP(i + vec3(0, 0, 1), period), f - vec3(0, 0, 1));
  float n101 = dot(gradDirP(i + vec3(1, 0, 1), period), f - vec3(1, 0, 1));
  float n011 = dot(gradDirP(i + vec3(0, 1, 1), period), f - vec3(0, 1, 1));
  float n111 = dot(gradDirP(i + vec3(1, 1, 1), period), f - vec3(1, 1, 1));
  return 1.2 * mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
`;

/**
 * Time coordinate for looping noise: returns [z, period] so that loopNoise(vec3(p, z), period)
 * advances `speed` lattice units per second and repeats exactly every `loopSec` seconds.
 */
export function loopTime(time: number, speed: number, loopSec: number): [number, number] {
  if (speed <= 0) return [0, 0];
  if (loopSec <= 0) return [time * speed, 0];
  const cycles = Math.max(1, Math.round(speed * loopSec));
  return [((time / loopSec) % 1) * cycles, cycles];
}
