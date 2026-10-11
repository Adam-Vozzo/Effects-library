// Randomize an effect's parameters within sensible ranges (keeps texture/text/font params).

import type { EffectDef, GradientStop, ParamValues } from '../../engine/types';
import { rgbToHex } from '../../engine/luts';

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function randomColor(): string {
  const hue = Math.random();
  const s = rand(0.35, 1);
  const l = rand(0.25, 0.8);
  const k = (n: number) => (n + hue * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0), f(8), f(4));
}

export function randomizeParams(effect: EffectDef, current: ParamValues): ParamValues {
  const out: ParamValues = { ...current };
  for (const p of effect.params) {
    if (p.noRandom) continue;
    switch (p.type) {
      case 'float':
      case 'int': {
        const [lo, hi] = p.randomRange ?? [p.min, p.max];
        // Bias toward the default so results stay usable.
        const def = p.default;
        let v = Math.random() < 0.5 ? rand(lo, hi) : def + (rand(lo, hi) - def) * rand(0.15, 0.6);
        const step = p.step ?? (p.type === 'int' ? 1 : 0.01);
        v = Math.round(v / step) * step;
        out[p.key] = Math.min(p.max, Math.max(p.min, parseFloat(v.toFixed(5))));
        break;
      }
      case 'enum':
        if (p.ui !== 'select' || Math.random() < 0.3) out[p.key] = Math.floor(Math.random() * p.options.length);
        break;
      case 'bool':
        if (Math.random() < 0.3) out[p.key] = !current[p.key];
        break;
      case 'color':
        out[p.key] = randomColor();
        break;
      case 'vec2': {
        const mn = p.min ?? [-1, -1];
        const mx = p.max ?? [1, 1];
        out[p.key] = [parseFloat(rand(mn[0] * 0.6, mx[0] * 0.6).toFixed(3)), parseFloat(rand(mn[1] * 0.6, mx[1] * 0.6).toFixed(3))];
        break;
      }
      case 'wheel':
        out[p.key] = [Math.round(rand(0, 360)), parseFloat(rand(0, 0.5).toFixed(2))];
        break;
      case 'gradient': {
        const n = 2 + Math.floor(Math.random() * 3);
        const stops: GradientStop[] = [];
        for (let i = 0; i < n; i++) stops.push({ pos: i / (n - 1), color: randomColor(), mid: 0.5 });
        out[p.key] = stops;
        break;
      }
      case 'palette': {
        const n = Math.max(2, (current[p.key] as string[] | undefined)?.length ?? 4);
        out[p.key] = Array.from({ length: n }, randomColor);
        break;
      }
      default:
        break;
    }
  }
  return out;
}
