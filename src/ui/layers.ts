// Layers panel: source media + effect stack (top of the list = applied last).

import { allEffects, getEffect } from '../effects/registry';
import type { Layer } from '../engine/types';
import type { Store } from '../state/store';
import { clear, h } from './dom';
import { icon } from './icons';
import { openMenu, prompt } from './menu';

export interface MediaActions {
  upload(): void;
  random(): void;
  fromUrl(): void;
  sample(name: string): void;
  savePreset(): void;
}

export const SAMPLES = ['portrait', 'coffee', 'bokeh', 'grapes', 'street'];

export class LayersPanel {
  readonly el: HTMLElement;
  private list: HTMLOListElement;
  private media: HTMLElement;
  private renderedProject: unknown = null;
  private renderedSel: string | null = null;

  constructor(
    private store: Store,
    private actions: MediaActions,
  ) {
    const addBtn = h('button', { class: 'button button--primary button--small', type: 'button', onclick: (e: Event) => this.openAddMenu(e.currentTarget as HTMLElement) }, icon('plus', 14), 'Add');
    const presetBtn = h('button', { class: 'icon-button', type: 'button', title: 'Save stack as preset', onclick: () => actions.savePreset() }, icon('bookmark', 18));
    this.media = h('div', { class: 'media' });
    this.list = h('ol', { class: 'layers', attrs: { 'aria-label': 'Layer stack' } });
    this.el = h(
      'aside',
      { class: 'panel panel--layers', attrs: { 'aria-label': 'Layers' } },
      h('div', { class: 'panel__header' }, h('span', { class: 'panel__title' }, 'Layers'), h('div', { class: 'panel__actions' }, presetBtn, addBtn)),
      this.media,
      h('div', { class: 'panel__scroll' }, this.list),
    );
    store.subscribe((s, prev) => {
      if (s.source !== prev.source) this.renderMedia();
      if (s.project !== this.renderedProject || s.selectedLayerId !== this.renderedSel) this.renderList();
    });
    this.renderMedia();
    this.renderList();
  }

  private renderMedia(): void {
    clear(this.media);
    const src = this.store.state.source;
    const samples = h('button', {
      class: 'icon-button',
      type: 'button',
      title: 'Sample images',
      onclick: (e: Event) => openMenu(e.currentTarget as HTMLElement, SAMPLES.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), action: () => this.actions.sample(s) }))),
    }, icon('image', 18));
    const buttons = h(
      'div',
      { class: 'media__buttons' },
      h('button', { class: 'media__upload', type: 'button', onclick: () => this.actions.upload() }, icon('upload', 18), h('span', null, 'Upload')),
      h('div', { class: 'media__actions' },
        h('button', { class: 'icon-button', type: 'button', title: 'Random image (picsum.photos)', onclick: () => this.actions.random() }, icon('dice', 18)),
        h('button', { class: 'icon-button', type: 'button', title: 'Add from URL', onclick: () => this.actions.fromUrl() }, icon('link', 18)),
        samples,
      ),
    );
    if (src) {
      const img = h('img', { class: 'media__img', src: src.url, alt: src.name, draggable: false });
      const meta = h('div', { class: 'media__meta' }, h('span', { class: 'media__name', title: src.name }, src.name), h('span', { class: 'media__size' }, `${src.width} × ${src.height}`));
      this.media.append(h('div', { class: 'media__preview' }, img, buttons), meta);
    } else {
      this.media.append(h('div', { class: 'media__preview media__preview--empty' }, buttons));
    }
  }

  private renderList(): void {
    const { project, selectedLayerId } = this.store.state;
    this.renderedProject = project;
    this.renderedSel = selectedLayerId;
    clear(this.list);
    const layers = [...project.layers].reverse();
    if (!layers.length) {
      this.list.append(h('li', { class: 'layers__empty' }, 'No effects yet. Pick one from the library or press Add.'));
      return;
    }
    for (const layer of layers) this.list.append(this.row(layer, layer.id === selectedLayerId));
  }

  private row(layer: Layer, active: boolean): HTMLElement {
    const effect = getEffect(layer.effectId);
    const name = layer.name || effect?.name || layer.effectId;
    const eye = h(
      'button',
      {
        class: ['icon-button icon-button--tiny layers__eye', !layer.visible && 'is-off'],
        type: 'button',
        title: layer.visible ? 'Hide layer' : 'Show layer',
        onclick: (e: Event) => {
          e.stopPropagation();
          this.store.patchLayer(layer.id, { visible: !layer.visible });
        },
      },
      icon(layer.visible ? 'eye' : 'eyeOff', 16),
    );
    const del = h(
      'button',
      {
        class: 'icon-button icon-button--tiny layers__del',
        type: 'button',
        title: 'Delete layer',
        onclick: (e: Event) => {
          e.stopPropagation();
          this.store.removeLayer(layer.id);
        },
      },
      icon('trash', 16),
    );
    const handle = h('span', { class: 'layers__grip', title: 'Drag to reorder' }, icon('grip', 14));
    const li = h(
      'li',
      {
        class: ['layers__item', active && 'is-active', !layer.visible && 'is-hidden', !effect && 'is-missing'],
        tabIndex: 0,
        dataset: { id: layer.id },
        onclick: () => this.store.set({ selectedLayerId: layer.id, mode: 'effect' }),
        ondblclick: () => this.rename(layer),
        oncontextmenu: (e: MouseEvent) => {
          e.preventDefault();
          this.contextMenu(layer, { x: e.clientX, y: e.clientY });
        },
        onkeydown: (e: KeyboardEvent) => {
          if (e.key === 'Enter') this.store.set({ selectedLayerId: layer.id, mode: 'effect' });
        },
      },
      handle,
      h('span', { class: 'layers__name' }, name, layer.opacity < 1 || layer.blend !== 'normal' ? h('span', { class: 'layers__badge' }, `${Math.round(layer.opacity * 100)}%`) : null),
      h('span', { class: 'layers__trail' }, del, eye),
    );
    this.dragSort(li, handle, layer);
    return li;
  }

  private dragSort(li: HTMLElement, handle: HTMLElement, layer: Layer): void {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const items = [...this.list.querySelectorAll<HTMLElement>('.layers__item')];
      const rects = items.map((it) => it.getBoundingClientRect());
      const startY = e.clientY;
      const from = items.indexOf(li);
      let to = from;
      li.classList.add('is-dragging');
      handle.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const dy = ev.clientY - startY;
        li.style.transform = `translateY(${dy}px)`;
        const y = rects[from].top + rects[from].height / 2 + dy;
        to = rects.findIndex((r) => y < r.bottom);
        if (to < 0) to = items.length - 1;
        items.forEach((it, i) => {
          if (it === li) return;
          const shift = from < to ? (i > from && i <= to ? -rects[from].height : 0) : i >= to && i < from ? rects[from].height : 0;
          it.style.transform = shift ? `translateY(${shift}px)` : '';
        });
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        items.forEach((it) => (it.style.transform = ''));
        li.classList.remove('is-dragging');
        if (to !== from) {
          // Displayed list is reversed relative to the stack array.
          const n = items.length;
          this.store.moveLayer(layer.id, n - 1 - to);
        }
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  }

  private async rename(layer: Layer): Promise<void> {
    const effect = getEffect(layer.effectId);
    const n = await prompt('Rename layer', 'Name', layer.name || effect?.name || '', 'Rename');
    if (n !== null) this.store.patchLayer(layer.id, { name: n.trim() || undefined });
  }

  private contextMenu(layer: Layer, at: { x: number; y: number }): void {
    const layers = this.store.state.project.layers;
    const i = layers.findIndex((l) => l.id === layer.id);
    openMenu(at, [
      { label: 'Duplicate', shortcut: 'Ctrl+D', action: () => this.store.duplicateLayer(layer.id) },
      { label: 'Rename…', action: () => this.rename(layer) },
      { label: layer.visible ? 'Hide' : 'Show', action: () => this.store.patchLayer(layer.id, { visible: !layer.visible }) },
      { separator: true },
      { label: 'Move up', disabled: i >= layers.length - 1, action: () => this.store.moveLayer(layer.id, i + 1) },
      { label: 'Move down', disabled: i <= 0, action: () => this.store.moveLayer(layer.id, i - 1) },
      { separator: true },
      { label: 'Delete', shortcut: 'Del', action: () => this.store.removeLayer(layer.id) },
    ]);
  }

  /** Quick "Add effect" picker grouped by category. */
  private openAddMenu(anchor: HTMLElement): void {
    const effects = allEffects().filter((e) => !e.hidden);
    const items = [];
    let cat = '';
    for (const e of effects) {
      if (e.category !== cat) {
        cat = e.category;
        items.push({ label: cat, heading: true });
      }
      items.push({ label: e.name, action: () => this.store.addLayer(e.id) });
    }
    const menu = openMenu(anchor, items);
    menu.classList.add('menu--tall');
  }
}
