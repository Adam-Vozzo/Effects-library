// Left panel: effect library (explore / favorites / presets) with search and live thumbnails.

import { CATEGORIES, type Category, type EffectDef, type Layer } from '../engine/types';
import { allEffects, defaultParams, normalizeParams, getEffect } from '../effects/registry';
import type { Store } from '../state/store';
import { presetToLayers, type Library, type Preset } from '../state/presets';
import { clear, h } from './dom';
import { icon } from './icons';
import { openMenu, prompt, toast } from './menu';
import type { ThumbnailRenderer } from './thumbnails';

type Tab = 'explore' | 'favorites' | 'presets';

const CATEGORY_LABEL: Record<Category, string> = {
  Blur: 'Blur',
  Color: 'Color',
  Distort: 'Distort',
  Effects: 'Effects',
  Generate: 'Generate',
  Custom: 'Custom',
  Film: 'Film',
};

export class EffectBrowser {
  readonly el: HTMLElement;
  private content: HTMLElement;
  private search: HTMLInputElement;
  private tab: Tab = 'explore';
  private tabButtons: Record<Tab, HTMLButtonElement>;
  private canvases: HTMLCanvasElement[] = [];

  constructor(
    private store: Store,
    private library: Library,
    private thumbs: ThumbnailRenderer,
    private onCollapse: () => void,
  ) {
    this.search = h('input', { class: 'search__input', type: 'search', placeholder: 'Search', spellcheck: false, attrs: { 'aria-label': 'Search effects' } }) as HTMLInputElement;
    this.search.addEventListener('input', () => this.render());
    this.search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = this.filtered()[0];
        if (first) this.add(first);
      } else if (e.key === 'Escape') {
        this.search.value = '';
        this.render();
        this.search.blur();
      }
    });
    const collapse = h('button', { class: 'icon-button', type: 'button', title: 'Collapse panel', onclick: () => this.onCollapse() }, icon('collapse', 18));
    const mk = (t: Tab, label: string) =>
      h('button', {
        class: 'tabs__item',
        type: 'button',
        onclick: () => {
          this.tab = t;
          this.render();
        },
      }, label) as HTMLButtonElement;
    this.tabButtons = { explore: mk('explore', 'Explore'), favorites: mk('favorites', 'Favorites'), presets: mk('presets', 'Presets') };
    this.content = h('div', { class: 'panel__scroll browser__content' });
    this.el = h(
      'aside',
      { class: 'panel panel--browser', attrs: { 'aria-label': 'Effect library' } },
      h('div', { class: 'browser__head' }, h('label', { class: 'search' }, icon('search', 18), this.search), collapse),
      h('div', { class: 'tabs' }, this.tabButtons.explore, this.tabButtons.favorites, this.tabButtons.presets),
      this.content,
    );
    library.onChange(() => this.render());
    this.render();
  }

  focusSearch(): void {
    this.search.focus();
    this.search.select();
  }

  private filtered(): EffectDef[] {
    const q = this.search.value.trim().toLowerCase();
    const list = allEffects().filter((e) => !e.hidden);
    if (!q) return list;
    const words = q.split(/\s+/);
    return list.filter((e) => {
      const hay = (e.name + ' ' + (e.keywords ?? '') + ' ' + e.category).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }

  private add(e: EffectDef): void {
    this.store.addLayer(e.id);
  }

  render(): void {
    for (const c of this.canvases) this.thumbs.unobserve(c);
    this.canvases = [];
    for (const [t, b] of Object.entries(this.tabButtons)) b.classList.toggle('is-active', t === this.tab);
    clear(this.content);
    const q = this.search.value.trim();
    if (q) {
      const list = this.filtered();
      this.content.append(this.section(`Results (${list.length})`, list.map((e) => this.effectCard(e))));
      if (!list.length) this.content.append(h('div', { class: 'empty' }, 'No effects match “' + q + '”.'));
      const presets = this.library.presets.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
      if (presets.length) this.content.append(this.section('Presets', presets.map((p) => this.presetCard(p))));
      return;
    }
    if (this.tab === 'explore') {
      const effects = allEffects().filter((e) => !e.hidden);
      const presets = this.library.presets.slice(0, 6);
      if (presets.length) this.content.append(this.section('Presets', presets.map((p) => this.presetCard(p)), () => this.switchTab('presets')));
      for (const cat of CATEGORIES) {
        const list = effects.filter((e) => e.category === cat);
        if (list.length) this.content.append(this.section(CATEGORY_LABEL[cat], list.map((e) => this.effectCard(e))));
      }
    } else if (this.tab === 'favorites') {
      const favs = this.library.favorites.map((id) => getEffect(id)).filter((e): e is EffectDef => !!e);
      if (!favs.length) this.content.append(h('div', { class: 'empty' }, h('p', null, 'No favorites yet.'), h('p', null, 'Hover an effect and click ★ to pin it here.')));
      else this.content.append(this.section('Favorites', favs.map((e) => this.effectCard(e))));
    } else {
      const actions = h(
        'div',
        { class: 'browser__actions' },
        h('button', { class: 'button button--small', type: 'button', onclick: () => this.saveCurrent() }, icon('bookmark', 14), 'Save current'),
        h('button', { class: 'button button--small', type: 'button', onclick: () => this.importPresets() }, icon('upload', 14), 'Import'),
        h('button', { class: 'button button--small', type: 'button', onclick: () => this.exportPresets() }, icon('download', 14), 'Export'),
      );
      this.content.append(actions);
      const user = this.library.presets.filter((p) => !p.builtin);
      const builtin = this.library.presets.filter((p) => p.builtin);
      if (user.length) this.content.append(this.section('My presets', user.map((p) => this.presetCard(p))));
      if (builtin.length) this.content.append(this.section('Built-in', builtin.map((p) => this.presetCard(p))));
      if (!user.length && !builtin.length) this.content.append(h('div', { class: 'empty' }, 'No presets yet.'));
    }
  }

  private switchTab(t: Tab): void {
    this.tab = t;
    this.render();
    this.content.scrollTop = 0;
  }

  private section(title: string, cards: HTMLElement[], more?: () => void): HTMLElement {
    return h(
      'section',
      { class: 'browser__section' },
      h('h3', { class: 'browser__title' }, title, more ? h('button', { class: 'link-button', type: 'button', onclick: more }, 'See all') : null),
      h('div', { class: 'cards' }, ...cards),
    );
  }

  private thumbCanvas(key: string, layers: () => Layer[]): HTMLCanvasElement {
    const c = h('canvas', { class: 'card__thumb' }) as HTMLCanvasElement;
    this.canvases.push(c);
    this.thumbs.observe(c, () => ({ key, layers: layers(), canvas: c }));
    return c;
  }

  private effectCard(e: EffectDef): HTMLElement {
    const fav = this.library.isFavorite(e.id);
    const star = h(
      'button',
      {
        class: ['card__fav', fav && 'is-on'],
        type: 'button',
        title: fav ? 'Remove from favorites' : 'Add to favorites',
        onclick: (ev: Event) => {
          ev.stopPropagation();
          this.library.toggleFavorite(e.id);
        },
      },
      icon('star', 16),
    );
    const canvas = this.thumbCanvas('fx:' + e.id, () => [{ id: 'thumb:' + e.id, effectId: e.id, params: defaultParams(e), visible: true, opacity: 1, blend: 'normal' }]);
    return h(
      'button',
      { class: 'card', type: 'button', title: e.description ?? e.name, onclick: () => this.add(e) },
      h('div', { class: 'card__media' }, canvas, star),
      h('span', { class: 'card__name' }, e.name),
    );
  }

  private presetCard(p: Preset): HTMLElement {
    const layers = () =>
      presetToLayers(p)
        .filter((l) => getEffect(l.effectId))
        .map((l, i) => ({ ...l, id: `thumb:preset:${p.id}:${i}`, params: normalizeParams(getEffect(l.effectId)!, l.params) }));
    const canvas = this.thumbCanvas('preset:' + p.id + ':' + JSON.stringify(p.layers).length, layers);
    const more = p.builtin
      ? null
      : h(
          'button',
          {
            class: 'card__fav card__more',
            type: 'button',
            title: 'Preset options',
            onclick: (ev: Event) => {
              ev.stopPropagation();
              openMenu(ev.currentTarget as HTMLElement, [
                { label: 'Apply', action: () => this.applyPreset(p) },
                { label: 'Add on top', action: () => this.applyPreset(p, true) },
                {
                  label: 'Rename…',
                  action: async () => {
                    const n = await prompt('Rename preset', 'Name', p.name, 'Rename');
                    if (n) this.library.renamePreset(p.id, n);
                  },
                },
                { separator: true },
                { label: 'Delete', action: () => this.library.deletePreset(p.id) },
              ]);
            },
          },
          icon('more', 16),
        );
    return h(
      'button',
      {
        class: 'card card--preset',
        type: 'button',
        title: p.layers.map((l) => getEffect(l.effectId)?.name ?? l.effectId).join(' → '),
        onclick: (e: MouseEvent) => this.applyPreset(p, e.shiftKey),
      },
      h('div', { class: 'card__media' }, canvas, more),
      h('span', { class: 'card__name' }, p.name),
    );
  }

  applyPreset(p: Preset, append = false): void {
    const layers = presetToLayers(p);
    const missing = layers.filter((l) => !getEffect(l.effectId)).length;
    this.store.setLayers(layers, append);
    if (missing) toast(`${missing} effect(s) in this preset are not available`, 'error');
  }

  private async saveCurrent(): Promise<void> {
    const layers = this.store.state.project.layers;
    if (!layers.length) return toast('Add some effects first');
    const name = await prompt('Save preset', 'Preset name', 'My look', 'Save');
    if (name === null) return;
    this.library.savePreset(name, layers);
    toast('Preset saved', 'success');
  }

  private exportPresets(): void {
    const list = this.library.userPresets;
    if (!list.length) return toast('No saved presets to export');
    const blob = new Blob([JSON.stringify({ app: 'effects-library', version: 1, presets: list }, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'effects-presets.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  private importPresets(): void {
    const input = h('input', { type: 'file', accept: 'application/json,.json' }) as HTMLInputElement;
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        const list = Array.isArray(data) ? data : data.presets;
        const n = this.library.importPresets(list ?? []);
        toast(n ? `Imported ${n} preset(s)` : 'No presets found in file', n ? 'success' : 'error');
      } catch {
        toast('Could not read that preset file', 'error');
      }
    });
    input.click();
  }
}
