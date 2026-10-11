import type { EffectDef, ParamDef, ParamValue, ParamValues } from '../engine/types';

const effects = new Map<string, EffectDef>();
/** Old ids (e.g. effect.app filenames like "radial-blur-v2") mapped to current ids. */
const aliases = new Map<string, string>();

/** Invalid definitions are reported and skipped so one broken effect can't take down the app. */
export const registrationErrors: string[] = [];

export function registerEffects(defs: EffectDef[]): void {
  for (const d of defs) {
    try {
      if (!d || !d.id) throw new Error('Effect without id');
      if (effects.has(d.id)) throw new Error('Duplicate effect id ' + d.id);
      validateEffect(d);
      effects.set(d.id, d);
    } catch (e) {
      const msg = `Effect registration failed: ${(e as Error).message}`;
      registrationErrors.push(msg);
      console.error(msg);
    }
  }
}

export function registerAlias(from: string, to: string): void {
  aliases.set(from, to);
}

export function getEffect(id: string): EffectDef | undefined {
  return effects.get(id) ?? effects.get(aliases.get(id) ?? '');
}

export function allEffects(): EffectDef[] {
  return [...effects.values()];
}

export function cloneValue<T extends ParamValue>(v: T): T {
  if (v === null || typeof v !== 'object') return v;
  return JSON.parse(JSON.stringify(v)) as T;
}

export function defaultParams(effect: EffectDef): ParamValues {
  const p: ParamValues = {};
  for (const d of effect.params) p[d.key] = cloneValue(d.default as ParamValue);
  return p;
}

/** Fill in missing params (e.g. presets saved before a param existed) and drop unknown ones. */
export function normalizeParams(effect: EffectDef, params: ParamValues | undefined): ParamValues {
  const out = defaultParams(effect);
  if (!params) return out;
  for (const d of effect.params) {
    if (d.key in params && params[d.key] !== undefined) out[d.key] = coerce(d, params[d.key]);
  }
  return out;
}

function coerce(d: ParamDef, v: ParamValue): ParamValue {
  switch (d.type) {
    case 'float':
    case 'int':
    case 'enum': {
      const n = Number(v);
      if (!Number.isFinite(n)) return d.default;
      if (d.type === 'enum') return Math.max(0, Math.min(d.options.length - 1, Math.round(n)));
      return n;
    }
    case 'bool':
      return !!v;
    default:
      return cloneValue(v);
  }
}

function validateEffect(d: EffectDef): void {
  if (!d.shaders || (!d.render && !d.shaders.main)) throw new Error(`Effect ${d.id} needs shaders.main or render()`);
  const keys = new Set<string>();
  for (const p of d.params) {
    if (keys.has(p.key)) throw new Error(`Effect ${d.id}: duplicate param ${p.key}`);
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(p.key)) throw new Error(`Effect ${d.id}: invalid param key ${p.key}`);
    keys.add(p.key);
  }
}
