// Streaming PNG encoder: rows are filtered and deflated incrementally (CompressionStream),
// so arbitrarily large images can be written without holding the whole raster.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array, crc = 0xffffffff): number {
  let c = crc;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return c;
}

function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + data.length)) ^ 0xffffffff;
  dv.setUint32(8 + data.length, crc >>> 0);
  return out;
}

export interface PngOptions {
  width: number;
  height: number;
  bitDepth: 8 | 16;
  alpha: boolean;
  /** Pixels per meter for the pHYs chunk (optional). */
  ppm?: number;
}

export class PngEncoder {
  private parts: BlobPart[] = [];
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private reading: Promise<void>;
  private prev: Uint8Array;
  private cur: Uint8Array;
  private rowBytes: number;
  private bpp: number;
  private rowsWritten = 0;

  constructor(private o: PngOptions) {
    const channels = o.alpha ? 4 : 3;
    this.bpp = channels * (o.bitDepth / 8);
    this.rowBytes = o.width * this.bpp;
    this.prev = new Uint8Array(this.rowBytes);
    this.cur = new Uint8Array(this.rowBytes + 1);
    const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = new Uint8Array(13);
    const dv = new DataView(ihdr.buffer);
    dv.setUint32(0, o.width);
    dv.setUint32(4, o.height);
    ihdr[8] = o.bitDepth;
    ihdr[9] = o.alpha ? 6 : 2;
    this.parts.push(sig, chunk('IHDR', ihdr), chunk('sRGB', new Uint8Array([0])));
    if (o.ppm) {
      const phys = new Uint8Array(9);
      const pv = new DataView(phys.buffer);
      pv.setUint32(0, o.ppm);
      pv.setUint32(4, o.ppm);
      phys[8] = 1;
      this.parts.push(chunk('pHYs', phys));
    }
    const cs = new CompressionStream('deflate');
    this.writer = cs.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
    const reader = cs.readable.getReader();
    this.reading = (async () => {
      // Coalesce compressed output into ~1 MB IDAT chunks.
      let buf: Uint8Array[] = [];
      let size = 0;
      const flush = () => {
        if (!size) return;
        const data = new Uint8Array(size);
        let o2 = 0;
        for (const b of buf) {
          data.set(b, o2);
          o2 += b.length;
        }
        this.parts.push(chunk('IDAT', data));
        buf = [];
        size = 0;
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf.push(value);
        size += value.length;
        if (size >= 1 << 20) flush();
      }
      flush();
    })();
  }

  /**
   * Add rows. 8-bit: RGBA8 bytes (alpha dropped when alpha=false).
   * 16-bit: RGBA float 0..1 values.
   */
  async addRows(data: Uint8Array | Float32Array, rows: number): Promise<void> {
    const { width, bitDepth, alpha } = this.o;
    const channels = alpha ? 4 : 3;
    for (let r = 0; r < rows; r++) {
      const raw = this.cur.subarray(1);
      if (bitDepth === 8) {
        const src = data as Uint8Array;
        const base = r * width * 4;
        if (alpha) raw.set(src.subarray(base, base + width * 4));
        else for (let x = 0, s = base, d = 0; x < width; x++, s += 4, d += 3) {
          raw[d] = src[s];
          raw[d + 1] = src[s + 1];
          raw[d + 2] = src[s + 2];
        }
      } else {
        const src = data as Float32Array;
        const base = r * width * 4;
        for (let x = 0, d = 0; x < width; x++) {
          for (let c = 0; c < channels; c++) {
            const v = src[base + x * 4 + c];
            const q = Math.round(Math.min(1, Math.max(0, v)) * 65535);
            raw[d++] = q >> 8;
            raw[d++] = q & 255;
          }
        }
      }
      // Paeth filter (good general-purpose choice for photographic content).
      const out = new Uint8Array(this.rowBytes + 1);
      out[0] = 4;
      const prev = this.prev;
      const bpp = this.bpp;
      for (let i = 0; i < this.rowBytes; i++) {
        const a = i >= bpp ? raw[i - bpp] : 0;
        const b = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        out[i + 1] = (raw[i] - pred) & 255;
      }
      this.prev.set(raw);
      await this.writer.ready;
      await this.writer.write(out);
      this.rowsWritten++;
    }
  }

  async finish(): Promise<Blob> {
    if (this.rowsWritten !== this.o.height) throw new Error(`PNG: wrote ${this.rowsWritten} of ${this.o.height} rows`);
    await this.writer.close();
    await this.reading;
    this.parts.push(chunk('IEND', new Uint8Array(0)));
    return new Blob(this.parts, { type: 'image/png' });
  }

  abort(): void {
    this.writer.abort().catch(() => undefined);
  }
}
