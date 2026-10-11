import type { EffectDef } from '../../engine/types';
import { float, int } from '../helpers';

// Frame drop holds frames at a reduced, irregular frame rate and optionally ghosts the held frame
// over the live one. That is purely temporal (it needs previous video frames); on a still image the
// held frame is the current frame, so the effect is an exact pass-through (as on effect.app).
// The params are kept for presets/projects and future video support.
export const frameDrop: EffectDef = {
  id: 'frame-drop',
  name: 'Frame drop',
  category: 'Effects',
  keywords: 'drop frame hold frame fps judder freeze Stutter',
  params: [
    int('fps', 'FPS', 1, 30, 8),
    float('irregularity', 'Irregularity', 0, 1, 0.35),
    float('opacity', 'Opacity', 0, 1, 0),
  ],
  shaders: {
    main: /* glsl */ `
void main() { fragColor = texture(u_input, v_uv); }`,
  },
  render: (ctx) => ctx.input,
};
