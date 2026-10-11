import { describe, expect, it } from 'vitest';
import { JpegEncoder } from '../../src/export/jpeg';

function gradient(w: number, h: number): Uint8Array {
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      d[o] = Math.round((x / (w - 1)) * 255);
      d[o + 1] = Math.round((y / (h - 1)) * 255);
      d[o + 2] = 128 + Math.round(60 * Math.sin(x / 5));
      d[o + 3] = 255;
    }
  return d;
}

async function encode(w: number, h: number, quality: number, subsample?: boolean, batch = 7) {
  const src = gradient(w, h);
  const enc = new JpegEncoder({ width: w, height: h, quality, subsample });
  for (let y = 0; y < h; y += batch) {
    const rows = Math.min(batch, h - y);
    enc.addRows(src.subarray(y * w * 4, (y + rows) * w * 4), rows);
  }
  return new Uint8Array(await enc.finish().arrayBuffer());
}

describe('JpegEncoder', () => {
  it('writes a well-formed JFIF stream with the right dimensions', async () => {
    for (const sub of [false, true]) {
      const bytes = await encode(53, 29, 85, sub);
      expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
      expect([bytes[bytes.length - 2], bytes[bytes.length - 1]]).toEqual([0xff, 0xd9]);
      // Find SOF0 and check height/width.
      let i = 2;
      let found = false;
      while (i < bytes.length - 9) {
        if (bytes[i] === 0xff && bytes[i + 1] === 0xc0) {
          expect((bytes[i + 5] << 8) | bytes[i + 6]).toBe(29);
          expect((bytes[i + 7] << 8) | bytes[i + 8]).toBe(53);
          expect(bytes[i + 11]).toBe(sub ? 0x22 : 0x11);
          found = true;
          break;
        }
        i++;
      }
      expect(found).toBe(true);
    }
  });

  it('produces smaller files at lower quality', async () => {
    const hi = await encode(128, 96, 95);
    const lo = await encode(128, 96, 30);
    expect(lo.length).toBeLessThan(hi.length);
  });

  it('never emits an unstuffed 0xFF inside entropy-coded data', async () => {
    const bytes = await encode(64, 64, 100, false);
    // Locate SOS then scan to EOI.
    let i = 0;
    while (!(bytes[i] === 0xff && bytes[i + 1] === 0xda)) i++;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    for (let k = i + 2 + len; k < bytes.length - 2; k++) {
      if (bytes[k] === 0xff) expect(bytes[k + 1]).toBe(0);
    }
  });
});
