import type { EffectDef } from '../../engine/types';
import type { Texture } from '../../engine/gl';
import { bool, choice, float, int, num, point } from '../helpers';
import { MATERIAL_COUNT, MATERIAL_GLSL } from './common-a';

// Bevel & emboss of a shape taken from the image (luma or alpha above a threshold).
// 1) mask at the processing resolution, 2) jump-flood distance field to the shape's edge (sub-pixel seeds),
// 3) profile → height map (inner / outer / both sides of the edge), 4) normals → shaded material,
// composited with a blend mode; flat interior / exterior use the inner / outer fill amounts.

const PROFILES = ['Round', 'Linear', 'Smooth', 'Cove', 'Ridge', 'Dome', 'Bulge', 'Scoop', 'Silk', 'Cone', 'Shelf', 'Bump', 'Rings', 'Steps', 'Ripple', 'Waves', 'Teeth', 'Scales', 'Flat'];
const BLENDS = ['Normal', 'Multiply', 'Screen', 'Overlay', 'Soft light', 'Hard light', 'Vivid light', 'Linear light', 'Color dodge', 'Color burn', 'Lighten', 'Darken', 'Emboss'];
/** BLENDS index → blendMode() index of the GLSL library (-1 = emboss). */
const BLEND_MAP = [0, 2, 6, 9, 10, 11, 12, 13, 7, 3, 5, 1, -1];

/** Largest bevel width (in processing px) the distance field is computed for; bigger bevels lower the resolution. */
const MAX_DIST = 384;

export const bevel: EffectDef = {
  id: 'bevel',
  name: 'Bevel',
  category: 'Effects',
  keywords: 'bevel emboss metallic relief texture',
  params: [
    choice('shapeFrom', 'shape from', ['Luma', 'Alpha'], 0, 'switcher'),
    float('threshold', 'threshold', 0.01, 0.99, 0.01),
    bool('invertMask', 'invert mask', false),
    int('size', 'size', 1, 1000, 40, { unit: 'px' }),
    int('procResolution', 'resolution', 256, 4096, 4096, { step: 32 }),
    float('depth', 'depth', 0, 4, 4, 0.05),
    choice('direction', 'direction', ['Inner', 'Outer', 'Both'], 2, 'switcher'),
    choice('profile', 'Profile', PROFILES, 0, 'slider'),
    int('material', 'material', 0, MATERIAL_COUNT - 1, 2, { group: 'Surface' }),
    point('lightDirection', 'light direction', [0, 0], { group: 'Surface' }),
    choice('blend', 'Blend', BLENDS, 0, 'slider', { group: 'Surface' }),
    float('opacity', 'opacity', 0, 1, 1, 0.01, { group: 'Surface' }),
    float('innerFill', 'inner fill', 0, 1, 1, 0.01, { group: 'Surface' }),
    float('outerFill', 'outer fill', 0, 1, 0, 0.01, { group: 'Surface' }),
  ],
  shaders: {
    // Shape mask at processing resolution (soft around the threshold for sub-pixel edges).
    mask: /* glsl */ `
void main() {
  vec2 o = 0.25 / u_resolution;
  vec4 c = (texture(u_input, v_uv + vec2(-o.x, -o.y)) + texture(u_input, v_uv + vec2(o.x, -o.y))
          + texture(u_input, v_uv + vec2(-o.x, o.y)) + texture(u_input, v_uv + vec2(o.x, o.y))) * 0.25;
  float v = u_shapeFrom == 0 ? luma(c.rgb) * (c.a > 0.0 ? 1.0 : 0.0) : c.a;
  float m = smoothstep(u_threshold - 0.01, u_threshold + 0.01, v);
  if (u_invertMask) m = 1.0 - m;
  fragColor = vec4(m, 0.0, 0.0, 1.0);
}`,
    // Jump flood seeds: offset to the 0.5 crossing toward a 4-neighbour on the other side of the edge.
    seed: /* glsl */ `
uniform sampler2D u_mask;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(u_mask, 0);
  float m = texelFetch(u_mask, p, 0).r;
  bool inside = m >= 0.5;
  vec2 best = vec2(1e4);
  for (int k = 0; k < 4; k++) {
    ivec2 d = k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(-1, 0) : k == 2 ? ivec2(0, 1) : ivec2(0, -1);
    ivec2 q = p + d;
    if (any(lessThan(q, ivec2(0))) || any(greaterThanEqual(q, size))) continue;
    float mq = texelFetch(u_mask, q, 0).r;
    if ((mq >= 0.5) != inside) {
      float f = clamp((m - 0.5) / (m - mq), 0.0, 1.0);
      vec2 off = vec2(d) * f;
      if (dot(off, off) < dot(best, best)) best = off;
    }
  }
  fragColor = vec4(best, m, 1.0);
}`,
    jfa: /* glsl */ `
uniform sampler2D u_src;
uniform float u_step;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(u_src, 0);
  vec4 self = texelFetch(u_src, p, 0);
  vec2 best = self.xy;
  float bd = dot(best, best);
  int s = int(u_step);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      if (i == 0 && j == 0) continue;
      ivec2 q = p + ivec2(i, j) * s;
      if (any(lessThan(q, ivec2(0))) || any(greaterThanEqual(q, size))) continue;
      vec2 o = texelFetch(u_src, q, 0).xy;
      if (o.x > 9000.0) continue;
      vec2 c = o + vec2(q - p);
      float dd = dot(c, c);
      if (dd < bd) { bd = dd; best = c; }
    }
  }
  fragColor = vec4(best, self.z, 1.0);
}`,
    // Profile → height (r, processing px), signed distance (g), mask (b).
    height: /* glsl */ `
uniform sampler2D u_src;
uniform float u_sizeP;
float profile(int k, float t) {
  t = saturate(t);
  if (k == 0) return sqrt(max(0.0, 1.0 - (1.0 - t) * (1.0 - t)));                // Round
  if (k == 1) return t;                                                          // Linear
  if (k == 2) return t * t * (3.0 - 2.0 * t);                                    // Smooth
  if (k == 3) return 1.0 - sqrt(max(0.0, 1.0 - t * t));                          // Cove
  if (k == 4) return t < 0.5 ? smoothstep(0.0, 0.5, t) : 1.0 - 0.45 * smoothstep(0.5, 1.0, t); // Ridge
  if (k == 5) return pow(sin(t * PI * 0.5), 0.6);                                // Dome
  if (k == 6) return t + 0.45 * sin(t * PI);                                     // Bulge
  if (k == 7) return t * t;                                                      // Scoop
  if (k == 8) { float s = t * t * (3.0 - 2.0 * t); return s * s * (3.0 - 2.0 * s); } // Silk
  if (k == 9) return 1.0 - abs(1.0 - 2.0 * t);                                   // Cone
  if (k == 10) return 0.5 * smoothstep(0.0, 0.3, t) + 0.5 * smoothstep(0.65, 0.95, t); // Shelf
  if (k == 11) return t * t * (3.0 - 2.0 * t) + 0.3 * sin(t * PI) * sin(t * PI); // Bump
  if (k == 12) return t + 0.12 * sin(t * PI * 6.0) * (1.0 - t);                  // Rings
  if (k == 13) return (floor(t * 4.0) + smoothstep(0.3, 0.7, fract(t * 4.0))) / 4.0; // Steps
  if (k == 14) return t + 0.08 * sin(t * PI * 10.0);                             // Ripple
  if (k == 15) return 0.5 - 0.5 * cos(t * PI * 3.0);                             // Waves
  if (k == 16) return t >= 1.0 ? 1.0 : fract(t * 3.0);                         // Teeth
  if (k == 17) return abs(sin(t * PI * 2.5));                                    // Scales
  return 1.0;                                                                    // Flat
}
void main() {
  vec4 j = texelFetch(u_src, ivec2(gl_FragCoord.xy), 0);
  float d = j.x > 9000.0 ? 1e4 : length(j.xy);
  bool inside = j.z >= 0.5;
  float sd = inside ? d : -d;
  float t;
  if (u_direction == 0) t = sd / u_sizeP;
  else if (u_direction == 1) t = (sd + u_sizeP) / u_sizeP;
  else t = (sd + 0.5 * u_sizeP) / u_sizeP;
  float h = (u_direction == 0 && sd < 0.0) ? 0.0 : profile(u_profile, t);
  fragColor = vec4(h * u_sizeP * u_depth * 0.3, clamp(sd, -2000.0, 2000.0), j.z, 1.0);
}`,
    main: /* glsl */ `
${MATERIAL_GLSL}
uniform sampler2D u_height;
uniform float u_sizeP;
const int BLEND_MAP[${BLEND_MAP.length}] = int[](${BLEND_MAP.join(', ')});
void main() {
  vec4 src = texture(u_input, v_uv);
  vec2 hs = vec2(textureSize(u_height, 0));
  vec2 e = 1.0 / hs;
  vec4 hc = texture(u_height, v_uv);
  float gx = (texture(u_height, v_uv + vec2(e.x, 0.0)).r - texture(u_height, v_uv - vec2(e.x, 0.0)).r) * 0.5;
  float gy = (texture(u_height, v_uv + vec2(0.0, e.y)).r - texture(u_height, v_uv - vec2(0.0, e.y)).r) * 0.5;
  vec3 n = normalize(vec3(-gx, -gy, 1.0));
  float az = radians(135.0) + u_lightDirection.x * PI;
  float el = clamp(radians(50.0) + u_lightDirection.y * radians(45.0), radians(3.0), radians(90.0));
  vec3 L = vec3(cos(el) * cos(az), cos(el) * sin(az), sin(el));
  int id = int(u_material + 0.5);
  vec3 shaded = shadeMaterial(id, n, L);

  // Coverage: the bevel band is always drawn, flat interior / exterior use the fill amounts.
  float sd = hc.g;
  float s = u_sizeP;
  float band, a;
  float aaw = max(1.0, 0.02 * s);
  if (u_direction == 0) {
    band = smoothstep(-aaw, 0.0, sd) * (1.0 - smoothstep(s - aaw, s, sd));
    a = sd < s * 0.5 ? mix(u_outerFill, 1.0, band) : mix(u_innerFill, 1.0, band);
  } else if (u_direction == 1) {
    band = smoothstep(-s, -s + aaw, sd) * (1.0 - smoothstep(0.0, aaw, sd));
    a = sd > -s * 0.5 ? mix(u_innerFill, 1.0, band) : mix(u_outerFill, 1.0, band);
  } else {
    band = smoothstep(-0.5 * s, -0.5 * s + aaw, sd) * (1.0 - smoothstep(0.5 * s - aaw, 0.5 * s, sd));
    a = sd > 0.0 ? mix(u_innerFill, 1.0, band) : mix(u_outerFill, 1.0, band);
  }
  if (u_profile == 18) a = sd > 0.0 ? u_innerFill : u_outerFill;
  a *= u_opacity;

  vec3 base = src.rgb;
  int mode = BLEND_MAP[clamp(u_blend, 0, ${BLEND_MAP.length - 1})];
  vec3 top;
  if (mode < 0) top = saturate(base + (shaded - shadeMaterial(id, vec3(0.0, 0.0, 1.0), L)) * 1.5);
  else top = mode == 0 ? shaded : blendMode(mode, saturate(base), shaded);
  vec3 rgb = mix(base, top, a);
  float alpha = max(src.a, u_direction != 0 ? a * band : 0.0);
  fragColor = vec4(rgb, alpha);
}`,
  },
  render(ctx) {
    const p = ctx.params;
    const W = ctx.width;
    const H = ctx.height;
    const long = Math.max(W, H);
    let s = Math.min(1, Math.max(256, num(p, 'procResolution')) / long);
    let sizeP = Math.max(1, num(p, 'size') * ctx.pxScale * s);
    if (sizeP > MAX_DIST) {
      s *= MAX_DIST / sizeP;
      sizeP = MAX_DIST;
    }
    const wp = Math.max(8, Math.round(W * s));
    const hp = Math.max(8, Math.round(H * s));
    const f = ctx.format === 'rgba16f' ? ('rgba16f' as const) : ctx.format;
    const mask = ctx.pass('mask', { width: wp, height: hp, format: f });
    let cur: Texture = ctx.pass('seed', { width: wp, height: hp, format: f, inputs: { u_mask: mask } });
    ctx.release(mask);
    const reach = sizeP * (num(p, 'direction') === 2 ? 0.5 : 1) + 2;
    let step = 1;
    while (step < reach) step *= 2;
    const steps: number[] = [];
    for (let k = step; k >= 1; k = Math.floor(k / 2)) steps.push(k);
    steps.push(1);
    for (const k of steps) {
      const next = ctx.pass('jfa', { width: wp, height: hp, format: f, inputs: { u_src: cur }, uniforms: { u_step: k } });
      ctx.release(cur);
      cur = next;
    }
    const height = ctx.pass('height', { width: wp, height: hp, format: f, inputs: { u_src: cur }, uniforms: { u_sizeP: sizeP } });
    ctx.release(cur);
    const smooth = ctx.blur(height, Math.max(1, sizeP * 0.06), undefined, f);
    ctx.release(height);
    const out = ctx.pass('main', { inputs: { u_height: smooth }, uniforms: { u_sizeP: sizeP } });
    ctx.release(smooth);
    return out;
  },
};
