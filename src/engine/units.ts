/**
 * Pixel-sized effect params are expressed in "reference pixels": 1 unit = 1/720 of the image's long
 * side, which matches effect.app's working scale (its blur sigma, grain size, etc. at the same values).
 * Renders multiply such params by pxScale = renderLongSide / REFERENCE_LONG_SIDE, so previews,
 * thumbnails and 16K exports all look the same.
 */
export const REFERENCE_LONG_SIDE = 720;

export function relativePxScale(width: number, height: number): number {
  return Math.max(width, height) / REFERENCE_LONG_SIDE;
}
