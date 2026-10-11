import type { EffectDef } from '../../engine/types';
import { jpegGlitch } from './jpeg-glitch';
import { scatter } from './scatter';
import { risograph } from './risograph';
import { vhs } from './vhs';
import { ascii } from './ascii';
import { macpaint } from './macpaint';
import { halftoneScreen } from './halftone-screen';
import { emboss } from './emboss';
import { bevel } from './bevel';
import { bloom } from './bloom';
import { starGlow } from './star-glow';

/** JPEG glitch … Star glow (effect.app "Effects" category, first half). */
export const stylizeEffectsA: EffectDef[] = [jpegGlitch, scatter, risograph, vhs, ascii, macpaint, halftoneScreen, emboss, bevel, bloom, starGlow];
