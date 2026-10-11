// Shared helpers for the second half of the "Effects" category (Motion trails … Frame drop).

import { BLEND_MODES, type BlendMode } from '../../engine/types';

const libIndex = (m: BlendMode) => BLEND_MODES.indexOf(m);

/** effect.app's 10-entry blend list (Vignette), mapped to the GLSL library's blendMode() indices. */
export const FX_BLEND_LABELS = ['Normal', 'Add', 'Subtract', 'Difference', 'Multiply', 'Screen', 'Overlay', 'Hard light', 'Softlight', 'Darken'];
export const FX_BLEND_LIB: number[] = (
  ['normal', 'linear-dodge', 'subtract', 'difference', 'multiply', 'screen', 'overlay', 'hard-light', 'soft-light', 'darken'] as BlendMode[]
).map(libIndex);

/**
 * Threshold's numeric "blend mode" slider (0..6, unlabeled on effect.app). Index 5 must give the
 * default look (ink multiplies the image), the rest follow the Vignette order.
 */
export const THRESHOLD_BLEND_LABELS = ['Normal', 'Add', 'Subtract', 'Difference', 'Screen', 'Multiply', 'Overlay'];
export const THRESHOLD_BLEND_LIB: number[] = (['normal', 'linear-dodge', 'subtract', 'difference', 'screen', 'multiply', 'overlay'] as BlendMode[]).map(libIndex);

/** Safe lookup of a library blend index from a (possibly out of range) UI index. */
export function libBlend(table: number[], i: number): number {
  const k = Math.max(0, Math.min(table.length - 1, Math.round(i) || 0));
  return table[k];
}

/** Hint text listing numbered options for effect.app's numeric "mode" sliders. */
export const numberedHint = (labels: string[]) => labels.map((l, i) => `${i} ${l}`).join(', ');

/** GLSL: short-side normalized, centered coordinates (short side spans 1, origin at the image center). */
export const SHORT_SIDE_GLSL = /* glsl */ `
vec2 shortCentered(vec2 uv, vec2 res) { return (uv - 0.5) * res / min(res.x, res.y); }
`;
