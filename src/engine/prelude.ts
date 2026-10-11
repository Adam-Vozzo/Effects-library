import type { EffectDef, ParamDef } from './types';
import { GLSL_LIB } from './glsl/lib';

export const MAX_PALETTE = 32;

/** GLSL uniform declarations generated from an effect's params. */
export function paramUniforms(params: ParamDef[]): string {
  const out: string[] = [];
  for (const p of params) {
    const n = 'u_' + p.key;
    switch (p.type) {
      case 'float':
      case 'int':
        out.push(`uniform float ${n};`);
        break;
      case 'enum':
        out.push(`uniform int ${n};`);
        break;
      case 'bool':
        out.push(`uniform bool ${n};`);
        break;
      case 'color':
        out.push(`uniform vec3 ${n};`);
        break;
      case 'vec2':
      case 'range':
        out.push(`uniform vec2 ${n};`);
        break;
      case 'wheel':
        // xy = hue (radians as unit vector * amount), z = amount; plus pure hue color.
        out.push(`uniform vec3 ${n};`, `uniform vec3 ${n}Color;`);
        break;
      case 'curve':
      case 'gradient':
        out.push(`uniform sampler2D ${n};`);
        break;
      case 'palette':
        out.push(`uniform vec3 ${n}[${MAX_PALETTE}];`, `uniform int ${n}Count;`);
        break;
      case 'texture':
        out.push(`uniform sampler2D ${n};`, `uniform bool ${n}Loaded;`, `uniform vec2 ${n}Size;`);
        break;
      case 'patterns':
        out.push(`uniform sampler2D ${n};`, `uniform int ${n}Count;`);
        break;
      case 'text':
      case 'font':
        break;
    }
  }
  return out.join('\n');
}

export function buildFragment(effect: Pick<EffectDef, 'params'>, body: string): string {
  return `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_input;
uniform sampler2D u_original;
uniform vec2 u_resolution;
uniform float u_pxScale;
uniform float u_time;
${paramUniforms(effect.params)}
${GLSL_LIB}
vec4 sampleInput(vec2 uv) { return texture(u_input, uv); }
vec2 texel() { return 1.0 / u_resolution; }
#line 1
${body}
`;
}
