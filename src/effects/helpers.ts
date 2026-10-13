// Compact builders for effect parameter definitions, plus shared param groups and GLSL snippets.

import type {
  BoolParam,
  ColorParam,
  CurveParam,
  CurvePoint,
  EnumParam,
  FloatParam,
  GradientParam,
  GradientStop,
  ParamValues,
  RangeParam,
  Vec2Param,
  WheelParam,
  PaletteParam,
  TextureParam,
} from '../engine/types';
import { BLEND_GROUPS, BLEND_LABELS, BLEND_MODES } from '../engine/types';

type Extra<T> = Partial<Omit<T, 'type' | 'key' | 'label' | 'default'>>;

export function float(key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Extra<FloatParam> = {}): FloatParam {
  return { type: 'float', key, label, min, max, step, default: def, ...extra };
}

export function int(key: string, label: string, min: number, max: number, def: number, extra: Extra<FloatParam> = {}): FloatParam {
  return { type: 'int', key, label, min, max, step: 1, default: def, ...extra };
}

export function angle(key: string, label: string, min: number, max: number, def: number, extra: Extra<FloatParam> = {}): FloatParam {
  return { type: 'float', key, label, min, max, step: 1, default: def, unit: '°', ...extra };
}

export function bool(key: string, label: string, def: boolean, extra: Extra<BoolParam> = {}): BoolParam {
  return { type: 'bool', key, label, default: def, ...extra };
}

export function color(key: string, label: string, def: string, extra: Extra<ColorParam> = {}): ColorParam {
  return { type: 'color', key, label, default: def, ...extra };
}

export function choice(key: string, label: string, options: string[], def = 0, ui: EnumParam['ui'] = 'slider', extra: Extra<EnumParam> = {}): EnumParam {
  return { type: 'enum', key, label, options, default: def, ui, ...extra };
}

export function point(key: string, label: string, def: [number, number], extra: Extra<Vec2Param> = {}): Vec2Param {
  return { type: 'vec2', key, label, default: def, min: [-1, -1], max: [1, 1], step: 0.01, ...extra };
}

export function range(key: string, label: string, min: number, max: number, def: [number, number], step = 0.01, extra: Extra<RangeParam> = {}): RangeParam {
  return { type: 'range', key, label, min, max, step, default: def, ...extra };
}

export function curve(key: string, label: string, def: CurvePoint[] = [[0, 0], [1, 1]], extra: Extra<CurveParam> = {}): CurveParam {
  return { type: 'curve', key, label, default: def, ...extra };
}

export function gradient(key: string, label: string, def: GradientStop[], extra: Extra<GradientParam> = {}): GradientParam {
  return { type: 'gradient', key, label, default: def, ...extra };
}

export function wheel(key: string, label: string, def: [number, number] = [0, 0], extra: Extra<WheelParam> = {}): WheelParam {
  return { type: 'wheel', key, label, default: def, ...extra };
}

export function palette(key: string, label: string, def: string[], extra: Extra<PaletteParam> = {}): PaletteParam {
  return { type: 'palette', key, label, default: def, ...extra };
}

export function texture(key: string, label: string, extra: Extra<TextureParam> = {}): TextureParam {
  return { type: 'texture', key, label, default: null, ...extra };
}

export const BLEND_OPTIONS = BLEND_MODES.map((m) => BLEND_LABELS[m]);

/** Blend mode dropdown; the shader receives the index matching blendMode() in the GLSL library. */
export function blendMode(key = 'blendMode', label = 'Blend mode', def = 0, extra: Extra<EnumParam> = {}): EnumParam {
  return { type: 'enum', key, label, options: BLEND_OPTIONS, default: def, ui: 'select', groups: BLEND_GROUPS, livePreview: true, ...extra };
}

export const num = (p: ParamValues, k: string): number => Number(p[k]);
export const flag = (p: ParamValues, k: string): boolean => !!p[k];

/**
 * Elliptical focus mask params (depth of field, masked motion blur, ...).
 * With `toggle` the group gets an enable checkbox and the other controls only show when enabled.
 */
export function maskParams(opts: { prefix?: string; group?: string; toggle?: boolean; labels?: 'mask' | 'plain' } = {}) {
  const pre = opts.prefix ?? 'mask';
  const g = opts.group;
  const L = (s: string) => (opts.labels === 'plain' ? s : `mask ${s}`);
  const vis = opts.toggle ? (p: ParamValues) => !!p[`${pre}Enable`] : undefined;
  const list = [
    ...(opts.toggle ? [bool(`${pre}Enable`, 'enable mask', false, { group: g })] : []),
    point(`${pre}Center`, opts.labels === 'plain' ? 'center' : L('center'), [0, 0], { group: g, visibleIf: vis }),
    float(`${pre}Radius`, opts.labels === 'plain' ? 'radius' : L('radius'), 0.01, 4, 0.35, 0.01, { group: g, visibleIf: vis }),
    float(`${pre}Stretch`, opts.labels === 'plain' ? 'aspect stretch' : L('aspect stretch'), 0, 5, 0, 0.05, { group: g, visibleIf: vis }),
    angle(`${pre}Rotation`, opts.labels === 'plain' ? 'mask rotation' : L('rotation'), -180, 180, 0, { group: g, visibleIf: vis }),
    float(`${pre}Falloff`, opts.labels === 'plain' ? 'falloff' : L('falloff'), 0.5, 6, 2, 0.1, { group: g, visibleIf: vis }),
    bool(`${pre}Invert`, 'invert mask', false, { group: g, visibleIf: vis }),
    bool(`${pre}Debug`, 'debug mask', false, { group: g, visibleIf: vis }),
  ];
  return list;
}

/** GLSL expression evaluating a maskParams() mask (1 = full effect) for the given prefix. */
export function maskGlsl(prefix = 'mask'): string {
  return `ellipseMask(v_uv, u_resolution, pointToUv(u_${prefix}Center), u_${prefix}Radius, u_${prefix}Falloff, u_${prefix}Stretch, u_${prefix}Rotation)`;
}
