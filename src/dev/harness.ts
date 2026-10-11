// Developer harness: renders effects on a sample image without the editor UI.
//   harness.html?fx=gaussian-blur,duotone            one chain (layers bottom→top)
//   harness.html?cat=Blur                             every effect of a category with defaults
//   harness.html?all=1                                every effect
//   &img=portrait|coffee|bokeh|grapes|street  &size=720  &t=1.5
//   &p.gaussian-blur.strength=30                      param override (JSON or number)
import '../effects';
import { Renderer } from '../engine/renderer';
import { relativePxScale } from '../engine/units';
import { allEffects, defaultParams, getEffect, registrationErrors } from '../effects';
import type { Layer, ParamValue } from '../engine/types';

const q = new URLSearchParams(location.search);
const grid = document.getElementById('grid')!;
const log = document.getElementById('log')!;
const errors: string[] = [];

function report(msg: string) {
  errors.push(msg);
  log.textContent += msg + '\n';
  console.error('HARNESS_ERROR ' + msg);
}

async function loadImage(name: string): Promise<ImageBitmap> {
  const res = await fetch(`/samples/${name}.jpg`);
  return createImageBitmap(await res.blob(), { colorSpaceConversion: 'none' });
}

function parseValue(v: string): ParamValue {
  try {
    return JSON.parse(v) as ParamValue;
  } catch {
    return v;
  }
}

function makeLayers(ids: string[]): Layer[] {
  return ids.map((id, i) => {
    const e = getEffect(id);
    if (!e) throw new Error('Unknown effect ' + id);
    const params = defaultParams(e);
    for (const [k, v] of q) {
      const m = /^p\.([^.]+)\.(.+)$/.exec(k);
      if (m && m[1] === id) params[m[2]] = parseValue(v);
    }
    return { id: 'h' + i, effectId: id, params, visible: true, opacity: 1, blend: 'normal' };
  });
}

async function main() {
  for (const e of registrationErrors) report(e);
  const img = await loadImage(q.get('img') ?? 'portrait');
  const long = Number(q.get('size') ?? 720);
  const s = long / Math.max(img.width, img.height);
  const w = Math.round(img.width * s);
  const h = Math.round(img.height * s);
  const glCanvas = document.createElement('canvas');
  const r = new Renderer(glCanvas);
  r.setSource(img);
  const time = Number(q.get('t') ?? 0);
  // Same scaling as the app (relative units); &units=source emulates the source-pixel setting.
  const pxScale = q.get('units') === 'source' ? w / img.width : relativePxScale(w, h);
  const render = (layers: Layer[]) => {
    const out = r.renderChain(layers, { width: w, height: h, pxScale, time, format: r.defaultFormat, crop: null });
    r.present(out);
    r.pool.release(out);
    const err = r.gl.getError();
    if (err) throw new Error('GL error 0x' + err.toString(16));
  };
  const addCell = (label: string, ok: boolean) => {
    const cell = document.createElement('div');
    cell.className = 'cell' + (ok ? '' : ' err');
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(glCanvas, 0, 0);
    const l = document.createElement('div');
    l.className = 'label';
    l.textContent = label;
    cell.append(l, c);
    grid.append(cell);
  };

  const fx = q.get('fx');
  const cat = q.get('cat');
  if (fx) {
    const ids = fx.split(',').filter(Boolean);
    try {
      const t0 = performance.now();
      render(makeLayers(ids));
      addCell(ids.join(' → ') + ` (${(performance.now() - t0).toFixed(0)} ms)`, true);
    } catch (e) {
      report(String((e as Error).message ?? e));
      addCell(ids.join(' → ') + ' FAILED', false);
    }
  } else {
    const list = allEffects().filter((e) => !e.hidden && (q.get('all') || e.category === cat));
    for (const e of list) {
      try {
        render(makeLayers([e.id]));
        addCell(e.name, true);
      } catch (err) {
        report(`[${e.id}] ` + String((err as Error).message ?? err));
        addCell(e.name + ' FAILED', false);
      }
    }
  }
  (window as unknown as { __done: boolean; __errors: string[] }).__done = true;
  (window as unknown as { __errors: string[] }).__errors = errors;
  console.log('HARNESS_DONE errors=' + errors.length);
}

main().catch((e) => {
  report(String(e?.stack ?? e));
  (window as unknown as { __done: boolean }).__done = true;
});
