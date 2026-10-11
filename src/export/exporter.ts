// High-resolution export: tiled GPU render at the target size, strip readback, worker encoding.

import type { Renderer } from '../engine/renderer';
import type { TexFormat } from '../engine/gl';
import type { Crop, Layer } from '../engine/types';
import type { ExportSettings } from '../state/store';
import type { EncodeMsg } from './encode-worker';
import { REFERENCE_LONG_SIDE } from '../engine/units';

export { REFERENCE_LONG_SIDE } from '../engine/units';
export const MAX_EXPORT_SIDE = 16384;

export interface ExportJob {
  layers: Layer[];
  crop: Crop | null;
  time: number;
  /** Cropped source size in px. */
  sourceW: number;
  sourceH: number;
  settings: ExportSettings;
  /** Units for effect params: 'relative' (720 px long side reference) or 'source' pixels. */
  units: 'relative' | 'source';
}

export interface ExportProgress {
  stage: 'render' | 'encode' | 'done';
  /** 0..1 */
  progress: number;
  detail: string;
}

export function exportSize(s: ExportSettings, sw: number, sh: number): { w: number; h: number } {
  let w = sw;
  let h = sh;
  if (s.sizeMode === 'scale') {
    w = sw * s.scale;
    h = sh * s.scale;
  } else if (s.sizeMode === 'long') {
    const k = s.longSide / Math.max(sw, sh);
    w = sw * k;
    h = sh * k;
  } else if (s.sizeMode === 'custom') {
    w = s.customW;
    h = s.customH;
  }
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
}

export function maxExportSide(r: Renderer): number {
  const c = r.caps;
  return Math.min(MAX_EXPORT_SIDE, c.maxTextureSize, c.maxRenderbufferSize, c.maxViewport[0], c.maxViewport[1]);
}

/** Bytes of GPU memory a render at this size needs (rough: 3 full-size targets + 1 readback copy). */
export function estimateGpuBytes(w: number, h: number, format: TexFormat): number {
  const px = w * h;
  return px * (format === 'rgba16f' ? 8 : 4) * 3 + px * 4;
}

export function chooseFormat(r: Renderer, w: number, h: number, bitDepth: 8 | 16): TexFormat {
  if (!r.caps.floatTargets) return 'rgba8';
  if (bitDepth === 16) return 'rgba16f';
  // Half-float intermediates avoid banding; above ~67 MP fall back to 8-bit to save VRAM.
  return w * h > 8192 * 8192 ? 'rgba8' : 'rgba16f';
}

export async function runExport(r: Renderer, job: ExportJob, onProgress: (p: ExportProgress) => void, signal: AbortSignal): Promise<Blob> {
  const { settings } = job;
  const { w, h } = exportSize(settings, job.sourceW, job.sourceH);
  const max = maxExportSide(r);
  if (w > max || h > max) throw new Error(`This GPU supports exports up to ${max}px per side (requested ${w}×${h}).`);
  if (settings.format === 'webp' && (w > 16383 || h > 16383)) throw new Error('WebP is limited to 16383px per side — use PNG or JPG for 16K.');
  const bitDepth = settings.format === 'png' ? settings.bitDepth : 8;
  const format = chooseFormat(r, w, h, bitDepth);
  const long = Math.max(w, h);
  const pxScale = job.units === 'relative' ? long / REFERENCE_LONG_SIDE : long / Math.max(job.sourceW, job.sourceH);
  const gl = r.gl;

  onProgress({ stage: 'render', progress: 0, detail: `Rendering ${w}×${h}` });
  // Free preview-sized targets first so the big ones fit.
  r.pool.trim();
  let out;
  try {
    out = await r.renderChainAsync(
      job.layers,
      {
        width: w,
        height: h,
        pxScale,
        time: job.time,
        format,
        crop: job.crop,
        exporting: true,
        tileSize: 1024,
        onLayer: (i, n) => onProgress({ stage: 'render', progress: (i + 1) / Math.max(1, n), detail: `Rendering layer ${i + 1} of ${n}` }),
      },
      signal,
    );
  } catch (e) {
    r.pool.trim();
    throw e instanceof DOMException && e.name === 'AbortError' ? e : wrapGlError(e, gl, w, h);
  }
  const err = gl.getError();
  if (err === gl.OUT_OF_MEMORY) {
    r.pool.release(out);
    r.pool.trim();
    throw new Error(`The GPU ran out of memory rendering ${w}×${h}. Try a smaller size or fewer layers.`);
  }
  await r.gpuIdle();

  // Detect transparency so opaque images are written as RGB.
  const hasAlpha = settings.format === 'png' && r.minAlpha(out) < 0.999;
  const readTex = bitDepth === 16 ? out : out.format === 'rgba8' ? out : r.toRGBA8(out, true);
  if (readTex !== out) r.pool.release(out);

  const worker = new Worker(new URL('./encode-worker.ts', import.meta.url), { type: 'module' });
  let inflight = 0;
  let waiters: (() => void)[] = [];
  let failure: Error | null = null;
  let resolveDone: (b: Blob) => void = () => undefined;
  let rejectDone: (e: Error) => void = () => undefined;
  const done = new Promise<Blob>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'ack') {
      inflight--;
      waiters.splice(0).forEach((f) => f());
    } else if (m.type === 'done') resolveDone(m.blob);
    else if (m.type === 'error') {
      failure = new Error(m.message);
      rejectDone(failure);
      waiters.splice(0).forEach((f) => f());
    }
  };
  worker.onerror = (e) => {
    failure = new Error(e.message || 'Encoder worker failed');
    rejectDone(failure);
  };
  const send = (m: EncodeMsg, transfer: Transferable[] = []) => worker.postMessage(m, transfer);
  try {
    send({ type: 'start', format: settings.format, width: w, height: h, quality: settings.quality, bitDepth, alpha: hasAlpha });
    const bytesPerRow = w * (bitDepth === 16 ? 16 : 4);
    // ~24 MB per strip, multiple of 16 rows (JPEG MCU height).
    const strip = Math.max(16, Math.floor((24 << 20) / bytesPerRow / 16) * 16);
    for (let y = 0; y < h; y += strip) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      if (failure) throw failure;
      while (inflight >= 3) await new Promise<void>((res) => waiters.push(res));
      const rows = Math.min(strip, h - y);
      if (bitDepth === 16) {
        const buf = r.readRowsFloat(readTex, y, rows);
        send({ type: 'rows', data: buf.buffer as ArrayBuffer, rows, float: true }, [buf.buffer as ArrayBuffer]);
      } else {
        const buf = r.readRowsRGBA8(readTex, y, rows);
        send({ type: 'rows', data: buf.buffer as ArrayBuffer, rows, float: false }, [buf.buffer as ArrayBuffer]);
      }
      inflight++;
      onProgress({ stage: 'encode', progress: (y + rows) / h, detail: `Encoding ${settings.format.toUpperCase()} · ${Math.round(((y + rows) / h) * 100)}%` });
      // Yield so the progress UI can paint.
      await new Promise((res) => setTimeout(res, 0));
    }
    r.pool.release(readTex);
    r.pool.trim();
    send({ type: 'end' });
    const blob = await done;
    onProgress({ stage: 'done', progress: 1, detail: `Done · ${(blob.size / 1048576).toFixed(1)} MB` });
    return blob;
  } catch (e) {
    send({ type: 'abort' });
    throw e;
  } finally {
    r.pool.release(readTex);
    r.pool.trim();
    waiters = [];
    setTimeout(() => worker.terminate(), 100);
  }
}

function wrapGlError(e: unknown, gl: WebGL2RenderingContext, w: number, h: number): Error {
  if (gl.isContextLost()) return new Error(`The GPU reset while rendering ${w}×${h} (likely out of memory). Try a smaller size.`);
  const msg = (e as Error)?.message ?? String(e);
  if (/Framebuffer incomplete|out of memory/i.test(msg)) return new Error(`Could not allocate ${w}×${h} render targets on this GPU. Try a smaller size.`);
  return e instanceof Error ? e : new Error(msg);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
