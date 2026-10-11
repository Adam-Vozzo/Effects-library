import type { EffectDef } from '../../engine/types';
import { textureFromFloat } from '../../engine/gl';
import { bool, float, int, num } from '../helpers';
import { buildLut, evalStops } from './color-math';

// Thermal-camera palettes (evenly spaced stops, sRGB interpolation), indexed by "gradient type".
// Type 3 (effect.app's default) reproduces their navy → azure → spring-green ramp.
const PALETTES: string[][] = [
  // 0 ironbow
  ['#000000', '#1c0a4a', '#4f0c86', '#931a8c', '#cf3a5c', '#f06c2b', '#fba71b', '#fde35e', '#ffffff'],
  // 1 rainbow (high contrast)
  ['#000000', '#1b0a6e', '#0035ff', '#00b4ff', '#00f0a0', '#7dff00', '#fff000', '#ff8a00', '#ff0000', '#ffffff'],
  // 2 white hot
  ['#000000', '#ffffff'],
  // 3 arctic blue (effect.app default)
  ['#000080', '#0080ff', '#00ff80', '#ffff00'],
  // 4 black hot
  ['#ffffff', '#000000'],
  // 5 lava
  ['#000000', '#3d0000', '#8e0000', '#d42400', '#ff7000', '#ffc000', '#ffff9a'],
  // 6 arctic (cold blues, warm golds)
  ['#03052a', '#13307f', '#3c64c8', '#8eb3ea', '#f5e7a6', '#ffbf3a', '#ff7a12'],
  // 7 night vision
  ['#000000', '#003300', '#007a10', '#25d43a', '#a8ff8c', '#f0ffe8'],
  // 8 predator
  ['#0a0a5c', '#1240ff', '#00d0ff', '#00ff4c', '#ffff00', '#ff5a00', '#ff0060', '#ffffff'],
  // 9 magma
  ['#000004', '#2c115f', '#721f81', '#b73779', '#f1605d', '#feaf78', '#fcfdbf'],
];

export const thermal: EffectDef = {
  id: 'thermal',
  name: 'Thermal',
  category: 'Color',
  keywords: 'filter heat infrared map night scifi surveillance thermal vision visuals',
  params: [
    bool('invert', 'invert', true),
    float('shadows', 'shadows', -0.5, 0.5, -0.5),
    float('midtones', 'midtones', -0.5, 0.5, -0.22),
    float('highlights', 'highlights', -0.5, 0.5, -0.05),
    int('gradientType', 'gradient type', 0, 9, 3, {
      hint: '0 ironbow · 1 rainbow · 2 white hot · 3 arctic blue · 4 black hot · 5 lava · 6 arctic · 7 night vision · 8 predator · 9 magma',
    }),
    float('gradientShift', 'gradient shift', 0, 1, 0),
    float('gradientRepeat', 'gradient repeat', 0.1, 10, 0.7, 0.1),
    bool('showEdges', 'show edges', true),
    float('edgeRange', 'edge range', 0.15, 2, 0.5, 0.01, { visibleIf: (p) => !!p.showEdges }),
  ],
  shaders: {
    main: /* glsl */ `
uniform sampler2D u_palette;
uniform sampler2D u_soft;
// Heat value: (inverted) luma through a 3-point tone curve (0, 0.5, 1) offset by shadows/midtones/highlights.
float heat(vec3 c) {
  float x = saturate(luma(c));
  if (u_invert) x = 1.0 - x;
  float y = x < 0.5
    ? mix(u_shadows, 0.5 + u_midtones, x * 2.0)
    : mix(0.5 + u_midtones, 1.0 + u_highlights, x * 2.0 - 1.0);
  return saturate(y);
}
void main() {
  vec4 src = texture(u_input, v_uv);
  // Slightly softened like a thermal sensor.
  float x = heat(texture(u_soft, v_uv).rgb) * u_gradientRepeat + u_gradientShift;
  float t = x > 0.0 ? x - ceil(x) + 1.0 : 0.0;
  vec3 col = lut3(u_palette, t);
  if (u_showEdges) {
    // Visible-light edge overlay (MSX style): gradient magnitude of the softened luma.
    vec2 d = texel() * max(u_edgeRange * 4.0 * u_pxScale, 0.75);
    float tl = luma(texture(u_soft, v_uv + vec2(-d.x, d.y)).rgb);
    float tc = luma(texture(u_soft, v_uv + vec2(0.0, d.y)).rgb);
    float tr = luma(texture(u_soft, v_uv + vec2(d.x, d.y)).rgb);
    float ml = luma(texture(u_soft, v_uv + vec2(-d.x, 0.0)).rgb);
    float mr = luma(texture(u_soft, v_uv + vec2(d.x, 0.0)).rgb);
    float bl = luma(texture(u_soft, v_uv + vec2(-d.x, -d.y)).rgb);
    float bc = luma(texture(u_soft, v_uv + vec2(0.0, -d.y)).rgb);
    float br = luma(texture(u_soft, v_uv + vec2(d.x, -d.y)).rgb);
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
    float e = smoothstep(0.1, 0.9, length(vec2(gx, gy)));
    col = mix(col, vec3(1.0), e * 0.25);
  }
  fragColor = vec4(col, src.a);
}`,
  },
  render(ctx) {
    const type = Math.max(0, Math.min(PALETTES.length - 1, Math.round(num(ctx.params, 'gradientType'))));
    const pal = ctx.cached('thermal-palette:' + type, () => textureFromFloat(ctx.gl, buildLut((t) => evalStops(PALETTES[type], t)), 256, 1), (t) => t.dispose());
    const soft = ctx.blur(ctx.input, 1.6 * ctx.pxScale);
    const out = ctx.pass('main', { inputs: { u_palette: pal, u_soft: soft } });
    ctx.release(soft);
    return out;
  },
};
