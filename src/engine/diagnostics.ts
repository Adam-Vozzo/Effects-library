// GPU self-test for bug reports: probes the shader features effects rely on and summarizes the
// environment, so a driver-specific rendering problem can be pinned down from a pasted report.

import { Program, Texture, setUniforms, textureFromData, type UniformValue } from './gl';
import { buildFragment } from './prelude';
import type { Renderer } from './renderer';
import { relativePxScale } from './units';
import { defaultParams, getEffect } from '../effects/registry';

interface Probe {
  name: string;
  /** Fragment body; results go through emit() so RGBA8 fallback targets can carry 0..255 values. */
  body: string;
  inputs?: Record<string, UniformValue>;
  /** Expected RGBA; NaN entries are not checked. Omit to only report the values. */
  expect?: number[];
  needsFloat?: boolean;
}

const EMIT = /* glsl */ `
uniform float u_emitScale;
void emit(vec4 v) { fragColor = v * u_emitScale; }
`;

/** Run the probes and a MacPaint render of the current image; returns a plain-text report. */
export function runGpuDiagnostics(r: Renderer): string {
  const gl = r.gl;
  const float = r.caps.floatTargets;
  const lines: string[] = ['Effects Library GPU diagnostics', `Browser: ${navigator.userAgent}`];
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
  lines.push(`GPU: ${r.caps.renderer} (${vendor})`);
  lines.push(`GL: ${gl.getParameter(gl.VERSION)} / ${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`);
  lines.push(
    `Limits: texture ${r.caps.maxTextureSize}, fragment uniform vectors ${gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)}, texture units ${gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)}`,
  );
  lines.push(`Float targets: ${float ? 'yes' : 'no'} · float linear: ${r.caps.floatLinear ? 'yes' : 'no'} · parallel compile: ${r.caps.parallelCompile ? 'yes' : 'no'}`);
  lines.push('');

  const owned: Texture[] = [];
  const data = (w: number, h: number, fill: (x: number, y: number) => number) => {
    const d = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set([fill(x, y), 0, 0, 255], (y * w + x) * 4);
    const t = textureFromData(gl, d, w, h, { nearest: true });
    owned.push(t);
    return t;
  };
  const lut = data(256, 1, (x) => x);
  const atlas = data(80, 8, (x, y) => (x * 3 + y) & 255);

  // A non-power-of-two float target holding (x - 3.25, y) per texel, like MacPaint's tone map.
  let field: Texture | null = null;
  if (float) {
    try {
      field = new Texture(gl, 342, 342, 'rgba16f', { renderable: true });
      owned.push(field);
      drawProbe(gl, 'diag-field', `void main() { emit(vec4(floor(gl_FragCoord.xy) - vec2(3.25, 0.0), 0.5, 1.0)); }`, {}, field, 1);
    } catch (e) {
      lines.push(`[FAIL] render to RGBA16F target: ${(e as Error).message.split('\n')[0]}`);
      field = null;
    }
  }

  const probes: Probe[] = [
    { name: 'texelFetch, RGBA8 data texture', body: `uniform sampler2D u_t; void main() { emit(vec4(texelFetch(u_t, ivec2(200, 0), 0).r * 255.0, 0.0, 0.0, 1.0)); }`, inputs: { u_t: lut }, expect: [200, 0, 0, 1] },
    { name: 'texture(), RGBA8 data texture', body: `uniform sampler2D u_t; void main() { emit(vec4(texture(u_t, vec2(200.5 / 256.0, 0.5)).r * 255.0, 0.0, 0.0, 1.0)); }`, inputs: { u_t: lut }, expect: [200, 0, 0, 1] },
    { name: 'texelFetch, 80x8 atlas', body: `uniform sampler2D u_t; void main() { emit(vec4(texelFetch(u_t, ivec2(37, 5), 0).r * 255.0, 0.0, 0.0, 1.0)); }`, inputs: { u_t: atlas }, expect: [116, 0, 0, 1] },
    { name: 'textureSize', body: `uniform sampler2D u_t; void main() { emit(vec4(vec2(textureSize(u_t, 0)), 0.0, 1.0)); }`, inputs: { u_t: atlas }, expect: [80, 8, 0, 1] },
    { name: 'texelFetch, RGBA16F target', body: `uniform sampler2D u_f; void main() { emit(texelFetch(u_f, ivec2(5, 7), 0)); }`, inputs: field ? { u_f: field } : {}, expect: [1.75, 7, 0.5, 1], needsFloat: true },
    { name: 'texture(), RGBA16F target', body: `uniform sampler2D u_f; void main() { emit(texture(u_f, (vec2(5.0, 7.0) + 0.5) / 342.0)); }`, inputs: field ? { u_f: field } : {}, expect: [1.75, 7, 0.5, 1], needsFloat: true },
    { name: 'int & % abs', body: `uniform float u_a; void main() { int i = int(u_a); emit(vec4(float(i & 7), float(7 - (i & 7)), float(i % 8), float(abs(-i)))); }`, inputs: { u_a: 141 }, expect: [5, 2, 5, 141] },
    { name: 'loop with continue', body: `uniform float u_a; void main() { int c = 0; for (int j = -3; j <= 3; j++) { if (abs(j) > int(u_a) - 140) continue; c++; } emit(vec4(float(c), 0.0, 0.0, 1.0)); }`, inputs: { u_a: 141 }, expect: [3, 0, 0, 1] },
    { name: 'NaN: saturate, clamp, isnan', body: `uniform float u_a; void main() { float z = u_a - 141.0; float n = z / z; emit(vec4(saturate(n), clamp(n, 0.0, 1.0), isnan(n) ? 1.0 : 0.0, 1.0)); }`, inputs: { u_a: 141 } },
  ];
  for (const p of probes) {
    if (p.needsFloat && !field) {
      lines.push(`[skip] ${p.name}: no float targets`);
      continue;
    }
    lines.push(runProbe(gl, p, float));
  }
  if (field) lines.push(fieldRoundTrip(gl, field));
  lines.push('');
  lines.push(macpaintCheck(r));
  if (r.lastError) lines.push(`Last render error: ${r.lastError.message.split('\n')[0]}`);
  for (const t of owned) t.dispose();
  return lines.join('\n');
}

function drawProbe(gl: WebGL2RenderingContext, name: string, body: string, inputs: Record<string, UniformValue>, target: Texture, emitScale: number): void {
  const prog = new Program(gl, name, buildFragment({ params: [] }, EMIT + body));
  try {
    prog.finalize();
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.width, target.height);
    gl.useProgram(prog.program);
    setUniforms(prog, { u_resolution: [target.width, target.height], u_emitScale: emitScale, ...inputs });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    prog.dispose();
  }
}

function readTarget(gl: WebGL2RenderingContext, t: Texture): Float32Array {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
  const n = t.width * t.height * 4;
  let out: Float32Array;
  if (t.format === 'rgba16f') {
    out = new Float32Array(n);
    gl.readPixels(0, 0, t.width, t.height, gl.RGBA, gl.FLOAT, out);
  } else {
    const b = new Uint8Array(n);
    gl.readPixels(0, 0, t.width, t.height, gl.RGBA, gl.UNSIGNED_BYTE, b);
    out = Float32Array.from(b);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return out;
}

function runProbe(gl: WebGL2RenderingContext, p: Probe, float: boolean): string {
  const target = new Texture(gl, 1, 1, float ? 'rgba16f' : 'rgba8', { renderable: true });
  try {
    while (gl.getError() !== gl.NO_ERROR) {
      // clear stale errors
    }
    // RGBA8 stores 0..1, so scale 0..255 results down; float targets keep them as is.
    drawProbe(gl, 'diag', p.body, p.inputs ?? {}, target, float ? 1 : 1 / 255);
    const v = Array.from(readTarget(gl, target));
    const err = gl.getError();
    const got = v.map((x) => (Number.isNaN(x) ? 'NaN' : String(Math.round(x * 1000) / 1000))).join(', ');
    const errText = err ? ` · GL error 0x${err.toString(16)}` : '';
    if (!p.expect) return `[info] ${p.name}: ${got}${errText}`;
    const ok = !err && p.expect.every((e, i) => Number.isNaN(e) || Math.abs(v[i] - e) < 0.01 + Math.abs(e) * 0.002);
    return `[${ok ? 'ok' : 'FAIL'}] ${p.name}: ${got}${ok ? '' : ` (expected ${p.expect.join(', ')})`}${errText}`;
  } catch (e) {
    return `[FAIL] ${p.name}: ${(e as Error).message.split('\n').slice(0, 2).join(' ')}`;
  } finally {
    target.dispose();
  }
}

/** texelFetch at gl_FragCoord over a whole non-power-of-two float target (MacPaint's access pattern). */
function fieldRoundTrip(gl: WebGL2RenderingContext, field: Texture): string {
  const out = new Texture(gl, field.width, field.height, 'rgba16f', { renderable: true });
  try {
    drawProbe(
      gl,
      'diag-roundtrip',
      `uniform sampler2D u_f; void main() { vec2 p = floor(gl_FragCoord.xy); vec4 v = texelFetch(u_f, ivec2(p), 0); emit(vec4(abs(v.x - (p.x - 3.25)) + abs(v.y - p.y), 0.0, 0.0, 1.0)); }`,
      { u_f: field },
      out,
      1,
    );
    const v = readTarget(gl, out);
    let bad = 0;
    for (let i = 0; i < v.length; i += 4) if (!(v[i] < 0.01)) bad++;
    const total = field.width * field.height;
    return `[${bad ? 'FAIL' : 'ok'}] texelFetch at gl_FragCoord, ${field.width}x${field.height} float: ${bad} of ${total} texels wrong`;
  } catch (e) {
    return `[FAIL] texelFetch at gl_FragCoord: ${(e as Error).message.split('\n')[0]}`;
  } finally {
    out.dispose();
  }
}

/** Render MacPaint over the current image and report how much of it is ink vs paper. */
function macpaintCheck(r: Renderer): string {
  const fx = getEffect('macpaint');
  if (!fx || !r.hasSource) return 'MacPaint: no image loaded';
  const [sw, sh] = r.sourceSize;
  const s = 256 / Math.max(sw, sh);
  const w = Math.max(8, Math.round(sw * s));
  const h = Math.max(8, Math.round(sh * s));
  try {
    const layer = { id: 'diag:macpaint', effectId: 'macpaint', params: defaultParams(fx), visible: true, opacity: 1, blend: 'normal' as const };
    const px = r.renderToPixels([layer], { width: w, height: h, pxScale: relativePxScale(w, h), time: 0, format: r.defaultFormat, crop: null });
    let ink = 0;
    let paper = 0;
    for (let i = 0; i < px.length; i += 4) {
      const l = px[i] + px[i + 1] + px[i + 2];
      if (l < 120) ink++;
      else if (l > 660) paper++;
    }
    const n = px.length / 4;
    const pct = (k: number) => `${Math.round((k / n) * 100)}%`;
    return `MacPaint on current image (${w}x${h}, ${sw}x${sh} source): ink ${pct(ink)}, paper ${pct(paper)}, other ${pct(n - ink - paper)}`;
  } catch (e) {
    return `MacPaint: ${(e as Error).message.split('\n')[0]}`;
  }
}
