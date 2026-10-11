import type { EffectDef } from '../../engine/types';
import { motionTrails } from './motion-trails';
import { ledScreen } from './led-screen';
import { ntsc } from './ntsc';
import { rgbShift } from './rgb-shift';
import { crtScreen } from './crt-screen';
import { modulation } from './modulation';
import { threshold } from './threshold';
import { vignette } from './vignette';
import { stripe } from './stripe';
import { frameDrop } from './frame-drop';

/** Motion trails … Frame drop (effect.app "Effects" category, second half), in effect.app's UI order. */
export const stylizeEffectsB: EffectDef[] = [
  motionTrails,
  ledScreen,
  ntsc,
  rgbShift,
  crtScreen,
  modulation,
  threshold,
  vignette,
  stripe,
  frameDrop,
];
