import type { EffectDef } from '../../engine/types';
import { bool, choice, color, float, num, point } from '../helpers';
import { FX_BLEND_LABELS, FX_BLEND_LIB, libBlend } from './common-b';

// Shaped vignette. Distance is a gauge function of the chosen shape (circle or regular polygon, in
// short-side units around `center`, stretched by anamorphism and rotated); the color amount follows
// 1 - ((d - (1 - softness)) / softness)^2, which at softness 1 is effect.app's quadratic falloff that
// reaches the full color at d = size. The color is composited with effect.app's blend list.
export const vignette: EffectDef = {
  id: 'vignette',
  name: 'Vignette',
  category: 'Effects',
  keywords: 'vignette shape oval triangle diamond rectangle hexagon octagon linear dither',
  params: [
    choice('shape', 'shape', ['Oval', 'Triangle', 'Diamond', 'Rectangle', 'Hexagon', 'Octagon'], 0, 'slider'),
    float('size', 'size', 0.05, 2, 0.65),
    float('anamorphism', 'anamorphism', 0.25, 4, 1),
    float('rotation', 'rotation', -180, 180, 0, 0.1, { unit: '°' }),
    point('center', 'center X', [0, 0], { step: 0.001 }),
    float('softness', 'softness', 0, 1, 1),
    float('transparency', 'transparency', 0, 1, 1),
    color('color', 'color', '#000000'),
    choice('blendMode', 'blend mode', FX_BLEND_LABELS, 0, 'slider'),
    float('blend', 'blend', 0, 1, 1),
    bool('dithering', 'dithering', true),
  ],
  uniforms: (p) => ({ u_libMode: libBlend(FX_BLEND_LIB, num(p, 'blendMode')) }),
  shaders: {
    main: /* glsl */ `
uniform int u_libMode;

// Gauge of a regular n-gon with edge normals at rot + k * 2pi/n, scaled so that its
// mid-radius ((inradius + circumradius) / 2) is 1. The max over the edge distances is a p-norm so
// the falloff has no creases along the corner directions (corners are rounded by ~4%).
float polyGauge(vec2 p, float n, float rot) {
  float seg = TAU / n;
  float s = 0.0;
  float m = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= n) break;
    float a = rot + seg * float(i);
    m = max(m, dot(p, vec2(cos(a), sin(a))));
  }
  for (int i = 0; i < 8; i++) {
    if (float(i) >= n) break;
    float a = rot + seg * float(i);
    s += pow(max(dot(p, vec2(cos(a), sin(a))), 0.0) / max(m, 1e-6), 16.0);
  }
  float c = cos(PI / n);
  return m * pow(s, 1.0 / 16.0) * (1.0 + c) / (2.0 * c);
}

float shapeGauge(vec2 p) {
  if (u_shape == 0) return length(p);
  if (u_shape == 1) return polyGauge(p, 3.0, PI / 6.0);  // apex up
  if (u_shape == 2) return polyGauge(p, 4.0, PI / 4.0);  // vertices on the axes
  if (u_shape == 3) return polyGauge(p, 4.0, 0.0);       // axis-aligned square
  if (u_shape == 4) return polyGauge(p, 6.0, PI / 6.0);  // flat top
  return polyGauge(p, 8.0, 0.0);
}

void main() {
  vec4 src = texture(u_input, v_uv);
  vec2 res = u_resolution;
  vec2 p = (v_uv - pointToUv(u_center)) * res / min(res.x, res.y);
  p = rot2(radians(u_rotation)) * p;
  p.x /= u_anamorphism;
  float d = shapeGauge(p) / u_size;
  float s = max(u_softness, 1e-3);
  float t = saturate((d - (1.0 - s)) / s);
  // Keep a hard edge anti-aliased.
  float aa = fwidth(d);
  float inside = u_softness < 1e-3 ? 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d) : 1.0 - t * t;
  float amount = (1.0 - inside) * u_transparency;
  vec3 top = blendMode(u_libMode, saturate(src.rgb), u_color);
  vec3 c = mix(src.rgb, top, amount);
  c = mix(src.rgb, c, u_blend);
  if (u_dithering) c += (hash12(gl_FragCoord.xy) - 0.5) * (4.0 / 255.0) * amount * u_blend;
  fragColor = vec4(c, src.a);
}`,
  },
};
