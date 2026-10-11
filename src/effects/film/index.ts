import type { EffectDef } from '../../engine/types';
import { classicFilm } from './classic-film';
import { vintageFilm } from './vintage-film';
import { blackWhite } from './black-white';
import { infraredFilm } from './infrared-film';
import { instantFilm } from './instant-film';
import { filmGrain } from './film-grain';
import { halation } from './halation';

/** Film category, in effect.app's UI order. */
export const filmEffects: EffectDef[] = [classicFilm, vintageFilm, blackWhite, infraredFilm, instantFilm, filmGrain, halation];
