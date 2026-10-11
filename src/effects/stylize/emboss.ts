import type { EffectDef } from '../../engine/types';
import { bool, float, int, num, point } from '../helpers';
import { MATERIAL_COUNT, MATERIAL_GLSL } from './common-a';

// Relief from the image's luminance (dark = high): the height gradient tilts a material surface lit from `light direction`
// (azimuth / elevation offsets from a top-left light; `light animation` spins / bobs it over time), plus a
// drop shadow cast along `shadow direction`, a rim highlight toward the light, a broad lighting gradient
// and darkening of the dark areas. `color` picks one of the shared procedural materials.

export const emboss: EffectDef = {
  id: 'emboss',
  name: 'Emboss',
  category: 'Effects',
  keywords: 'detection edge emboss metallic relief texture',
  animated: true,
  params: [
    float('scale', 'scale', 0, 10, 4, 0.1),
    int('material', 'color', 0, MATERIAL_COUNT - 1, 30),
    point('lightDirection', 'light direction', [0, 0]),
    point('lightAnimation', 'light animation', [0, 0]),
    point('shadowDirection', 'shadow direction', [0.15, -0.15]),
    bool('lockShadow', 'lock shadow', false),
    float('shadowIntensity', 'shadow intensity', 0, 2, 0.5, 0.1),
    float('shadowBlur', 'shadow blur', 0, 10, 0, 0.5),
    float('highlightIntensity', 'highlight intensity', 0, 2, 0.3, 0.1),
    float('highlightDistance', 'highlight distance', 0, 20, 2, 0.5),
    float('gradientStrength', 'gradient strength', 0, 1, 0.2),
    float('depthDarkening', 'depth darkening', 0, 1, 0.3),
  ],
  shaders: {
    main: /* glsl */ `
${MATERIAL_GLSL}
uniform sampler2D u_soft; // blurred input for the cast shadow
// Height: dark = raised (like ink pressed into the surface), which is how effect.app's relief reads.
float H(vec2 uv) { return 1.0 - luma(texture(u_input, uv).rgb); }
float Hs(vec2 uv) { return 1.0 - luma(texture(u_soft, uv).rgb); }
void main() {
  vec4 src = texture(u_input, v_uv);
  vec2 tx = 1.0 / u_resolution;
  float t = u_time;
  // Light: azimuth / elevation offsets from a 135° (top-left), 45° light; animation spins / bobs it.
  float az = radians(135.0) + u_lightDirection.x * PI + u_lightAnimation.x * t * 2.0;
  float el = radians(45.0) + u_lightDirection.y * radians(44.0) + u_lightAnimation.y * sin(t * 1.7) * radians(35.0);
  el = clamp(el, radians(2.0), radians(90.0));
  vec3 L = vec3(cos(el) * cos(az), cos(el) * sin(az), sin(el));
  vec2 L2 = normalize(vec2(cos(az), sin(az)));

  // Relief normal from the luminance gradient over ±1 reference px.
  float d = u_pxScale;
  float h = H(v_uv);
  float hx = H(v_uv + vec2(d, 0.0) * tx) - H(v_uv - vec2(d, 0.0) * tx);
  float hy = H(v_uv + vec2(0.0, d) * tx) - H(v_uv - vec2(0.0, d) * tx);
  vec3 n = normalize(vec3(-vec2(hx, hy) * u_scale * 0.9, 1.0));
  int id = int(u_material + 0.5);
  vec3 col = srgbToLinear(shadeMaterial(id, n, L));

  // Cast shadow: higher ground toward the light occludes this point.
  vec2 sdir = u_lockShadow ? -L2 * max(length(u_shadowDirection), 0.05) : u_shadowDirection;
  vec2 so = sdir * 20.0 * u_pxScale * tx;
  float sh = saturate((Hs(v_uv - so) - Hs(v_uv)) * 2.5);
  col *= 1.0 - saturate(u_shadowIntensity * sh);

  // Rim highlight: this point is higher than its neighbour toward the light.
  vec2 ho = L2 * u_highlightDistance * u_pxScale * tx;
  float hl = saturate((h - H(v_uv + ho)) * 2.5);
  col += u_highlightIntensity * hl * srgbToLinear(MAT_LIT[clamp(id, 0, ${MATERIAL_COUNT - 1})]) * 0.8;

  // Broad lighting gradient across the surface and darker low areas.
  // (The surface is lit "through" the relief, so the broad gradient brightens away from the light.)
  col *= 1.0 + u_gradientStrength * 0.7 * saturate(0.5 - dot(centered(v_uv, u_resolution), L2));
  col *= 1.0 - u_depthDarkening * h * 0.6;
  fragColor = vec4(linearToSrgb(max(col, 0.0)), src.a);
}`,
  },
  render(ctx) {
    const soft = ctx.blur(ctx.input, num(ctx.params, 'shadowBlur') * ctx.pxScale);
    const out = ctx.pass('main', { inputs: { u_soft: soft } });
    ctx.release(soft);
    return out;
  },
};
