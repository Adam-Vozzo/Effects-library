import type { EffectDef } from '../../engine/types';
import { colorGrading } from './color-grading';
import { thermal } from './thermal';
import { curves } from './curves';
import { colorBalance } from './color-balance';
import { gradientMap } from './gradient-map';
import { colorTemperature } from './color-temperature';
import { dither } from './dither';
import { hueCurves } from './hue-curves';
import { duotone } from './duotone';
import { hueSaturation } from './hue-saturation';
import { levels } from './levels';
import { exposure } from './exposure';
import { monochrome } from './monochrome';
import { colorMatrix } from './color-matrix';
import { rgbGain } from './rgb-gain';
import { contrast } from './contrast';

/** In effect.app's UI order. */
export const colorEffects: EffectDef[] = [
  colorGrading,
  thermal,
  curves,
  colorBalance,
  gradientMap,
  colorTemperature,
  dither,
  hueCurves,
  duotone,
  hueSaturation,
  levels,
  exposure,
  monochrome,
  colorMatrix,
  rgbGain,
  contrast,
];
