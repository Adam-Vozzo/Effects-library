// Streaming baseline JPEG encoder (JFIF, Huffman tables from ITU T.81 Annex K).
// Rows are consumed in MCU-height bands so huge images never need a full raster in memory.

const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36,
  29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
];

const STD_LUMA_Q = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68,
  109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];

const STD_CHROMA_Q = [
  17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
];

const DC_LUMA_BITS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_LUMA_VALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const DC_CHROMA_BITS = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const DC_CHROMA_VALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_LUMA_BITS = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
const AC_LUMA_VALS = [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23,
  0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a,
  0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64,
  0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94,
  0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2,
  0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8,
  0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
];
const AC_CHROMA_BITS = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77];
const AC_CHROMA_VALS = [
  0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71, 0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1,
  0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0, 0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63,
  0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92,
  0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9,
  0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7,
  0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
];

const AASF = [1.0, 1.387039845, 1.306562965, 1.175875602, 1.0, 0.785694958, 0.5411961, 0.275899379];

interface Huff {
  code: Uint16Array;
  size: Uint8Array;
}

function buildHuff(bits: number[], vals: number[]): Huff {
  const code = new Uint16Array(256);
  const size = new Uint8Array(256);
  let k = 0;
  let c = 0;
  for (let len = 1; len <= 16; len++) {
    for (let i = 0; i < bits[len - 1]; i++) {
      const v = vals[k++];
      code[v] = c;
      size[v] = len;
      c++;
    }
    c <<= 1;
  }
  return { code, size };
}

function scaleQuant(base: number[], quality: number): Uint8Array {
  const q = Math.min(100, Math.max(1, Math.round(quality)));
  const s = q < 50 ? 5000 / q : 200 - q * 2;
  const out = new Uint8Array(64);
  for (let i = 0; i < 64; i++) out[i] = Math.min(255, Math.max(1, Math.floor((base[i] * s + 50) / 100)));
  return out;
}

function divisors(qt: Uint8Array): Float32Array {
  const out = new Float32Array(64);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) out[r * 8 + c] = 1 / (qt[r * 8 + c] * AASF[r] * AASF[c] * 8);
  return out;
}

/** In-place AAN float forward DCT of an 8x8 block (row-major). */
function fdct(d: Float32Array): void {
  for (let p = 0; p < 64; p += 8) {
    const t0 = d[p] + d[p + 7], t7 = d[p] - d[p + 7];
    const t1 = d[p + 1] + d[p + 6], t6 = d[p + 1] - d[p + 6];
    const t2 = d[p + 2] + d[p + 5], t5 = d[p + 2] - d[p + 5];
    const t3 = d[p + 3] + d[p + 4], t4 = d[p + 3] - d[p + 4];
    let t10 = t0 + t3;
    const t13 = t0 - t3;
    let t11 = t1 + t2;
    let t12 = t1 - t2;
    d[p] = t10 + t11;
    d[p + 4] = t10 - t11;
    const z1 = (t12 + t13) * 0.707106781;
    d[p + 2] = t13 + z1;
    d[p + 6] = t13 - z1;
    t10 = t4 + t5;
    t11 = t5 + t6;
    t12 = t6 + t7;
    const z5 = (t10 - t12) * 0.382683433;
    const z2 = 0.5411961 * t10 + z5;
    const z4 = 1.306562965 * t12 + z5;
    const z3 = t11 * 0.707106781;
    const z11 = t7 + z3;
    const z13 = t7 - z3;
    d[p + 5] = z13 + z2;
    d[p + 3] = z13 - z2;
    d[p + 1] = z11 + z4;
    d[p + 7] = z11 - z4;
  }
  for (let p = 0; p < 8; p++) {
    const t0 = d[p] + d[p + 56], t7 = d[p] - d[p + 56];
    const t1 = d[p + 8] + d[p + 48], t6 = d[p + 8] - d[p + 48];
    const t2 = d[p + 16] + d[p + 40], t5 = d[p + 16] - d[p + 40];
    const t3 = d[p + 24] + d[p + 32], t4 = d[p + 24] - d[p + 32];
    let t10 = t0 + t3;
    const t13 = t0 - t3;
    let t11 = t1 + t2;
    let t12 = t1 - t2;
    d[p] = t10 + t11;
    d[p + 32] = t10 - t11;
    const z1 = (t12 + t13) * 0.707106781;
    d[p + 16] = t13 + z1;
    d[p + 48] = t13 - z1;
    t10 = t4 + t5;
    t11 = t5 + t6;
    t12 = t6 + t7;
    const z5 = (t10 - t12) * 0.382683433;
    const z2 = 0.5411961 * t10 + z5;
    const z4 = 1.306562965 * t12 + z5;
    const z3 = t11 * 0.707106781;
    const z11 = t7 + z3;
    const z13 = t7 - z3;
    d[p + 40] = z13 + z2;
    d[p + 24] = z13 - z2;
    d[p + 8] = z11 + z4;
    d[p + 56] = z11 - z4;
  }
}

class BitWriter {
  private buf = new Uint8Array(1 << 16);
  private pos = 0;
  private acc = 0;
  private n = 0;
  readonly chunks: Uint8Array<ArrayBuffer>[] = [];

  bytes(arr: ArrayLike<number>): void {
    for (let i = 0; i < arr.length; i++) this.byte(arr[i]);
  }

  byte(b: number): void {
    if (this.pos === this.buf.length) this.flushBuf();
    this.buf[this.pos++] = b;
  }

  word(w: number): void {
    this.byte((w >> 8) & 255);
    this.byte(w & 255);
  }

  bits(value: number, count: number): void {
    // Accumulate MSB-first; stuff a 0x00 after every 0xFF in entropy-coded data.
    this.acc = (this.acc << count) | (value & ((1 << count) - 1));
    this.n += count;
    while (this.n >= 8) {
      const b = (this.acc >> (this.n - 8)) & 255;
      this.byte(b);
      if (b === 0xff) this.byte(0);
      this.n -= 8;
    }
    this.acc &= (1 << this.n) - 1;
  }

  padBits(): void {
    if (this.n > 0) this.bits(0x7f, 8 - this.n);
  }

  flushBuf(): void {
    if (!this.pos) return;
    this.chunks.push(this.buf.slice(0, this.pos));
    this.pos = 0;
  }

  take(): Uint8Array<ArrayBuffer>[] {
    this.flushBuf();
    return this.chunks.splice(0, this.chunks.length);
  }
}

export interface JpegOptions {
  width: number;
  height: number;
  /** 1..100 */
  quality: number;
  /** 4:2:0 chroma subsampling (smaller files); default true when quality < 90. */
  subsample?: boolean;
}

export class JpegEncoder {
  private w: BitWriter = new BitWriter();
  private parts: BlobPart[] = [];
  private qY: Float32Array;
  private qC: Float32Array;
  private dcY: Huff;
  private dcC: Huff;
  private acY: Huff;
  private acC: Huff;
  private prevDC = [0, 0, 0];
  private sub: boolean;
  private mcuH: number;
  /** Band buffer of MCU height rows of RGBA. */
  private band: Uint8Array;
  private bandRows = 0;
  private rowsIn = 0;
  private block = new Float32Array(64);
  private zz = new Int32Array(64);
  private yPlane: Float32Array;
  private cbPlane: Float32Array;
  private crPlane: Float32Array;
  private paddedW: number;

  constructor(private o: JpegOptions) {
    this.sub = o.subsample ?? o.quality < 90;
    this.mcuH = this.sub ? 16 : 8;
    const mcuW = this.sub ? 16 : 8;
    this.paddedW = Math.ceil(o.width / mcuW) * mcuW;
    this.band = new Uint8Array(o.width * this.mcuH * 4);
    this.yPlane = new Float32Array(this.paddedW * this.mcuH);
    this.cbPlane = new Float32Array(this.paddedW * this.mcuH);
    this.crPlane = new Float32Array(this.paddedW * this.mcuH);
    const qy = scaleQuant(STD_LUMA_Q, o.quality);
    const qc = scaleQuant(STD_CHROMA_Q, o.quality);
    this.qY = divisors(qy);
    this.qC = divisors(qc);
    this.dcY = buildHuff(DC_LUMA_BITS, DC_LUMA_VALS);
    this.dcC = buildHuff(DC_CHROMA_BITS, DC_CHROMA_VALS);
    this.acY = buildHuff(AC_LUMA_BITS, AC_LUMA_VALS);
    this.acC = buildHuff(AC_CHROMA_BITS, AC_CHROMA_VALS);
    this.writeHeaders(qy, qc);
  }

  private writeHeaders(qy: Uint8Array, qc: Uint8Array): void {
    const w = this.w;
    w.word(0xffd8); // SOI
    w.word(0xffe0); // APP0 JFIF
    w.word(16);
    w.bytes([0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    w.word(0xffdb); // DQT
    w.word(132);
    w.byte(0);
    for (let i = 0; i < 64; i++) w.byte(qy[ZIGZAG[i]]);
    w.byte(1);
    for (let i = 0; i < 64; i++) w.byte(qc[ZIGZAG[i]]);
    w.word(0xffc0); // SOF0
    w.word(17);
    w.byte(8);
    w.word(this.o.height);
    w.word(this.o.width);
    w.byte(3);
    const samp = this.sub ? 0x22 : 0x11;
    w.bytes([1, samp, 0, 2, 0x11, 1, 3, 0x11, 1]);
    w.word(0xffc4); // DHT
    w.word(0x01a2);
    const table = (cls: number, bits: number[], vals: number[]) => {
      w.byte(cls);
      w.bytes(bits);
      w.bytes(vals);
    };
    table(0x00, DC_LUMA_BITS, DC_LUMA_VALS);
    table(0x10, AC_LUMA_BITS, AC_LUMA_VALS);
    table(0x01, DC_CHROMA_BITS, DC_CHROMA_VALS);
    table(0x11, AC_CHROMA_BITS, AC_CHROMA_VALS);
    w.word(0xffda); // SOS
    w.word(12);
    w.bytes([3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 0x3f, 0]);
  }

  /** Feed top-down RGBA8 rows. */
  addRows(rgba: Uint8Array, rows: number): void {
    const rowLen = this.o.width * 4;
    let r = 0;
    while (r < rows) {
      const take = Math.min(rows - r, this.mcuH - this.bandRows);
      this.band.set(rgba.subarray(r * rowLen, (r + take) * rowLen), this.bandRows * rowLen);
      this.bandRows += take;
      r += take;
      this.rowsIn += take;
      if (this.bandRows === this.mcuH) this.encodeBand();
    }
    if (this.rowsIn >= this.o.height && this.bandRows > 0) this.encodeBand();
    this.collect();
  }

  private collect(): void {
    for (const c of this.w.take()) this.parts.push(c);
  }

  private encodeBand(): void {
    const { width } = this.o;
    const rowLen = width * 4;
    const pw = this.paddedW;
    // Pad incomplete bands by repeating the last row; pad columns by repeating the last pixel.
    for (let y = 0; y < this.mcuH; y++) {
      const sy = Math.min(y, this.bandRows - 1);
      const srow = sy * rowLen;
      for (let x = 0; x < pw; x++) {
        const s = srow + Math.min(x, width - 1) * 4;
        const R = this.band[s];
        const G = this.band[s + 1];
        const B = this.band[s + 2];
        const i = y * pw + x;
        this.yPlane[i] = 0.299 * R + 0.587 * G + 0.114 * B - 128;
        this.cbPlane[i] = -0.168736 * R - 0.331264 * G + 0.5 * B;
        this.crPlane[i] = 0.5 * R - 0.418688 * G - 0.081312 * B;
      }
    }
    const blk = this.block;
    if (!this.sub) {
      for (let bx = 0; bx < pw; bx += 8) {
        this.loadBlock(this.yPlane, bx, 0);
        this.encodeBlock(blk, 0, this.qY, this.dcY, this.acY);
        this.loadBlock(this.cbPlane, bx, 0);
        this.encodeBlock(blk, 1, this.qC, this.dcC, this.acC);
        this.loadBlock(this.crPlane, bx, 0);
        this.encodeBlock(blk, 2, this.qC, this.dcC, this.acC);
      }
    } else {
      for (let mx = 0; mx < pw; mx += 16) {
        for (let k = 0; k < 4; k++) {
          this.loadBlock(this.yPlane, mx + (k & 1) * 8, (k >> 1) * 8);
          this.encodeBlock(blk, 0, this.qY, this.dcY, this.acY);
        }
        this.loadSubBlock(this.cbPlane, mx);
        this.encodeBlock(blk, 1, this.qC, this.dcC, this.acC);
        this.loadSubBlock(this.crPlane, mx);
        this.encodeBlock(blk, 2, this.qC, this.dcC, this.acC);
      }
    }
    this.bandRows = 0;
  }

  private loadBlock(plane: Float32Array, x0: number, y0: number): void {
    const pw = this.paddedW;
    const b = this.block;
    for (let y = 0; y < 8; y++) {
      const row = (y0 + y) * pw + x0;
      for (let x = 0; x < 8; x++) b[y * 8 + x] = plane[row + x];
    }
  }

  /** 2x2 average for 4:2:0 chroma. */
  private loadSubBlock(plane: Float32Array, x0: number): void {
    const pw = this.paddedW;
    const b = this.block;
    for (let y = 0; y < 8; y++) {
      const r0 = y * 2 * pw + x0;
      const r1 = r0 + pw;
      for (let x = 0; x < 8; x++) {
        const c = x * 2;
        b[y * 8 + x] = (plane[r0 + c] + plane[r0 + c + 1] + plane[r1 + c] + plane[r1 + c + 1]) * 0.25;
      }
    }
  }

  private encodeBlock(b: Float32Array, comp: number, q: Float32Array, dc: Huff, ac: Huff): void {
    fdct(b);
    const zz = this.zz;
    for (let i = 0; i < 64; i++) {
      const n = ZIGZAG[i];
      zz[i] = Math.round(b[n] * q[n]);
    }
    const w = this.w;
    const diff = zz[0] - this.prevDC[comp];
    this.prevDC[comp] = zz[0];
    const dcs = category(diff);
    w.bits(dc.code[dcs], dc.size[dcs]);
    if (dcs) w.bits(diff < 0 ? diff + (1 << dcs) - 1 : diff, dcs);
    let run = 0;
    let last = 63;
    while (last > 0 && zz[last] === 0) last--;
    for (let i = 1; i <= last; i++) {
      const v = zz[i];
      if (v === 0) {
        run++;
        continue;
      }
      while (run > 15) {
        w.bits(ac.code[0xf0], ac.size[0xf0]);
        run -= 16;
      }
      const s = category(v);
      const sym = (run << 4) | s;
      w.bits(ac.code[sym], ac.size[sym]);
      w.bits(v < 0 ? v + (1 << s) - 1 : v, s);
      run = 0;
    }
    if (last < 63) w.bits(ac.code[0], ac.size[0]);
  }

  finish(): Blob {
    if (this.bandRows > 0) this.encodeBand();
    this.w.padBits();
    this.w.word(0xffd9); // EOI
    this.collect();
    return new Blob(this.parts, { type: 'image/jpeg' });
  }
}

function category(v: number): number {
  let a = v < 0 ? -v : v;
  let n = 0;
  while (a) {
    n++;
    a >>= 1;
  }
  return n;
}
