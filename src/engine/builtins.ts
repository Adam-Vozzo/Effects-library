// Procedurally generated, tileable helper textures shared by effects.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Separable wrap-around box blur (radius r) of a size x size float field. */
function blurWrap(src: Float32Array, size: number, r: number): Float32Array {
  const tmp = new Float32Array(size * size);
  const out = new Float32Array(size * size);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[y * size + ((x + k + size) % size)];
      tmp[y * size + x] = s * norm;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[((y + k + size) % size) * size + x];
      out[y * size + x] = s * norm;
    }
  }
  return out;
}

/** Rank-normalize values to a uniform 0..1 distribution. */
function rankNormalize(v: Float32Array): Float32Array {
  const idx = Array.from(v.keys()).sort((a, b) => v[a] - v[b]);
  const out = new Float32Array(v.length);
  const n = v.length - 1;
  idx.forEach((i, rank) => (out[i] = rank / n));
  return out;
}

/** Approximate blue noise: iterated high-pass filtered white noise, rank-normalized. */
export function makeBlueNoise(size: number): { data: Uint8Array; size: number } {
  const rnd = mulberry32(1337);
  const ch: Float32Array[] = [];
  for (let c = 0; c < 4; c++) {
    let v: Float32Array = new Float32Array(size * size);
    for (let i = 0; i < v.length; i++) v[i] = rnd();
    for (let it = 0; it < 3; it++) {
      const lo = blurWrap(v, size, 2);
      for (let i = 0; i < v.length; i++) v[i] = v[i] - lo[i];
      v = rankNormalize(v);
    }
    ch.push(v);
  }
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    for (let c = 0; c < 4; c++) data[i * 4 + c] = Math.round(ch[c][i] * 255);
  }
  return { data, size };
}

/** Tileable value noise sampled with a lattice period. */
function periodicNoise(size: number, period: number, rnd: () => number): Float32Array {
  const lat = new Float32Array(period * period);
  for (let i = 0; i < lat.length; i++) lat[i] = rnd();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * period;
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    const sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * period;
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const sx = tx * tx * (3 - 2 * tx);
      const a = lat[(y0 % period) * period + (x0 % period)];
      const b = lat[(y0 % period) * period + ((x0 + 1) % period)];
      const c = lat[((y0 + 1) % period) * period + (x0 % period)];
      const d = lat[((y0 + 1) % period) * period + ((x0 + 1) % period)];
      out[y * size + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
  }
  return out;
}

/** Paper grain: multi-octave tileable noise in R, fine grain in G, blotches in B. */
export function makePaperTexture(size: number): { data: Uint8Array; size: number } {
  const rnd = mulberry32(42);
  const octaves = [4, 8, 16, 32, 64, 128];
  const acc = new Float32Array(size * size);
  let amp = 0.5;
  let total = 0;
  for (const p of octaves) {
    const n = periodicNoise(size, p, rnd);
    for (let i = 0; i < acc.length; i++) acc[i] += n[i] * amp;
    total += amp;
    amp *= 0.6;
  }
  const grain = new Float32Array(size * size);
  for (let i = 0; i < grain.length; i++) grain[i] = rnd();
  const grainSoft = blurWrap(grain, size, 1);
  const blotch = periodicNoise(size, 3, rnd);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = Math.round((acc[i] / total) * 255);
    data[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, (grainSoft[i] - 0.5) * 3 + 0.5)) * 255);
    data[i * 4 + 2] = Math.round(blotch[i] * 255);
    data[i * 4 + 3] = 255;
  }
  return { data, size };
}

/** Fibers: thin random curved strokes accumulated with wrap-around (for paper/ink textures). */
export function makeFiberTexture(size: number): { data: Uint8Array; size: number } {
  const rnd = mulberry32(7);
  const acc = new Float32Array(size * size);
  const fibers = Math.round(size * 1.5);
  for (let f = 0; f < fibers; f++) {
    let x = rnd() * size;
    let y = rnd() * size;
    let a = rnd() * Math.PI * 2;
    const len = 8 + rnd() * 40;
    const strength = 0.15 + rnd() * 0.35;
    for (let s = 0; s < len; s++) {
      a += (rnd() - 0.5) * 0.25;
      x += Math.cos(a);
      y += Math.sin(a);
      const ix = ((Math.round(x) % size) + size) % size;
      const iy = ((Math.round(y) % size) + size) % size;
      acc[iy * size + ix] += strength;
    }
  }
  const soft = blurWrap(acc, size, 1);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = Math.min(1, acc[i] * 0.6 + soft[i] * 0.8);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = Math.round(v * 255);
    data[i * 4 + 3] = 255;
  }
  return { data, size };
}
