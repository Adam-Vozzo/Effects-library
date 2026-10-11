import type { EffectDef } from '../../engine/types';
import { bool, color, float } from '../helpers';

// Curved CRT tube. Geometry: the picture lies on a sphere cap of radius 1/curvature (long half side = 1)
// viewed from `distance`; each output ray is intersected with the sphere and the hit point's arc-length
// coordinates address the picture, so the screen bulges and its edges recede (perspective), and the
// corners are rounded by `bezel`. Outside the tube: `bg` at `bgOpacity`.
// Beam: decoded with `gamma correction`, `brightness gain` in linear light, re-encoded with gamma 2.8
// (so the default is tone-neutral like effect.app), times a tube vignette.
// Shadow mask: a triangular lattice of round R/G/B phosphor dots in screen space (3-colored lattice,
// 40 × density dots per short side, dot radius = size × dot pitch); each dot shows its channel of the
// beam. The mask is applied to the encoded value so sub-pixel dots keep the average brightness.
export const crtScreen: EffectDef = {
  id: 'crt-screen',
  name: 'CRT screen',
  category: 'Effects',
  keywords: 'crt look monitor old retro scanlines screen vhs tv',
  params: [
    float('distance', 'distance', 1.5, 10, 2),
    float('curvature', 'curvature', 0.01, 0.7, 0.2),
    float('bezel', 'bezel', 0, 1, 0.02),
    float('vignette', 'vignette', 0, 10, 6),
    color('bg', 'bg', '#000000'),
    float('bgOpacity', 'bgOpacity', 0, 1, 1),
    bool('phosphorDots', 'phosphor dots', true),
    float('density', 'density', 0, 10, 4.5),
    float('size', 'size', 0, 0.5, 0.4),
    float('dotSoftness', 'dot softness', 0.001, 0.5, 0.101),
    float('gamma', 'gamma correction', 0.1, 10, 2.8),
    float('brightness', 'brightness gain', 0, 10, 1),
  ],
  shaders: {
    main: /* glsl */ `
const float SQ3 = 1.7320508;

// Output pixel -> picture coordinates (same units: long half side = 1). Returns false if the ray misses.
bool tubeMap(vec2 p, out vec2 s) {
  float R = 1.0 / u_curvature;
  float D = u_distance;
  vec3 ro = vec3(0.0, 0.0, -D);
  vec3 rd = normalize(vec3(p, D));
  vec3 oc = ro - vec3(0.0, 0.0, R);
  float b = dot(oc, rd);
  float h = b * b - (dot(oc, oc) - R * R);
  if (h < 0.0) return false;
  vec3 hit = ro + (-b - sqrt(h)) * rd;
  float r = length(hit.xy);
  s = r > 1e-6 ? hit.xy * (R * asin(min(r / R, 1.0)) / r) : hit.xy;
  return true;
}

// Sum of the dots of one channel around q (lattice units: neighbouring dots are 1 apart).
vec3 phosphor(vec2 q, float aa) {
  // Lattice basis e1 = (1, 0), e2 = (1/2, sqrt3/2); the dot at i e1 + j e2 has color (i - j) mod 3.
  float jf = q.y / (0.5 * SQ3);
  float j0 = floor(jf);
  float i0 = floor(q.x - 0.5 * jf);
  vec3 m = vec3(0.0);
  float r0 = u_size - 0.5 * u_dotSoftness - aa;
  float r1 = u_size + 0.5 * u_dotSoftness + aa;
  for (int dj = -1; dj <= 2; dj++)
    for (int di = -1; di <= 2; di++) {
      float i = i0 + float(di), j = j0 + float(dj);
      vec2 c = vec2(i + 0.5 * j, 0.5 * SQ3 * j);
      float w = 1.0 - smoothstep(r0, r1, length(q - c));
      int k = int(mod(i - j + 0.5, 3.0));
      if (k == 0) m.r += w; else if (k == 1) m.g += w; else m.b += w;
    }
  return min(m, 1.0);
}

void main() {
  vec2 res = u_resolution;
  float L = max(res.x, res.y);
  vec2 ext = res / L;                       // picture half extents
  vec2 p = (v_uv - 0.5) * 2.0 * ext;
  vec2 s;
  bool hitTube = tubeMap(p, s);
  // Rounded-rectangle screen mask in picture space.
  float px = 2.0 / L;                        // one output pixel in these units
  float cr = min(u_bezel * 1.8, min(ext.x, ext.y));
  vec2 qd = abs(s) - (ext - cr);
  float sd = length(max(qd, 0.0)) + min(max(qd.x, qd.y), 0.0) - cr;
  float inside = hitTube ? 1.0 - smoothstep(-px, px, sd) : 0.0;

  vec2 suv = clamp(s / ext * 0.5 + 0.5, 0.0, 1.0);
  vec4 src = texture(u_input, suv);
  // Beam in linear light (tube gamma), gain, re-encoded with the default tube gamma 2.8.
  vec3 beam = pow(saturate(src.rgb), vec3(u_gamma)) * u_brightness;
  vec3 c = pow(beam, vec3(1.0 / 2.8));
  float vig = 16.0 * suv.x * (1.0 - suv.x) * suv.y * (1.0 - suv.y);
  c *= pow(max(vig, 1e-6), u_vignette * 0.016);
  if (u_phosphorDots && u_density > 0.0) {
    // Dot coverage is applied to the encoded value so small (sub-pixel) dots keep effect.app's
    // average brightness instead of being brightened by the gamma curve.
    float sc = 40.0 * u_density / min(ext.x, ext.y) * 0.5;  // dots per picture unit (short side = 2 min(ext))
    vec2 q = s * sc;
    float aa = px * sc * 0.7;
    c *= phosphor(q, aa);
  }
  // Composite over the background in premultiplied space (bg may be transparent).
  float a = mix(u_bgOpacity, src.a, inside);
  vec3 pm = mix(u_bg * u_bgOpacity, c * src.a, inside);
  fragColor = vec4(a > 1e-5 ? pm / a : vec3(0.0), a);
}`,
  },
};
