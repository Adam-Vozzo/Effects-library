# Effects Library

A personal WebGL 2 image-effects workstation for digital art. Stack GPU shader effects, tweak them
live, save looks as presets and export stills up to **16K** (16384 px per side).

**Live:** https://adam-vozzo.github.io/Effects-library/

All shaders here are original implementations.

## Effects (73)

- **Blur** (8): Depth of field, Circular blur, Gaussian blur, Motion blur, Radial blur, Blur/sharp, Zoom blur, Camera shake
- **Color** (16): Color grading, Thermal, Curves, Color balance, Gradient map, Color temperature, Dither, Hue curves, Duotone, Hue/saturation, Levels, Exposure, Monochrome, Color matrix, RGB Gain, Contrast
- **Distort** (12): Elastic grid, Grid split, Reeded glass, Cubify, Glitch, Perspective, Pinch, Polar to rectangular, Rectangular to polar, Ripple, Transform, Swirl
- **Effects** (21): JPEG glitch, Scatter, Risograph, VHS, ASCII, MacPaint, Halftone screen, Emboss, Bevel, Bloom, Star glow, Motion trails, LED screen, NTSC, RGB Shift, CRT screen, Modulation, Threshold, Vignette, Stripe, Frame drop
- **Generate** (6): Text, Noise, Ink bleed, Paper scan, Blob Tracker, Paper cutout
- **Custom** (3): Layer Mix, Texture Blur, Displacement
- **Film** (7): Classic Film, Vintage Film, Black & White, Infrared Film, Instant Film, Film Grain, Halation

Parameters, ranges and defaults follow effect.app; defaults were checked side by side against its
renders of the same photo. Film stocks are parametric emulations (no LUT files). Temporal effects
built for video (motion trails, frame drop, blob persistence) render their single-frame look on stills.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (open with any static file server)
```

Requires a browser with WebGL 2 (Chrome, Edge, Firefox, Safari 15+). A discrete or recent integrated
GPU is recommended for 8K–16K exports.

## Using it

- **Load media**: drop an image anywhere, paste one (Ctrl/⌘ V), use *Load media*, the dice
  (random photo from picsum.photos), the link icon (image URL) or one of the bundled samples.
- **Add effects** from the library on the left (click a card; thumbnails preview each effect on
  *your* image). Search with `/`. Star effects to pin them under *Favorites*.
- **Layers** apply bottom → top. Drag the grip to reorder, eye to hide, double-click to rename,
  right-click for duplicate / move. Every layer also has an opacity + blend mode (24 Photoshop
  modes) under *Layer* at the bottom of its controls.
- **Controls**: drag sliders (arrow keys nudge, Shift ×10), type exact values, double-click a label to
  reset it, ⤨ randomizes, ↺ resets the whole layer. Undo/redo with Ctrl/⌘ Z / Shift Z.
- **Crop** (`C`): aspect presets, rotation, flips. **Compare** with the original: hold `\` or the
  compare button. Zoom with ctrl/pinch + wheel, `0` fit, `1` 100 %, Space-drag to pan.
- **Presets**: save the current stack (bookmark icon or Ctrl/⌘ S), apply from the *Presets* tab
  (Shift-click adds on top of the current stack), import/export them as JSON.
- **Animated effects** (VHS, camera shake, ripple, …) show a timeline; stills export the frame at the
  playhead.
- Your session (image, layers, crop, texture inputs) autosaves to IndexedDB and restores on reload.

### Export

Pick PNG (8- or 16-bit), JPG or WebP and a size: original, a scale factor, a long-side preset
(1080 → 16K) or a custom size. The export renders the whole stack again at the target resolution:

- effect sizes are resolution independent (params are expressed relative to a 720 px long side, effect.app’s working scale —
  switchable to source pixels in the menu), so a 16K export looks like the preview, just sharper;
- draws are split into scissor tiles to stay under GPU watchdog limits, intermediates use half-float
  targets (8-bit above ~67 MP to save VRAM; 16-bit PNG keeps float precision end to end);
- pixels are read back in strips and encoded in a worker by streaming PNG/JPEG encoders, so the full
  raster never has to fit in a canvas. WebP is capped at 16383 px by the format.

The export dialog shows the output size, estimated GPU memory, and disables sizes beyond your GPU's
`MAX_TEXTURE_SIZE`.

## GitHub Pages

The site is served by GitHub Pages straight from the `main` branch. Browsers can't run the source
`index.html` (it loads TypeScript), so the production build is committed in `docs/` and the root
`index.html` redirects there; Vite strips that redirect from everything it serves or builds.

`.github/workflows/pages.yml` rebuilds `docs/` and commits it on every push to `main`, so don't edit
`docs/` by hand. To rebuild it locally: `npm run build:pages`. If you'd rather drop the redirect,
set the Pages folder to `/docs` (Settings → Pages) and the app is served at the site root.

## Project layout

```
src/
  engine/        WebGL2 core: gl helpers, renderer (passes, pooling, blur, tiling, readback),
                 GLSL library (color spaces, noise, blend modes), param → uniform prelude, LUTs
  effects/       one file per effect, grouped by category; registry.ts, helpers.ts (param builders)
  ui/            editor panels (browser, layers, stage, controls & editors, crop, export, timeline)
  state/         store with undo/redo, presets & favorites, texture assets, IndexedDB autosave
  export/        exporter, streaming PNG & JPEG encoders, encode worker
  presets/       built-in presets
  dev/harness.ts effect test harness (harness.html)
docs/            production build served by GitHub Pages (generated, see above)
tests/
  unit/          vitest: encoders
  e2e/smoke.mjs  Playwright: renders every effect + drives the editor and exports
```

### Writing an effect

```ts
import type { EffectDef } from '../../engine/types';
import { float, color } from '../helpers';

export const tint: EffectDef = {
  id: 'tint',
  name: 'Tint',
  category: 'Color',
  params: [float('amount', 'amount', 0, 1, 0.5), color('tint', 'tint color', '#ff8800')],
  shaders: {
    // Every param is available as a uniform (u_amount, u_tint); u_input is the layer below.
    main: /* glsl */ `
void main() {
  vec4 c = texture(u_input, v_uv);
  fragColor = vec4(mix(c.rgb, c.rgb * u_tint, u_amount), c.a);
}`,
  },
};
```

Multi-pass effects implement `render(ctx)` and chain `ctx.pass('name', { inputs, uniforms, width, height })`,
`ctx.blur(tex, sigmaX, sigmaY)` and friends — see `src/engine/types.ts` (`RenderContext`). Pixel-sized
params should be multiplied by `u_pxScale` / `ctx.pxScale` to stay resolution independent.
Register the effect in its category's `index.ts`.

## Testing

```bash
npm run typecheck
npm test            # unit tests (encoders)
npm run test:e2e    # headless Chromium: every effect renders, editor flow, PNG/JPG export
```

`harness.html` renders effects without the editor, e.g.
`/harness.html?cat=Blur&img=bokeh&size=720` or `/harness.html?fx=bloom,vignette&p.bloom.intensity=2`.

## Roadmap

- Mosh Pro features (next).
- Video input/export, keyframed parameters.

## Credits

Sample photos from [Unsplash](https://unsplash.com/license) via picsum.photos — see
`public/samples/credits.json` (also listed in the app's *About* dialog). Fonts: Archivo (OFL),
Commit Mono (OFL).
