// Application state with immutable project updates and undo/redo history.

import type { BlendMode, Crop, Layer, ParamValue, ParamValues, Project } from '../engine/types';
import { defaultParams, getEffect, normalizeParams, cloneValue } from '../effects/registry';
import { uid } from '../ui/dom';

export type ExportFormat = 'png' | 'jpeg' | 'webp';
export type SizeMode = 'original' | 'scale' | 'long' | 'custom';

export interface ExportSettings {
  format: ExportFormat;
  quality: number; // 0..1 for jpeg/webp
  bitDepth: 8 | 16; // png only
  sizeMode: SizeMode;
  scale: number;
  longSide: number;
  customW: number;
  customH: number;
}

export interface SourceInfo {
  name: string;
  width: number;
  height: number;
  /** Object URL for the layers panel thumbnail. */
  url: string;
}

export interface AppState {
  project: Project;
  selectedLayerId: string | null;
  mode: 'effect' | 'crop';
  source: SourceInfo | null;
  export: ExportSettings;
  /** Max long side of the preview render, 0 = full resolution. */
  previewMax: number;
  playing: boolean;
  loop: boolean;
  duration: number;
  theme: 'dark' | 'day';
  compare: boolean;
  /** Transient look at another value (hovered dropdown option); applied to the preview render only. */
  preview: LayerPreview | null;
}

export interface LayerPreview {
  layerId: string;
  blend?: BlendMode;
  params?: ParamValues;
}

type Listener = (s: AppState, prev: AppState) => void;

const HISTORY_LIMIT = 200;

export class Store {
  private s: AppState;
  private listeners = new Set<Listener>();
  private undoStack: Project[] = [];
  private redoStack: Project[] = [];
  private coalesceKey: string | null = null;
  private coalesceTime = 0;

  constructor(initial: AppState) {
    this.s = initial;
  }

  get state(): AppState {
    return this.s;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  set(patch: Partial<AppState>): void {
    const prev = this.s;
    this.s = { ...prev, ...patch };
    for (const l of this.listeners) l(this.s, prev);
  }

  /**
   * Update the project, recording undo history. Updates sharing a `coalesce` key within 1.5s
   * (e.g. slider drags) collapse into one history step.
   */
  updateProject(fn: (p: Project) => Project, opts: { coalesce?: string; history?: boolean } = {}): void {
    const before = this.s.project;
    const after = fn(before);
    if (after === before) return;
    if (opts.history !== false) {
      const now = performance.now();
      const merge = opts.coalesce && opts.coalesce === this.coalesceKey && now - this.coalesceTime < 1500;
      if (!merge) {
        this.undoStack.push(before);
        if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
      }
      this.redoStack = [];
      this.coalesceKey = opts.coalesce ?? null;
      this.coalesceTime = now;
    }
    this.set({ project: after });
  }

  /** End the current coalescing run (call on pointerup / change). */
  commit(): void {
    this.coalesceKey = null;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): void {
    const p = this.undoStack.pop();
    if (!p) return;
    this.redoStack.push(this.s.project);
    this.coalesceKey = null;
    this.set({ project: p, selectedLayerId: this.keepSelection(p) });
  }

  redo(): void {
    const p = this.redoStack.pop();
    if (!p) return;
    this.undoStack.push(this.s.project);
    this.coalesceKey = null;
    this.set({ project: p, selectedLayerId: this.keepSelection(p) });
  }

  resetHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  private keepSelection(p: Project): string | null {
    const id = this.s.selectedLayerId;
    if (id && p.layers.some((l) => l.id === id)) return id;
    return p.layers.length ? p.layers[p.layers.length - 1].id : null;
  }

  // ------------------------------------------------------------ layer helpers

  get selectedLayer(): Layer | null {
    return this.s.project.layers.find((l) => l.id === this.s.selectedLayerId) ?? null;
  }

  /** Add an effect layer above the selected one (or on top). Layers apply bottom → top. */
  addLayer(effectId: string, params?: ParamValues, extra: Partial<Layer> = {}): Layer | null {
    const effect = getEffect(effectId);
    if (!effect) return null;
    const layer: Layer = {
      id: uid(),
      effectId: effect.id,
      params: params ? normalizeParams(effect, params) : defaultParams(effect),
      visible: true,
      opacity: 1,
      blend: 'normal',
      ...extra,
    };
    this.updateProject((p) => ({ ...p, layers: [...p.layers, layer] }));
    this.set({ selectedLayerId: layer.id, mode: 'effect' });
    return layer;
  }

  /** Replace the stack with a list of layers (presets). */
  setLayers(layers: Omit<Layer, 'id'>[], append = false): void {
    const fresh = layers
      .filter((l) => getEffect(l.effectId))
      .map((l) => ({ ...l, id: uid(), params: normalizeParams(getEffect(l.effectId)!, l.params) }));
    this.updateProject((p) => ({ ...p, layers: append ? [...p.layers, ...fresh] : fresh }));
    this.set({ selectedLayerId: fresh.length ? fresh[fresh.length - 1].id : null, mode: 'effect' });
  }

  removeLayer(id: string): void {
    const layers = this.s.project.layers;
    const i = layers.findIndex((l) => l.id === id);
    if (i < 0) return;
    this.updateProject((p) => ({ ...p, layers: p.layers.filter((l) => l.id !== id) }));
    if (this.s.selectedLayerId === id) {
      const rest = this.s.project.layers;
      const next = rest[Math.min(i, rest.length - 1)] ?? null;
      this.set({ selectedLayerId: next ? next.id : null });
    }
  }

  duplicateLayer(id: string): void {
    const layers = this.s.project.layers;
    const i = layers.findIndex((l) => l.id === id);
    if (i < 0) return;
    const copy: Layer = { ...layers[i], id: uid(), params: cloneValue(layers[i].params as unknown as ParamValue) as unknown as ParamValues };
    this.updateProject((p) => ({ ...p, layers: [...p.layers.slice(0, i + 1), copy, ...p.layers.slice(i + 1)] }));
    this.set({ selectedLayerId: copy.id });
  }

  moveLayer(id: string, toIndex: number): void {
    this.updateProject((p) => {
      const i = p.layers.findIndex((l) => l.id === id);
      if (i < 0) return p;
      const j = Math.max(0, Math.min(p.layers.length - 1, toIndex));
      if (i === j) return p;
      const arr = [...p.layers];
      const [l] = arr.splice(i, 1);
      arr.splice(j, 0, l);
      return { ...p, layers: arr };
    });
  }

  patchLayer(id: string, patch: Partial<Pick<Layer, 'visible' | 'opacity' | 'blend' | 'name'>>, coalesce?: string): void {
    this.updateProject((p) => ({ ...p, layers: p.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }), { coalesce });
  }

  setParam(id: string, key: string, value: ParamValue, coalesce = true): void {
    this.updateProject(
      (p) => ({
        ...p,
        layers: p.layers.map((l) => (l.id === id ? { ...l, params: { ...l.params, [key]: value } } : l)),
      }),
      { coalesce: coalesce ? `param:${id}:${key}` : undefined },
    );
  }

  setParams(id: string, params: ParamValues): void {
    this.updateProject((p) => ({ ...p, layers: p.layers.map((l) => (l.id === id ? { ...l, params } : l)) }));
  }

  setCrop(crop: Crop | null, coalesce?: string): void {
    this.updateProject((p) => ({ ...p, crop }), { coalesce });
  }

  setBlend(id: string, blend: BlendMode): void {
    this.patchLayer(id, { blend });
  }
}
