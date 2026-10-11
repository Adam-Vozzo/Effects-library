import type { EffectDef } from '../../engine/types';
import type { Texture } from '../../engine/gl';
import { bool, curve, float, int, num, point, texture } from '../helpers';

/** Simulation grid (long side): fixed relative to the image so the bleed looks the same at any render size. */
const SIM = 640;
const PASSES = 10;

/**
 * Ink spreading from dark areas into light ones. effect.app runs this as a feedback simulation over frames; a still
 * renders the settled state with a fixed cascade of spread passes (radii shrinking from the full reach down to a
 * pixel) on a reduced grid. Each pass pulls colour from inkier neighbours along noise-jittered directions, so fronts
 * grow blotchy and feathered. "Ink reset" restarts the growth every N seconds when animating (0 = always settled).
 */
export const inkBleed: EffectDef = {
  id: 'ink-bleed',
  name: 'Ink bleed',
  category: 'Generate',
  keywords: 'bleed ink spread',
  animated: true,
  params: [
    float('spread', 'spread', 0, 30, 5, 0.5),
    float('decay', 'decay', 0, 0.2, 0, 0.001),
    float('intensity', 'intensity', 0, 1, 0.15),
    point('direction', 'direction', [0, 0]),
    int('noiseSize', 'noise size', 4, 120, 90),
    float('grain', 'grain', 0, 1, 0.4),
    float('grainSize', 'grain size', 0.5, 3, 1, 0.1),
    texture('customMask', 'custom mask'),
    curve('maskContrast', 'mask contrast'),
    float('maskStrength', 'mask strength', 0, 1, 1),
    bool('showMask', 'show mask', false),
    int('inkReset', 'Ink reset (sec)', 0, 10, 0),
  ],
  shaders: {
    down: /* glsl */ `
uniform sampler2D u_src;
uniform vec2 u_srcTexel;
void main() {
  vec2 o = u_srcTexel;
  fragColor = 0.25 * (texture(u_src, v_uv - o) + texture(u_src, v_uv + vec2(o.x, -o.y))
    + texture(u_src, v_uv + vec2(-o.x, o.y)) + texture(u_src, v_uv + o));
}`,
    seed: /* glsl */ `
uniform sampler2D u_src;
float inkMask(vec3 c, vec2 uv) {
  float m = u_customMaskLoaded ? luma(texture(u_customMask, uv).rgb) : 1.0 - luma(saturate(c));
  m = lut1(u_maskContrast, m);
  return mix(1.0, m, u_maskStrength);
}
void main() {
  vec3 c = texture(u_src, v_uv).rgb;
  fragColor = vec4(srgbToLinear(c), inkMask(c, v_uv));
}`,
    spread: /* glsl */ `
uniform sampler2D u_src;  // rgb linear colour, a = ink
uniform float u_r;        // pass radius (sim px)
uniform float u_pass;
uniform float u_rate;     // how strongly an inkier neighbour takes over per pass
void main() {
  vec2 res = vec2(textureSize(u_src, 0));
  vec2 px = 1.0 / res;
  vec2 p = v_uv * res;
  vec4 c0 = texture(u_src, v_uv);
  // Reference-px coordinates for the paper noise (independent of the sim grid size).
  vec2 rp = p * (1000.0 / max(res.x, res.y));
  // Paper absorbency: blotchy at the noise size; the radius jitter makes the fronts irregular.
  float absorb = saturate(fbm(rp / u_noiseSize, 4) * 1.2 + 0.5);
  float jit = valueNoise(rp / 2.5 + u_pass * 7.0);
  float a0 = hash12(p + u_pass * 131.0) * TAU;
  vec2 bias = u_direction * 0.9;
  float rr = u_r * (0.15 + 1.25 * absorb) * (0.5 + 0.7 * jit);
  vec4 best = c0;
  for (int i = 0; i < 8; i++) {
    float ang = a0 + float(i) * (TAU / 8.0);
    vec2 q = p - (vec2(cos(ang), sin(ang)) + bias) * rr;
    vec4 s = texture(u_src, q / res);
    if (s.a > best.a) best = s;
  }
  float gain = smoothstep(0.0, 0.12, best.a - c0.a) * u_rate;
  // Feathered fronts: fibres stretched along the direction the ink travels (the ink gradient).
  vec2 g = vec2(texture(u_src, v_uv + vec2(px.x, 0.0)).a - texture(u_src, v_uv - vec2(px.x, 0.0)).a,
                texture(u_src, v_uv + vec2(0.0, px.y)).a - texture(u_src, v_uv - vec2(0.0, px.y)).a);
  float gl = length(g);
  vec2 dn = gl > 1e-4 ? g / gl : vec2(0.0, 1.0);
  vec2 pp = vec2(dot(rp, vec2(-dn.y, dn.x)), dot(rp, dn));
  float streak = valueNoise(pp * vec2(0.55, 0.035) + u_pass * 5.0);
  gain *= mix(1.0, 0.15 + 1.5 * streak, smoothstep(0.0, 0.05, gl));
  // Pigment mixes with what is there (blue over pink turns violet); ink thins with decay as it travels.
  fragColor = vec4(mix(c0.rgb, best.rgb, saturate(gain * 0.85)), mix(c0.a, best.a * (1.0 - u_decay * 2.0), saturate(gain)));
}`,
    main: /* glsl */ `
uniform sampler2D u_ink;   // settled simulation (linear rgb, a = ink)
uniform sampler2D u_orig;  // seed (unspread) on the same grid
uniform float u_strength;
vec4 textureBSpline(sampler2D t, vec2 uv) {
  vec2 size = vec2(textureSize(t, 0));
  vec2 st = uv * size - 0.5;
  vec2 i = floor(st), f = st - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;
  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;
  vec2 w3 = f3 / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i - 0.5 + w1 / g0) / size;
  vec2 h1 = (i + 1.5 + w3 / g1) / size;
  return (texture(t, vec2(h0.x, h0.y)) * g0.x + texture(t, vec2(h1.x, h0.y)) * g1.x) * g0.y
       + (texture(t, vec2(h0.x, h1.y)) * g0.x + texture(t, vec2(h1.x, h1.y)) * g1.x) * g1.y;
}
void main() {
  vec4 src = texture(u_input, v_uv);
  if (u_showMask) {
    float m = u_customMaskLoaded ? luma(texture(u_customMask, v_uv).rgb) : 1.0 - luma(saturate(src.rgb));
    m = mix(1.0, lut1(u_maskContrast, m), u_maskStrength);
    fragColor = vec4(vec3(m), 1.0);
    return;
  }
  vec4 ink = textureBSpline(u_ink, v_uv);
  vec4 base = textureBSpline(u_orig, v_uv);
  vec3 bled = linearToSrgb(ink.rgb);
  vec3 low = linearToSrgb(base.rgb);
  // The soaked paper loses most fine detail; where the ink changed the picture its colour replaces it fully.
  float change = saturate(length(bled - low) * 20.0);
  vec3 c = mix(src.rgb + (bled - low), bled, max(change, 0.7));
  // Ink pigment: denser and more saturated than the source colour.
  float L = luma(c);
  c = mix(c, mix(vec3(L), c, 1.45) * 0.93, saturate(change * ink.a * 1.3));
  // Fibre grain: thin streaks that modulate the ink density.
  vec2 rp = gl_FragCoord.xy / u_pxScale / max(u_grainSize, 0.1);
  float a = gradientNoise(rp * 0.01) * 2.0;
  vec2 q = rot2(a) * rp;
  float streak = gradientNoise(q * vec2(0.08, 0.9)) * 0.7 + gradientNoise(rp * 0.5) * 0.3;
  c *= 1.0 + u_grain * 0.12 * streak * (0.3 + ink.a);
  fragColor = vec4(mix(src.rgb, c, u_strength), src.a);
}`,
  },
  render(ctx) {
    const p = ctx.params;
    const long = Math.max(ctx.width, ctx.height);
    const sw = Math.max(1, Math.round((ctx.width / long) * SIM));
    const sh = Math.max(1, Math.round((ctx.height / long) * SIM));
    // Animated growth when Ink reset is set: the spread restarts every N seconds.
    const reset = num(p, 'inkReset');
    const phase = reset > 0 ? (ctx.time % reset) / reset : 1;
    let cur = ctx.input;
    const temps: Texture[] = [];
    while (cur.width > sw * 3 || cur.height > sh * 3) {
      const next = ctx.pass('down', {
        width: Math.ceil(cur.width / 2),
        height: Math.ceil(cur.height / 2),
        inputs: { u_src: cur },
        uniforms: { u_srcTexel: [0.5 / cur.width, 0.5 / cur.height] },
      });
      temps.push(next);
      cur = next;
    }
    const seed = ctx.pass('seed', { width: sw, height: sh, inputs: { u_src: cur } });
    for (const t of temps) ctx.release(t);
    // First pass radius: spread 5 → 4% of the long side (the cascade reaches about 3x that).
    const reach = num(p, 'spread') * 0.008 * SIM * Math.sqrt(phase);
    const rate = 1 - Math.pow(1 - Math.min(1, num(p, 'intensity')), 5);
    let ink = seed;
    if (reach > 0.3) {
      for (let k = 0; k < PASSES; k++) {
        const r = Math.max(0.7, reach * Math.pow(0.72, k));
        const next = ctx.pass('spread', { width: sw, height: sh, inputs: { u_src: ink }, uniforms: { u_r: r, u_pass: k, u_rate: rate } });
        if (ink !== seed) ctx.release(ink);
        ink = next;
      }
    }
    const strength = 1 - Math.pow(1 - Math.min(1, num(p, 'intensity')), 20);
    const out = ctx.pass('main', { inputs: { u_ink: ink, u_orig: seed }, uniforms: { u_strength: strength } });
    if (ink !== seed) ctx.release(ink);
    ctx.release(seed);
    return out;
  },
};
