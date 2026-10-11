// Low-level WebGL2 helpers: capability detection, render targets, programs.

export type TexFormat = 'rgba8' | 'rgba16f';

export interface Caps {
  maxTextureSize: number;
  maxRenderbufferSize: number;
  maxViewport: [number, number];
  floatTargets: boolean;
  floatLinear: boolean;
  parallelCompile: boolean;
  renderer: string;
}

export function detectCaps(gl: WebGL2RenderingContext): Caps {
  const floatTargets = !!gl.getExtension('EXT_color_buffer_float');
  const floatLinear = !!gl.getExtension('OES_texture_float_linear');
  const parallelCompile = !!gl.getExtension('KHR_parallel_shader_compile');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
  return {
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
    maxViewport: [vp[0], vp[1]],
    floatTargets,
    floatLinear,
    parallelCompile,
    renderer,
  };
}

/** A texture that can be sampled, optionally backed by a framebuffer so it can be rendered into. */
export class Texture {
  readonly tex: WebGLTexture;
  fbo: WebGLFramebuffer | null = null;
  /** Pool bookkeeping: true while handed out by a TargetPool. */
  inUse = false;
  readonly levels: number;
  constructor(
    readonly gl: WebGL2RenderingContext,
    public width: number,
    public height: number,
    readonly format: TexFormat,
    opts: { renderable?: boolean; levels?: number } = {},
  ) {
    const t = gl.createTexture();
    if (!t) throw new Error('Failed to create texture');
    this.tex = t;
    this.levels = opts.levels ?? 1;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, this.levels, format === 'rgba16f' ? gl.RGBA16F : gl.RGBA8, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.levels > 1 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (opts.renderable) {
      const fbo = gl.createFramebuffer();
      if (!fbo) throw new Error('Failed to create framebuffer');
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        gl.deleteFramebuffer(fbo);
        gl.deleteTexture(t);
        throw new Error(`Framebuffer incomplete (0x${status.toString(16)}) for ${width}x${height} ${format}`);
      }
      this.fbo = fbo;
    }
  }

  get bytes(): number {
    return Math.round(this.width * this.height * (this.format === 'rgba16f' ? 8 : 4) * (this.levels > 1 ? 4 / 3 : 1));
  }

  setFilter(nearest: boolean): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    const min = nearest ? (this.levels > 1 ? gl.NEAREST_MIPMAP_NEAREST : gl.NEAREST) : this.levels > 1 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
  }

  setWrap(repeat: boolean, mirror = false): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    const w = mirror ? gl.MIRRORED_REPEAT : repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
  }

  dispose(): void {
    const gl = this.gl;
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    gl.deleteTexture(this.tex);
    this.fbo = null;
  }
}

export function mipLevels(w: number, h: number): number {
  return Math.floor(Math.log2(Math.max(w, h))) + 1;
}

/** Upload an image-like source as an immutable RGBA8 texture (flipped so v=0 is the bottom row). */
export function textureFromImage(
  gl: WebGL2RenderingContext,
  src: TexImageSource,
  width: number,
  height: number,
  opts: { mipmaps?: boolean; repeat?: boolean; nearest?: boolean } = {},
): Texture {
  const t = new Texture(gl, width, height, 'rgba8', { levels: opts.mipmaps ? mipLevels(width, height) : 1 });
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  if (opts.mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
  t.setFilter(!!opts.nearest);
  t.setWrap(!!opts.repeat);
  return t;
}

/** Create a small RGBA8 data texture (LUTs, palettes, glyph atlases). Rows are bottom-up. */
export function textureFromData(
  gl: WebGL2RenderingContext,
  data: Uint8Array,
  width: number,
  height: number,
  opts: { nearest?: boolean; repeat?: boolean } = {},
): Texture {
  const t = new Texture(gl, width, height, 'rgba8');
  updateTextureData(t, data);
  t.setFilter(!!opts.nearest);
  t.setWrap(!!opts.repeat);
  return t;
}

/** Float data texture stored as RGBA16F (filterable everywhere WebGL2 runs). Rows are bottom-up. */
export function textureFromFloat(
  gl: WebGL2RenderingContext,
  data: Float32Array,
  width: number,
  height: number,
  opts: { nearest?: boolean; repeat?: boolean } = {},
): Texture {
  const t = new Texture(gl, width, height, 'rgba16f');
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, data);
  t.setFilter(!!opts.nearest);
  t.setWrap(!!opts.repeat);
  return t;
}

export function updateTextureData(t: Texture, data: Uint8Array): void {
  const gl = t.gl;
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, t.width, t.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
}

/** Pool of renderable textures keyed by size + format, so per-frame passes don't reallocate. */
export class TargetPool {
  private free: Texture[] = [];
  private all = new Set<Texture>();
  constructor(private gl: WebGL2RenderingContext) {}

  acquire(width: number, height: number, format: TexFormat): Texture {
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));
    const i = this.free.findIndex((t) => t.width === width && t.height === height && t.format === format);
    let t: Texture;
    if (i >= 0) {
      t = this.free[i];
      this.free.splice(i, 1);
    } else {
      t = new Texture(this.gl, width, height, format, { renderable: true });
      this.all.add(t);
    }
    t.inUse = true;
    return t;
  }

  release(t: Texture | null | undefined): void {
    if (!t || !t.inUse || !this.all.has(t)) return;
    t.inUse = false;
    this.free.push(t);
  }

  /** Drop free textures (all of them, or those not matching a size we expect to reuse). */
  trim(keep?: (t: Texture) => boolean): void {
    this.free = this.free.filter((t) => {
      if (keep && keep(t)) return true;
      t.dispose();
      this.all.delete(t);
      return false;
    });
  }

  get allocatedBytes(): number {
    let n = 0;
    for (const t of this.all) n += t.bytes;
    return n;
  }

  disposeAll(): void {
    for (const t of this.all) t.dispose();
    this.all.clear();
    this.free = [];
  }
}

const VERT = `#version 300 es
out vec2 v_uv;
void main() {
  // Single oversized triangle covering the viewport.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export interface UniformInfo {
  loc: WebGLUniformLocation;
  type: number;
  size: number;
}

export type UniformValue = number | boolean | number[] | Float32Array | Int32Array | Texture;

export class Program {
  readonly program: WebGLProgram;
  readonly uniforms = new Map<string, UniformInfo>();
  private linked = false;
  private vs: WebGLShader;
  private fs: WebGLShader;

  constructor(
    readonly gl: WebGL2RenderingContext,
    readonly name: string,
    readonly fragSource: string,
  ) {
    this.vs = compile(gl, gl.VERTEX_SHADER, VERT, name + ' (vertex)');
    this.fs = compile(gl, gl.FRAGMENT_SHADER, fragSource, name);
    const p = gl.createProgram();
    if (!p) throw new Error('Failed to create program');
    gl.attachShader(p, this.vs);
    gl.attachShader(p, this.fs);
    gl.linkProgram(p);
    this.program = p;
  }

  /** True once the (possibly parallel) compile has finished. */
  isReady(parallel: boolean): boolean {
    if (this.linked || !parallel) return true;
    const gl = this.gl;
    return !!gl.getProgramParameter(this.program, 0x91b1 /* COMPLETION_STATUS_KHR */);
  }

  /** Finish linking (throws with a readable log on failure) and read uniform metadata. */
  finalize(): void {
    if (this.linked) return;
    const gl = this.gl;
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const fsLog = gl.getShaderInfoLog(this.fs) || '';
      const log = gl.getProgramInfoLog(this.program) || '';
      throw new ShaderError(this.name, (fsLog + '\n' + log).trim(), this.fragSource);
    }
    const n = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(this.program, i);
      if (!info) continue;
      const loc = gl.getUniformLocation(this.program, info.name);
      if (!loc) continue;
      const base = info.name.replace(/\[0\]$/, '');
      this.uniforms.set(base, { loc, type: info.type, size: info.size });
    }
    gl.detachShader(this.program, this.vs);
    gl.detachShader(this.program, this.fs);
    gl.deleteShader(this.vs);
    gl.deleteShader(this.fs);
    this.linked = true;
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}

export class ShaderError extends Error {
  constructor(
    readonly shaderName: string,
    readonly log: string,
    readonly source: string,
  ) {
    super(`Shader "${shaderName}" failed to compile:\n${annotate(log, source)}`);
  }
}

function annotate(log: string, source: string): string {
  let lines = source.split('\n');
  // Bodies are compiled after a "#line 1" directive, so error line numbers refer to the body.
  const marker = lines.indexOf('#line 1');
  if (marker >= 0) lines = lines.slice(marker + 1);
  const out: string[] = [log];
  const re = /ERROR:\s*\d+:(\d+)/g;
  let m: RegExpExecArray | null;
  const seen = new Set<number>();
  while ((m = re.exec(log))) {
    const ln = parseInt(m[1], 10);
    if (seen.has(ln)) continue;
    seen.add(ln);
    for (let k = Math.max(1, ln - 2); k <= Math.min(lines.length, ln + 2); k++) {
      out.push(`${k === ln ? '>' : ' '}${String(k).padStart(5)}| ${lines[k - 1]}`);
    }
  }
  return out.join('\n');
}

function compile(gl: WebGL2RenderingContext, type: number, src: string, name: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('Failed to create shader ' + name);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

/** Bind uniforms by name; textures are assigned to sequential units. Unknown names are ignored. */
export function setUniforms(prog: Program, values: Record<string, UniformValue | undefined>, unitStart = 0): number {
  const gl = prog.gl;
  let unit = unitStart;
  for (const name in values) {
    const v = values[name];
    if (v === undefined) continue;
    const u = prog.uniforms.get(name);
    if (!u) continue;
    if (v instanceof Texture) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, v.tex);
      gl.uniform1i(u.loc, unit);
      unit++;
      continue;
    }
    setUniform(gl, u, v);
  }
  return unit;
}

function setUniform(gl: WebGL2RenderingContext, u: UniformInfo, v: number | boolean | number[] | Float32Array | Int32Array): void {
  const num = typeof v === 'boolean' ? (v ? 1 : 0) : v;
  switch (u.type) {
    case gl.FLOAT:
      if (typeof num === 'number') gl.uniform1f(u.loc, num);
      else gl.uniform1fv(u.loc, toF32(num));
      break;
    case gl.INT:
    case gl.BOOL:
    case gl.SAMPLER_2D:
      if (typeof num === 'number') gl.uniform1i(u.loc, Math.round(num));
      else gl.uniform1iv(u.loc, Int32Array.from(num as ArrayLike<number>, (x) => Math.round(x)));
      break;
    case gl.FLOAT_VEC2:
      gl.uniform2fv(u.loc, toF32(num));
      break;
    case gl.FLOAT_VEC3:
      gl.uniform3fv(u.loc, toF32(num));
      break;
    case gl.FLOAT_VEC4:
      gl.uniform4fv(u.loc, toF32(num));
      break;
    case gl.INT_VEC2:
    case gl.BOOL_VEC2:
      gl.uniform2iv(u.loc, Int32Array.from(num as ArrayLike<number>));
      break;
    case gl.INT_VEC3:
    case gl.BOOL_VEC3:
      gl.uniform3iv(u.loc, Int32Array.from(num as ArrayLike<number>));
      break;
    case gl.INT_VEC4:
    case gl.BOOL_VEC4:
      gl.uniform4iv(u.loc, Int32Array.from(num as ArrayLike<number>));
      break;
    case gl.FLOAT_MAT3:
      gl.uniformMatrix3fv(u.loc, false, toF32(num));
      break;
    case gl.FLOAT_MAT4:
      gl.uniformMatrix4fv(u.loc, false, toF32(num));
      break;
    case gl.FLOAT_MAT2:
      gl.uniformMatrix2fv(u.loc, false, toF32(num));
      break;
    default:
      break;
  }
}

function toF32(v: number | number[] | Float32Array | Int32Array): Float32Array {
  if (typeof v === 'number') return new Float32Array([v]);
  return v instanceof Float32Array ? v : Float32Array.from(v as ArrayLike<number>);
}
