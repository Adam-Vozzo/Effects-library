// Center stage: the preview canvas with zoom/pan, crop overlay and the bottom toolbar.

import type { Crop } from '../engine/types';
import type { Store } from '../state/store';
import { clamp, h } from './dom';
import { icon } from './icons';
import { openMenu } from './menu';

export interface StageActions {
  openExport(anchor: HTMLElement): void;
  upload(): void;
  sample(name: string): void;
  loadFiles(files: FileList | File[]): void;
}

const ZOOM_STEPS = [0.05, 0.1, 0.125, 0.25, 1 / 3, 0.5, 2 / 3, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];

export class Stage {
  readonly el: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  private viewport: HTMLElement;
  private frame: HTMLElement;
  private zoomLabel: HTMLElement;
  private formatLabel: HTMLElement;
  private cropBtn: HTMLButtonElement;
  private cropOverlay: HTMLElement;
  private empty: HTMLElement;
  private busy: HTMLElement;
  /** 'fit' or image px → css px factor (1 = 100%, one image pixel per device pixel). */
  zoom: number | 'fit' = 'fit';
  private panX = 0;
  private panY = 0;
  /** Logical (cropped source) image size shown on stage. */
  private imgW = 0;
  private imgH = 0;
  /** Uncropped source size (crop overlay works in source space). */
  private srcW = 0;
  private srcH = 0;
  private spaceDown = false;

  constructor(
    private store: Store,
    private actions: StageActions,
  ) {
    this.canvas = h('canvas', { class: 'stage__canvas' }) as HTMLCanvasElement;
    this.cropOverlay = h('div', { class: 'crop', hidden: true });
    this.frame = h('div', { class: 'stage__frame' }, this.canvas, this.cropOverlay);
    this.empty = h(
      'div',
      { class: 'stage__empty' },
      h('p', { class: 'stage__empty-title' }, 'Drop an image here'),
      h('p', { class: 'stage__empty-sub' }, 'or'),
      h('div', { class: 'stage__empty-actions' },
        h('button', { class: 'button button--primary', type: 'button', onclick: () => actions.upload() }, icon('upload', 16), 'Upload image'),
        h('button', { class: 'button', type: 'button', onclick: () => actions.sample('portrait') }, icon('image', 16), 'Use a sample'),
      ),
    );
    this.busy = h('div', { class: 'stage__busy', hidden: true }, h('span', { class: 'spinner' }));
    this.viewport = h('div', { class: 'stage__viewport' }, this.frame, this.empty, this.busy);
    this.zoomLabel = h('span', null, 'Fit');
    this.formatLabel = h('span', null, 'PNG');
    const zoomBtn = h('button', { class: 'toolbar__button', type: 'button', title: 'Zoom', onclick: (e: Event) => this.zoomMenu(e.currentTarget as HTMLElement) }, this.zoomLabel, icon('chevronDown', 14));
    this.cropBtn = h('button', { class: 'toolbar__button toolbar__icon', type: 'button', title: 'Crop (C)', onclick: () => this.toggleCrop() }, icon('crop', 18)) as HTMLButtonElement;
    const compare = h('button', { class: 'toolbar__button toolbar__icon', type: 'button', title: 'Hold to compare with original (\\)' }, icon('compare', 18));
    compare.addEventListener('pointerdown', () => store.set({ compare: true }));
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) compare.addEventListener(ev, () => store.state.compare && store.set({ compare: false }));
    const formatBtn = h('button', {
      class: 'toolbar__button',
      type: 'button',
      title: 'Export format',
      onclick: (e: Event) =>
        openMenu(e.currentTarget as HTMLElement, (['png', 'jpeg', 'webp'] as const).map((f) => ({
          label: f === 'jpeg' ? 'JPG' : f.toUpperCase(),
          checked: store.state.export.format === f,
          action: () => store.set({ export: { ...store.state.export, format: f } }),
        })), { placement: 'above' }),
    }, this.formatLabel);
    const exportBtn = h('button', { class: 'toolbar__export', type: 'button', onclick: (e: Event) => actions.openExport(e.currentTarget as HTMLElement) }, 'Export');
    const toolbar = h('div', { class: 'toolbar' }, zoomBtn, h('span', { class: 'toolbar__sep' }), this.cropBtn, compare, h('span', { class: 'toolbar__sep' }), formatBtn, exportBtn);
    this.el = h('section', { class: 'stage', attrs: { 'aria-label': 'Canvas' } }, this.viewport, h('div', { class: 'stage__toolbar' }, toolbar));

    new ResizeObserver(() => this.layout()).observe(this.viewport);
    this.bindPanZoom();
    this.bindDrop();
    store.subscribe((s, prev) => {
      if (s.export.format !== prev.export.format) this.formatLabel.textContent = s.export.format === 'jpeg' ? 'JPG' : s.export.format.toUpperCase();
      if (s.mode !== prev.mode || s.project.crop !== prev.project.crop || s.source !== prev.source) this.syncCrop();
      if (s.source !== prev.source) this.empty.hidden = !!s.source;
    });
    this.empty.hidden = !!store.state.source;
  }

  setBusy(b: boolean): void {
    this.busy.hidden = !b;
  }

  /** Update the logical image size (cropped) and the source size. */
  setImageSize(w: number, h: number, srcW: number, srcH: number): void {
    const changed = w !== this.imgW || h !== this.imgH;
    this.imgW = w;
    this.imgH = h;
    this.srcW = srcW;
    this.srcH = srcH;
    if (changed) this.layout();
  }

  /** Displayed scale in css px per image px. */
  get displayScale(): number {
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;
    if (!this.imgW || !vw) return 1;
    if (this.zoom === 'fit') {
      const pad = 48;
      return Math.min((vw - pad) / this.imgW, (vh - pad - 56) / this.imgH, 4 / devicePixelRatio);
    }
    return this.zoom / devicePixelRatio;
  }

  /** Device pixels the preview occupies (for choosing the preview render size). */
  get displayDevicePixels(): number {
    return Math.max(this.imgW, this.imgH) * this.displayScale * devicePixelRatio;
  }

  layout(): void {
    if (!this.imgW) return;
    const s = this.displayScale;
    const w = this.imgW * s;
    const hh = this.imgH * s;
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight - 56;
    if (this.zoom === 'fit') {
      this.panX = 0;
      this.panY = 0;
    }
    // Keep the image reachable when panning.
    const maxX = Math.max(0, (w - vw) / 2 + 80);
    const maxY = Math.max(0, (hh - vh) / 2 + 80);
    this.panX = clamp(this.panX, -maxX, maxX);
    this.panY = clamp(this.panY, -maxY, maxY);
    this.frame.style.width = w + 'px';
    this.frame.style.height = hh + 'px';
    this.frame.style.transform = `translate(calc(-50% + ${this.panX}px), calc(-50% + ${this.panY - 28}px))`;
    this.canvas.classList.toggle('is-pixelated', s * devicePixelRatio >= 2);
    const pct = Math.round(s * devicePixelRatio * 100);
    this.zoomLabel.textContent = this.zoom === 'fit' ? `Fit · ${pct}%` : `${pct}%`;
    this.syncCrop();
    this.onLayout?.();
  }

  onLayout: (() => void) | null = null;

  setZoom(z: number | 'fit', anchor?: { x: number; y: number }): void {
    const before = this.displayScale;
    this.zoom = z === 'fit' ? 'fit' : clamp(z, 0.02, 32);
    const after = this.displayScale;
    if (anchor && z !== 'fit') {
      const r = this.viewport.getBoundingClientRect();
      const cx = anchor.x - (r.left + r.width / 2);
      const cy = anchor.y - (r.top + r.height / 2 - 28);
      const k = after / before;
      this.panX = cx - (cx - this.panX) * k;
      this.panY = cy - (cy - this.panY) * k;
    }
    this.layout();
  }

  zoomBy(dir: 1 | -1, anchor?: { x: number; y: number }): void {
    const cur = this.displayScale * devicePixelRatio;
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > cur * 1.01) ?? 16 : [...ZOOM_STEPS].reverse().find((z) => z < cur * 0.99) ?? 0.05;
    this.setZoom(next, anchor);
  }

  private zoomMenu(anchor: HTMLElement): void {
    openMenu(anchor, [
      { label: 'Zoom in', shortcut: '+', action: () => this.zoomBy(1) },
      { label: 'Zoom out', shortcut: '−', action: () => this.zoomBy(-1) },
      { separator: true },
      { label: 'Zoom to 50%', action: () => this.setZoom(0.5) },
      { label: 'Zoom to 100%', shortcut: '1', action: () => this.setZoom(1) },
      { label: 'Zoom to 200%', shortcut: '2', action: () => this.setZoom(2) },
      { label: 'Zoom to fit', shortcut: '0', checked: this.zoom === 'fit', action: () => this.setZoom('fit') },
    ], { placement: 'above' });
  }

  private bindPanZoom(): void {
    const vp = this.viewport;
    vp.addEventListener(
      'wheel',
      (e) => {
        if (!this.imgW) return;
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          // Pinch / ctrl+wheel: smooth zoom around the cursor.
          const cur = this.displayScale * devicePixelRatio;
          const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025));
          this.setZoom(cur * f, { x: e.clientX, y: e.clientY });
        } else {
          if (this.zoom === 'fit') {
            this.zoom = this.displayScale * devicePixelRatio;
          }
          const m = e.deltaMode === 1 ? 16 : 1;
          this.panX -= e.deltaX * m;
          this.panY -= e.deltaY * m;
          this.layout();
        }
      },
      { passive: false },
    );
    let panning = false;
    let sx = 0;
    let sy = 0;
    let px = 0;
    let py = 0;
    vp.addEventListener('pointerdown', (e) => {
      const mid = e.button === 1;
      if (!(mid || (e.button === 0 && this.spaceDown))) return;
      if (this.zoom === 'fit') this.zoom = this.displayScale * devicePixelRatio;
      panning = true;
      sx = e.clientX;
      sy = e.clientY;
      px = this.panX;
      py = this.panY;
      vp.setPointerCapture(e.pointerId);
      vp.classList.add('is-panning');
      e.preventDefault();
    });
    vp.addEventListener('pointermove', (e) => {
      if (!panning) return;
      this.panX = px + e.clientX - sx;
      this.panY = py + e.clientY - sy;
      this.layout();
    });
    const end = () => {
      panning = false;
      vp.classList.remove('is-panning');
    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', end);
    vp.addEventListener('dblclick', (e) => {
      if (e.target === vp || e.target === this.canvas) this.setZoom(this.zoom === 'fit' ? 1 : 'fit', { x: e.clientX, y: e.clientY });
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !isTyping(e)) {
        this.spaceDown = true;
        vp.classList.add('can-pan');
        if (e.target === document.body) e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spaceDown = false;
        vp.classList.remove('can-pan');
      }
    });
  }

  private bindDrop(): void {
    const el = this.el;
    el.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      el.classList.add('is-dropping');
    });
    el.addEventListener('dragleave', (e) => {
      if (e.target === el || !el.contains(e.relatedTarget as Node)) el.classList.remove('is-dropping');
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('is-dropping');
      if (e.dataTransfer?.files?.length) this.actions.loadFiles(e.dataTransfer.files);
    });
  }

  // ---------------------------------------------------------------- crop overlay

  toggleCrop(): void {
    if (!this.store.state.source) return;
    this.store.set({ mode: this.store.state.mode === 'crop' ? 'effect' : 'crop' });
  }

  /**
   * In crop mode the stage shows the *uncropped* source so the rectangle can be edited;
   * the app renders accordingly and we draw the rectangle over it.
   */
  private syncCrop(): void {
    const s = this.store.state;
    const on = s.mode === 'crop' && !!s.source;
    this.cropBtn.classList.toggle('is-active', on);
    this.cropOverlay.hidden = !on;
    if (!on) return;
    const c: Crop = s.project.crop ?? { x: 0, y: 0, w: 1, h: 1 };
    const rect = this.cropRect ?? this.buildCropOverlay();
    rect.style.left = c.x * 100 + '%';
    rect.style.top = c.y * 100 + '%';
    rect.style.width = c.w * 100 + '%';
    rect.style.height = c.h * 100 + '%';
    rect.style.transform = c.rotation ? `rotate(${c.rotation}deg)` : '';
  }

  private cropRect: HTMLElement | null = null;
  /** Locked aspect ratio (w/h in source pixels) or null for free. */
  cropAspect: number | null = null;

  private buildCropOverlay(): HTMLElement {
    const rect = h('div', { class: 'crop__rect' }, h('div', { class: 'crop__grid' }));
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    for (const k of handles) rect.append(h('div', { class: `crop__handle crop__handle--${k}`, dataset: { h: k } }));
    this.cropOverlay.append(rect);
    this.cropRect = rect;
    let start: Crop | null = null;
    let sx = 0;
    let sy = 0;
    let mode = '';
    rect.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      mode = t.dataset.h ?? 'move';
      start = { ...(this.store.state.project.crop ?? { x: 0, y: 0, w: 1, h: 1 }) };
      sx = e.clientX;
      sy = e.clientY;
      rect.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    });
    rect.addEventListener('pointermove', (e) => {
      if (!start) return;
      const fr = this.frame.getBoundingClientRect();
      const dx = (e.clientX - sx) / fr.width;
      const dy = (e.clientY - sy) / fr.height;
      this.store.setCrop(this.dragCrop(start, mode, dx, dy), 'crop');
    });
    const end = () => {
      if (start) this.store.commit();
      start = null;
    };
    rect.addEventListener('pointerup', end);
    rect.addEventListener('pointercancel', end);
    return rect;
  }

  private dragCrop(c0: Crop, mode: string, dx: number, dy: number): Crop {
    let { x, y, w, h: hh } = c0;
    const min = 0.02;
    if (mode === 'move') {
      x = clamp(x + dx, 0, 1 - w);
      y = clamp(y + dy, 0, 1 - hh);
      return { ...c0, x, y };
    }
    let x1 = x + w;
    let y1 = y + hh;
    if (mode.includes('w')) x = clamp(x + dx, 0, x1 - min);
    if (mode.includes('e')) x1 = clamp(x1 + dx, x + min, 1);
    if (mode.includes('n')) y = clamp(y + dy, 0, y1 - min);
    if (mode.includes('s')) y1 = clamp(y1 + dy, y + min, 1);
    w = x1 - x;
    hh = y1 - y;
    if (this.cropAspect) {
      // Convert the pixel aspect to normalized units and fit inside the dragged box.
      const a = this.cropAspect * (this.srcH / this.srcW);
      if (mode === 'n' || mode === 's') w = hh * a;
      else if (mode === 'e' || mode === 'w') hh = w / a;
      else if (w / hh > a) w = hh * a;
      else hh = w / a;
      if (mode.includes('w')) x = x1 - w;
      if (mode.includes('n')) y = y1 - hh;
      if (mode === 'n' || mode === 's') x = clamp(c0.x + (c0.w - w) / 2, 0, 1 - w);
      if (mode === 'e' || mode === 'w') y = clamp(c0.y + (c0.h - hh) / 2, 0, 1 - hh);
      if (x + w > 1 || y + hh > 1 || x < 0 || y < 0) return c0;
    }
    return { ...c0, x, y, w, h: hh };
  }
}

export function isTyping(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}
