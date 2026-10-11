import type { EffectDef } from '../../engine/types';
import { bool, choice, color, float, int, num, point, texture } from '../helpers';

// Sprites on a rotated, jittered grid. Each fragment gathers the sprites of the neighbouring cells,
// keeps the two top-most (random stacking order) for anti-aliased compositing and accumulates drop shadows.
// Grid cells are `Density` across the image width; sprite diameter = 0.8 × Size × (Min…Max size) cells.

const SEARCH_MAX = 4;
/** Sprite diameter in cells per unit of Size × scale. */
const DIAM = 0.8;

export const scatter: EffectDef = {
  id: 'scatter',
  name: 'Scatter',
  category: 'Effects',
  keywords: 'scatter',
  params: [
    choice('shape', 'Shape', ['Circle', 'Quad', 'Star', 'Crescent', 'Mix', 'Custom'], 0, 'slider'),
    texture('spriteTexture', 'Sprite Texture'),
    float('size', 'Size', 0.05, 10, 0.52),
    float('minSize', 'Min Size', 0, 3, 3),
    float('maxSize', 'Max Size', 0, 3, 3),
    float('widthVariance', 'Width Variance', 0, 0.5, 0),
    float('rotationVariance', 'Rotation Variance', 0, 1, 1),
    choice('colorMode', 'Color mode', ['Single', 'Original', 'Texture'], 2, 'slider', { group: 'Color' }),
    color('spriteColor', 'Sprite Color', '#ffffff', { group: 'Color' }),
    float('colorVariation', 'Color variation', 0, 1, 1, 0.01, { group: 'Color' }),
    choice('background', 'Background', ['Original', 'Multiply', 'Screen', 'Overlay', 'Soft light', 'Hidden'], 0, 'slider', { group: 'Color' }),
    color('backgroundColor', 'Background Color', '#000000', { group: 'Color' }),
    float('threshold', 'Threshold', 0, 1, 0.7, 0.01, { group: 'Selection' }),
    color('keyColor', 'Key Color', '#ffffff', { group: 'Selection' }),
    int('density', 'Density', 2, 300, 60, { group: 'Grid' }),
    int('gridAngle', 'Grid Angle', -90, 90, 0, { group: 'Grid', unit: '°' }),
    float('spread', 'Spread', 0, 1, 1, 0.01, { group: 'Grid' }),
    int('seed', 'Seed', 0, 100, 0, { group: 'Grid' }),
    bool('maskEnable', 'Enable', false, { group: 'Mask' }),
    bool('maskInvert', 'Invert', false, { group: 'Mask', visibleIf: (p) => !!p.maskEnable }),
    point('maskCenter', 'Center', [0, 0], { group: 'Mask', visibleIf: (p) => !!p.maskEnable }),
    float('maskSize', 'Size', 0, 2, 0.5, 0.01, { group: 'Mask', visibleIf: (p) => !!p.maskEnable }),
    float('maskSoftness', 'Softness', 0, 1, 0.5, 0.01, { group: 'Mask', visibleIf: (p) => !!p.maskEnable }),
    float('shadowOpacity', 'Opacity', 0, 1, 0, 0.01, { group: 'Drop Shadow' }),
    color('shadowColor', 'Shadow Color', '#000000', { group: 'Drop Shadow' }),
    int('shadowAngle', 'Angle', -180, 180, -45, { group: 'Drop Shadow', unit: '°' }),
    float('shadowDistance', 'Distance', 0, 1, 0.15, 0.01, { group: 'Drop Shadow' }),
    float('shadowSpread', 'Spread', 0, 1, 0, 0.01, { group: 'Drop Shadow' }),
    float('shadowBlur', 'Blur', 0, 4, 0.3, 0.01, { group: 'Drop Shadow' }),
    choice('shadowMode', 'Draw per', ['Element', 'Layer'], 0, 'switcher', { group: 'Drop Shadow' }),
  ],
  uniforms(p, { width }) {
    const cell = width / Math.max(2, num(p, 'density'));
    const diam = DIAM * num(p, 'size') * Math.max(num(p, 'minSize'), num(p, 'maxSize')) * (1 + num(p, 'widthVariance'));
    const shadow = num(p, 'shadowOpacity') > 0 ? diam * (num(p, 'shadowDistance') + 0.5 * num(p, 'shadowSpread') + 0.5 * num(p, 'shadowBlur')) : 0;
    const reach = diam * 0.5 * 1.15 + 0.75 * num(p, 'spread') + shadow;
    return {
      u_cellPx: cell,
      u_search: Math.min(SEARCH_MAX, Math.ceil(reach + 0.01)),
    };
  },
  shaders: {
    main: /* glsl */ `
uniform float u_cellPx;
uniform float u_search;

struct Sprite { vec2 pos; float diam; float rot; float sx; int shape; float z; vec2 src; float vary; };

float sdStar5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

// Signed distance (in sprite radii) of local point q to the sprite shape; negative inside.
float shapeSdf(int shape, vec2 q) {
  if (shape == 1) { vec2 d = abs(q) - vec2(0.886); return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
  if (shape == 2) return sdStar5(q * vec2(1.0, -1.0) + vec2(0.0, 0.12), 1.08, 0.45);
  if (shape == 3) return max(length(q) - 1.0, -(length(q - vec2(0.42, 0.18)) - 0.86));
  if (shape == 5) {
    if (!u_spriteTextureLoaded) return length(q) - 1.0;
    vec2 tuv = q * 0.5 + 0.5;
    if (any(lessThan(tuv, vec2(0.0))) || any(greaterThan(tuv, vec2(1.0)))) return 1.0;
    vec4 t = texture(u_spriteTexture, tuv);
    float a = t.a < 0.999 ? t.a : luma(t.rgb);
    return (0.5 - a) * 0.25;
  }
  return length(q) - 1.0;
}

// Straight-alpha "over".
vec4 over(vec4 top, vec4 base) {
  float a = top.a + base.a * (1.0 - top.a);
  return vec4((top.rgb * top.a + base.rgb * base.a * (1.0 - top.a)) / max(a, 1e-5), a);
}

vec2 gridToPx(vec2 g) { return rot2(radians(float(u_gridAngle))) * (g * u_cellPx) + u_resolution * 0.5; }

float maskAt(vec2 px) {
  if (!u_maskEnable) return 1.0;
  vec2 uv = px / u_resolution;
  float d = length(centered(uv, u_resolution) - centered(pointToUv(u_maskCenter), u_resolution));
  float r = u_maskSize * 0.5;
  float m = 1.0 - smoothstep(r * (1.0 - u_maskSoftness) - 1e-4, r + 1e-4, d);
  return u_maskInvert ? 1.0 - m : m;
}

Sprite makeSprite(vec2 c) {
  Sprite s;
  vec4 h = vec4(hash33(vec3(c, float(u_seed) * 13.0 + 1.0)), hash12(c * 1.37 + float(u_seed) * 7.0 + 3.0));
  vec4 h2 = vec4(hash33(vec3(c, float(u_seed) * 13.0 + 5.0)), 0.0);
  s.src = c + 0.5;
  s.pos = s.src + (h.xy - 0.5) * 1.5 * u_spread;
  vec2 srcPx = gridToPx(s.src);
  vec3 col = texture(u_input, srcPx / u_resolution).rgb;
  float sim = 1.0 - length(col - u_keyColor) / 1.7320508;
  float f = saturate((sim - (1.0 - u_threshold)) / max(u_threshold, 1e-3));
  s.diam = ${DIAM} * u_size * mix(u_minSize, u_maxSize, f) * maskAt(srcPx);
  s.rot = (h.z - 0.5) * TAU * u_rotationVariance;
  s.sx = 1.0 + (h.w - 0.5) * 2.0 * u_widthVariance;
  s.shape = u_shape == 4 ? int(h2.x * 4.0) : u_shape;
  s.z = h2.y;
  s.vary = h2.z;
  return s;
}

// Local sprite coordinates (unit radius) of grid-space point g.
vec2 spriteLocal(Sprite s, vec2 g) {
  vec2 q = rot2(-s.rot) * (g - s.pos) / max(s.diam * 0.5, 1e-4);
  q.x /= s.sx;
  return q;
}

vec3 spriteColor(Sprite s, vec2 g) {
  vec3 base = texture(u_input, gridToPx(s.src) / u_resolution).rgb;
  if (u_colorMode == 2) {
    // Texture: the sprite image, or the picture itself rotated with the sprite around its source cell;
    // color variation blends from the plain source color to the full texture detail.
    vec3 t;
    if (u_spriteTextureLoaded) t = texture(u_spriteTexture, spriteLocal(s, g) * 0.5 + 0.5).rgb;
    else t = texture(u_input, gridToPx(s.src + rot2(-s.rot) * (g - s.pos)) / u_resolution).rgb;
    return mix(base, t, u_colorVariation);
  }
  vec3 c = u_colorMode == 0 ? u_spriteColor : base;
  float v = (s.vary - 0.5) * u_colorVariation;
  return saturate(c * (1.0 + 0.35 * v) + 0.05 * v);
}

void main() {
  vec4 src = texture(u_input, v_uv);
  vec2 g = rot2(-radians(float(u_gridAngle))) * (gl_FragCoord.xy - u_resolution * 0.5) / u_cellPx;
  vec2 cell = floor(g);
  float aa = 1.0 / u_cellPx; // one render pixel in grid units
  int R = int(u_search);
  // Shadow offset in grid space (screen angle, +y up).
  float sa = radians(float(u_shadowAngle));
  vec2 sdir = rot2(-radians(float(u_gridAngle))) * vec2(cos(sa), sin(sa));
  bool shadows = u_shadowOpacity > 0.0;

  // Top two sprites by z (z, coverage, cell.xy).
  vec4 top0 = vec4(-1.0), top1 = vec4(-1.0);
  // Shadow casters: union for the background, plus the two highest casters (z, alpha) for stacking.
  float shadowAll = 0.0;
  vec4 casters = vec4(-1.0);
  for (int j = -${SEARCH_MAX}; j <= ${SEARCH_MAX}; j++) {
    if (abs(j) > R) continue;
    for (int i = -${SEARCH_MAX}; i <= ${SEARCH_MAX}; i++) {
      if (abs(i) > R) continue;
      vec2 c = cell + vec2(i, j);
      Sprite s = makeSprite(c);
      if (s.diam <= 1e-4) continue;
      float rpx = s.diam * 0.5;
      float d = shapeSdf(s.shape, spriteLocal(s, g)) * rpx; // grid units
      float cov = saturate(0.5 - d / aa);
      if (cov > 0.0) {
        vec4 e = vec4(s.z, cov, c);
        if (e.x > top0.x) { top1 = top0; top0 = e; }
        else if (e.x > top1.x) top1 = e;
      }
      if (shadows) {
        vec2 gs = g - sdir * u_shadowDistance * s.diam;
        float ds = shapeSdf(s.shape, spriteLocal(s, gs)) * rpx - u_shadowSpread * rpx;
        float soft = max(u_shadowBlur * rpx, aa);
        float a = saturate(0.5 - ds / soft);
        if (a > 0.0) {
          shadowAll = 1.0 - (1.0 - shadowAll) * (1.0 - a);
          if (s.z > casters.x) { casters.zw = casters.xy; casters.xy = vec2(s.z, a); }
          else if (s.z > casters.z) casters.zw = vec2(s.z, a);
        }
      }
    }
  }

  // Background.
  vec4 bg;
  vec3 img = src.rgb;
  if (u_background == 0) bg = vec4(img, src.a);
  else if (u_background == 1) bg = vec4(img * u_backgroundColor, src.a);
  else if (u_background == 2) bg = vec4(1.0 - (1.0 - img) * (1.0 - u_backgroundColor), src.a);
  else if (u_background == 3) bg = vec4(blendOverlay(img, u_backgroundColor), src.a);
  else if (u_background == 4) bg = vec4(blendSoftLight(img, u_backgroundColor), src.a);
  else bg = vec4(0.0);
  float sop = u_shadowOpacity;
  vec4 outc = shadows ? over(vec4(u_shadowColor, shadowAll * sop), bg) : bg;
  // Composite kept sprites back to front.
  for (int k = 1; k >= 0; k--) {
    vec4 e = k == 0 ? top0 : top1;
    if (e.x < 0.0) continue;
    Sprite s = makeSprite(e.zw);
    vec3 c = spriteColor(s, g);
    if (shadows && u_shadowMode == 0) {
      // Shadows of sprites stacked above this one.
      float a = 0.0;
      if (casters.x > e.x) a = 1.0 - (1.0 - a) * (1.0 - casters.y);
      if (casters.z > e.x) a = 1.0 - (1.0 - a) * (1.0 - casters.w);
      c = mix(c, u_shadowColor, a * sop);
    }
    outc = over(vec4(c, e.y), outc);
  }
  fragColor = outc;
}`,
  },
};
