import type { EffectDef } from '../../engine/types';
import { bool, float } from '../helpers';

// Exposure in stops applied in a gamma-decoded space (exponent = gamma, 2.2 ≈ linear light).
// Optional extended Reinhard on luminance (white point = the brightest exposed input), gamut mapping
// that pulls out-of-range colors toward their luminance instead of clipping channels independently,
// and a clipping overlay (zebra stripes on blown highlights, blue on crushed shadows).
export const exposure: EffectDef = {
  id: 'exposure',
  name: 'Exposure',
  category: 'Color',
  keywords: 'exposure',
  params: [
    float('exposure', 'exposure', -5, 5, 0),
    float('gamma', 'gamma', 0.5, 10, 2.2),
    float('gamutMapping', 'gamut mapping', 0, 1, 0),
    bool('reinhard', 'reinhard', false),
    bool('showClipping', 'show clipping', false),
  ],
  shaders: {
    main: /* glsl */ `
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 lin = pow(max(src.rgb, 0.0), vec3(u_gamma)) * exp2(u_exposure);
  if (u_reinhard) {
    float lw = max(1.0, exp2(u_exposure));
    float y = luma(lin);
    float yt = y * (1.0 + y / (lw * lw)) / (1.0 + y);
    lin *= y > 1e-6 ? yt / y : 1.0;
  }
  if (u_gamutMapping > 0.0) {
    float y = luma(lin);
    float mx = max(lin.r, max(lin.g, lin.b));
    vec3 mapped = lin;
    if (y >= 1.0) mapped = vec3(1.0);
    else if (mx > 1.0) mapped = y + (lin - y) * (1.0 - y) / (mx - y);
    // Negative channels (from wide-gamut math) pull toward luminance too.
    float mn = min(lin.r, min(lin.g, lin.b));
    if (mn < 0.0 && y > 0.0) mapped = y + (mapped - y) * y / (y - mn);
    lin = mix(lin, max(mapped, 0.0), u_gamutMapping);
  }
  vec3 o = pow(max(lin, 0.0), vec3(1.0 / u_gamma));
  if (u_showClipping) {
    float mx = max(lin.r, max(lin.g, lin.b));
    float period = max(12.0 * u_pxScale, 6.0);
    float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / period));
    if (mx > 1.0 + 1e-3) o = mix(vec3(1.0, 0.1, 0.1), vec3(1.0), stripe);
    else if (max(o.r, max(o.g, o.b)) < 0.5 / 255.0) o = vec3(0.1, 0.3, 1.0);
  }
  fragColor = vec4(o, src.a);
}`,
  },
};
