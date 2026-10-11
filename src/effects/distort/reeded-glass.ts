import type { EffectDef } from '../../engine/types';
import { angle, float, int, num } from '../helpers';
import { DISTORT_GLSL, loopTime } from './common';

// Fluted / reeded glass. A periodic glass thickness profile T(u) (u = position across the reeds in
// periods, `pattern repeats` reeds per image short side) refracts the image along the pattern
// normal by amount * 0.2 * period * T'(u) / 2pi, which folds and mirrors the image inside each reed.
// Pattern types: 0 contrast-shaped wave, 1 round flutes, 2 prisms (V grooves), 3 sawtooth steps.
// Dispersion separates the channels, reflection adds glossy highlights + an environment sheen,
// imperfections add a subtle uneven-glass wobble. The pattern drifts `shift speed` periods per
// second and loops seamlessly every `shift loop` seconds.
export const reededGlass: EffectDef = {
  id: 'reeded-glass',
  name: 'Reeded glass',
  category: 'Distort',
  keywords: 'analog distortion fluted glass reeded refraction ribbed',
  animated: true,
  params: [
    float('amount', 'amount', 0, 10, 1),
    float('dispersion', 'dispersion', 0, 0.5, 0.3, 0.001),
    float('reflection', 'reflection', 0, 1, 0),
    float('reflectionScale', 'reflection scale', 0.1, 2, 1, 0.05),
    int('patternType', 'pattern type', 0, 3, 0),
    int('repeats', 'pattern repeats', 1, 64, 7),
    angle('patternAngle', 'pattern angle', 0, 360, 0),
    float('contrast', 'pattern contrast', 0.1, 5, 4, 0.05),
    float('shiftSpeed', 'shift speed', 0, 2, 1, 0.1),
    float('shiftLoop', 'shift loop (sec)', 0, 10, 5, 0.5),
    float('imperfections', 'imperfections', 0, 1, 0.3),
    float('imperfectionsScale', 'imperfections scale', 0.2, 25, 10, 0.1),
  ],
  // The pattern period is 1, so the looping time coordinate doubles as a seamless shift.
  uniforms: (p, ctx) => ({ u_shift: loopTime(ctx.time, num(p, 'shiftSpeed'), num(p, 'shiftLoop'))[0] }),
  shaders: {
    main: /* glsl */ `
${DISTORT_GLSL}
uniform float u_shift;

// Signed power keeping the sign of x.
float spow(float x, float e) { return sign(x) * pow(abs(x), e); }

// Glass thickness profile T(u) (one period per unit u, roughly in [-1, 1]); returns (T, dT/du).
vec2 profile(float u) {
  float c = max(u_contrast, 0.1);
  int type = int(u_patternType + 0.5);
  if (type == 1) {
    // Round flutes: bumps (1 - x^2)^(c/4), x in [-1, 1] across each flute.
    float x = fract(u) * 2.0 - 1.0;
    float e = 0.25 * c;
    float b = max(1.0 - x * x, 1e-4);
    return vec2(2.0 * pow(b, e) - 1.0, 2.0 * e * pow(b, e - 1.0) * (-2.0 * x) * 2.0);
  }
  if (type == 2) {
    // Prisms: V grooves with contrast-shaped flanks.
    float x = fract(u) * 2.0 - 1.0;
    float e = 0.25 * c + 0.25;
    float ax = max(abs(x), 1e-4);
    return vec2(1.0 - 2.0 * pow(ax, e), -2.0 * e * pow(ax, e - 1.0) * sign(x) * 2.0);
  }
  if (type == 3) {
    // Sawtooth steps: a ramp per reed, eased by the contrast.
    float x = fract(u);
    float e = 0.5 * c + 0.5;
    float xs = max(x, 1e-4);
    return vec2(4.0 * pow(xs, e) - 2.0, 4.0 * e * pow(xs, e - 1.0));
  }
  // Contrast-shaped wave: T = -sign(cos)|cos|^c (c = 1 is a plain sine profile).
  float a = TAU * u;
  float cs = cos(a), sn = sin(a);
  return vec2(-spow(cs, c), TAU * c * pow(max(abs(cs), 1e-5), c - 1.0) * sn);
}

void main() {
  vec2 p = uvToUnit(v_uv);
  float ang = radians(u_patternAngle);
  vec2 dir = vec2(cos(ang), sin(ang));
  float reps = max(u_repeats, 1.0);
  float period = 2.0 / reps; // unit space (short side = 2)
  // Imperfections: low-amplitude smooth wobble of the glass (static, in screen space).
  vec2 q = p * u_imperfectionsScale;
  vec2 wob = vec2(gradientNoise(q + 13.1), gradientNoise(q.yx - 7.7)) + 0.5 * vec2(gradientNoise(q * 2.7 + 3.3), gradientNoise(q.yx * 2.7 - 1.9));
  float u = dot(p, dir) / period + u_shift + u_imperfections * 0.025 * wob.x;
  vec2 prof = profile(u);
  prof.y = clamp(prof.y, -60.0, 60.0);
  float d = u_amount * 0.2 * period * prof.y / TAU;
  vec2 disp = dir * d + wob * u_imperfections * 0.002;
  vec2 uv = unitToUv(p + disp);
  vec4 col = textureLod(u_input, mirrorUv(uv), 0.0);
  if (u_dispersion > 0.0) {
    vec2 spread = dir * d * u_dispersion * 0.35;
    col.r = textureLod(u_input, mirrorUv(unitToUv(p + disp - spread)), 0.0).r;
    col.b = textureLod(u_input, mirrorUv(unitToUv(p + disp + spread)), 0.0).b;
  }
  if (u_reflection > 0.0) {
    // Surface normal of the reed (tilts across the pattern direction with the profile slope).
    float slope = prof.y * 0.08 * u_amount / max(u_reflectionScale, 0.1);
    vec3 n = normalize(vec3(-dir * slope, 1.0));
    vec3 l = normalize(vec3(-0.55, 0.65, 0.9));
    vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(n, h), 0.0), 18.0 / (u_reflectionScale * u_reflectionScale));
    float fres = pow(1.0 - n.z, 1.5);
    // Environment sheen: a mirrored glimpse of the image, offset along the normal.
    vec2 ruv = mirrorUv(unitToUv(-p * 0.6 + n.xy * 1.5 * u_reflectionScale));
    vec3 env = textureLod(u_input, ruv, 0.0).rgb;
    vec3 add = vec3(spec) * 0.9 + env * fres * 1.6;
    col.rgb = mix(col.rgb, 1.0 - (1.0 - col.rgb) * (1.0 - saturate(add)), u_reflection);
  }
  fragColor = col;
}`,
  },
};
