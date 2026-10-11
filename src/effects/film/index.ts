import type { EffectDef } from '../../engine/types';
import { registerAlias } from '../registry';
import { classicFilm } from './film-classic';
import { vintageFilm } from './film-vintage';
import { blackWhite } from './film-bw';
import { infraredFilm } from './film-infrared';
import { instantFilm } from './film-instant';
import { filmGrain } from './film-grain';
import { halation } from './halation';

/** Film category, in effect.app's UI order. */
export const filmEffects: EffectDef[] = [classicFilm, vintageFilm, blackWhite, infraredFilm, instantFilm, filmGrain, halation];

// Ids used by early WIP builds (and possibly saved projects/presets) before switching to effect.app's ids.
registerAlias('classic-film', 'film-classic');
registerAlias('vintage-film', 'film-vintage');
registerAlias('black-white', 'film-bw');
registerAlias('infrared-film', 'film-infrared');
registerAlias('instant-film', 'film-instant');
