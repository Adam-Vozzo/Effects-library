import { registerEffects } from './registry';
import { blurEffects } from './blur';
import { colorEffects } from './color';
import { distortEffects } from './distort';
import { stylizeEffects } from './stylize';
import { generateEffects } from './generate';
import { customEffects } from './custom';
import { filmEffects } from './film';

registerEffects([...blurEffects, ...colorEffects, ...distortEffects, ...stylizeEffects, ...generateEffects, ...customEffects, ...filmEffects]);

export * from './registry';
