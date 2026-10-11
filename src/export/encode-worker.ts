// Web worker: receives raw rows from the main thread and encodes PNG / JPEG / WebP.

import { PngEncoder } from './png';
import { JpegEncoder } from './jpeg';

export type EncodeStart = {
  type: 'start';
  format: 'png' | 'jpeg' | 'webp';
  width: number;
  height: number;
  quality: number;
  bitDepth: 8 | 16;
  alpha: boolean;
};
export type EncodeRows = { type: 'rows'; data: ArrayBuffer; rows: number; float: boolean };
export type EncodeEnd = { type: 'end' };
export type EncodeMsg = EncodeStart | EncodeRows | EncodeEnd | { type: 'abort' };

let png: PngEncoder | null = null;
let jpeg: JpegEncoder | null = null;
let webp: { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D; y: number; quality: number } | null = null;
let queue: Promise<void> = Promise.resolve();

function post(msg: unknown) {
  (self as unknown as Worker).postMessage(msg);
}

self.onmessage = (e: MessageEvent<EncodeMsg>) => {
  const m = e.data;
  queue = queue.then(() => handle(m)).catch((err) => {
    post({ type: 'error', message: String((err as Error)?.message ?? err) });
  });
};

async function handle(m: EncodeMsg): Promise<void> {
  if (m.type === 'start') {
    png = null;
    jpeg = null;
    webp = null;
    if (m.format === 'png') png = new PngEncoder({ width: m.width, height: m.height, bitDepth: m.bitDepth, alpha: m.alpha });
    else if (m.format === 'jpeg') jpeg = new JpegEncoder({ width: m.width, height: m.height, quality: Math.round(m.quality * 100) });
    else {
      const canvas = new OffscreenCanvas(m.width, m.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not allocate a canvas this large for WebP encoding');
      webp = { canvas, ctx, y: 0, quality: m.quality };
    }
    post({ type: 'ready' });
  } else if (m.type === 'rows') {
    if (png) await png.addRows(m.float ? new Float32Array(m.data) : new Uint8Array(m.data), m.rows);
    else if (jpeg) jpeg.addRows(new Uint8Array(m.data), m.rows);
    else if (webp) {
      const w = webp.canvas.width;
      const img = new ImageData(new Uint8ClampedArray(m.data), w, m.rows);
      webp.ctx.putImageData(img, 0, webp.y);
      webp.y += m.rows;
    }
    post({ type: 'ack', rows: m.rows });
  } else if (m.type === 'end') {
    let blob: Blob;
    if (png) blob = await png.finish();
    else if (jpeg) blob = jpeg.finish();
    else if (webp) blob = await webp.canvas.convertToBlob({ type: 'image/webp', quality: webp.quality });
    else throw new Error('Encoder not started');
    png = null;
    jpeg = null;
    webp = null;
    post({ type: 'done', blob });
  } else if (m.type === 'abort') {
    png?.abort();
    png = null;
    jpeg = null;
    webp = null;
  }
}
