import type { EffectDef } from '../../engine/types';
import { layerMix } from './layer-mix';
import { textureBlur } from './texture-blur';
import { displacement } from './displacement';

export const customEffects: EffectDef[] = [layerMix, textureBlur, displacement];
