import type { EffectDef } from '../../engine/types';
import { registerAlias } from '../registry';
import { blurSharpen } from './blur-sharpen';
import { cameraShake } from './camera-shake';
import { circularBlur } from './circular-blur';
import { depthOfField } from './depth-of-field';
import { gaussianBlur } from './gaussian-blur';
import { motionBlur } from './motion-blur';
import { radialBlur } from './radial-blur';
import { zoomBlur } from './zoom-blur';

// effect.app UI order.
export const blurEffects: EffectDef[] = [depthOfField, circularBlur, gaussianBlur, motionBlur, radialBlur, blurSharpen, zoomBlur, cameraShake];

registerAlias('radial-blur-v2', 'radial-blur');
registerAlias('zoom-blur-v2', 'zoom-blur');
