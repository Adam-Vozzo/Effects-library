import type { EffectDef } from '../../engine/types';
import { cubify } from './cubify';
import { elasticGrid } from './elastic-grid';
import { glitch } from './glitch';
import { gridSplit } from './grid-split';
import { perspective } from './perspective';
import { pinch } from './pinch';
import { polarToRectangular } from './polar-to-rectangular';
import { rectangularToPolar } from './rectangular-to-polar';
import { reededGlass } from './reeded-glass';
import { ripple } from './ripple';
import { swirl } from './swirl';
import { transform } from './transform';

/** effect.app "Distort" category, in its UI order. */
export const distortEffects: EffectDef[] = [elasticGrid, gridSplit, reededGlass, cubify, glitch, perspective, pinch, polarToRectangular, rectangularToPolar, ripple, transform, swirl];
