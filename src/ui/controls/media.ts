// Texture (image upload) and font picker controls.

import type { FontParam, ParamValue, TextureParam, TextureRef } from '../../engine/types';
import type { AssetStore } from '../../state/assets';
import { h } from '../dom';
import { icon } from '../icons';
import { openMenu, toast } from '../menu';
import { FONT_FAMILIES, loadFont } from '../fonts';
import { header, type Control, type ControlHost } from './basic';

export function textureControl(def: TextureParam, value: ParamValue, host: ControlHost, assets: AssetStore): Control {
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true }) as HTMLInputElement;
  const thumb = h('div', { class: 'texture__thumb' });
  const name = h('span', { class: 'texture__name' }, 'No image');
  const clearBtn = h('button', { class: 'icon-button icon-button--tiny', type: 'button', title: 'Remove image', onclick: (e: Event) => { e.stopPropagation(); host.set(null, { commit: true }); } }, icon('x', 14));
  const pickExisting = h('button', { class: 'icon-button icon-button--tiny', type: 'button', title: 'Use a loaded image', onclick: (e: Event) => {
    e.stopPropagation();
    const list = assets.all();
    if (!list.length) return toast('No images loaded yet');
    openMenu(pickExisting, list.map((a) => ({ label: a.name, action: () => host.set({ assetId: a.id }, { commit: true }) })));
  } }, icon('folder', 14));
  const drop = h('button', { class: 'texture', type: 'button', onclick: () => file.click() }, thumb, h('div', { class: 'texture__meta' }, name, h('span', { class: 'param__hint' }, 'Click or drop an image')));
  const load = async (f: File) => {
    try {
      const a = await assets.add(f, f.name);
      host.set({ assetId: a.id }, { commit: true });
    } catch {
      toast('Could not load that image', 'error');
    }
  };
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (f) load(f);
    file.value = '';
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('is-over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    drop.classList.remove('is-over');
    const f = e.dataTransfer?.files?.[0];
    if (f) load(f);
  });
  const update = (v: ParamValue) => {
    const ref = v as TextureRef | null;
    const a = ref?.assetId ? assets.get(ref.assetId) : undefined;
    thumb.style.backgroundImage = a ? `url(${a.url})` : '';
    thumb.classList.toggle('is-empty', !a);
    name.textContent = a ? a.name : ref?.assetId ? 'Missing image' : 'No image';
    clearBtn.hidden = !ref;
  };
  update(value);
  const el = h('div', { class: 'param param--texture' }, header(def.label, host, pickExisting, clearBtn), drop, file);
  return { el, update };
}

export function fontControl(def: FontParam, value: string, host: ControlHost): Control {
  const text = h('span', { class: 'dropdown__text' }, value);
  const btn = h('button', { class: 'dropdown', type: 'button' }, text, icon('chevronDown', 16));
  btn.addEventListener('click', () => {
    openMenu(
      btn,
      FONT_FAMILIES.map((f) => ({
        label: f.name,
        checked: f.name === value,
        action: async () => {
          await loadFont(f.name);
          host.set(f.name, { commit: true });
        },
      })),
      { align: 'stretch' },
    );
  });
  const el = h('div', { class: 'param param--select' }, header(def.label, host), btn);
  return {
    el,
    update(v) {
      value = String(v);
      text.textContent = value;
      text.style.fontFamily = `"${value}", sans-serif`;
    },
  };
}
