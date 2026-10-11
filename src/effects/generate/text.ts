import type { EffectDef, FontParam, ParamValues, TextParam } from '../../engine/types';
import { textureFromImage, type Texture } from '../../engine/gl';
import { BLEND_OPTIONS, angle, bool, choice, color, flag, float, num, point } from '../helpers';
import { isFontReady, loadFont } from '../../ui/fonts';

const WEIGHTS = ['Thin', 'Extra Light', 'Light', 'Regular', 'Medium', 'Semi Bold', 'Bold', 'Extra Bold', 'Black'];

interface TextRaster {
  tex: Texture;
  /** Raster extent in render px (block coordinates: y down, origin = block top-left = Position). */
  origin: [number, number];
  size: [number, number];
  pivot: [number, number];
}

function genericFamily(name: string): string {
  if (/mono|courier|vt323|press start|silkscreen|code/i.test(name)) return 'monospace';
  if (/serif|georgia|times|playfair|abril|fraktur|bodoni/i.test(name) && !/sans/i.test(name)) return 'serif';
  return 'sans-serif';
}

/**
 * Rasterize the text block with Canvas 2D: fill coverage in R, stroke coverage in G (black, opaque background so
 * the browser's alpha un-premultiply cannot disturb the channels). Only the ink bounding box is allocated.
 */
function rasterize(gl: WebGL2RenderingContext, p: ParamValues, fontPx: number, strokePx: number): TextRaster | null {
  const text = String(p.text ?? '');
  if (!text.trim() || fontPx < 0.5) return null;
  const family = String(p.font || 'Instrument Serif');
  const weight = (num(p, 'weight') + 1) * 100;
  const style = flag(p, 'italic') ? 'italic ' : '';
  const lines = text.split('\n');
  const maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 16384);
  const measure = new OffscreenCanvas(1, 1).getContext('2d')!;
  const setup = (c: OffscreenCanvasRenderingContext2D, s: number) => {
    c.font = `${style}${weight} ${fontPx * s}px "${family}", ${genericFamily(family)}`;
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    const ls = num(p, 'letterSpacing') * fontPx * s;
    if ('letterSpacing' in c) (c as unknown as { letterSpacing: string }).letterSpacing = `${ls}px`;
    return ls;
  };
  const ls = setup(measure, 1);
  const hasLs = 'letterSpacing' in measure;
  const ref = measure.measureText('Hxgjy');
  const descent = ref.fontBoundingBoxDescent ?? fontPx * 0.25;
  // The block's top edge is the first line's cap height (effect.app places the cap top at Position).
  const capH = measure.measureText('H').actualBoundingBoxAscent || fontPx * 0.7;
  const advance = num(p, 'lineHeight') * fontPx;
  // Per-line advance width (letter spacing trails the last glyph; drop it for alignment) and ink box.
  const metrics = lines.map((l) => {
    const m = measure.measureText(l);
    const extra = hasLs ? 0 : ls * l.length;
    return { m, width: Math.max(0, m.width + extra - (l.length ? ls : 0)) };
  });
  const blockW = Math.max(...metrics.map((m) => m.width), 0);
  const align = num(p, 'align');
  const pad = strokePx + 2 + fontPx * 0.05;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const placed = metrics.map(({ m, width }, i) => {
    const lx = align === 0 ? 0 : align === 1 ? (blockW - width) / 2 : blockW - width;
    const base = capH + i * advance;
    x0 = Math.min(x0, lx - m.actualBoundingBoxLeft);
    x1 = Math.max(x1, lx + Math.max(m.actualBoundingBoxRight, width));
    y0 = Math.min(y0, base - Math.max(m.actualBoundingBoxAscent, capH));
    y1 = Math.max(y1, base + Math.max(m.actualBoundingBoxDescent, descent * 0.5));
    return { lx, base };
  });
  if (!(x1 > x0 && y1 > y0)) return null;
  // Rotation pivot: center of the ink box.
  const pivot: [number, number] = [(x0 + x1) / 2, (y0 + y1) / 2];
  x0 -= pad;
  y0 -= pad;
  x1 += pad;
  y1 += pad;
  // Raster at render resolution unless it would exceed the GPU limit.
  const s = Math.min(1, maxTex / (x1 - x0), maxTex / (y1 - y0));
  const cw = Math.max(1, Math.ceil((x1 - x0) * s));
  const ch = Math.max(1, Math.ceil((y1 - y0) * s));
  const canvas = new OffscreenCanvas(cw, ch);
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#000';
  c.fillRect(0, 0, cw, ch);
  const lss = setup(c, s);
  c.globalCompositeOperation = 'lighter';
  const draw = (fn: (t: string, x: number, y: number) => void) => {
    lines.forEach((l, i) => {
      const x = (placed[i].lx - x0) * s;
      const y = (placed[i].base - y0) * s;
      if (hasLs) fn(l, x, y);
      else {
        // No canvas letterSpacing support: place glyphs one by one.
        let cx = x;
        for (const ch of l) {
          fn(ch, cx, y);
          cx += c.measureText(ch).width + lss;
        }
      }
    });
  };
  if (strokePx > 0) {
    c.strokeStyle = 'rgb(0,255,0)';
    c.lineWidth = 2 * strokePx * s;
    c.lineJoin = 'round';
    c.miterLimit = 2;
    draw((t, x, y) => c.strokeText(t, x, y));
  }
  c.fillStyle = 'rgb(255,0,0)';
  draw((t, x, y) => c.fillText(t, x, y));
  const tex = textureFromImage(gl, canvas, cw, ch);
  return { tex, origin: [x0, y0], size: [cw / s, ch / s], pivot };
}

export const text: EffectDef = {
  id: 'text',
  name: 'Text',
  category: 'Generate',
  keywords: 'text font style letter line',
  params: [
    { type: 'text', key: 'text', label: 'Text', default: 'Type', multiline: true } as TextParam,
    { type: 'font', key: 'font', label: 'Font', default: 'Instrument Serif' } as FontParam,
    choice('weight', 'Weight', WEIGHTS, 3, 'select'),
    bool('italic', 'Italic', false),
    choice('align', 'Align', ['Left', 'Center', 'Right'], 1, 'switcher'),
    // effect.app's pad spans [-1, 2] image widths (image = middle third); Position is the block's top-left.
    point('position', 'Position', [-0.2, 0.2], { min: [-3, -3], max: [3, 3] }),
    float('size', 'Size', 0.01, 0.6, 0.12, 0.005),
    angle('rotation', 'Rotation', -360, 360, 0),
    float('lineHeight', 'Line Height', 0.5, 3, 1.2, 0.05),
    float('letterSpacing', 'Letter Spacing', -0.1, 0.6, 0, 0.005),
    color('textColor', 'Text Color', '#ffffff'),
    float('opacity', 'Opacity', 0, 1, 1),
    float('strokeWidth', 'Stroke Width', 0, 30, 0, 0.5),
    color('strokeColor', 'Stroke Color', '#000000'),
    choice('blendMode', 'blend mode', BLEND_OPTIONS, 0, 'slider'),
  ],
  shaders: {
    main: /* glsl */ `
uniform sampler2D u_textTex;
uniform vec2 u_rasterOrigin; // raster top-left in block coords (render px, y down, origin = Position)
uniform vec2 u_rasterSize;   // raster extent in render px
uniform vec2 u_pivot;        // rotation center in block coords
void main() {
  vec4 base = texture(u_input, v_uv);
  vec2 d = v_uv * u_resolution - pointToUv(u_position) * u_resolution;
  vec2 b = vec2(d.x, -d.y);
  // Positive rotation turns the text clockwise around the center of its ink box.
  b = u_pivot + rot2(-radians(u_rotation)) * (b - u_pivot);
  vec2 r = (b - u_rasterOrigin) / u_rasterSize;
  vec2 cov = vec2(0.0);
  if (all(greaterThanEqual(r, vec2(0.0))) && all(lessThanEqual(r, vec2(1.0)))) {
    cov = texture(u_textTex, vec2(r.x, 1.0 - r.y)).rg;
  }
  float fillA = cov.r;
  float strokeA = cov.g;
  float a = max(fillA, strokeA) * u_opacity;
  vec3 col = mix(u_strokeColor, u_textColor, fillA);
  vec3 blended = blendMode(u_blendMode, saturate(base.rgb), col);
  fragColor = vec4(mix(base.rgb, blended, a), max(base.a, a));
}`,
  },
  render(ctx) {
    const p = ctx.params;
    const family = String(p.font || 'Instrument Serif');
    const ready = typeof document === 'undefined' || isFontReady(family);
    if (!ready) void loadFont(family);
    const fontPx = num(p, 'size') * ctx.height;
    const strokePx = num(p, 'strokeWidth') * ctx.pxScale;
    const key = JSON.stringify([
      'text',
      p.text,
      family,
      p.weight,
      p.italic,
      p.align,
      Math.round(fontPx * 100),
      p.lineHeight,
      p.letterSpacing,
      Math.round(strokePx * 100),
      ready,
    ]);
    const raster = ctx.cached<TextRaster | null>(
      key,
      () => (typeof OffscreenCanvas === 'undefined' ? null : rasterize(ctx.gl, p, fontPx, strokePx)),
      (r) => r?.tex.dispose(),
    );
    if (!raster) return ctx.input;
    return ctx.pass('main', {
      inputs: { u_textTex: raster.tex },
      uniforms: { u_rasterOrigin: raster.origin, u_rasterSize: raster.size, u_pivot: raster.pivot },
    });
  },
};
