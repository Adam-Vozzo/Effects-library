import type { EffectDef } from '../../engine/types';
import { registerAlias } from '../registry';
import { layerMix } from './layer-mix';
import { textureBlur } from './texture-blur';
import { textureDisplacement } from './texture-displacement';

export const customEffects: EffectDef[] = [layerMix, textureBlur, textureDisplacement];

// effect.app ids (and an earlier id of ours) → current ids.
registerAlias('layer-mix-curve', 'layer-mix');
registerAlias('displacement', 'texture-displacement');
