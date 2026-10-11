// Rich parameter editors: XY plane, curves, gradients, color wheels, palettes, patterns.

import type {
  CurveParam,
  CurvePoint,
  GradientParam,
  GradientStop,
  PaletteParam,
  ParamValue,
  PatternsParam,
  Vec2Param,
  WheelParam,
} from '../../engine/types';
import { evalCurve, evalGradient, hexToRgb, rgbToHex } from '../../engine/luts';
import { clamp, formatNumber, h, onDrag, svg } from '../dom';
import { icon } from '../icons';
import { header, numberInput, type Control, type ControlHost } from './basic';

// ---------------------------------------------------------------- XY plane

export function planeControl(def: Vec2Param, value: [number, number], host: ControlHost, aspect: () => number): Control {
  const min = def.min ?? [-1, -1];
  const max = def.max ?? [1, 1];
  const step = def.step ?? 0.01;
  let cur: [number, number] = [...value];
  const nx = numberInput(cur[0], step, (v) => apply([v, cur[1]], true));
  const ny = numberInput(cur[1], step, (v) => apply([cur[0], v], true));
  const dot = h('div', { class: 'plane__point' });
  const box = h('div', { class: 'plane' }, h('div', { class: 'plane__axis plane__axis--x' }), h('div', { class: 'plane__axis plane__axis--y' }), dot);
  const render = () => {
    const tx = (cur[0] - min[0]) / (max[0] - min[0]);
    const ty = (cur[1] - min[1]) / (max[1] - min[1]);
    dot.style.left = clamp(tx, 0, 1) * 100 + '%';
    dot.style.top = (1 - clamp(ty, 0, 1)) * 100 + '%';
    if (document.activeElement !== nx) nx.value = formatNumber(cur[0], step);
    if (document.activeElement !== ny) ny.value = formatNumber(cur[1], step);
  };
  const apply = (v: [number, number], commit: boolean) => {
    cur = v;
    render();
    host.set([...v] as [number, number], { commit });
  };
  const fromEvent = (e: PointerEvent): [number, number] => {
    const r = box.getBoundingClientRect();
    const tx = clamp((e.clientX - r.left) / r.width, 0, 1);
    const ty = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    const q = (t: number, a: number, b: number) => parseFloat((Math.round((a + t * (b - a)) / step) * step).toFixed(5));
    return [q(tx, min[0], max[0]), q(ty, min[1], max[1])];
  };
  onDrag(box, { move: (e) => apply(fromEvent(e), false), end: (e) => apply(fromEvent(e), true) });
  box.addEventListener('dblclick', () => host.reset());
  // Match the plane's shape to the image so positions read naturally.
  const ro = new ResizeObserver(() => {
    const a = clamp(aspect(), 0.4, 2.5);
    box.style.aspectRatio = String(a);
  });
  ro.observe(box);
  render();
  const el = h('div', { class: 'param param--plane' }, header(def.label, host, nx, ny), box);
  return {
    el,
    update(v) {
      cur = [...(v as [number, number])];
      render();
    },
  };
}

// ---------------------------------------------------------------- curves

export function curveControl(def: CurveParam, value: CurvePoint[], host: ControlHost): Control {
  let pts: CurvePoint[] = value.map((p) => [...p] as CurvePoint);
  const W = 240;
  const H = 160;
  const path = svg('path', { class: 'curve__line', d: '', stroke: def.color ?? 'currentColor' });
  const diag = svg('line', { class: 'curve__diag', x1: 0, y1: H, x2: W, y2: 0 });
  const grid = svg('g', { class: 'curve__grid' });
  for (let i = 1; i < 4; i++) {
    grid.append(svg('line', { x1: (W * i) / 4, y1: 0, x2: (W * i) / 4, y2: H }));
    grid.append(svg('line', { x1: 0, y1: (H * i) / 4, x2: W, y2: (H * i) / 4 }));
  }
  const handles = svg('g');
  const root = svg('svg', { class: 'curve__svg', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none' }, grid, def.periodic ? null : diag, path, handles);
  const bg = def.hueBackground ? h('div', { class: 'curve__hue' }) : null;
  const box = h('div', { class: 'curve' }, bg, root as unknown as HTMLElement);
  let active = -1;

  const render = () => {
    const f = evalCurve(pts, def.periodic);
    let d = '';
    for (let i = 0; i <= 96; i++) {
      const x = i / 96;
      const y = clamp(f(x), -0.05, 1.05);
      d += (i ? 'L' : 'M') + (x * W).toFixed(2) + ' ' + ((1 - y) * H).toFixed(2);
    }
    path.setAttribute('d', d);
    handles.innerHTML = '';
    pts.forEach((p, i) => {
      handles.append(svg('circle', { class: 'curve__pt' + (i === active ? ' is-active' : ''), cx: p[0] * W, cy: (1 - p[1]) * H, r: 5 }));
    });
  };

  const toCurve = (e: PointerEvent): CurvePoint => {
    const r = box.getBoundingClientRect();
    return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp(1 - (e.clientY - r.top) / r.height, 0, 1)];
  };
  const emit = (commit: boolean) => host.set(pts.map((p) => [round3(p[0]), round3(p[1])] as CurvePoint), { commit });

  let removing = false;
  onDrag(box, {
    start: (e) => {
      const [x, y] = toCurve(e);
      const r = box.getBoundingClientRect();
      const tol = 10 / r.width;
      active = pts.findIndex((p) => Math.abs(p[0] - x) < tol && Math.abs(p[1] - y) < (10 / r.height) * 1.2);
      if (active < 0) {
        const f = evalCurve(pts, def.periodic);
        // Click near the curve inserts a point on it; elsewhere inserts at the cursor.
        const yy = Math.abs(f(x) - y) < 0.08 ? f(x) : y;
        pts.push([x, yy]);
        pts.sort((a, b) => a[0] - b[0]);
        active = pts.findIndex((p) => p[0] === x);
      }
      removing = false;
    },
    move: (e) => {
      if (active < 0) return;
      const r = box.getBoundingClientRect();
      const outside = e.clientY < r.top - 24 || e.clientY > r.bottom + 24;
      const endpoint = !def.periodic && (active === 0 || active === pts.length - 1);
      removing = outside && pts.length > 2 && !endpoint;
      let [x, y] = toCurve(e);
      // Keep points ordered: clamp x between neighbours.
      const lo = active > 0 ? pts[active - 1][0] + 0.005 : 0;
      const hi = active < pts.length - 1 ? pts[active + 1][0] - 0.005 : 1;
      x = clamp(x, lo, hi);
      if (!def.periodic && active === 0 && pts.length > 1 && !e.shiftKey) x = Math.min(x, hi);
      pts[active] = [x, y];
      box.classList.toggle('is-removing', removing);
      render();
      emit(false);
    },
    end: () => {
      if (removing && active >= 0) pts.splice(active, 1);
      box.classList.remove('is-removing');
      active = -1;
      render();
      emit(true);
    },
  });
  box.addEventListener('dblclick', (e) => {
    const r = box.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = 1 - (e.clientY - r.top) / r.height;
    const i = pts.findIndex((p) => Math.abs(p[0] - x) < 0.04 && Math.abs(p[1] - y) < 0.06);
    if (i >= 0 && pts.length > 2) {
      pts.splice(i, 1);
      render();
      emit(true);
    }
  });
  const resetBtn = h('button', { class: 'icon-button icon-button--tiny', type: 'button', title: 'Reset curve', onclick: () => host.reset() }, icon('reset', 14));
  render();
  const el = h('div', { class: 'param param--curve' }, header(def.label, host, resetBtn), box, h('div', { class: 'param__hint' }, 'Click to add · drag off to remove'));
  return {
    el,
    update(v) {
      if (active >= 0) return;
      pts = (v as CurvePoint[]).map((p) => [...p] as CurvePoint);
      render();
    },
  };
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------- gradient

export function gradientControl(def: GradientParam, value: GradientStop[], host: ControlHost): Control {
  const evalG = def.evaluate ?? evalGradient;
  let stops: GradientStop[] = value.map((s) => ({ ...s }));
  let selected = 0;
  const bar = h('div', { class: 'gradient__bar' });
  const stopsRow = h('div', { class: 'gradient__stops' });
  const midsRow = h('div', { class: 'gradient__mids' });
  const picker = h('input', { type: 'color', class: 'gradient__picker' }) as HTMLInputElement;
  const posInput = numberInput(0, 0.01, (v) => {
    if (!stops[selected]) return;
    stops[selected].pos = clamp(v, 0, 1);
    sortKeep();
    render();
    emit(true);
  }, { min: 0, max: 1 });
  const colorSwatch = h('span', { class: 'color__swatch' }, picker);
  const delBtn = h('button', { class: 'icon-button icon-button--tiny', type: 'button', title: 'Remove stop', onclick: () => removeStop(selected) }, icon('trash', 14));
  const reverseBtn = h('button', { class: 'icon-button icon-button--tiny', type: 'button', title: 'Reverse', onclick: () => reverse() }, icon('flipH', 14));

  const emit = (commit: boolean) => host.set(stops.map((s) => ({ ...s, pos: round3(s.pos) })), { commit });
  const sortKeep = () => {
    const sel = stops[selected];
    stops.sort((a, b) => a.pos - b.pos);
    selected = stops.indexOf(sel);
  };
  const removeStop = (i: number) => {
    if (stops.length <= 2) return;
    stops.splice(i, 1);
    selected = Math.max(0, Math.min(selected, stops.length - 1));
    render();
    emit(true);
  };
  const reverse = () => {
    stops = stops.map((s) => ({ ...s, pos: 1 - s.pos })).reverse();
    // midpoints belong to the segment after each stop; reversing flips them.
    const mids = stops.map((s) => s.mid);
    stops.forEach((s, i) => (s.mid = i < stops.length - 1 ? 1 - (mids[i + 1] ?? 0.5) : 0.5));
    render();
    emit(true);
  };

  const render = () => {
    bar.style.background = gradientCss(stops, evalG);
    stopsRow.innerHTML = '';
    stops.forEach((s, i) => {
      const st = h('div', { class: ['gradient__stop', i === selected && 'is-selected'], style: { left: s.pos * 100 + '%', '--c': s.color } });
      let moved = false;
      let removing = false;
      onDrag(st, {
        start: () => {
          selected = i;
          moved = false;
          syncInspector();
          stopsRow.querySelectorAll('.gradient__stop').forEach((n, k) => n.classList.toggle('is-selected', k === i));
        },
        move: (e) => {
          const r = bar.getBoundingClientRect();
          const p = clamp((e.clientX - r.left) / r.width, 0, 1);
          removing = stops.length > 2 && e.clientY > r.bottom + 40;
          st.classList.toggle('is-removing', removing);
          if (Math.abs(p - stops[selected].pos) > 0.001) moved = true;
          stops[selected].pos = p;
          st.style.left = p * 100 + '%';
          bar.style.background = gradientCss(stops, evalG);
          renderMids();
          syncInspector();
          emit(false);
        },
        end: () => {
          if (removing) {
            removeStop(selected);
            return;
          }
          sortKeep();
          render();
          emit(true);
          if (!moved) picker.click();
        },
      });
      stopsRow.append(st);
    });
    renderMids();
    syncInspector();
  };
  const renderMids = () => {
    midsRow.innerHTML = '';
    const sorted = [...stops].sort((a, b) => a.pos - b.pos);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const m = a.mid ?? 0.5;
      const mid = h('div', { class: 'gradient__mid', style: { left: (a.pos + (b.pos - a.pos) * m) * 100 + '%' }, title: 'Midpoint' });
      onDrag(mid, {
        move: (e) => {
          const r = bar.getBoundingClientRect();
          const p = clamp((e.clientX - r.left) / r.width, a.pos, b.pos);
          a.mid = clamp((p - a.pos) / Math.max(1e-6, b.pos - a.pos), 0.05, 0.95);
          mid.style.left = (a.pos + (b.pos - a.pos) * a.mid) * 100 + '%';
          bar.style.background = gradientCss(stops, evalG);
          emit(false);
        },
        end: () => emit(true),
      });
      mid.addEventListener('dblclick', () => {
        a.mid = 0.5;
        render();
        emit(true);
      });
      midsRow.append(mid);
    }
  };
  const syncInspector = () => {
    const s = stops[selected];
    if (!s) return;
    picker.value = s.color;
    colorSwatch.style.background = s.color;
    if (document.activeElement !== posInput) posInput.value = formatNumber(s.pos, 0.01);
  };
  picker.addEventListener('input', () => {
    if (!stops[selected]) return;
    stops[selected].color = picker.value;
    render();
    emit(false);
  });
  picker.addEventListener('change', () => emit(true));
  bar.addEventListener('pointerdown', (e) => {
    const r = bar.getBoundingClientRect();
    const p = clamp((e.clientX - r.left) / r.width, 0, 1);
    const c = evalG(stops, p);
    stops.push({ pos: p, color: rgbToHex(c[0], c[1], c[2]), mid: 0.5 });
    selected = stops.length - 1;
    sortKeep();
    render();
    emit(true);
  });
  render();
  const el = h(
    'div',
    { class: 'param param--gradient' },
    header(def.label, host, reverseBtn),
    h('div', { class: 'gradient' }, bar, midsRow, stopsRow),
    h('div', { class: 'gradient__inspector' }, colorSwatch, h('span', { class: 'param__hint' }, 'Location'), posInput, delBtn),
  );
  return {
    el,
    update(v) {
      const next = (v as GradientStop[]).map((s) => ({ ...s }));
      if (JSON.stringify(next) === JSON.stringify(stops)) return;
      stops = next;
      selected = Math.min(selected, stops.length - 1);
      render();
    },
  };
}

function gradientCss(stops: GradientStop[], evalG: (s: GradientStop[], t: number) => [number, number, number] = evalGradient): string {
  const css: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const c = evalG(stops, t);
    css.push(`${rgbToHex(c[0], c[1], c[2])} ${(t * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${css.join(',')})`;
}

// ---------------------------------------------------------------- color wheel

export function wheelControl(def: WheelParam, value: [number, number], host: ControlHost): Control {
  let cur: [number, number] = [...value];
  const hueIn = numberInput(cur[0], 1, (v) => apply([((v % 360) + 360) % 360, cur[1]], true), { min: 0, max: 360 });
  const amtIn = numberInput(cur[1], 0.01, (v) => apply([cur[0], clamp(v, 0, 1)], true), { min: 0, max: 1 });
  const dot = h('div', { class: 'wheel__point' });
  const disc = h('div', { class: 'wheel__disc' }, h('div', { class: 'wheel__center' }), dot);
  const render = () => {
    const a = (cur[0] * Math.PI) / 180;
    dot.style.left = 50 + Math.cos(a) * cur[1] * 50 + '%';
    dot.style.top = 50 - Math.sin(a) * cur[1] * 50 + '%';
    if (document.activeElement !== hueIn) hueIn.value = formatNumber(cur[0], 1);
    if (document.activeElement !== amtIn) amtIn.value = formatNumber(cur[1], 0.01);
  };
  const apply = (v: [number, number], commit: boolean) => {
    cur = v;
    render();
    host.set([...v] as [number, number], { commit });
  };
  const fromEvent = (e: PointerEvent): [number, number] => {
    const r = disc.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    let hue = (Math.atan2(y, x) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    const amt = clamp(Math.hypot(x, y), 0, 1);
    return [Math.round(hue), Math.round(amt * 100) / 100];
  };
  onDrag(disc, { move: (e) => apply(fromEvent(e), false), end: (e) => apply(fromEvent(e), true) });
  disc.addEventListener('dblclick', () => host.reset());
  render();
  const el = h(
    'div',
    { class: 'param param--wheel' },
    header(def.label, host, hueIn, h('span', { class: 'param__unit' }, '°'), amtIn),
    h('div', { class: 'wheel' }, disc),
  );
  return {
    el,
    update(v) {
      cur = [...(v as [number, number])];
      render();
    },
  };
}

// ---------------------------------------------------------------- palette

export function paletteControl(def: PaletteParam, value: string[], host: ControlHost): Control {
  let cols = [...value];
  const max = def.maxColors ?? 32;
  const grid = h('div', { class: 'palette' });
  const emit = () => host.set([...cols], { commit: true });
  const render = () => {
    grid.innerHTML = '';
    cols.forEach((c, i) => {
      const inp = h('input', { type: 'color', value: c, class: 'palette__input' }) as HTMLInputElement;
      inp.addEventListener('input', () => {
        cols[i] = inp.value;
        sw.style.background = inp.value;
        host.set([...cols], { commit: false });
      });
      inp.addEventListener('change', emit);
      const sw = h('label', { class: 'palette__swatch', style: { background: c }, title: c + ' · right-click to remove' }, inp);
      sw.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (cols.length <= 1) return;
        cols.splice(i, 1);
        render();
        emit();
      });
      grid.append(sw);
    });
    if (cols.length < max) {
      grid.append(
        h('button', {
          class: 'palette__add',
          type: 'button',
          title: 'Add color',
          onclick: () => {
            cols.push(cols[cols.length - 1] ?? '#ffffff');
            render();
            emit();
          },
        }, icon('plus', 14)),
      );
    }
  };
  render();
  const el = h('div', { class: 'param param--palette' }, header(def.label, host), grid);
  return {
    el,
    update(v) {
      const next = [...(v as string[])];
      if (next.join() === cols.join()) return;
      cols = next;
      render();
    },
  };
}

// ---------------------------------------------------------------- 8x8 pattern swatches

export function patternsControl(def: PatternsParam, value: string[], host: ControlHost): Control {
  let sel = new Set(value);
  const grid = h('div', { class: 'patterns' });
  const render = () => {
    grid.innerHTML = '';
    def.patterns.forEach((pat, i) => {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const cx = c.getContext('2d')!;
      const img = cx.createImageData(16, 16);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const on = (pat[y % 8] >> (7 - (x % 8))) & 1;
          const o = (y * 16 + x) * 4;
          const v = on ? 20 : 240;
          img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
          img.data[o + 3] = 255;
        }
      cx.putImageData(img, 0, 0);
      const b = h('button', {
        class: ['patterns__swatch', sel.has(String(i)) && 'is-selected'],
        type: 'button',
        title: `Pattern ${i + 1}`,
        onclick: () => {
          const k = String(i);
          if (sel.has(k)) {
            if (sel.size > 1) sel.delete(k);
          } else sel.add(k);
          render();
          host.set(orderedSelection(), { commit: true });
        },
      }, c);
      grid.append(b);
    });
  };
  const orderedSelection = () => [...sel].sort((a, b) => +a - +b);
  render();
  const el = h('div', { class: 'param param--patterns' }, header(def.label, host), grid);
  return {
    el,
    update(v) {
      sel = new Set(v as string[]);
      render();
    },
  };
}

export function hexLuma(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export type { ParamValue };
