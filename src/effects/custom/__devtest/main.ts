// Temporary dev page: like the harness, plus &tex=<sample> loaded as a texture asset (assetId "tex").
import '../../index';
import { Renderer } from '../../../engine/renderer';
import { Texture, mipLevels } from '../../../engine/gl';
import { getEffect, defaultParams } from '../../index';
import { relativePxScale } from '../../../engine/units';
import type { Layer, ParamValue } from '../../../engine/types';

const q = new URLSearchParams(location.search);
async function bitmap(name: string, flip = false): Promise<ImageBitmap> {
  const res = await fetch(`/samples/${name}.jpg`);
  return createImageBitmap(await res.blob(), flip ? { imageOrientation: 'flipY', premultiplyAlpha: 'none' } : { colorSpaceConversion: 'none' });
}
async function main() {
  const img = await bitmap(q.get('img') ?? 'portrait');
  const long = Number(q.get('size') ?? 640);
  const s = long / Math.max(img.width, img.height);
  const w = Math.round(img.width * s), h = Math.round(img.height * s);
  const canvas = document.createElement('canvas');
  const r = new Renderer(canvas);
  r.setSource(img);
  let tex: Texture | null = null;
  if (q.get('tex')) {
    const b = await bitmap(q.get('tex')!, true);
    const gl = r.gl;
    tex = new Texture(gl, b.width, b.height, 'rgba8', { levels: mipLevels(b.width, b.height) });
    gl.bindTexture(gl.TEXTURE_2D, tex.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, b.width, b.height, gl.RGBA, gl.UNSIGNED_BYTE, b);
    gl.generateMipmap(gl.TEXTURE_2D);
    tex.setWrap(true);
  }
  r.assets = { get: (id) => (id === 'tex' ? tex : null) };
  const ids = (q.get('fx') ?? '').split(',').filter(Boolean);
  const layers: Layer[] = ids.map((id, i) => {
    const e = getEffect(id)!;
    const params = defaultParams(e);
    for (const p of e.params) if (p.type === 'texture' && tex) params[p.key] = { assetId: 'tex' };
    for (const [k, v] of q) {
      const m = /^p\.([^.]+)\.(.+)$/.exec(k);
      if (m && m[1] === id) { try { params[m[2]] = JSON.parse(v) as ParamValue; } catch { params[m[2]] = v; } }
    }
    return { id: 'h' + i, effectId: id, params, visible: true, opacity: 1, blend: 'normal' };
  });
  try {
    const out = r.renderChain(layers, { width: w, height: h, pxScale: relativePxScale(w, h), time: Number(q.get('t') ?? 0), format: r.defaultFormat, crop: null });
    r.present(out);
    r.pool.release(out);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(canvas, 0, 0);
    const cell = document.createElement('div');
    cell.className = 'cell';
    const l = document.createElement('div');
    l.textContent = ids.join(',');
    cell.append(l, c);
    document.getElementById('grid')!.append(cell);
  } catch (e) {
    console.error('HARNESS_ERROR ' + String((e as Error).message ?? e));
  }
  (window as unknown as { __done: boolean }).__done = true;
}
main();
