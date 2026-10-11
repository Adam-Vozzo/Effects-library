import type { EffectDef } from '../../engine/types';
import { stylizeEffectsA } from './part-a';
import { stylizeEffectsB } from './part-b';

export const stylizeEffects: EffectDef[] = [...stylizeEffectsA, ...stylizeEffectsB];
