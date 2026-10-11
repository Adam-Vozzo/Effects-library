// Live effect thumbnails rendered on the current image, one at a time in idle frames.

import type { Renderer } from '../engine/renderer';
import type { Crop, Layer } from '../engine/types';
import { getEffect } from '../effects/registry';
import { relativePxScale } from '../engine/units';

interface Job {
  key: string;
  layers: Layer[];
  canvas: HTMLCanvasElement;
}

export const THUMB_LONG = 256;

export class ThumbnailRenderer {
  private queue: Job[] = [];
  private visible = new Set<HTMLCanvasElement>();
  private done = new WeakMap<HTMLCanvasElement, string>();
  private observer: IntersectionObserver;
  private jobs = new WeakMap<HTMLCanvasElement, () => Job>();
  private version = 0;
  private scheduled = false;
  /** Paused while exporting. */
  paused = false;
  /** Timestamp of the last main preview render; thumbnails wait until interaction settles. */
  busyUntil = 0;
  /** Current crop so thumbnails match the framed image. */
  crop: Crop | null = null;

  constructor(private renderer: Renderer) {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const c = e.target as HTMLCanvasElement;
          if (e.isIntersecting) {
            this.visible.add(c);
            this.enqueue(c);
          } else this.visible.delete(c);
        }
      },
      { rootMargin: '200px' },
    );
  }

  /** Register a canvas; `make` builds its layer stack lazily. */
  observe(canvas: HTMLCanvasElement, make: () => Job): void {
    this.jobs.set(canvas, make);
    this.observer.observe(canvas);
  }

  unobserve(canvas: HTMLCanvasElement): void {
    this.observer.unobserve(canvas);
    this.visible.delete(canvas);
  }

  /** Source image changed: re-render everything visible. */
  invalidate(): void {
    this.version++;
    for (const c of this.visible) this.enqueue(c);
  }

  private enqueue(c: HTMLCanvasElement): void {
    const make = this.jobs.get(c);
    if (!make) return;
    const job = make();
    const stamp = job.key + '@' + this.version;
    if (this.done.get(c) === stamp) return;
    if (!this.queue.some((j) => j.canvas === c)) this.queue.push(job);
    this.schedule();
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => this.tick());
  }

  private busy = false;

  private async tick(): Promise<void> {
    this.scheduled = false;
    if (this.busy || !this.renderer.hasSource || this.renderer.isContextLost()) return;
    if (this.paused || performance.now() < this.busyUntil) {
      setTimeout(() => this.schedule(), 150);
      return;
    }
    const job = this.queue.shift();
    if (!job) return;
    if (this.visible.has(job.canvas)) {
      const effects = job.layers.map((l) => getEffect(l.effectId)).filter((e) => !!e);
      if (!this.renderer.ready(effects)) {
        // Programs still compiling in parallel: retry shortly.
        this.queue.push(job);
        this.renderer.pollPrograms();
        setTimeout(() => this.schedule(), 30);
        return;
      }
      this.busy = true;
      const version = this.version;
      try {
        await this.draw(job);
      } catch (e) {
        console.warn('Thumbnail failed', job.key, e);
      } finally {
        this.busy = false;
      }
      this.done.set(job.canvas, job.key + '@' + version);
    }
    if (this.queue.length) this.schedule();
  }

  private async draw(job: Job): Promise<void> {
    const r = this.renderer;
    const [fw, fh] = r.sourceSize;
    const sw = fw * (this.crop?.w ?? 1);
    const sh = fh * (this.crop?.h ?? 1);
    const s = THUMB_LONG / Math.max(sw, sh);
    const w = Math.max(8, Math.round(sw * s));
    const h = Math.max(8, Math.round(sh * s));
    const data = await r.renderToPixelsAsync(job.layers, { width: w, height: h, pxScale: relativePxScale(w, h), time: 0, format: r.defaultFormat, crop: this.crop });
    const c = job.canvas;
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength), w, h), 0, 0);
  }
}
