import type { EffectDef, ParamDef } from '../../engine/types';
import { bool, float, wheel } from '../helpers';

const ZONES = ['Black', 'Shadow', 'Light', 'Highlight', 'Specular'] as const;
/** GLSL weight variable of each zone. */
const W: Record<(typeof ZONES)[number], string> = { Black: 'wB', Shadow: 'wS', Light: 'wL', Highlight: 'wH', Specular: 'wP' };

function zoneParams(zone: string): ParamDef[] {
  const k = zone.toLowerCase();
  return [
    wheel(`${k}Tint`, `${zone} tint`, [0, 0], { group: zone }),
    float(`${k}Exposure`, `${zone} Exposure`, -4, 4, 0, 0.01, { group: zone }),
    float(`${k}Saturation`, `${zone} Saturation`, 0, 2, 1, 0.01, { group: zone }),
  ];
}

const tintSum = ZONES.map((z) => {
  const k = z.toLowerCase();
  return `${W[z]} * tintStops(u_${k}Tint, u_${k}TintColor)`;
}).join(' + ');
const sumOf = (suffix: string) => ZONES.map((z) => `${W[z]} * u_${z.toLowerCase()}${suffix}`).join(' + ');

// HDR-style zone grading (in the spirit of exposure-zone color wheels): scene-linear luminance is
// measured in stops relative to mid grey (0.18) and split into Black / Shadow / Light / Highlight /
// Specular zones at the boundary sliders, with smooth transitions "Zone Falloff" stops wide.
// Every zone (and the global controls) adds exposure + a tint, both as log2 gains in linear light,
// and scales saturation around the pixel's luminance.
export const colorGrading: EffectDef = {
  id: 'color-grading',
  name: 'Color grading',
  category: 'Color',
  keywords: 'hdr color wheels grade, grading',
  params: [
    wheel('globalTint', 'Global tint', [0, 0]),
    float('globalExposure', 'Global Exposure', -4, 4, 0, 0.01),
    float('globalSaturation', 'Global Saturation', 0, 2, 1, 0.1),
    ...ZONES.flatMap(zoneParams),
    float('blackShadow', 'Black | Shadow', -8, -1, -4, 0.05, { group: 'Zones', unit: ' EV' }),
    float('shadowLight', 'Shadow | Light', -3, 1.5, 0, 0.05, { group: 'Zones', unit: ' EV' }),
    float('lightHighlight', 'Light | Highlight', 0, 2.4, 1.2, 0.05, { group: 'Zones', unit: ' EV' }),
    float('highlightSpecular', 'Highlight | Specular', 0.5, 2.5, 2, 0.05, { group: 'Zones', unit: ' EV' }),
    float('zoneFalloff', 'Zone Falloff', 0.25, 2.5, 1, 0.01, { group: 'Zones' }),
    bool('showZones', 'Show zones', false, { group: 'Zones' }),
    float('strength', 'Strength', 0, 1, 1, 0.01, { group: 'Zones' }),
  ],
  shaders: {
    main: /* glsl */ `
// Wheel → per-channel log2 gain: push toward the wheel hue, luminance-neutral, up to ~1.5 stops.
vec3 tintStops(vec3 w, vec3 hueColor) {
  return (hueColor - luma(hueColor)) * (1.5 * w.z);
}
void main() {
  vec4 src = texture(u_input, v_uv);
  vec3 lin = srgbToLinear(src.rgb);
  float ev = log2(max(luma(lin), 1e-7) / 0.18);
  float b1 = u_blackShadow;
  float b2 = max(u_shadowLight, b1);
  float b3 = max(u_lightHighlight, b2);
  float b4 = max(u_highlightSpecular, b3);
  float f = 0.5 * u_zoneFalloff;
  float s1 = smoothstep(b1 - f, b1 + f, ev);
  float s2 = smoothstep(b2 - f, b2 + f, ev);
  float s3 = smoothstep(b3 - f, b3 + f, ev);
  float s4 = smoothstep(b4 - f, b4 + f, ev);
  float wB = 1.0 - s1, wS = s1 - s2, wL = s2 - s3, wH = s3 - s4, wP = s4;
  if (u_showZones) {
    vec3 zc = wB * vec3(0.16, 0.1, 0.45) + wS * vec3(0.15, 0.45, 1.0) + wL * vec3(0.25, 0.85, 0.35)
            + wH * vec3(1.0, 0.82, 0.2) + wP * vec3(1.0, 0.3, 0.25);
    fragColor = vec4(zc * (0.55 + 0.45 * saturate(luma(src.rgb))), src.a);
    return;
  }
  float stops = u_globalExposure + ${sumOf('Exposure')};
  vec3 tint = tintStops(u_globalTint, u_globalTintColor) + ${tintSum};
  float sat = u_globalSaturation * (${sumOf('Saturation')});
  vec3 g = lin * exp2(stops + tint);
  float gy = luma(g);
  g = max(gy + (g - gy) * sat, 0.0);
  fragColor = vec4(mix(src.rgb, linearToSrgb(g), u_strength), src.a);
}`,
  },
};
