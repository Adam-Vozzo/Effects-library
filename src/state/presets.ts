// Presets (saved layer stacks) and favorite effects, persisted in localStorage.

import type { BlendMode, Layer, ParamValues } from '../engine/types';
import { BUILTIN_PRESETS } from '../presets/builtin';

export interface PresetLayer {
  effectId: string;
  params: ParamValues;
  visible?: boolean;
  opacity?: number;
  blend?: BlendMode;
  name?: string;
}

export interface Preset {
  id: string;
  name: string;
  layers: PresetLayer[];
  builtin?: boolean;
  created?: number;
}

const PRESETS_KEY = 'fxlib.presets.v1';
const FAV_KEY = 'fxlib.favorites.v1';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // Storage full or blocked: presets just won't persist.
  }
}

type Listener = () => void;

export class Library {
  private user: Preset[] = load<Preset[]>(PRESETS_KEY, []);
  private favs = new Set<string>(load<string[]>(FAV_KEY, []));
  private listeners = new Set<Listener>();

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const f of this.listeners) f();
  }

  get presets(): Preset[] {
    return [...this.user.slice().reverse(), ...BUILTIN_PRESETS.map((p) => ({ ...p, builtin: true }))];
  }

  get userPresets(): Preset[] {
    return this.user;
  }

  savePreset(name: string, layers: Layer[]): Preset {
    const p: Preset = {
      id: 'u' + Date.now().toString(36),
      name: name.trim() || 'Untitled preset',
      created: Date.now(),
      layers: layers.map((l) => ({ effectId: l.effectId, params: l.params, visible: l.visible, opacity: l.opacity, blend: l.blend, name: l.name })),
    };
    this.user.push(p);
    save(PRESETS_KEY, this.user);
    this.emit();
    return p;
  }

  renamePreset(id: string, name: string): void {
    const p = this.user.find((x) => x.id === id);
    if (!p) return;
    p.name = name;
    save(PRESETS_KEY, this.user);
    this.emit();
  }

  deletePreset(id: string): void {
    this.user = this.user.filter((p) => p.id !== id);
    save(PRESETS_KEY, this.user);
    this.emit();
  }

  importPresets(list: Preset[]): number {
    let n = 0;
    for (const p of list) {
      if (!p || !Array.isArray(p.layers) || !p.layers.length) continue;
      this.user.push({ id: 'u' + Date.now().toString(36) + n, name: String(p.name || 'Imported preset'), layers: p.layers, created: Date.now() });
      n++;
    }
    save(PRESETS_KEY, this.user);
    this.emit();
    return n;
  }

  isFavorite(effectId: string): boolean {
    return this.favs.has(effectId);
  }

  toggleFavorite(effectId: string): void {
    if (this.favs.has(effectId)) this.favs.delete(effectId);
    else this.favs.add(effectId);
    save(FAV_KEY, [...this.favs]);
    this.emit();
  }

  get favorites(): string[] {
    return [...this.favs];
  }
}

export function presetToLayers(p: Preset): Omit<Layer, 'id'>[] {
  return p.layers.map((l) => ({
    effectId: l.effectId,
    params: l.params,
    visible: l.visible ?? true,
    opacity: l.opacity ?? 1,
    blend: l.blend ?? 'normal',
    name: l.name,
  }));
}
