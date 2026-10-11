// User-provided textures (for texture params). Stored as blobs (persisted with the project)
// and uploaded to GL lazily.

import { Texture, mipLevels } from '../engine/gl';
import type { Renderer } from '../engine/renderer';

export interface Asset {
  id: string;
  name: string;
  blob: Blob;
  width: number;
  height: number;
  url: string;
  bitmap: ImageBitmap | null;
}

export class AssetStore {
  private assets = new Map<string, Asset>();
  private textures = new Map<string, Texture>();
  private listeners = new Set<() => void>();
  constructor(private renderer: Renderer) {
    renderer.assets = { get: (id) => this.texture(id) };
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const f of this.listeners) f();
  }

  get(id: string): Asset | undefined {
    return this.assets.get(id);
  }

  all(): Asset[] {
    return [...this.assets.values()];
  }

  async add(blob: Blob, name: string, id?: string): Promise<Asset> {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
    const a: Asset = {
      id: id ?? 'a' + Math.random().toString(36).slice(2, 10),
      name,
      blob,
      width: bitmap.width,
      height: bitmap.height,
      url: URL.createObjectURL(blob),
      bitmap,
    };
    this.assets.set(a.id, a);
    this.emit();
    return a;
  }

  remove(id: string): void {
    const a = this.assets.get(id);
    if (!a) return;
    URL.revokeObjectURL(a.url);
    a.bitmap?.close();
    this.assets.delete(id);
    this.textures.get(id)?.dispose();
    this.textures.delete(id);
    this.emit();
  }

  /** GL texture for an asset (uploaded on first use, mipmapped, repeat wrap). */
  texture(id: string): Texture | null {
    const cached = this.textures.get(id);
    if (cached) return cached;
    const a = this.assets.get(id);
    if (!a || !a.bitmap) return null;
    const gl = this.renderer.gl;
    const max = this.renderer.caps.maxTextureSize;
    let w = a.width;
    let hgt = a.height;
    let src: TexImageSource = a.bitmap;
    if (w > max || hgt > max) {
      const s = max / Math.max(w, hgt);
      const c = new OffscreenCanvas(Math.floor(w * s), Math.floor(hgt * s));
      c.getContext('2d')!.drawImage(a.bitmap, 0, 0, c.width, c.height);
      src = c;
      w = c.width;
      hgt = c.height;
    }
    const t = new Texture(gl, w, hgt, 'rgba8', { levels: mipLevels(w, hgt) });
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    // The bitmap was decoded with imageOrientation 'flipY', so rows are already bottom-up.
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, hgt, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    t.setWrap(true);
    this.textures.set(id, t);
    return t;
  }

  /** Forget GL textures (after a context loss); they are re-uploaded on demand. */
  dropTextures(): void {
    this.textures.clear();
  }

  clear(): void {
    for (const id of [...this.assets.keys()]) this.remove(id);
  }
}
