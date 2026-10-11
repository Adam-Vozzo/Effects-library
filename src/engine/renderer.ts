import {
  Program,
  TargetPool,
  Texture,
  detectCaps,
  mipLevels,
  setUniforms,
  textureFromData,
  textureFromFloat,
  type Caps,
  type TexFormat,
  type UniformValue,
} from './gl';
import { buildFragment, MAX_PALETTE } from './prelude';
import { CORE_SHADERS } from './glsl/core';
import { buildCurveLut, buildGradientLut, hexToRgb, patternsToTexture } from './luts';
import { makeBlueNoise, makePaperTexture, makeFiberTexture } from './builtins';
import type { BlendMode, Crop, EffectDef, Layer, ParamDef, ParamValue, ParamValues, PassOptions, RenderContext } from './types';
import { BLEND_MODES } from './types';
import { getEffect } from '../effects/registry';

interface CacheEntry {
  value: unknown;
  dispose?: (v: unknown) => void;
  frame: number;
}

export interface ChainOptions {
  width: number;
  height: number;
  /** Render px per source px. */
  pxScale: number;
  time: number;
  format: TexFormat;
  crop: Crop | null;
  exporting?: boolean;
  /** Split draws into tiles no larger than this (export: avoids GPU watchdog resets). */
  tileSize?: number;
  /** Called after each layer; may return a promise to yield (export progress). */
  onLayer?: (index: number, total: number) => void | Promise<void>;
  /** Render only the first N layers (for compare/thumbnails). */
  limit?: number;
}

export interface AssetSource {
  get(id: string): Texture | null;
}

const BLEND_INDEX: Record<BlendMode, number> = Object.fromEntries(BLEND_MODES.map((m, i) => [m, i])) as Record<BlendMode, number>;

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  readonly caps: Caps;
  readonly pool: TargetPool;
  private programs = new Map<string, Program>();
  private pending = new Set<Program>();
  private source: Texture | null = null;
  /** ImageBitmap uploads ignore UNPACK_FLIP_Y, leaving rows top-down; the base pass compensates. */
  private sourceTopDown = false;
  private dummy: Texture;
  private layerCaches = new Map<string, Map<string, CacheEntry>>();
  private builtins = new Map<string, Texture>();
  private frame = 0;
  /** Current tile size for the pass being executed (0 = no tiling). */
  private tileSize = 0;
  assets: AssetSource = { get: () => null };
  /** Invoked when an async program compile finishes so the UI can re-render. */
  onProgramReady: (() => void) | null = null;
  lastError: Error | null = null;

  constructor(readonly canvas: HTMLCanvasElement | OffscreenCanvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL 2 is not available in this browser.');
    this.gl = gl;
    this.caps = detectCaps(gl);
    this.pool = new TargetPool(gl);
    this.dummy = textureFromData(gl, new Uint8Array([0, 0, 0, 0]), 1, 1);
  }

  get defaultFormat(): TexFormat {
    return this.caps.floatTargets ? 'rgba16f' : 'rgba8';
  }

  get hasSource(): boolean {
    return !!this.source;
  }

  get sourceSize(): [number, number] {
    return this.source ? [this.source.width, this.source.height] : [0, 0];
  }

  /** Upload the source image. Images larger than the GPU limit are downscaled. */
  setSource(img: TexImageSource & { width: number; height: number }): void {
    const gl = this.gl;
    let src: TexImageSource = img;
    let w = img.width;
    let h = img.height;
    const max = this.caps.maxTextureSize;
    if (w > max || h > max) {
      const s = max / Math.max(w, h);
      const c = new OffscreenCanvas(Math.floor(w * s), Math.floor(h * s));
      const cx = c.getContext('2d')!;
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(img as CanvasImageSource, 0, 0, c.width, c.height);
      src = c;
      w = c.width;
      h = c.height;
    }
    this.source?.dispose();
    this.sourceTopDown = typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap;
    const t = new Texture(gl, w, h, 'rgba8', { levels: mipLevels(w, h) });
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.source = t;
  }

  // ---------------------------------------------------------------- programs

  private programFor(effect: Pick<EffectDef, 'id' | 'params' | 'shaders'>, name: string): Program {
    const key = effect.id + ':' + name;
    let p = this.programs.get(key);
    if (!p) {
      const body = effect.shaders[name];
      if (body === undefined) throw new Error(`Effect ${effect.id} has no shader "${name}"`);
      p = new Program(this.gl, key, buildFragment(effect, body));
      this.programs.set(key, p);
      if (this.caps.parallelCompile) this.pending.add(p);
    }
    return p;
  }

  private coreProgram(name: keyof typeof CORE_SHADERS): Program {
    return this.programFor(CORE_EFFECT, name);
  }

  /** Start compiling every shader an effect may use. Returns true when all are ready. */
  prepare(effect: EffectDef): boolean {
    let ready = true;
    for (const name of Object.keys(effect.shaders)) {
      const p = this.programFor(effect, name);
      if (!p.isReady(this.caps.parallelCompile)) ready = false;
    }
    return ready;
  }

  /** True if all of the effects' programs finished compiling (kicks off compiles as a side effect). */
  ready(effects: EffectDef[]): boolean {
    let ok = true;
    for (const e of effects) if (!this.prepare(e)) ok = false;
    for (const name of Object.keys(CORE_SHADERS)) {
      if (!this.coreProgram(name as keyof typeof CORE_SHADERS).isReady(this.caps.parallelCompile)) ok = false;
    }
    return ok;
  }

  /** Poll pending async compiles; fires onProgramReady when something completed. */
  pollPrograms(): boolean {
    if (!this.pending.size) return false;
    let any = false;
    for (const p of this.pending) {
      if (p.isReady(true)) {
        this.pending.delete(p);
        any = true;
      }
    }
    if (any) this.onProgramReady?.();
    return this.pending.size > 0;
  }

  // ---------------------------------------------------------------- passes

  private draw(prog: Program, target: Texture | null, w: number, h: number, uniforms: Record<string, UniformValue | undefined>, opts: PassOptions = {}): void {
    const gl = this.gl;
    prog.finalize();
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.program);
    setUniforms(prog, uniforms);
    if (opts.clear) {
      gl.clearColor(...opts.clear);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    if (opts.blend === 'add') {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
    } else if (opts.blend === 'alpha') {
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    const ts = this.tileSize;
    if (ts > 0 && (w > ts || h > ts)) {
      gl.enable(gl.SCISSOR_TEST);
      for (let y = 0; y < h; y += ts) {
        for (let x = 0; x < w; x += ts) {
          gl.scissor(x, y, Math.min(ts, w - x), Math.min(ts, h - y));
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.flush();
        }
      }
      gl.disable(gl.SCISSOR_TEST);
    } else {
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (opts.blend) gl.disable(gl.BLEND);
  }

  /** Copy/resample the cropped source into a render target. */
  private renderBase(w: number, h: number, crop: Crop | null, format: TexFormat): Texture {
    const out = this.pool.acquire(w, h, format);
    const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
    this.draw(this.coreProgram('base'), out, w, h, {
      u_src: this.source ?? this.dummy,
      u_crop: [c.x, 1 - c.y - c.h, c.w, c.h],
      // Crop rotation is clockwise on screen (y-down); the shader works y-up.
      u_rotation: (-(c.rotation ?? 0) * Math.PI) / 180,
      u_flip: [c.flipX ? -1 : 1, c.flipY ? -1 : 1],
      u_srcTopDown: this.sourceTopDown,
    });
    return out;
  }

  /** Render a layer stack. Returns a pooled texture the caller must release. */
  renderChain(layers: Layer[], opts: ChainOptions): Texture {
    const it = this.renderChainSteps(layers, opts);
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
  }

  /** Async variant used by export: yields between layers so progress can update. */
  async renderChainAsync(layers: Layer[], opts: ChainOptions, signal?: AbortSignal): Promise<Texture> {
    const it = this.renderChainSteps(layers, opts);
    let r = it.next();
    while (!r.done) {
      if (signal?.aborted) {
        // Drain to release resources.
        while (!r.done) r = it.next();
        this.pool.release(r.value);
        throw new DOMException('Export cancelled', 'AbortError');
      }
      await this.gpuIdle();
      await r.value;
      r = it.next();
    }
    return r.value;
  }

  private *renderChainSteps(layers: Layer[], opts: ChainOptions): Generator<void | Promise<void>, Texture, void> {
    this.frame++;
    const prevTile = this.tileSize;
    this.tileSize = opts.tileSize ?? 0;
    const { width: w, height: h, format } = opts;
    const active = layers.slice(0, opts.limit ?? layers.length).filter((l) => l.visible && getEffect(l.effectId));
    const usesOriginal = active.map((l) => !!getEffect(l.effectId)?.usesOriginal);
    const needsOriginalFrom = (i: number) => usesOriginal.slice(i).some(Boolean);
    let base: Texture | null = this.renderBase(w, h, opts.crop, format);
    let current: Texture = base;
    try {
      for (let i = 0; i < active.length; i++) {
        const layer = active[i];
        const effect = getEffect(layer.effectId)!;
        const out = this.applyEffect(effect, layer.id, layer.params, current, base, opts);
        let result = out;
        if (out !== current && (layer.opacity < 1 || layer.blend !== 'normal')) {
          result = this.pool.acquire(w, h, format);
          this.draw(this.coreProgram('mix'), result, w, h, {
            u_base: current,
            u_top: out,
            u_opacity: layer.opacity,
            u_mode: BLEND_INDEX[layer.blend] ?? 0,
          });
          this.pool.release(out);
        }
        if (result !== current) {
          if (current !== base) this.pool.release(current);
          current = result;
        }
        if (base && base !== current && !needsOriginalFrom(i + 1)) {
          this.pool.release(base);
          base = null;
        }
        const r = opts.onLayer?.(i, active.length);
        yield r ?? undefined;
      }
    } finally {
      this.tileSize = prevTile;
    }
    if (base && base !== current) this.pool.release(base);
    this.gcCaches(active.map((l) => l.id));
    return current;
  }

  /** Apply a single effect to an input texture. */
  applyEffect(effect: EffectDef, layerId: string, params: ParamValues, input: Texture, original: Texture | null, opts: ChainOptions): Texture {
    const w = input.width;
    const h = input.height;
    const paramUniforms = this.paramUniforms(effect, layerId, params);
    const extra = effect.uniforms?.(params, { width: w, height: h, pxScale: opts.pxScale, time: opts.time }) ?? {};
    let lazyOriginal = original;
    const owned = new Set<Texture>();
    const self = this;
    const base: Record<string, UniformValue | undefined> = {
      u_resolution: [w, h],
      u_pxScale: opts.pxScale,
      u_time: opts.time,
      ...paramUniforms,
      ...extra,
    };
    const ctx: RenderContext = {
      gl: this.gl,
      input,
      get original() {
        if (!lazyOriginal) {
          lazyOriginal = self.renderBase(w, h, opts.crop, opts.format);
          owned.add(lazyOriginal);
        }
        return lazyOriginal;
      },
      width: w,
      height: h,
      pxScale: opts.pxScale,
      time: opts.time,
      params,
      format: opts.format,
      exporting: !!opts.exporting,
      pass: (shader, po = {}) => {
        const prog = this.programFor(effect, shader);
        const tw = Math.max(1, Math.round(po.width ?? w));
        const th = Math.max(1, Math.round(po.height ?? h));
        const target = po.target ?? this.pool.acquire(tw, th, po.format ?? opts.format);
        const uniforms: Record<string, UniformValue | undefined> = {
          ...base,
          u_resolution: [target.width, target.height],
          u_input: input,
          u_original: effect.usesOriginal ? ctx.original : undefined,
          ...po.inputs,
          ...po.uniforms,
        };
        this.draw(prog, target, target.width, target.height, uniforms, po);
        return target;
      },
      release: (t) => {
        if (t !== input && t !== original) this.pool.release(t);
      },
      target: (tw, th, fmt) => this.pool.acquire(tw, th, fmt ?? opts.format),
      cached: <T,>(key: string, create: () => T, dispose?: (v: T) => void): T => this.cached(layerId, key, create, dispose),
      asset: (ref: ParamValue) => this.assetTexture(ref),
      blur: (src, sx, sy, fmt) => this.blur(src, sx, sy ?? sx, fmt ?? opts.format),
      builtin: (name) => this.builtin(name),
      read: (t) => this.readTexture(t),
    };
    let out: Texture;
    if (effect.render) out = effect.render(ctx);
    else out = ctx.pass('main');
    for (const t of owned) if (t !== out) this.pool.release(t);
    return out;
  }

  /** Convert param values to uniforms (LUT textures are cached per layer). */
  private paramUniforms(effect: EffectDef, layerId: string, params: ParamValues): Record<string, UniformValue> {
    const u: Record<string, UniformValue> = {};
    for (const p of effect.params) {
      const v = params[p.key] ?? (p.default as ParamValue);
      const n = 'u_' + p.key;
      switch (p.type) {
        case 'float':
        case 'int':
        case 'enum':
          u[n] = Number(v);
          break;
        case 'bool':
          u[n] = !!v;
          break;
        case 'color':
          u[n] = hexToRgb(String(v));
          break;
        case 'vec2':
        case 'range':
          u[n] = (v as [number, number]) ?? p.default;
          break;
        case 'wheel': {
          const [hue, amt] = (v as [number, number]) ?? p.default;
          const a = (hue * Math.PI) / 180;
          u[n] = [Math.cos(a) * amt, Math.sin(a) * amt, amt];
          u[n + 'Color'] = hueColor(hue);
          break;
        }
        case 'curve': {
          const pts = v as [number, number][];
          const key = 'curve:' + p.key + ':' + JSON.stringify(pts);
          u[n] = this.cached(layerId, key, () => textureFromFloat(this.gl, buildCurveLut(pts, !!p.periodic), 256, 1), (t) => t.dispose());
          break;
        }
        case 'gradient': {
          const key = 'grad:' + p.key + ':' + JSON.stringify(v);
          u[n] = this.cached(layerId, key, () => textureFromFloat(this.gl, buildGradientLut(v as never), 256, 1), (t) => t.dispose());
          break;
        }
        case 'palette': {
          const cols = (v as string[]) ?? [];
          const arr = new Float32Array(MAX_PALETTE * 3);
          cols.slice(0, MAX_PALETTE).forEach((c, i) => arr.set(hexToRgb(c), i * 3));
          u[n] = arr;
          u[n + 'Count'] = Math.min(cols.length, MAX_PALETTE);
          break;
        }
        case 'texture': {
          const t = this.assetTexture(v);
          u[n] = t ?? this.dummy;
          u[n + 'Loaded'] = !!t;
          u[n + 'Size'] = t ? [t.width, t.height] : [1, 1];
          break;
        }
        case 'patterns': {
          const sel = (v as string[]) ?? [];
          const key = 'pat:' + p.key + ':' + sel.join(',');
          const { data, width, height, count } = patternsToTexture(p.patterns, sel);
          u[n] = this.cached(layerId, key, () => textureFromData(this.gl, data, width, height, { nearest: true, repeat: false }), (t) => t.dispose());
          u[n + 'Count'] = count;
          break;
        }
        default:
          break;
      }
    }
    return u;
  }

  private assetTexture(ref: ParamValue): Texture | null {
    if (ref && typeof ref === 'object' && 'assetId' in ref) return this.assets.get(ref.assetId);
    return null;
  }

  // ---------------------------------------------------------------- caches

  private cached<T>(layerId: string, key: string, create: () => T, dispose?: (v: T) => void): T {
    let m = this.layerCaches.get(layerId);
    if (!m) this.layerCaches.set(layerId, (m = new Map()));
    let e = m.get(key);
    if (!e) {
      e = { value: create(), dispose: dispose as ((v: unknown) => void) | undefined, frame: this.frame };
      m.set(key, e);
    }
    e.frame = this.frame;
    return e.value as T;
  }

  private gcCaches(layerIds: string[]): void {
    for (const id of layerIds) {
      const m = this.layerCaches.get(id);
      if (!m) continue;
      for (const [k, e] of m) {
        if (e.frame < this.frame) {
          e.dispose?.(e.value);
          m.delete(k);
        }
      }
    }
  }

  /** Dispose caches of layers that no longer exist. */
  pruneLayers(keep: Set<string>): void {
    for (const [id, m] of this.layerCaches) {
      if (keep.has(id) || id.startsWith('thumb:')) continue;
      for (const e of m.values()) e.dispose?.(e.value);
      this.layerCaches.delete(id);
    }
  }

  private builtin(name: 'blueNoise' | 'paper' | 'fiber'): Texture {
    let t = this.builtins.get(name);
    if (!t) {
      const gl = this.gl;
      if (name === 'blueNoise') {
        const { data, size } = makeBlueNoise(128);
        t = textureFromData(gl, data, size, size, { nearest: true, repeat: true });
      } else if (name === 'paper') {
        const { data, size } = makePaperTexture(512);
        t = textureFromData(gl, data, size, size, { repeat: true });
      } else {
        const { data, size } = makeFiberTexture(512);
        t = textureFromData(gl, data, size, size, { repeat: true });
      }
      this.builtins.set(name, t);
    }
    return t;
  }

  // ---------------------------------------------------------------- shared blur

  /**
   * Separable gaussian blur. Large sigmas are computed on a downsampled copy so the cost stays
   * roughly constant regardless of resolution (important for 8K–16K exports).
   */
  blur(src: Texture, sigmaX: number, sigmaY: number, format: TexFormat): Texture {
    const w = src.width;
    const h = src.height;
    sigmaX = Math.max(0, sigmaX);
    sigmaY = Math.max(0, sigmaY);
    const s = Math.max(sigmaX, sigmaY);
    if (s < 0.35) {
      const copy = this.pool.acquire(w, h, format);
      this.draw(this.coreProgram('copy'), copy, w, h, { u_src: src });
      return copy;
    }
    // Downsample until the sigma at that level is <= 6 texels.
    let level = 0;
    while (s / 2 ** level > 6 && Math.min(w, h) / 2 ** (level + 1) >= 4) level++;
    let cur = src;
    const temps: Texture[] = [];
    let cw = w;
    let ch = h;
    for (let i = 0; i < level; i++) {
      cw = Math.max(1, Math.ceil(cw / 2));
      ch = Math.max(1, Math.ceil(ch / 2));
      const d = this.pool.acquire(cw, ch, format);
      this.draw(this.coreProgram('downsample'), d, cw, ch, { u_src: cur, u_srcTexel: [1 / cur.width, 1 / cur.height] });
      temps.push(d);
      cur = d;
    }
    const f = 2 ** level;
    // Each 2x box downsample contributes roughly sigma 0.5 (in its source texels).
    const pre = level > 0 ? Math.sqrt((1 - 4 ** -level) / 3) * 0.9 : 0;
    const sx = Math.sqrt(Math.max(0, (sigmaX / f) ** 2 - pre * pre));
    const sy = Math.sqrt(Math.max(0, (sigmaY / f) ** 2 - pre * pre));
    const hpass = this.pool.acquire(cw, ch, format);
    this.draw(this.coreProgram('gauss'), hpass, cw, ch, { u_src: cur, u_dir: [1 / cw, 0], u_sigma: sx });
    const vpass = this.pool.acquire(cw, ch, format);
    this.draw(this.coreProgram('gauss'), vpass, cw, ch, { u_src: hpass, u_dir: [0, 1 / ch], u_sigma: sy });
    this.pool.release(hpass);
    for (const t of temps) this.pool.release(t);
    if (level === 0) return vpass;
    const up = this.pool.acquire(w, h, format);
    this.draw(this.coreProgram('upsample'), up, w, h, { u_src: vpass });
    this.pool.release(vpass);
    return up;
  }

  // ---------------------------------------------------------------- output

  /** Draw a texture to the canvas (resized to the texture). */
  present(tex: Texture, opts: { checker?: boolean } = {}): void {
    const c = this.canvas;
    if (c.width !== tex.width || c.height !== tex.height) {
      c.width = tex.width;
      c.height = tex.height;
    }
    void opts;
    this.draw(this.coreProgram('present'), null, tex.width, tex.height, { u_src: tex });
  }

  /** Quantize a (float) texture to RGBA8 with dithering for readback. */
  toRGBA8(tex: Texture, dither = true): Texture {
    const out = this.pool.acquire(tex.width, tex.height, 'rgba8');
    const prev = this.tileSize;
    this.tileSize = 4096;
    this.draw(this.coreProgram('quantize'), out, tex.width, tex.height, { u_src: tex, u_dither: dither ? 1 : 0 });
    this.tileSize = prev;
    return out;
  }

  /** Minimum alpha over the whole texture (GPU 4x4 min-reduction, then a tiny readback). */
  minAlpha(tex: Texture): number {
    let cur = tex;
    const temps: Texture[] = [];
    while (cur.width > 1 || cur.height > 1) {
      const w = Math.max(1, Math.ceil(cur.width / 4));
      const h = Math.max(1, Math.ceil(cur.height / 4));
      const t = this.pool.acquire(w, h, 'rgba8');
      this.draw(this.coreProgram('minAlpha'), t, w, h, { u_src: cur });
      temps.push(t);
      cur = t;
    }
    const px = this.readTexture(cur);
    for (const t of temps) this.pool.release(t);
    return px[3];
  }

  /** Render a stack and return top-down RGBA8 pixels (thumbnails, small previews). */
  renderToPixels(layers: Layer[], opts: ChainOptions): Uint8Array {
    const out = this.renderChain(layers, opts);
    const q = out.format === 'rgba8' ? out : this.toRGBA8(out);
    const px = this.readRowsRGBA8(q, 0, q.height);
    if (q !== out) this.pool.release(q);
    this.pool.release(out);
    return px;
  }

  /** Read rows [y0, y0+rows) (top-down image rows) as RGBA8, already flipped to top-down order. */
  readRowsRGBA8(tex: Texture, y0: number, rows: number, out?: Uint8Array): Uint8Array {
    const gl = this.gl;
    const w = tex.width;
    const buf = out ?? new Uint8Array(w * rows * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tex.fbo);
    // GL rows are bottom-up: image row y maps to GL row (h - 1 - y).
    const glY = tex.height - y0 - rows;
    gl.readPixels(0, glY, w, rows, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    flipRows(buf, w * 4, rows);
    return buf;
  }

  /** Read rows as float RGBA (for 16-bit export from a half-float target). */
  readRowsFloat(tex: Texture, y0: number, rows: number, out?: Float32Array): Float32Array {
    const gl = this.gl;
    const w = tex.width;
    const buf = out ?? new Float32Array(w * rows * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tex.fbo);
    const glY = tex.height - y0 - rows;
    gl.readPixels(0, glY, w, rows, gl.RGBA, gl.FLOAT, buf);
    flipRowsF(buf, w * 4, rows);
    return buf;
  }

  /** Read a whole (small) texture as RGBA floats 0..1, bottom-up rows. */
  readTexture(t: Texture): Float32Array {
    const gl = this.gl;
    const n = t.width * t.height * 4;
    let fbo = t.fbo;
    let temp: WebGLFramebuffer | null = null;
    if (!fbo) {
      temp = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, temp);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
      fbo = temp;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    let out: Float32Array;
    if (t.format === 'rgba16f') {
      out = new Float32Array(n);
      gl.readPixels(0, 0, t.width, t.height, gl.RGBA, gl.FLOAT, out);
    } else {
      const u8 = new Uint8Array(n);
      gl.readPixels(0, 0, t.width, t.height, gl.RGBA, gl.UNSIGNED_BYTE, u8);
      out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = u8[i] / 255;
    }
    if (temp) gl.deleteFramebuffer(temp);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return out;
  }

  /** Resolve after the GPU has drained queued work (without blocking the main thread). */
  gpuIdle(): Promise<void> {
    const gl = this.gl;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    if (!sync) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        const r = gl.clientWaitSync(sync, 0, 0);
        if (r === gl.WAIT_FAILED || r === gl.ALREADY_SIGNALED || r === gl.CONDITION_SATISFIED) {
          gl.deleteSync(sync);
          resolve();
        } else setTimeout(check, 4);
      };
      check();
    });
  }

  /** After a context loss every GL object is gone: drop references and start fresh. */
  handleContextRestored(): void {
    this.programs.clear();
    this.pending.clear();
    (this as { pool: TargetPool }).pool = new TargetPool(this.gl);
    this.builtins.clear();
    this.layerCaches.clear();
    this.source = null;
    this.dummy = textureFromData(this.gl, new Uint8Array([0, 0, 0, 0]), 1, 1);
  }

  isContextLost(): boolean {
    return this.gl.isContextLost();
  }

  dispose(): void {
    this.pool.disposeAll();
    for (const p of this.programs.values()) p.dispose();
    this.programs.clear();
    this.source?.dispose();
    for (const t of this.builtins.values()) t.dispose();
    for (const m of this.layerCaches.values()) for (const e of m.values()) e.dispose?.(e.value);
    this.layerCaches.clear();
  }
}

function hueColor(hueDeg: number): [number, number, number] {
  const h = (((hueDeg % 360) + 360) % 360) / 360;
  const f = (n: number) => Math.min(1, Math.max(0, Math.abs(((h + n) % 1) * 6 - 3) - 1));
  return [f(0), f(2 / 3), f(1 / 3)];
}

function flipRows(buf: Uint8Array, stride: number, rows: number): void {
  const tmp = new Uint8Array(stride);
  for (let a = 0, b = rows - 1; a < b; a++, b--) {
    const ia = a * stride;
    const ib = b * stride;
    tmp.set(buf.subarray(ia, ia + stride));
    buf.copyWithin(ia, ib, ib + stride);
    buf.set(tmp, ib);
  }
}

function flipRowsF(buf: Float32Array, stride: number, rows: number): void {
  const tmp = new Float32Array(stride);
  for (let a = 0, b = rows - 1; a < b; a++, b--) {
    const ia = a * stride;
    const ib = b * stride;
    tmp.set(buf.subarray(ia, ia + stride));
    buf.copyWithin(ia, ib, ib + stride);
    buf.set(tmp, ib);
  }
}

/** Pseudo effect holding the engine's own shaders (they get the same prelude). */
const CORE_EFFECT: Pick<EffectDef, 'id' | 'params' | 'shaders'> = {
  id: 'core',
  params: [] as ParamDef[],
  shaders: CORE_SHADERS,
};
