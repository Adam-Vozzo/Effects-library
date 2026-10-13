// Basic parameter controls: slider, enum (slider/switcher/select), toggle, color, range, text.

import type { BoolParam, ColorParam, EnumParam, FloatParam, ParamValue, RangeParam, TextParam } from '../../engine/types';
import { clamp, formatNumber, h, onDrag } from '../dom';
import { icon } from '../icons';
import { openMenu, type MenuItem } from '../menu';

export interface ControlHost {
  set(v: ParamValue, opts?: { commit?: boolean }): void;
  /** Reset to the default value. */
  reset(): void;
  /** Show a value on the canvas without applying it; null ends the preview. */
  preview?(v: ParamValue | null): void;
}

export interface Control {
  el: HTMLElement;
  update(v: ParamValue): void;
}

export function header(label: string, host: ControlHost, ...trail: (HTMLElement | null)[]): HTMLElement {
  const title = h('label', { class: 'param__title', title: 'Double-click to reset', ondblclick: () => host.reset() }, label);
  return h('div', { class: 'param__header' }, title, h('div', { class: 'param__trail' }, ...trail));
}

/** Numeric input that commits on Enter/blur and supports arrow-key nudging. */
export function numberInput(value: number, step: number, onChange: (v: number) => void, opts: { min?: number; max?: number } = {}): HTMLInputElement {
  const inp = h('input', {
    class: 'param__number',
    type: 'text',
    inputMode: 'decimal',
    spellcheck: false,
    value: formatNumber(value, step),
  }) as HTMLInputElement;
  const commit = () => {
    const v = parseFloat(inp.value.replace(',', '.'));
    if (Number.isFinite(v)) onChange(v);
  };
  inp.addEventListener('change', commit);
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      commit();
      inp.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const cur = parseFloat(inp.value) || 0;
      const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      let v = cur + (e.key === 'ArrowUp' ? 1 : -1) * step * mult;
      if (opts.min !== undefined) v = Math.max(opts.min, v);
      if (opts.max !== undefined) v = Math.min(opts.max, v);
      inp.value = formatNumber(v, step);
      onChange(v);
    }
  });
  inp.addEventListener('focus', () => inp.select());
  inp.style.width = Math.max(4, formatNumber(opts.max ?? value, step).length + 2) + 'ch';
  return inp;
}

function quantize(v: number, min: number, max: number, step: number): number {
  const q = step > 0 ? Math.round((v - min) / step) * step + min : v;
  return clamp(parseFloat(q.toFixed(6)), min, max);
}

/** Custom slider track (thin line + tick) used by float/int/enum sliders. */
function track(pos: number, onPos: (t: number, commit: boolean) => void): { el: HTMLElement; set(t: number): void } {
  const fill = h('div', { class: 'slider__fill' });
  const thumb = h('div', { class: 'slider__thumb' });
  const el = h('div', { class: 'slider__track', tabIndex: 0 }, h('div', { class: 'slider__rail' }), fill, thumb);
  const set = (t: number) => {
    t = clamp(t, 0, 1);
    thumb.style.left = `${t * 100}%`;
    fill.style.width = `${t * 100}%`;
  };
  set(pos);
  let dragging = false;
  onDrag(el, {
    start: () => {
      dragging = true;
    },
    move: (e) => {
      const r = el.getBoundingClientRect();
      onPos(clamp((e.clientX - r.left) / r.width, 0, 1), false);
    },
    end: (e) => {
      dragging = false;
      const r = el.getBoundingClientRect();
      onPos(clamp((e.clientX - r.left) / r.width, 0, 1), true);
    },
  });
  void dragging;
  return { el, set };
}

/** Parse hints like "0 ironbow · 1 rainbow" or "0 = RGB, 1 = OKLab" into index → name. */
export function parseNumberedHint(hint: string | undefined): Map<number, string> | null {
  if (!hint) return null;
  const parts = hint.split(/\s*[·,;]\s*(?=\d+\s*[:=]?\s*\S)/);
  const map = new Map<number, string>();
  for (const part of parts) {
    const m = /^(\d+)\s*[:=]?\s*(.+)$/.exec(part.trim());
    if (!m) return null;
    map.set(Number(m[1]), m[2].trim());
  }
  return map.size >= 2 ? map : null;
}

export function sliderControl(def: FloatParam, value: number, host: ControlHost): Control {
  const step = def.step ?? (def.type === 'int' ? 1 : 0.01);
  const names = def.type === 'int' ? parseNumberedHint(def.hint) : null;
  const nameLabel = names ? h('span', { class: 'param__value-label param__value-name' }, names.get(Math.round(value)) ?? '') : null;
  const curve = def.curve ?? 1;
  const toPos = (v: number) => Math.pow(clamp((v - def.min) / (def.max - def.min || 1), 0, 1), 1 / curve);
  const fromPos = (t: number) => def.min + Math.pow(t, curve) * (def.max - def.min);
  let current = value;
  const num = numberInput(value, step, (v) => {
    // Typed values may exceed the slider range (useful for extreme looks) but stay finite.
    const q = def.type === 'int' ? Math.round(v) : v;
    apply(q, true);
  }, { min: def.min, max: def.max });
  const unit = def.unit ? h('span', { class: 'param__unit' }, def.unit) : null;
  const tr = track(toPos(value), (t, commit) => apply(quantize(fromPos(t), def.min, def.max, step), commit));
  const apply = (v: number, commit: boolean) => {
    current = v;
    tr.set(toPos(v));
    num.value = formatNumber(v, step);
    if (nameLabel) nameLabel.textContent = names!.get(Math.round(v)) ?? '';
    host.set(v, { commit });
  };
  tr.el.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'ArrowUp' && k !== 'ArrowDown') return;
    e.preventDefault();
    const dir = k === 'ArrowLeft' || k === 'ArrowDown' ? -1 : 1;
    const mult = e.shiftKey ? 10 : 1;
    apply(clamp(quantize(current + dir * step * mult, def.min, def.max, step), def.min, def.max), true);
  });
  const el = h('div', { class: 'param param--slider', title: names ? undefined : def.hint }, header(def.label, host, nameLabel, num, unit), tr.el);
  return {
    el,
    update(v) {
      current = Number(v);
      tr.set(toPos(current));
      if (nameLabel) nameLabel.textContent = names!.get(Math.round(current)) ?? '';
      if (document.activeElement !== num) num.value = formatNumber(current, step);
    },
  };
}

export function enumSliderControl(def: EnumParam, value: number, host: ControlHost): Control {
  const n = def.options.length;
  const label = h('span', { class: 'param__value-label' }, def.options[value] ?? '');
  const tr = track(n > 1 ? value / (n - 1) : 0, (t, commit) => {
    const v = Math.round(t * (n - 1));
    label.textContent = def.options[v] ?? '';
    tr.set(n > 1 ? v / (n - 1) : 0);
    host.set(v, { commit });
  });
  const title = def.label ? h('label', { class: 'param__title', ondblclick: () => host.reset() }, def.label) : null;
  const el = h('div', { class: 'param param--slider param--enum' }, h('div', { class: 'param__header' }, title ?? h('span'), h('div', { class: 'param__trail' }, label)), tr.el);
  return {
    el,
    update(v) {
      const i = Number(v);
      label.textContent = def.options[i] ?? '';
      tr.set(n > 1 ? i / (n - 1) : 0);
    },
  };
}

export function switcherControl(def: EnumParam, value: number, host: ControlHost): Control {
  const buttons = def.options.map((o, i) =>
    h('button', { class: 'switcher__item', type: 'button', onclick: () => host.set(i, { commit: true }) }, o),
  );
  const sw = h('div', { class: 'switcher' }, ...buttons);
  const el = h('div', { class: 'param param--switcher' }, header(def.label, host), sw);
  const update = (v: ParamValue) => buttons.forEach((b, i) => b.classList.toggle('is-active', i === Number(v)));
  update(value);
  return { el, update };
}

export function selectControl(def: EnumParam, value: number, host: ControlHost): Control {
  const text = h('span', { class: 'dropdown__text' }, def.options[value] ?? '');
  const btn = h('button', { class: 'dropdown', type: 'button' }, text, icon('chevronDown', 16));
  let current = value;
  const preview = def.livePreview ? host.preview?.bind(host) : undefined;
  btn.addEventListener('click', () => {
    const items: MenuItem[] = [];
    def.options.forEach((o, i) => {
      if (def.groups?.includes(i)) items.push({ separator: true });
      items.push({ label: o, checked: i === current, action: () => host.set(i, { commit: true }), preview: preview && (() => preview(i)) });
    });
    openMenu(btn, items, { align: 'stretch', onPreviewEnd: preview && (() => preview(null)) });
  });
  const el = h('div', { class: 'param param--select' }, header(def.label, host), btn);
  return {
    el,
    update(v) {
      current = Number(v);
      text.textContent = def.options[current] ?? '';
    },
  };
}

export function toggleControl(def: BoolParam, value: boolean, host: ControlHost): Control {
  const on = h('button', { class: 'switcher__item', type: 'button', onclick: () => host.set(true, { commit: true }) }, 'On');
  const off = h('button', { class: 'switcher__item', type: 'button', onclick: () => host.set(false, { commit: true }) }, 'Off');
  const el = h('div', { class: 'param param--toggle' }, header(def.label, host, h('div', { class: 'switcher switcher--small' }, on, off)));
  const update = (v: ParamValue) => {
    on.classList.toggle('is-active', !!v);
    off.classList.toggle('is-active', !v);
  };
  update(value);
  return { el, update };
}

export function colorControl(def: ColorParam, value: string, host: ControlHost): Control {
  const picker = h('input', { type: 'color', class: 'color__native', value: value }) as HTMLInputElement;
  const swatch = h('span', { class: 'color__swatch', style: { background: value } }, picker);
  const hex = h('input', { class: 'param__number color__hex', type: 'text', value: value.toUpperCase(), spellcheck: false, maxLength: 7 }) as HTMLInputElement;
  picker.addEventListener('input', () => {
    swatch.style.background = picker.value;
    hex.value = picker.value.toUpperCase();
    host.set(picker.value, { commit: false });
  });
  picker.addEventListener('change', () => host.set(picker.value, { commit: true }));
  hex.addEventListener('change', () => {
    let v = hex.value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#[0-9a-fA-F]{3}$/.test(v)) v = '#' + v.slice(1).split('').map((c) => c + c).join('');
    if (/^#[0-9a-fA-F]{6}$/.test(v)) host.set(v.toLowerCase(), { commit: true });
  });
  const el = h('div', { class: 'param param--color' }, header(def.label, host, hex, swatch));
  return {
    el,
    update(v) {
      const s = String(v);
      picker.value = s;
      swatch.style.background = s;
      if (document.activeElement !== hex) hex.value = s.toUpperCase();
    },
  };
}

export function rangeControl(def: RangeParam, value: [number, number], host: ControlHost): Control {
  const step = def.step ?? 0.01;
  let cur: [number, number] = [...value];
  const lo = numberInput(cur[0], step, (v) => apply([clamp(v, def.min, cur[1]), cur[1]], true));
  const hi = numberInput(cur[1], step, (v) => apply([cur[0], clamp(v, cur[0], def.max)], true));
  const fill = h('div', { class: 'slider__fill slider__fill--range' });
  const t0 = h('div', { class: 'slider__thumb' });
  const t1 = h('div', { class: 'slider__thumb' });
  const trackEl = h('div', { class: 'slider__track' }, h('div', { class: 'slider__rail' }), fill, t0, t1);
  const pos = (v: number) => (v - def.min) / (def.max - def.min || 1);
  const render = () => {
    t0.style.left = pos(cur[0]) * 100 + '%';
    t1.style.left = pos(cur[1]) * 100 + '%';
    fill.style.left = pos(cur[0]) * 100 + '%';
    fill.style.width = (pos(cur[1]) - pos(cur[0])) * 100 + '%';
    if (document.activeElement !== lo) lo.value = formatNumber(cur[0], step);
    if (document.activeElement !== hi) hi.value = formatNumber(cur[1], step);
  };
  const apply = (v: [number, number], commit: boolean) => {
    cur = v;
    render();
    host.set([...v] as [number, number], { commit });
  };
  let which = 0;
  onDrag(trackEl, {
    start: (e) => {
      const r = trackEl.getBoundingClientRect();
      const v = def.min + ((e.clientX - r.left) / r.width) * (def.max - def.min);
      which = Math.abs(v - cur[0]) <= Math.abs(v - cur[1]) ? 0 : 1;
      if (cur[0] === cur[1]) which = v < cur[0] ? 0 : 1;
    },
    move: (e) => {
      const r = trackEl.getBoundingClientRect();
      const v = quantize(def.min + clamp((e.clientX - r.left) / r.width, 0, 1) * (def.max - def.min), def.min, def.max, step);
      apply(which === 0 ? [Math.min(v, cur[1]), cur[1]] : [cur[0], Math.max(v, cur[0])], false);
    },
    end: () => host.set([...cur] as [number, number], { commit: true }),
  });
  render();
  const el = h('div', { class: 'param param--range' }, header(def.label, host, lo, hi), trackEl);
  return {
    el,
    update(v) {
      cur = [...(v as [number, number])];
      render();
    },
  };
}

export function textControl(def: TextParam, value: string, host: ControlHost): Control {
  const ta = def.multiline
    ? (h('textarea', { class: 'param__text', rows: 3, value, spellcheck: false }) as HTMLTextAreaElement)
    : (h('input', { class: 'param__text', type: 'text', value, spellcheck: false }) as HTMLInputElement);
  ta.addEventListener('input', () => host.set(ta.value, { commit: false }));
  ta.addEventListener('change', () => host.set(ta.value, { commit: true }));
  const el = h('div', { class: 'param param--text' }, header(def.label, host), ta);
  return {
    el,
    update(v) {
      if (document.activeElement !== ta) ta.value = String(v ?? '');
    },
  };
}
