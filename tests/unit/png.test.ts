import { describe, expect, it } from 'vitest';
import { PngEncoder, crc32 } from '../../src/export/png';

/** Minimal PNG decoder for round-trip checks (non-interlaced, 8/16-bit RGB/RGBA). */
async function decodePng(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let p = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let ctype = 0;
  const idat: Uint8Array[] = [];
  const types: string[] = [];
  while (p < bytes.length) {
    const len = dv.getUint32(p);
    const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    const data = bytes.subarray(p + 8, p + 8 + len);
    const crc = dv.getUint32(p + 8 + len);
    expect((crc32(bytes.subarray(p + 4, p + 8 + len)) ^ 0xffffffff) >>> 0).toBe(crc);
    types.push(type);
    if (type === 'IHDR') {
      const h = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = h.getUint32(0);
      height = h.getUint32(4);
      depth = data[8];
      ctype = data[9];
    } else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const z = new Blob(idat as BlobPart[]).stream().pipeThrough(new DecompressionStream('deflate'));
  const raw = new Uint8Array(await new Response(z).arrayBuffer());
  const channels = ctype === 6 ? 4 : 3;
  const bpp = channels * (depth / 8);
  const stride = width * bpp;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[y * stride + i - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = i >= bpp && y > 0 ? out[(y - 1) * stride + i - bpp] : 0;
      let pred = 0;
      if (f === 1) pred = a;
      else if (f === 2) pred = b;
      else if (f === 3) pred = (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + i] = (line[i] + pred) & 255;
    }
  }
  return { width, height, depth, ctype, pixels: out, types };
}

function pattern(w: number, h: number): Uint8Array {
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      d[o] = (x * 7 + y * 3) & 255;
      d[o + 1] = (x * y) & 255;
      d[o + 2] = (255 - x) & 255;
      d[o + 3] = (x + y) % 3 === 0 ? 128 : 255;
    }
  return d;
}

describe('PngEncoder', () => {
  it('round-trips 8-bit RGBA across multiple row batches', async () => {
    const w = 37;
    const h = 23;
    const src = pattern(w, h);
    const enc = new PngEncoder({ width: w, height: h, bitDepth: 8, alpha: true });
    await enc.addRows(src.subarray(0, w * 10 * 4), 10);
    await enc.addRows(src.subarray(w * 10 * 4), h - 10);
    const blob = await enc.finish();
    const dec = await decodePng(new Uint8Array(await blob.arrayBuffer()));
    expect(dec.width).toBe(w);
    expect(dec.height).toBe(h);
    expect(dec.ctype).toBe(6);
    expect(dec.types[0]).toBe('IHDR');
    expect(dec.types[dec.types.length - 1]).toBe('IEND');
    expect(dec.pixels.every((v, i) => v === src[i])).toBe(true);
  });

  it('drops alpha for RGB output', async () => {
    const w = 16;
    const h = 9;
    const src = pattern(w, h);
    const enc = new PngEncoder({ width: w, height: h, bitDepth: 8, alpha: false });
    await enc.addRows(src, h);
    const dec = await decodePng(new Uint8Array(await (await enc.finish()).arrayBuffer()));
    expect(dec.ctype).toBe(2);
    for (let i = 0; i < w * h; i++) {
      expect(dec.pixels[i * 3]).toBe(src[i * 4]);
      expect(dec.pixels[i * 3 + 1]).toBe(src[i * 4 + 1]);
      expect(dec.pixels[i * 3 + 2]).toBe(src[i * 4 + 2]);
    }
  });

  it('writes 16-bit samples big-endian from float input', async () => {
    const w = 5;
    const h = 3;
    const src = new Float32Array(w * h * 4);
    for (let i = 0; i < src.length; i++) src[i] = (i % 17) / 16;
    const enc = new PngEncoder({ width: w, height: h, bitDepth: 16, alpha: true });
    await enc.addRows(src, h);
    const dec = await decodePng(new Uint8Array(await (await enc.finish()).arrayBuffer()));
    expect(dec.depth).toBe(16);
    for (let i = 0; i < w * h * 4; i++) {
      const v = (dec.pixels[i * 2] << 8) | dec.pixels[i * 2 + 1];
      expect(v).toBe(Math.round(Math.min(1, src[i]) * 65535));
    }
  });

  it('rejects incomplete images', async () => {
    const enc = new PngEncoder({ width: 4, height: 4, bitDepth: 8, alpha: true });
    await enc.addRows(new Uint8Array(4 * 4 * 2), 2);
    await expect(enc.finish()).rejects.toThrow(/2 of 4/);
  });
});
