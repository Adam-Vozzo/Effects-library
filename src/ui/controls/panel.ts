// Right-hand controls panel: parameter editors for the selected layer.

import type { EffectDef, Layer, ParamDef, ParamValue, ParamValues } from '../../engine/types';
import { BLEND_LABELS, BLEND_MODES } from '../../engine/types';
import { cloneValue, defaultParams, getEffect } from '../../effects/registry';
import type { Store } from '../../state/store';
import type { AssetStore } from '../../state/assets';
import { clear, h } from '../dom';
import { icon } from '../icons';
import {
  colorControl,
  enumSliderControl,
  rangeControl,
  selectControl,
  sliderControl,
  switcherControl,
  textControl,
  toggleControl,
  type Control,
  type ControlHost,
} from './basic';
import { curveControl, gradientControl, paletteControl, patternsControl, planeControl, wheelControl } from './editors';
import { fontControl, textureControl } from './media';
import { randomizeParams } from './randomize';

interface Mounted {
  def: ParamDef;
  ctl: Control;
}

export class ControlsPanel {
  readonly el: HTMLElement;
  private title: HTMLElement;
  private body: HTMLElement;
  private mounted: Mounted[] = [];
  private layerId: string | null = null;
  private effectId: string | null = null;
  private layerSection: { opacity: Control; blend: Control } | null = null;
  private lastParams: ParamValues | null = null;

  constructor(
    private store: Store,
    private assets: AssetStore,
    private aspect: () => number,
  ) {
    this.title = h('span', { class: 'panel__title' }, 'Controls');
    const randomBtn = h('button', { class: 'icon-button', type: 'button', title: 'Randomize', onclick: () => this.randomize() }, icon('shuffle', 18));
    const resetBtn = h('button', { class: 'icon-button', type: 'button', title: 'Reset to defaults', onclick: () => this.resetAll() }, icon('reset', 18));
    this.body = h('div', { class: 'panel__scroll params' });
    this.el = h('aside', { class: 'panel panel--controls', attrs: { 'aria-label': 'Controls' } }, h('div', { class: 'panel__header' }, this.title, h('div', { class: 'panel__actions' }, randomBtn, resetBtn)), this.body);
    store.subscribe((s, prev) => {
      if (s.mode !== 'effect') return;
      if (s.selectedLayerId !== prev.selectedLayerId || s.project !== prev.project || s.mode !== prev.mode) this.sync();
    });
    assets.onChange(() => this.refreshValues(true));
    this.sync();
  }

  private get layer(): Layer | null {
    return this.store.selectedLayer;
  }

  sync(): void {
    const layer = this.layer;
    const effect = layer ? getEffect(layer.effectId) : undefined;
    if (!layer || !effect) {
      this.layerId = null;
      this.effectId = null;
      this.mounted = [];
      this.layerSection = null;
      this.title.textContent = 'Controls';
      clear(this.body);
      this.body.append(
        h('div', { class: 'empty' }, h('p', null, 'Select a layer to edit its controls,'), h('p', null, 'or pick an effect from the library to add one.')),
      );
      return;
    }
    if (layer.id !== this.layerId || effect.id !== this.effectId) {
      this.build(layer, effect);
    } else {
      this.refreshValues();
    }
  }

  private host(layerId: string, def: ParamDef): ControlHost {
    return {
      set: (v, opts) => {
        this.store.setParam(layerId, def.key, v);
        if (opts?.commit) this.store.commit();
      },
      reset: () => {
        this.store.setParam(layerId, def.key, cloneValue(def.default as ParamValue), false);
        this.store.commit();
      },
    };
  }

  private build(layer: Layer, effect: EffectDef): void {
    this.layerId = layer.id;
    this.effectId = effect.id;
    this.title.textContent = layer.name || effect.name;
    clear(this.body);
    this.mounted = [];
    let groupEl: HTMLElement | null = null;
    let groupName: string | undefined;
    for (const def of effect.params) {
      const ctl = this.createControl(def, layer.params[def.key] ?? (def.default as ParamValue), this.host(layer.id, def));
      if (!ctl) continue;
      if (def.hint && !ctl.el.title && !(def.type === 'int' && ctl.el.querySelector('.param__value-name'))) ctl.el.title = def.hint;
      this.mounted.push({ def, ctl });
      if (def.group !== groupName) {
        groupName = def.group;
        if (def.group) {
          const details = h('details', { class: 'param-group', open: true }, h('summary', { class: 'param-group__summary' }, icon('chevronRight', 14, 'param-group__chevron'), def.group));
          groupEl = h('div', { class: 'param-group__controls' });
          details.append(groupEl);
          this.body.append(details);
        } else groupEl = null;
      }
      (groupEl ?? this.body).append(ctl.el);
    }
    // Per-layer compositing (applies on top of the effect's own params).
    const opacityHost: ControlHost = {
      set: (v, opts) => {
        this.store.patchLayer(layer.id, { opacity: Number(v) }, 'opacity:' + layer.id);
        if (opts?.commit) this.store.commit();
      },
      reset: () => this.store.patchLayer(layer.id, { opacity: 1 }),
    };
    const blendHost: ControlHost = {
      set: (v) => this.store.patchLayer(layer.id, { blend: BLEND_MODES[Number(v)] ?? 'normal' }),
      reset: () => this.store.patchLayer(layer.id, { blend: 'normal' }),
    };
    const opacity = sliderControl({ type: 'float', key: '_opacity', label: 'layer opacity', min: 0, max: 1, step: 0.01, default: 1 }, layer.opacity, opacityHost);
    const blend = selectControl(
      { type: 'enum', key: '_blend', label: 'layer blend', options: BLEND_MODES.map((m) => BLEND_LABELS[m]), default: 0, ui: 'select' },
      Math.max(0, BLEND_MODES.indexOf(layer.blend)),
      blendHost,
    );
    this.layerSection = { opacity, blend };
    const layerGroup = h('details', { class: 'param-group param-group--layer' }, h('summary', { class: 'param-group__summary' }, icon('chevronRight', 14, 'param-group__chevron'), 'Layer'), h('div', { class: 'param-group__controls' }, opacity.el, blend.el));
    if (layer.opacity < 1 || layer.blend !== 'normal') layerGroup.open = true;
    this.body.append(layerGroup);
    this.lastParams = layer.params;
    this.applyVisibility(layer.params);
  }

  private refreshValues(force = false): void {
    const layer = this.layer;
    if (!layer) return;
    this.title.textContent = layer.name || getEffect(layer.effectId)?.name || 'Controls';
    if (force || layer.params !== this.lastParams) {
      for (const m of this.mounted) {
        const v = layer.params[m.def.key];
        if (force || v !== this.lastParams?.[m.def.key]) m.ctl.update(v ?? (m.def.default as ParamValue));
      }
      this.lastParams = layer.params;
      this.applyVisibility(layer.params);
    }
    if (this.layerSection) {
      this.layerSection.opacity.update(layer.opacity);
      this.layerSection.blend.update(Math.max(0, BLEND_MODES.indexOf(layer.blend)));
    }
  }

  private applyVisibility(p: ParamValues): void {
    for (const m of this.mounted) {
      const vis = m.def.visibleIf ? m.def.visibleIf(p) : true;
      m.ctl.el.hidden = !vis;
    }
  }

  private createControl(def: ParamDef, value: ParamValue, host: ControlHost): Control | null {
    switch (def.type) {
      case 'float':
      case 'int':
        return sliderControl(def, Number(value), host);
      case 'enum':
        if (def.ui === 'switcher') return switcherControl(def, Number(value), host);
        if (def.ui === 'select') return selectControl(def, Number(value), host);
        return enumSliderControl(def, Number(value), host);
      case 'bool':
        return toggleControl(def, !!value, host);
      case 'color':
        return colorControl(def, String(value), host);
      case 'vec2':
        return planeControl(def, value as [number, number], host, this.aspect);
      case 'range':
        return rangeControl(def, value as [number, number], host);
      case 'curve':
        return curveControl(def, value as [number, number][], host);
      case 'gradient':
        return gradientControl(def, value as never, host);
      case 'wheel':
        return wheelControl(def, value as [number, number], host);
      case 'palette':
        return paletteControl(def, value as string[], host);
      case 'texture':
        return textureControl(def, value, host, this.assets);
      case 'text':
        return textControl(def, String(value ?? ''), host);
      case 'font':
        return fontControl(def, String(value), host);
      case 'patterns':
        return patternsControl(def, value as string[], host);
      default:
        return null;
    }
  }

  randomize(): void {
    const layer = this.layer;
    const effect = layer ? getEffect(layer.effectId) : undefined;
    if (!layer || !effect) return;
    this.store.setParams(layer.id, randomizeParams(effect, layer.params));
  }

  resetAll(): void {
    const layer = this.layer;
    const effect = layer ? getEffect(layer.effectId) : undefined;
    if (!layer || !effect) return;
    this.store.setParams(layer.id, defaultParams(effect));
  }
}
