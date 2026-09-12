/**
 * Every dog picture in the game comes through here.
 *
 * The drawing itself lives in DogSprite: hand-drawn white stencils, stacked by
 * genotype and coloured in code. This wrapper keeps the old name so every
 * screen that already asks for a portrait carries on working unchanged.
 */

export { DogSprite as DogPortrait } from './DogSprite';
export type { DogSpriteProps as DogPortraitProps } from './DogSprite';
