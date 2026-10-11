// Crop panel (replaces the controls panel while cropping).

import type { Crop } from '../engine/types';
import type { Store } from '../state/store';
import { h } from './dom';
import { icon } from './icons';
import { sliderControl, type Control } from './controls/basic';
import type { Stage } from './stage';

const RATIOS: { label: string; value: number | 'original' | null }[] = [
  { label: 'Free', value: null },
  { label: 'Original', value: 'original' },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '5:4', value: 5 / 4 },
  { label: '3:4', value: 3 / 4 },
  { label: '4:3', value: 4 / 3 },
  { label: '2:3', value: 2 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '9:16', value: 9 / 16 },
  { label: '16:9', value: 16 / 9 },
  { label: '21:9', value: 21 / 9 },
];

export class CropPanel {
  readonly el: HTMLElement;
  private size: HTMLElement;
  private ratioButtons: HTMLButtonElement[] = [];
  private ratio: number | 'original' | null = null;
  private rotation: Control;

  constructor(
    private store: Store,
    private stage: Stage,
  ) {
    this.size = h('div', { class: 'crop-panel__size' });
    const grid = h('div', { class: 'crop-panel__ratios' });
    for (const r of RATIOS) {
      const b = h('button', { class: 'chip', type: 'button', onclick: () => this.setRatio(r.value) }, r.label) as HTMLButtonElement;
      this.ratioButtons.push(b);
      grid.append(b);
    }
    this.rotation = sliderControl(
      { type: 'float', key: 'rotation', label: 'rotation', min: -45, max: 45, step: 0.1, default: 0, unit: '°' },
      0,
      {
        set: (v, opts) => {
          this.patch({ rotation: Number(v) }, 'crop-rot');
          if (opts?.commit) store.commit();
        },
        reset: () => this.patch({ rotation: 0 }),
      },
    );
    const flips = h(
      'div',
      { class: 'crop-panel__row' },
      h('button', { class: 'button button--small', type: 'button', onclick: () => this.patch({ flipX: !this.crop.flipX }) }, icon('flipH', 16), 'Flip H'),
      h('button', { class: 'button button--small', type: 'button', onclick: () => this.patch({ flipY: !this.crop.flipY }) }, icon('flipV', 16), 'Flip V'),
    );
    const actions = h(
      'div',
      { class: 'crop-panel__row' },
      h('button', { class: 'button button--small', type: 'button', onclick: () => this.reset() }, icon('reset', 16), 'Reset'),
      h('button', { class: 'button button--primary button--small', type: 'button', onclick: () => store.set({ mode: 'effect' }) }, icon('check', 16), 'Done'),
    );
    this.el = h(
      'aside',
      { class: 'panel panel--controls panel--crop', attrs: { 'aria-label': 'Crop' } },
      h('div', { class: 'panel__header' }, h('span', { class: 'panel__title' }, 'Crop')),
      h(
        'div',
        { class: 'panel__scroll params' },
        h('div', { class: 'param' }, h('div', { class: 'param__header' }, h('label', { class: 'param__title' }, 'Size')), this.size),
        h('div', { class: 'param' }, h('div', { class: 'param__header' }, h('label', { class: 'param__title' }, 'Aspect ratio')), grid),
        this.rotation.el,
        flips,
        actions,
        h('p', { class: 'param__hint crop-panel__hint' }, 'Drag the frame or its handles on the canvas. Effects are hidden while cropping.'),
      ),
    );
    store.subscribe((s, prev) => {
      if (s.project.crop !== prev.project.crop || s.source !== prev.source || s.mode !== prev.mode) this.sync();
    });
    this.sync();
  }

  private get crop(): Crop {
    return this.store.state.project.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  }

  private patch(p: Partial<Crop>, coalesce?: string): void {
    this.store.setCrop({ ...this.crop, ...p }, coalesce);
  }

  private reset(): void {
    this.ratio = null;
    this.stage.cropAspect = null;
    this.store.setCrop(null);
  }

  private setRatio(r: number | 'original' | null): void {
    this.ratio = r;
    const src = this.store.state.source;
    if (!src) return;
    const aspect = r === 'original' ? src.width / src.height : r;
    this.stage.cropAspect = aspect;
    if (aspect) {
      // Largest rect of that aspect centered on the current crop.
      const c = this.crop;
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      const a = aspect * (src.height / src.width); // normalized w/h
      let w = 1;
      let hh = w / a;
      if (hh > 1) {
        hh = 1;
        w = a;
      }
      const x = Math.min(1 - w, Math.max(0, cx - w / 2));
      const y = Math.min(1 - hh, Math.max(0, cy - hh / 2));
      this.store.setCrop({ ...c, x, y, w, h: hh });
    }
    this.sync();
  }

  private sync(): void {
    const src = this.store.state.source;
    const c = this.crop;
    if (src) this.size.textContent = `${Math.round(c.w * src.width)} × ${Math.round(c.h * src.height)} px`;
    this.ratioButtons.forEach((b, i) => b.classList.toggle('is-active', RATIOS[i].value === this.ratio));
    this.rotation.update(c.rotation ?? 0);
  }
}
