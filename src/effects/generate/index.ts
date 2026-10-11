import type { EffectDef } from '../../engine/types';
import { text } from './text';
import { noise } from './noise';
import { inkBleed } from './ink-bleed';
import { paperScan } from './paper-scan';
import { blobTracker } from './blob-tracker';
import { paperCutout } from './paper-cutout';

export const generateEffects: EffectDef[] = [text, noise, inkBleed, paperScan, blobTracker, paperCutout];
