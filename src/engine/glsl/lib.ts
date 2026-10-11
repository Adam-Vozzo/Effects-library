// Shared GLSL library injected into every effect shader. Keep functions small and pure;
// unused ones are stripped by the driver.

export const GLSL_LIB = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718
#define saturate(x) clamp(x, 0.0, 1.0)

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float luma601(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

vec3 srgbToLinear(vec3 c) {
  c = max(c, 0.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 gammaDecode(vec3 c, float g) { return pow(max(c, 0.0), vec3(g)); }
vec3 gammaEncode(vec3 c, float g) { return pow(max(c, 0.0), vec3(1.0 / g)); }

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec3 hue2rgb(float h) {
  return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
}
vec3 rgb2hsl(vec3 c) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  float l = (mx + mn) * 0.5;
  float d = mx - mn;
  if (d < 1e-6) return vec3(0.0, 0.0, l);
  float s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
  float h;
  if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  return vec3(h / 6.0, s, l);
}
vec3 hsl2rgb(vec3 hsl) {
  vec3 rgb = hue2rgb(hsl.x);
  float c = (1.0 - abs(2.0 * hsl.z - 1.0)) * hsl.y;
  return (rgb - 0.5) * c + hsl.z;
}

// OKLab (Björn Ottosson), input/output linear sRGB.
vec3 linearToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = sign(l) * pow(abs(l), 1.0 / 3.0);
  m = sign(m) * pow(abs(m), 1.0 / 3.0);
  s = sign(s) * pow(abs(s), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 oklabToLinear(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
vec3 srgbToOklch(vec3 c) {
  vec3 lab = linearToOklab(srgbToLinear(c));
  return vec3(lab.x, length(lab.yz), atan(lab.z, lab.y));
}
vec3 oklchToSrgb(vec3 lch) {
  return linearToSrgb(oklabToLinear(vec3(lch.x, lch.y * cos(lch.z), lch.y * sin(lch.z))));
}

vec3 rgb2ycbcr(vec3 c) {
  return vec3(
    0.299 * c.r + 0.587 * c.g + 0.114 * c.b,
    -0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b + 0.5,
    0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b + 0.5);
}
vec3 ycbcr2rgb(vec3 c) {
  float y = c.x, cb = c.y - 0.5, cr = c.z - 0.5;
  return vec3(y + 1.402 * cr, y - 0.344136 * cb - 0.714136 * cr, y + 1.772 * cb);
}
vec3 rgb2yiq(vec3 c) {
  return mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * c;
}
vec3 yiq2rgb(vec3 c) {
  return mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * c;
}

// Approximate blackbody color (Tanner Helland fit), kelvin 1000..40000, returns sRGB 0..1.
vec3 kelvinToRgb(float k) {
  float t = k / 100.0;
  vec3 c;
  if (t <= 66.0) {
    c.r = 1.0;
    c.g = clamp(0.39008157876 * log(t) - 0.63184144378, 0.0, 1.0);
    c.b = t <= 19.0 ? 0.0 : clamp(0.54320678911 * log(t - 10.0) - 1.19625408914, 0.0, 1.0);
  } else {
    c.r = clamp(1.29293618606 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
    c.g = clamp(1.12989086089 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
    c.b = 1.0;
  }
  return c;
}

// ---------- hashing & noise (integer hashes are stable across GPUs) ----------
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
uvec2 pcg2d(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v = v ^ (v >> 16u);
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v = v ^ (v >> 16u);
  return v;
}
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
float hash11(float p) { return float(pcg(floatBitsToUint(p))) / 4294967295.0; }
float hash12(vec2 p) { uvec2 q = pcg2d(uvec2(ivec2(floor(p)) + 32768)); return float(q.x ^ q.y) / 4294967295.0; }
vec2 hash22(vec2 p) { return vec2(pcg2d(uvec2(ivec2(floor(p)) + 32768))) / 4294967295.0; }
vec3 hash32(vec2 p) { return vec3(pcg3d(uvec3(ivec2(floor(p)) + 32768, 7u))) / 4294967295.0; }
vec3 hash33(vec3 p) { return vec3(pcg3d(uvec3(ivec3(floor(p)) + 32768))) / 4294967295.0; }
float hash13(vec3 p) { return hash33(p).x; }
// Continuous-input hash (for non-integer coordinates, e.g. seeds).
float hashf(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123); }

float valueNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float valueNoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i), n100 = hash13(i + vec3(1, 0, 0)), n010 = hash13(i + vec3(0, 1, 0)), n110 = hash13(i + vec3(1, 1, 0));
  float n001 = hash13(i + vec3(0, 0, 1)), n101 = hash13(i + vec3(1, 0, 1)), n011 = hash13(i + vec3(0, 1, 1)), n111 = hash13(i + vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
vec2 gradDir(vec2 p) { float a = hash12(p) * TAU; return vec2(cos(a), sin(a)); }
// Gradient (Perlin-style) noise in roughly [-1, 1].
float gradientNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(gradDir(i), f), b = dot(gradDir(i + vec2(1, 0)), f - vec2(1, 0));
  float c = dot(gradDir(i + vec2(0, 1)), f - vec2(0, 1)), d = dot(gradDir(i + vec2(1, 1)), f - vec2(1, 1));
  return 1.4142 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec3 gradDir3(vec3 p) {
  vec3 h = hash33(p) * 2.0 - 1.0;
  return normalize(h + 1e-5);
}
float gradientNoise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(gradDir3(i), f);
  float n100 = dot(gradDir3(i + vec3(1, 0, 0)), f - vec3(1, 0, 0));
  float n010 = dot(gradDir3(i + vec3(0, 1, 0)), f - vec3(0, 1, 0));
  float n110 = dot(gradDir3(i + vec3(1, 1, 0)), f - vec3(1, 1, 0));
  float n001 = dot(gradDir3(i + vec3(0, 0, 1)), f - vec3(0, 0, 1));
  float n101 = dot(gradDir3(i + vec3(1, 0, 1)), f - vec3(1, 0, 1));
  float n011 = dot(gradDir3(i + vec3(0, 1, 1)), f - vec3(0, 1, 1));
  float n111 = dot(gradDir3(i + vec3(1, 1, 1)), f - vec3(1, 1, 1));
  return 1.2 * mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm(vec2 p, int octaves) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    s += a * gradientNoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 17.0;
    a *= 0.5;
  }
  return s;
}
float fbm3(vec3 p, int octaves) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    s += a * gradientNoise3(p);
    p = p * 2.03 + vec3(17.0, 31.0, 7.0);
    a *= 0.5;
  }
  return s;
}
// Cellular (Worley) noise: x = distance to nearest, y = second nearest, z = cell id hash.
vec3 worley(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(x, y);
      vec2 o = hash22(i + g);
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; id = hash12(i + g + 0.5); }
      else if (d < d2) d2 = d;
    }
  return vec3(d1, d2, id);
}
// Interleaved gradient noise: cheap screen-space dither in [0,1).
float ign(vec2 px) { return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715)))); }

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

// ---------- blend modes (base = below, blend = above), all in [0,1] sRGB ----------
vec3 blendOverlay(vec3 b, vec3 s) { return mix(2.0 * b * s, 1.0 - 2.0 * (1.0 - b) * (1.0 - s), step(0.5, b)); }
vec3 blendSoftLight(vec3 b, vec3 s) {
  vec3 d = mix(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, step(b, vec3(0.25)));
  return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(0.5, s));
}
vec3 blendColorDodge(vec3 b, vec3 s) { return mix(min(vec3(1.0), b / max(1.0 - s, 1e-5)), vec3(1.0), step(1.0, s)) * step(1e-6, b); }
vec3 blendColorBurn(vec3 b, vec3 s) { return mix(1.0 - min(vec3(1.0), (1.0 - b) / max(s, 1e-5)), vec3(0.0), step(s, vec3(0.0))) * (1.0 - step(1.0, b)) + step(1.0, b); }
vec3 setLum(vec3 c, float l) {
  c += l - luma601(c);
  float L = luma601(c);
  float n = min(min(c.r, c.g), c.b), x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = L + (c - L) * L / max(L - n, 1e-5);
  if (x > 1.0) c = L + (c - L) * (1.0 - L) / max(x - L, 1e-5);
  return c;
}
float satOf(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
vec3 setSat(vec3 c, float s) {
  float mx = max(max(c.r, c.g), c.b), mn = min(min(c.r, c.g), c.b);
  float d = mx - mn;
  return d > 1e-6 ? (c - mn) * s / d : vec3(0.0);
}
vec3 blendVividLight(vec3 b, vec3 s) {
  return mix(blendColorBurn(b, 2.0 * s), blendColorDodge(b, 2.0 * (s - 0.5)), step(0.5, s));
}
// Index order matches BLEND_MODES in engine/types.ts (Photoshop order).
vec3 blendMode(int mode, vec3 b, vec3 s) {
  switch (mode) {
    case 0: return s;
    case 1: return min(b, s);
    case 2: return b * s;
    case 3: return blendColorBurn(b, s);
    case 4: return max(b + s - 1.0, 0.0);
    case 5: return max(b, s);
    case 6: return 1.0 - (1.0 - b) * (1.0 - s);
    case 7: return blendColorDodge(b, s);
    case 8: return b + s;
    case 9: return blendOverlay(b, s);
    case 10: return blendSoftLight(b, s);
    case 11: return blendOverlay(s, b);
    case 12: return blendVividLight(b, s);
    case 13: return b + 2.0 * s - 1.0;
    case 14: return mix(min(b, 2.0 * s), max(b, 2.0 * (s - 0.5)), step(0.5, s));
    case 15: return step(0.5, blendVividLight(b, s));
    case 16: return abs(b - s);
    case 17: return b + s - 2.0 * b * s;
    case 18: return max(b - s, 0.0);
    case 19: return b / max(s, 1e-4);
    case 20: return setLum(setSat(s, satOf(b)), luma601(b));
    case 21: return setLum(setSat(b, satOf(s)), luma601(b));
    case 22: return setLum(s, luma601(b));
    case 23: return setLum(b, luma601(s));
  }
  return s;
}

// Composite an effect result over its input with a blend mode and opacity (straight alpha).
vec4 blendOver(vec4 base, vec4 top, int mode, float opacity) {
  vec3 c = mode == 0 ? top.rgb : blendMode(mode, saturate(base.rgb), saturate(top.rgb));
  return vec4(mix(base.rgb, c, opacity * top.a), max(base.a, top.a * opacity));
}

// ---------- geometry helpers ----------
// Aspect-corrected centered coordinates: x in [-aspect, aspect] * 0.5, y in [-0.5, 0.5].
vec2 centered(vec2 uv, vec2 res) { return (uv - 0.5) * vec2(res.x / res.y, 1.0); }
vec2 uncentered(vec2 p, vec2 res) { return p / vec2(res.x / res.y, 1.0) + 0.5; }
// Param-space point ([-1,1], +y up, 0 = image center) to uv.
vec2 pointToUv(vec2 p) { return p * 0.5 + 0.5; }

// Elliptical radial mask used by depth-of-field / masked blurs. Returns 1 inside, 0 outside.
float ellipseMask(vec2 uv, vec2 res, vec2 centerUv, float radius, float falloff, float stretch, float rotDeg) {
  vec2 p = centered(uv, res) - centered(centerUv, res);
  p = rot2(radians(rotDeg)) * p;
  p.x /= (1.0 + stretch);
  float d = length(p) / max(radius * 0.5, 1e-4);
  return 1.0 - smoothstep(1.0, 1.0 + falloff * 0.5, d);
}

// Bicubic (Catmull-Rom, 9-tap) texture sample for sharper resampling.
vec4 textureBicubic(sampler2D tex, vec2 uv) {
  vec2 size = vec2(textureSize(tex, 0));
  vec2 samplePos = uv * size;
  vec2 texPos1 = floor(samplePos - 0.5) + 0.5;
  vec2 f = samplePos - texPos1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 offset12 = w2 / w12;
  vec2 texPos0 = (texPos1 - 1.0) / size;
  vec2 texPos3 = (texPos1 + 2.0) / size;
  vec2 texPos12 = (texPos1 + offset12) / size;
  vec4 r = vec4(0.0);
  r += texture(tex, vec2(texPos0.x, texPos0.y)) * w0.x * w0.y;
  r += texture(tex, vec2(texPos12.x, texPos0.y)) * w12.x * w0.y;
  r += texture(tex, vec2(texPos3.x, texPos0.y)) * w3.x * w0.y;
  r += texture(tex, vec2(texPos0.x, texPos12.y)) * w0.x * w12.y;
  r += texture(tex, vec2(texPos12.x, texPos12.y)) * w12.x * w12.y;
  r += texture(tex, vec2(texPos3.x, texPos12.y)) * w3.x * w12.y;
  r += texture(tex, vec2(texPos0.x, texPos3.y)) * w0.x * w3.y;
  r += texture(tex, vec2(texPos12.x, texPos3.y)) * w12.x * w3.y;
  r += texture(tex, vec2(texPos3.x, texPos3.y)) * w3.x * w3.y;
  return r;
}

// 256-entry LUT lookups (curves, gradients).
float lut1(sampler2D t, float x) { return texture(t, vec2((saturate(x) * 255.0 + 0.5) / 256.0, 0.5)).r; }
vec3 lut3(sampler2D t, float x) { return texture(t, vec2((saturate(x) * 255.0 + 0.5) / 256.0, 0.5)).rgb; }
float lut1Periodic(sampler2D t, float x) { return texture(t, vec2((fract(x) * 255.0 + 0.5) / 256.0, 0.5)).r; }

// Mirror-repeat a uv so out-of-range lookups reflect instead of smearing edge pixels.
vec2 mirrorUv(vec2 uv) { return 1.0 - abs(1.0 - mod(uv, 2.0)); }
`;
