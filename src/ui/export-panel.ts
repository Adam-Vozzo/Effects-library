// Export popover (format / quality / size up to 16K) and the progress dialog.

import type { Renderer } from '../engine/renderer';
import type { ExportSettings, Store } from '../state/store';
import { chooseFormat, estimateGpuBytes, exportSize, maxExportSide } from '../export/exporter';
import { h } from './dom';
import { icon } from './icons';
import { modal, openPopover } from './menu';

const LONG_PRESETS = [1080, 2048, 3840, 4096, 6000, 8192, 12288, 16384];
const SCALES = [0.25, 0.5, 1, 1.5, 2, 3, 4];

export function openExportPanel(
  anchor: HTMLElement,
  store: Store,
  renderer: Renderer,
  croppedSize: () => [number, number],
  run: () => void,
): void {
  const body = h('div', { class: 'export' });
  const close = openPopover(anchor, body, { placement: 'above', align: 'end' });
  const patch = (p: Partial<ExportSettings>) => {
    store.set({ export: { ...store.state.export, ...p } });
    render();
  };

  const render = () => {
    const s = store.state.export;
    const [sw, sh] = croppedSize();
    const { w, h: hh } = exportSize(s, sw, sh);
    const max = maxExportSide(renderer);
    const tooBig = w > max || hh > max;
    const webpTooBig = s.format === 'webp' && (w > 16383 || hh > 16383);
    const fmt = chooseFormat(renderer, w, hh, s.format === 'png' ? s.bitDepth : 8);
    const mem = estimateGpuBytes(w, hh, fmt);
    body.replaceChildren(
      ...([
      h('div', { class: 'export__title' }, 'Export image'),
      field(
        'Format',
        segmented(
          [
            ['png', 'PNG'],
            ['jpeg', 'JPG'],
            ['webp', 'WEBP'],
          ],
          s.format,
          (v) => patch({ format: v as ExportSettings['format'] }),
        ),
      ),
      s.format === 'png'
        ? field(
            'Bit depth',
            segmented(
              [
                ['8', '8-bit'],
                ['16', '16-bit'],
              ],
              String(s.bitDepth),
              (v) => patch({ bitDepth: Number(v) as 8 | 16 }),
            ),
          )
        : field('Quality', qualitySlider(s.quality, (q) => patch({ quality: q }))),
      field(
        'Size',
        segmented(
          [
            ['original', 'Original'],
            ['scale', 'Scale'],
            ['long', 'Long side'],
            ['custom', 'Custom'],
          ],
          s.sizeMode,
          (v) => patch({ sizeMode: v as ExportSettings['sizeMode'] }),
        ),
      ),
      s.sizeMode === 'scale'
        ? h('div', { class: 'chips' }, ...SCALES.map((k) => chip(`${k}×`, s.scale === k, () => patch({ scale: k }))))
        : null,
      s.sizeMode === 'long'
        ? h(
            'div',
            { class: 'chips' },
            ...LONG_PRESETS.map((k) => chip(k >= 1000 && k % 1024 === 0 ? `${k / 1024}K` : k === 3840 ? '4K UHD' : `${k}`, s.longSide === k, () => patch({ longSide: k }), k > max)),
          )
        : null,
      s.sizeMode === 'custom' ? customSize(s, sw, sh, (p) => patch(p)) : null,
      h(
        'div',
        { class: ['export__summary', (tooBig || webpTooBig) && 'is-error'] },
        h('strong', null, `${w} × ${hh}px`),
        h('span', null, `${((w * hh) / 1e6).toFixed(1)} MP · ~${formatBytes(mem)} GPU · ${fmt === 'rgba16f' ? '16-bit float' : '8-bit'} pipeline`),
        tooBig ? h('span', null, `Exceeds this GPU's limit of ${max}px per side.`) : null,
        webpTooBig ? h('span', null, 'WebP supports up to 16383px per side.') : null,
      ),
      h(
        'button',
        {
          class: 'button button--primary button--block',
          type: 'button',
          disabled: tooBig || webpTooBig || !store.state.source,
          onclick: () => {
            close();
            run();
          },
        },
        icon('download', 16),
        'Export',
      ),
      ] as (HTMLElement | null)[]).filter((x): x is HTMLElement => !!x),
    );
  };
  render();
}

function field(label: string, control: HTMLElement): HTMLElement {
  return h('div', { class: 'export__field' }, h('span', { class: 'export__label' }, label), control);
}

function segmented(opts: [string, string][], value: string, onChange: (v: string) => void): HTMLElement {
  return h(
    'div',
    { class: 'switcher' },
    ...opts.map(([v, l]) => h('button', { class: ['switcher__item', v === value && 'is-active'], type: 'button', onclick: () => onChange(v) }, l)),
  );
}

function chip(label: string, active: boolean, onClick: () => void, disabled = false): HTMLElement {
  return h('button', { class: ['chip', active && 'is-active'], type: 'button', disabled, onclick: onClick }, label);
}

function qualitySlider(q: number, onChange: (q: number) => void): HTMLElement {
  const out = h('span', { class: 'export__value' }, `${Math.round(q * 100)}`);
  const input = h('input', { class: 'range', type: 'range', min: 10, max: 100, step: 1, value: Math.round(q * 100) }) as HTMLInputElement;
  input.addEventListener('input', () => (out.textContent = input.value));
  input.addEventListener('change', () => onChange(Number(input.value) / 100));
  return h('div', { class: 'export__quality' }, input, out);
}

function customSize(s: ExportSettings, sw: number, sh: number, patch: (p: Partial<ExportSettings>) => void): HTMLElement {
  const aspect = sw / sh;
  const wi = h('input', { class: 'input input--small', type: 'number', min: 1, max: 16384, value: s.customW || sw }) as HTMLInputElement;
  const hi = h('input', { class: 'input input--small', type: 'number', min: 1, max: 16384, value: s.customH || sh }) as HTMLInputElement;
  const lock = h('input', { type: 'checkbox', checked: true }) as HTMLInputElement;
  wi.addEventListener('change', () => {
    const w = Math.max(1, Math.round(Number(wi.value)));
    patch({ customW: w, customH: lock.checked ? Math.round(w / aspect) : Number(hi.value) });
  });
  hi.addEventListener('change', () => {
    const hh = Math.max(1, Math.round(Number(hi.value)));
    patch({ customH: hh, customW: lock.checked ? Math.round(hh * aspect) : Number(wi.value) });
  });
  return h('div', { class: 'export__custom' }, wi, h('span', null, '×'), hi, h('label', { class: 'export__lock' }, lock, 'Keep ratio'));
}

export function formatBytes(n: number): string {
  if (n >= 1 << 30) return (n / (1 << 30)).toFixed(1) + ' GB';
  if (n >= 1 << 20) return Math.round(n / (1 << 20)) + ' MB';
  return Math.round(n / 1024) + ' KB';
}

/** Modal with a progress bar; returns updater + closer. */
export function progressDialog(title: string, onCancel: () => void): { update(p: number, detail: string): void; close(): void } {
  const bar = h('div', { class: 'progress__bar' });
  const detail = h('div', { class: 'progress__detail' }, 'Preparing…');
  const cancel = h('button', { class: 'button', type: 'button', onclick: () => onCancel() }, 'Cancel');
  const body = h('div', { class: 'modal__body' }, h('div', { class: 'progress' }, bar), detail, h('div', { class: 'modal__actions' }, cancel));
  const m = modal(title, body, { dismissable: false });
  return {
    update(p, d) {
      bar.style.width = Math.round(Math.min(1, Math.max(0, p)) * 100) + '%';
      detail.textContent = d;
    },
    close: () => m.close(),
  };
}
