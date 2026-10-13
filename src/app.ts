// Application shell: wires state, renderer, panels, preview loop, media loading, autosave and export.

import './effects';
import { Renderer } from './engine/renderer';
import { runGpuDiagnostics } from './engine/diagnostics';
import { getEffect, normalizeParams, registrationErrors } from './effects/registry';
import type { Layer, Project } from './engine/types';
import type { Texture } from './engine/gl';
import { Store, type AppState } from './state/store';
import { AssetStore } from './state/assets';
import { Library } from './state/presets';
import { loadSession, saveSession, clearSession, projectToJson } from './state/persist';
import { EffectBrowser } from './ui/browser';
import { LayersPanel } from './ui/layers';
import { Stage, isTyping } from './ui/stage';
import { ControlsPanel } from './ui/controls/panel';
import { CropPanel } from './ui/crop-panel';
import { Timeline } from './ui/timeline';
import { ThumbnailRenderer } from './ui/thumbnails';
import { openExportPanel, progressDialog } from './ui/export-panel';
import { runExport, downloadBlob, REFERENCE_LONG_SIDE, exportSize } from './export/exporter';
import { debounce, h } from './ui/dom';
import { icon } from './ui/icons';
import { modal, openMenu, prompt, toast } from './ui/menu';

const SETTINGS_KEY = 'fxlib.settings.v1';

interface Settings {
  theme: 'dark' | 'day';
  previewMax: number;
  units: 'relative' | 'source';
  browserCollapsed: boolean;
}

function loadSettings(): Settings {
  const d: Settings = { theme: 'dark', previewMax: 0, units: 'relative', browserCollapsed: false };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return d;
  }
}

export class App {
  readonly store: Store;
  readonly renderer: Renderer;
  readonly assets: AssetStore;
  readonly library = new Library();
  private stage: Stage;
  private browser: EffectBrowser;
  private controls: ControlsPanel;
  private cropPanel: CropPanel;
  private timeline: Timeline;
  private thumbs: ThumbnailRenderer;
  private root: HTMLElement;
  private rightSlot: HTMLElement;
  private settings = loadSettings();
  private sourceBlob: Blob | null = null;
  private sourceBitmap: ImageBitmap | null = null;
  private dirty = true;
  private rafPending = false;
  private lastFrameTime = 0;
  private fileInput: HTMLInputElement;
  private exporting = false;
  private lastRenderMs = 0;
  /** Output of the layers below the selected one, reused while editing it. */
  private chainCache: { key: string; tex: Texture } | null = null;

  constructor(mount: HTMLElement) {
    const initial: AppState = {
      project: { layers: [], crop: null, time: 0 },
      selectedLayerId: null,
      mode: 'effect',
      source: null,
      export: { format: 'png', quality: 0.92, bitDepth: 8, sizeMode: 'original', scale: 2, longSide: 4096, customW: 0, customH: 0 },
      previewMax: this.settings.previewMax,
      playing: false,
      loop: true,
      duration: 5,
      theme: this.settings.theme,
      compare: false,
    };
    this.store = new Store(initial);
    this.applyTheme();

    // The stage owns the visible canvas; the renderer draws into it.
    this.stage = new Stage(this.store, {
      openExport: (a) => this.openExport(a),
      upload: () => this.fileInput.click(),
      sample: (n) => this.loadSample(n),
      loadFiles: (f) => this.loadFiles(f),
    });
    this.renderer = new Renderer(this.stage.canvas);
    this.renderer.onProgramReady = () => this.requestRender();
    this.assets = new AssetStore(this.renderer);
    this.thumbs = new ThumbnailRenderer(this.renderer);
    this.browser = new EffectBrowser(this.store, this.library, this.thumbs, () => this.toggleBrowser());
    const layers = new LayersPanel(this.store, {
      upload: () => this.fileInput.click(),
      random: () => this.loadRandom(),
      fromUrl: () => this.loadFromUrl(),
      sample: (n) => this.loadSample(n),
      savePreset: () => this.savePreset(),
    });
    this.controls = new ControlsPanel(this.store, this.assets, () => this.aspect());
    this.cropPanel = new CropPanel(this.store, this.stage);
    this.timeline = new Timeline(this.store);
    this.rightSlot = h('div', { class: 'right-slot' }, this.controls.el);
    this.fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true }) as HTMLInputElement;
    this.fileInput.addEventListener('change', () => {
      if (this.fileInput.files?.length) this.loadFiles(this.fileInput.files);
      this.fileInput.value = '';
    });

    this.root = h(
      'div',
      { class: ['app', this.settings.browserCollapsed && 'is-browser-collapsed'] },
      this.topbar(),
      h('main', { class: 'workspace' }, this.browser.el, layers.el, this.stage.el, this.rightSlot),
      this.timeline.el,
      this.fileInput,
    );
    mount.replaceChildren(this.root);

    this.store.subscribe((s, prev) => this.onState(s, prev));
    this.stage.onLayout = () => this.maybeResizePreview();
    this.bindKeys();
    this.bindContextLoss();
    document.addEventListener('fontloaded', () => this.requestRender());
    window.addEventListener('paste', (e) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
      if (f) this.loadFiles([f]);
    });
    for (const msg of registrationErrors) toast(msg, 'error', 8000);
  }

  // ------------------------------------------------------------------ startup

  async start(): Promise<void> {
    const saved = await loadSession();
    if (saved?.source?.blob) {
      try {
        for (const a of saved.assets ?? []) await this.assets.add(a.blob, a.name, a.id);
        await this.loadBlob(saved.source.blob, saved.source.name, { keepCrop: true });
        const layers = (saved.project?.layers ?? [])
          .filter((l) => getEffect(l.effectId))
          .map((l) => ({ ...l, params: normalizeParams(getEffect(l.effectId)!, l.params) }));
        this.store.set({
          project: { layers, crop: saved.project?.crop ?? null, time: saved.project?.time ?? 0 },
          selectedLayerId: saved.selectedLayerId ?? (layers.length ? layers[layers.length - 1].id : null),
        });
        this.thumbs.crop = this.store.state.project.crop;
        this.store.resetHistory();
        return;
      } catch (e) {
        console.warn('Could not restore session', e);
      }
    }
    await this.loadSample('portrait');
    this.store.resetHistory();
  }

  // ------------------------------------------------------------------ state reactions

  private onState(s: AppState, prev: AppState): void {
    if (s.project !== prev.project || s.mode !== prev.mode || s.compare !== prev.compare || s.source !== prev.source || s.previewMax !== prev.previewMax) {
      this.requestRender();
    }
    if (s.mode !== prev.mode) {
      this.rightSlot.replaceChildren(s.mode === 'crop' ? this.cropPanel.el : this.controls.el);
      if (s.mode === 'effect') this.controls.sync();
    }
    if (s.project.crop !== prev.project.crop || s.source !== prev.source || s.mode !== prev.mode) this.updateStageSize();
    if (s.project.crop !== prev.project.crop) this.cropThumbs();
    if (s.theme !== prev.theme) this.applyTheme();
    if (s.project.layers !== prev.project.layers) {
      this.renderer.pruneLayers(new Set(s.project.layers.map((l) => l.id)));
      this.timeline.setVisible(s.project.layers.some((l) => l.visible && getEffect(l.effectId)?.animated));
    }
    if (s.playing && !prev.playing) {
      this.lastFrameTime = performance.now();
      this.requestRender();
    }
    if (s.project !== prev.project || s.source !== prev.source) this.autosave();
  }

  private updateStageSize(): void {
    const s = this.store.state;
    if (!s.source) return;
    const [w, hh] = this.croppedSize(s.mode === 'crop');
    this.stage.setImageSize(w, hh, s.source.width, s.source.height);
  }

  /** Cropped source size in source pixels (or the full source while cropping). */
  croppedSize(full = false): [number, number] {
    const src = this.store.state.source;
    if (!src) return [0, 0];
    const c = this.store.state.project.crop;
    if (!c || full) return [src.width, src.height];
    return [Math.max(1, Math.round(c.w * src.width)), Math.max(1, Math.round(c.h * src.height))];
  }

  private aspect(): number {
    const [w, hh] = this.croppedSize();
    return w && hh ? w / hh : 1;
  }

  // ------------------------------------------------------------------ preview rendering

  requestRender(): void {
    this.dirty = true;
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Preview resolution: follows the on-screen size (re-rendered on zoom), capped by the setting. */
  private previewSize(): [number, number] {
    const s = this.store.state;
    const [w, hh] = this.croppedSize(s.mode === 'crop');
    const long = Math.max(w, hh);
    let target = long;
    const cap = this.renderer.caps.maxTextureSize;
    if (s.previewMax > 0) target = Math.min(target, s.previewMax);
    else {
      // Auto: match the displayed device pixels (rounded up in 512px steps), at least 1024.
      const shown = Math.ceil(this.stage.displayDevicePixels / 512) * 512;
      target = Math.min(target, Math.max(1024, shown));
    }
    target = Math.min(target, cap);
    const k = target / long;
    return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(hh * k))];
  }

  private lastPreviewLong = 0;
  private maybeResizePreview(): void {
    const [w, hh] = this.previewSize();
    if (Math.max(w, hh) !== this.lastPreviewLong) this.requestRender();
  }

  private frame(now: number): void {
    this.rafPending = false;
    const s = this.store.state;
    const animated = s.playing && s.project.layers.some((l) => l.visible && getEffect(l.effectId)?.animated);
    if (animated) {
      const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;
      let t = s.project.time + dt;
      if (t > s.duration) t = s.loop ? t % s.duration : s.duration;
      this.store.updateProject((p) => ({ ...p, time: t }), { history: false });
      if (!s.loop && t >= s.duration) this.store.set({ playing: false });
    }
    if (this.dirty && this.renderer.hasSource && !this.exporting && !this.renderer.isContextLost()) {
      const layers: Layer[] = s.mode === 'crop' || s.compare ? [] : s.project.layers;
      const effects = layers.filter((l) => l.visible).map((l) => getEffect(l.effectId)!).filter(Boolean);
      if (!this.renderer.ready(effects)) {
        this.stage.setBusy(true);
        this.renderer.pollPrograms();
        setTimeout(() => this.requestRender(), 30);
        return;
      }
      this.stage.setBusy(false);
      const [w, hh] = this.previewSize();
      this.lastPreviewLong = Math.max(w, hh);
      const [cw, ch] = this.croppedSize(s.mode === 'crop');
      const pxScale = this.settings.units === 'relative' ? Math.max(w, hh) / REFERENCE_LONG_SIDE : w / cw;
      void ch;
      const t0 = performance.now();
      try {
        const opts = {
          width: w,
          height: hh,
          pxScale,
          time: s.project.time,
          format: this.renderer.defaultFormat,
          crop: s.mode === 'crop' ? null : s.project.crop,
        };
        // Reuse the render of everything below the selected layer while it is being edited.
        const sel = layers.findIndex((l) => l.id === s.selectedLayerId);
        const below = sel > 0 ? layers.slice(0, sel) : [];
        const key =
          below.some((l) => l.visible) && !this.exporting
            ? JSON.stringify([
                this.renderer.sourceVersion,
                opts.crop,
                w,
                hh,
                pxScale,
                below.some((l) => l.visible && getEffect(l.effectId)?.animated) ? s.project.time : 0,
                below.map((l) => [l.effectId, l.visible, l.opacity, l.blend, l.params]),
              ])
            : null;
        const cache = this.chainCache;
        const hit = key !== null && cache !== null && cache.key === key;
        const out = this.renderer.renderChain(layers, {
          ...opts,
          start: hit ? { tex: cache!.tex, index: sel } : undefined,
          capture: !hit && key !== null ? sel : undefined,
          onCapture: (t) => {
            if (this.chainCache) this.renderer.pool.release(this.chainCache.tex);
            this.chainCache = { key: key!, tex: t };
          },
        });
        this.renderer.present(out);
        this.renderer.pool.release(out);
        this.renderer.pool.trimOlderThan(8000);
        this.dirty = false;
      } catch (e) {
        console.error(e);
        this.dirty = false;
        toast(String((e as Error).message ?? e).split('\n')[0], 'error', 6000);
      }
      this.lastRenderMs = performance.now() - t0;
      // Let thumbnails catch up only once the preview has been idle for a moment.
      this.thumbs.busyUntil = performance.now() + Math.min(600, 120 + this.lastRenderMs * 2);
    }
    if (animated) this.requestRender();
  }

  // ------------------------------------------------------------------ media

  private async loadFiles(files: FileList | File[]): Promise<void> {
    const f = [...files][0];
    if (!f) return;
    if (f.type.startsWith('video/')) return toast('Video input is not supported yet — load an image.', 'error');
    if (f.type === 'application/json' || f.name.endsWith('.json')) return this.importProject(f);
    await this.loadBlob(f, f.name);
  }

  async loadBlob(blob: Blob, name: string, opts: { keepCrop?: boolean } = {}): Promise<void> {
    let bmp: ImageBitmap;
    try {
      bmp = await createImageBitmap(blob, { imageOrientation: 'from-image', premultiplyAlpha: 'none', colorSpaceConversion: 'default' });
    } catch {
      toast(`Could not decode “${name}”. Try PNG, JPG, WebP or AVIF.`, 'error');
      return;
    }
    const max = this.renderer.caps.maxTextureSize;
    if (bmp.width > max || bmp.height > max) toast(`Image is larger than this GPU's ${max}px limit — it was downscaled.`, 'info', 6000);
    this.renderer.setSource(bmp);
    this.sourceBitmap?.close();
    this.sourceBitmap = bmp;
    this.sourceBlob = blob;
    const prevUrl = this.store.state.source?.url;
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    const [w, hh] = this.renderer.sourceSize;
    this.store.set({ source: { name, width: w, height: hh, url: URL.createObjectURL(blob) } });
    if (!opts.keepCrop && this.store.state.project.crop) this.store.updateProject((p) => ({ ...p, crop: null }), { history: false });
    this.updateStageSize();
    this.stage.setZoom('fit');
    this.thumbs.crop = this.store.state.project.crop;
    this.thumbs.invalidate();
    this.requestRender();
  }

  async loadSample(name: string): Promise<void> {
    try {
      const res = await fetch(`samples/${name}.jpg`);
      if (!res.ok) throw new Error(String(res.status));
      await this.loadBlob(await res.blob(), `${name}.jpg`);
    } catch {
      toast('Could not load the sample image', 'error');
    }
  }

  private async loadRandom(): Promise<void> {
    this.stage.setBusy(true);
    try {
      const portrait = Math.random() < 0.35;
      const res = await fetch(`https://picsum.photos/${portrait ? '1600/2000' : '2400/1600'}?random=${Date.now()}`);
      if (!res.ok) throw new Error(String(res.status));
      const id = res.headers.get('picsum-id');
      await this.loadBlob(await res.blob(), id ? `picsum-${id}.jpg` : 'random.jpg');
    } catch {
      toast('Could not fetch a random image (offline?)', 'error');
    } finally {
      this.stage.setBusy(false);
    }
  }

  private async loadFromUrl(): Promise<void> {
    const url = await prompt('Add from URL', 'Image URL (must allow cross-origin access)', '', 'Load');
    if (!url) return;
    this.stage.setBusy(true);
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(String(res.status));
      const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image');
      await this.loadBlob(await res.blob(), name);
    } catch {
      toast('Could not load that URL (blocked by CORS or not an image)', 'error', 6000);
    } finally {
      this.stage.setBusy(false);
    }
  }

  // ------------------------------------------------------------------ export

  private openExport(anchor: HTMLElement): void {
    if (!this.store.state.source) return toast('Load an image first');
    openExportPanel(anchor, this.store, this.renderer, () => this.croppedSize(), () => this.doExport());
  }

  private async doExport(): Promise<void> {
    const s = this.store.state;
    if (!s.source || this.exporting) return;
    const [sw, sh] = this.croppedSize();
    const ctrl = new AbortController();
    const dlg = progressDialog('Exporting', () => ctrl.abort());
    this.exporting = true;
    this.thumbs.paused = true;
    if (this.chainCache) {
      // Free preview memory for the big export targets.
      this.renderer.pool.release(this.chainCache.tex);
      this.chainCache = null;
    }
    const t0 = performance.now();
    try {
      const effects = s.project.layers.filter((l) => l.visible).map((l) => getEffect(l.effectId)!).filter(Boolean);
      while (!this.renderer.ready(effects)) {
        this.renderer.pollPrograms();
        await new Promise((r) => setTimeout(r, 30));
      }
      const blob = await runExport(
        this.renderer,
        { layers: s.project.layers, crop: s.project.crop, time: s.project.time, sourceW: sw, sourceH: sh, settings: s.export, units: this.settings.units },
        (p) => dlg.update(p.stage === 'render' ? p.progress * 0.5 : p.stage === 'encode' ? 0.5 + p.progress * 0.5 : 1, p.detail),
        ctrl.signal,
      );
      const { w, h: hh } = exportSize(s.export, sw, sh);
      const base = s.source.name.replace(/\.[^.]+$/, '') || 'image';
      const ext = s.export.format === 'jpeg' ? 'jpg' : s.export.format;
      downloadBlob(blob, `${base}-fx-${w}x${hh}.${ext}`);
      toast(`Exported ${w}×${hh} ${ext.toUpperCase()} (${(blob.size / 1048576).toFixed(1)} MB) in ${((performance.now() - t0) / 1000).toFixed(1)}s`, 'success', 5000);
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast(String((e as Error)?.message ?? e), 'error', 8000);
      else toast('Export cancelled');
    } finally {
      dlg.close();
      this.exporting = false;
      this.thumbs.paused = false;
      if (this.renderer.isContextLost()) toast('The GPU context was lost; it will be restored automatically.', 'error');
      this.requestRender();
    }
  }

  // ------------------------------------------------------------------ presets / project

  private async savePreset(): Promise<void> {
    const layers = this.store.state.project.layers;
    if (!layers.length) return toast('Add some effects first');
    const name = await prompt('Save preset', 'Preset name', 'My look', 'Save');
    if (name === null) return;
    this.library.savePreset(name, layers);
    toast('Preset saved to the Presets tab', 'success');
  }

  private exportProject(): void {
    const s = this.store.state;
    const blob = new Blob([projectToJson(s.project, s.source?.name)], { type: 'application/json' });
    downloadBlob(blob, (s.source?.name.replace(/\.[^.]+$/, '') || 'project') + '.fx.json');
  }

  private async importProject(f: File): Promise<void> {
    try {
      const data = JSON.parse(await f.text());
      const p: Project = data.project ?? data;
      if (!Array.isArray(p.layers)) throw new Error('bad');
      this.store.setLayers(p.layers);
      this.store.setCrop(p.crop ?? null);
      toast('Project loaded', 'success');
    } catch {
      toast('That file is not a valid project', 'error');
    }
  }

  private cropThumbs = debounce(() => {
    this.thumbs.crop = this.store.state.project.crop;
    this.thumbs.invalidate();
  }, 500);

  private autosave = debounce(() => {
    const s = this.store.state;
    if (!this.sourceBlob || !s.source) return;
    const used = new Set<string>();
    for (const l of s.project.layers) for (const v of Object.values(l.params)) if (v && typeof v === 'object' && 'assetId' in v) used.add((v as { assetId: string }).assetId);
    const assets = this.assets
      .all()
      .filter((a) => used.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, blob: a.blob }));
    void saveSession({ project: s.project, selectedLayerId: s.selectedLayerId, source: { name: s.source.name, blob: this.sourceBlob }, assets, savedAt: Date.now() });
  }, 800);

  // ------------------------------------------------------------------ chrome

  private topbar(): HTMLElement {
    const undo = h('button', { class: 'icon-button', type: 'button', title: 'Undo (Ctrl+Z)', onclick: () => this.store.undo() }, icon('undo', 18));
    const redo = h('button', { class: 'icon-button', type: 'button', title: 'Redo (Ctrl+Shift+Z)', onclick: () => this.store.redo() }, icon('redo', 18));
    const sync = () => {
      (undo as HTMLButtonElement).disabled = !this.store.canUndo;
      (redo as HTMLButtonElement).disabled = !this.store.canRedo;
    };
    this.store.subscribe(sync);
    sync();
    const browserToggle = h('button', { class: 'icon-button topbar__browser-toggle', type: 'button', title: 'Show effect library', onclick: () => this.toggleBrowser() }, icon('layers', 18));
    return h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'topbar__brand' }, browserToggle, h('span', { class: 'logo' }, 'EFFECTS', h('span', { class: 'logo__dot' }, '.'), 'LIB')),
      h('div', { class: 'topbar__center' }, undo, redo),
      h(
        'div',
        { class: 'topbar__actions' },
        h('button', { class: 'pill', type: 'button', onclick: () => this.fileInput.click() }, icon('plus', 16), 'Load media'),
        h('button', { class: 'icon-button', type: 'button', title: 'Toggle theme', onclick: () => this.toggleTheme() }, icon('sun', 18)),
        h('button', { class: 'icon-button', type: 'button', title: 'Menu', onclick: (e: Event) => this.mainMenu(e.currentTarget as HTMLElement) }, icon('menu', 20)),
      ),
    );
  }

  private mainMenu(anchor: HTMLElement): void {
    const st = this.settings;
    openMenu(anchor, [
      { label: 'Preview resolution', heading: true },
      { label: 'Auto (match screen)', checked: st.previewMax === 0, action: () => this.setSetting({ previewMax: 0 }) },
      { label: 'Up to 2048 px', checked: st.previewMax === 2048, action: () => this.setSetting({ previewMax: 2048 }) },
      { label: 'Up to 4096 px', checked: st.previewMax === 4096, action: () => this.setSetting({ previewMax: 4096 }) },
      { label: 'Full resolution', checked: st.previewMax === 1e9, action: () => this.setSetting({ previewMax: 1e9 }) },
      { label: 'Effect size units', heading: true },
      { label: 'Relative to image (720 px reference)', checked: st.units === 'relative', action: () => this.setSetting({ units: 'relative' }) },
      { label: 'Source pixels', checked: st.units === 'source', action: () => this.setSetting({ units: 'source' }) },
      { separator: true },
      { label: 'Save stack as preset…', icon: 'bookmark', action: () => this.savePreset() },
      { label: 'Download project (.json)', icon: 'download', action: () => this.exportProject() },
      { label: 'Open project / image…', icon: 'folder', action: () => this.fileInput.click() },
      { label: 'Clear all layers', icon: 'trash', action: () => this.store.setLayers([]) },
      {
        label: 'Reset session',
        icon: 'reset',
        action: async () => {
          await clearSession();
          location.reload();
        },
      },
      { separator: true },
      { label: 'Keyboard shortcuts', icon: 'info', action: () => this.showShortcuts() },
      { label: 'GPU diagnostics…', icon: 'info', action: () => this.showDiagnostics() },
      { label: 'About & credits', icon: 'info', action: () => this.showAbout() },
    ]);
  }

  private setSetting(p: Partial<Settings>): void {
    this.settings = { ...this.settings, ...p };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore
    }
    if (p.previewMax !== undefined) this.store.set({ previewMax: p.previewMax });
    this.thumbs.invalidate();
    this.requestRender();
  }

  private toggleTheme(): void {
    const theme = this.store.state.theme === 'dark' ? 'day' : 'dark';
    this.store.set({ theme });
    this.setSetting({ theme });
  }

  private applyTheme(): void {
    document.documentElement.dataset.theme = this.store.state.theme;
  }

  private toggleBrowser(): void {
    this.settings.browserCollapsed = !this.settings.browserCollapsed;
    this.root.classList.toggle('is-browser-collapsed', this.settings.browserCollapsed);
    this.setSetting({});
    setTimeout(() => this.stage.layout(), 220);
  }

  private showShortcuts(): void {
    const rows: [string, string][] = [
      ['Ctrl/⌘ Z', 'Undo'],
      ['Ctrl/⌘ Shift Z · Ctrl Y', 'Redo'],
      ['Delete', 'Delete selected layer'],
      ['Ctrl/⌘ D', 'Duplicate layer'],
      ['H', 'Hide / show layer'],
      ['[  ]', 'Select layer below / above'],
      ['R', 'Randomize layer'],
      ['C', 'Crop'],
      ['\\ (hold)', 'Compare with original'],
      ['0 · 1 · 2', 'Zoom fit · 100% · 200%'],
      ['+ / −', 'Zoom in / out'],
      ['Space + drag', 'Pan'],
      ['/', 'Search effects'],
      ['K', 'Play / pause animation'],
      ['Ctrl/⌘ E', 'Export'],
      ['Ctrl/⌘ O', 'Open image'],
      ['Ctrl/⌘ V', 'Paste image'],
    ];
    modal('Keyboard shortcuts', h('div', { class: 'modal__body shortcuts' }, ...rows.map(([k, d]) => h('div', { class: 'shortcuts__row' }, h('kbd', null, k), h('span', null, d)))));
  }

  /** Shader feature probes for bug reports (results depend on the browser and GPU driver). */
  private showDiagnostics(): void {
    let report: string;
    try {
      report = runGpuDiagnostics(this.renderer);
    } catch (e) {
      report = 'Diagnostics failed: ' + ((e as Error).stack || String(e));
    }
    this.requestRender();
    const copy = h('button', { class: 'button button--primary', type: 'button' }, 'Copy report');
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(report);
        toast('Report copied', 'success');
      } catch {
        toast('Copy failed: select the text and copy it', 'error');
      }
    };
    modal(
      'GPU diagnostics',
      h('div', { class: 'modal__body diagnostics' }, h('pre', { class: 'diagnostics__report' }, report), h('div', { class: 'modal__actions' }, copy)),
      { wide: true },
    );
  }

  private async showAbout(): Promise<void> {
    let credits: { file: string; author: string; url: string }[] = [];
    try {
      credits = await (await fetch('samples/credits.json')).json();
    } catch {
      // offline
    }
    const c = this.renderer.caps;
    modal(
      'About',
      h(
        'div',
        { class: 'modal__body about' },
        h('p', null, 'A WebGL 2 image effects workstation for digital art — stack GPU effects, tweak them live and export up to 16K.'),
        h('p', { class: 'muted' }, `GPU: ${c.renderer} · max texture ${c.maxTextureSize}px · float targets ${c.floatTargets ? 'yes' : 'no'}`),
        h('h4', null, 'Sample photos (Unsplash license)'),
        h('ul', null, ...credits.map((cr) => h('li', null, h('a', { href: cr.url, target: '_blank', rel: 'noopener' }, cr.author), ` — ${cr.file}`))),
      ),
    );
  }

  // ------------------------------------------------------------------ input

  private bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key;
      if (mod && k.toLowerCase() === 'z') {
        if (isTyping(e)) return;
        e.preventDefault();
        if (e.shiftKey) this.store.redo();
        else this.store.undo();
        return;
      }
      if (mod && k.toLowerCase() === 'y') {
        e.preventDefault();
        this.store.redo();
        return;
      }
      if (mod && k.toLowerCase() === 'o') {
        e.preventDefault();
        this.fileInput.click();
        return;
      }
      if (mod && k.toLowerCase() === 'e') {
        e.preventDefault();
        const btn = this.root.querySelector('.toolbar__export') as HTMLElement | null;
        if (btn) this.openExport(btn);
        return;
      }
      if (mod && k.toLowerCase() === 's') {
        e.preventDefault();
        void this.savePreset();
        return;
      }
      if (mod && k.toLowerCase() === 'd') {
        e.preventDefault();
        const id = this.store.state.selectedLayerId;
        if (id) this.store.duplicateLayer(id);
        return;
      }
      if (isTyping(e) || mod || e.altKey) return;
      const sel = this.store.state.selectedLayerId;
      switch (k) {
        case 'Delete':
        case 'Backspace':
          if (sel) {
            e.preventDefault();
            this.store.removeLayer(sel);
          }
          break;
        case 'h':
        case 'H': {
          const l = this.store.selectedLayer;
          if (l) this.store.patchLayer(l.id, { visible: !l.visible });
          break;
        }
        case '[':
        case ']': {
          const layers = this.store.state.project.layers;
          const i = layers.findIndex((l) => l.id === sel);
          const j = Math.max(0, Math.min(layers.length - 1, i + (k === ']' ? 1 : -1)));
          if (layers[j]) this.store.set({ selectedLayerId: layers[j].id, mode: 'effect' });
          break;
        }
        case 'r':
        case 'R':
          this.controls.randomize();
          break;
        case 'c':
        case 'C':
          this.stage.toggleCrop();
          break;
        case '\\':
          if (!this.store.state.compare) this.store.set({ compare: true });
          break;
        case '0':
          this.stage.setZoom('fit');
          break;
        case '1':
          this.stage.setZoom(1);
          break;
        case '2':
          this.stage.setZoom(2);
          break;
        case '+':
        case '=':
          this.stage.zoomBy(1);
          break;
        case '-':
        case '_':
          this.stage.zoomBy(-1);
          break;
        case '/':
          e.preventDefault();
          if (this.settings.browserCollapsed) this.toggleBrowser();
          this.browser.focusSearch();
          break;
        case 'k':
        case 'K':
          this.timeline.toggle();
          break;
        case 'Escape':
          if (this.store.state.mode === 'crop') this.store.set({ mode: 'effect' });
          break;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === '\\' && this.store.state.compare) this.store.set({ compare: false });
    });
  }

  private bindContextLoss(): void {
    const c = this.stage.canvas;
    c.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      toast('GPU context lost — restoring…', 'error');
    });
    c.addEventListener('webglcontextrestored', () => {
      this.chainCache = null;
      this.renderer.handleContextRestored();
      this.assets.dropTextures();
      if (this.sourceBitmap) this.renderer.setSource(this.sourceBitmap);
      this.thumbs.invalidate();
      this.requestRender();
      toast('GPU context restored', 'success');
    });
  }
}
