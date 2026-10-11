import type { EffectDef } from '../../engine/types';
import { ledScreen } from './led-screen';
import { rgbShift } from './rgb-shift';
import { crtScreen } from './crt-screen';
import { modulation } from './modulation';
import { threshold } from './threshold';
import { vignette } from './vignette';
import { stripe } from './stripe';
import { frameDrop } from './frame-drop';

/** Motion trails … Frame drop (effect.app "Effects" category, second half). */
export const stylizeEffectsB: EffectDef[] = [ledScreen, rgbShift, crtScreen, modulation, threshold, vignette, stripe, frameDrop];
