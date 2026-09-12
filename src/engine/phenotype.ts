/**
 * PHENOTYPE
 *
 * "Genotype" is what a dog carries. "Phenotype" is what you actually see.
 * This file does the translation: it reads the genes and works out the colour,
 * the coat, how much the dog sheds, how much grooming it needs, and how it
 * copes with heat and cold.
 *
 * It also spots RARE FINDS — unusual combinations worth celebrating, like a
 * lilac merle or a fluffy hidden inside a smooth-coated breed.
 */

import {
  copies,
  expressed,
  type Genotype,
  isAffected,
  isCarrier,
  DISEASE_LOCI,
} from './loci';

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

export interface CoatColor {
  /** Player-facing colour name, for example "Lilac merle with tan points". */
  name: string;
  /** Main body colour as a hex code, used to draw the dog. */
  base: string;
  /** Second colour for points, tan markings and sable shading. */
  accent: string;
  /** Nose and lip colour — a genuine tell for chocolate and dilute dogs. */
  nose: string;
  eye: string;
  merle: boolean;
  doubleMerle: boolean;
  harlequin: boolean;
  brindle: boolean;
  /** 0 = no white, 1 = almost entirely white. */
  white: number;
  ticked: boolean;
  mask: boolean;
  tanPoints: boolean;
}

/** Dark pigment shades, before and after the dilution and brown genes act. */
const EUMELANIN = {
  black: { name: 'Black', hex: '#26221f', nose: '#1a1a1a' },
  blue: { name: 'Blue', hex: '#6f7076', nose: '#5c5f66' },
  chocolate: { name: 'Chocolate', hex: '#5a3a24', nose: '#6b4a30' },
  lilac: { name: 'Lilac', hex: '#a08d86', nose: '#a4908a' },
  cocoa: { name: 'Cocoa', hex: '#6b4630', nose: '#77543c' },
  cocoaDilute: { name: 'Cocoa lilac', hex: '#ad9b91', nose: '#b09c93' },
};

/** Red and cream shades, controlled mostly by the intensity gene. */
const PHAEOMELANIN = [
  { name: 'Cream', hex: '#efe2c6' },
  { name: 'Apricot', hex: '#e0b581' },
  { name: 'Red', hex: '#b9702f' },
];

export function resolveColor(g: Genotype): CoatColor {
  // Albinism overrides absolutely everything else.
  if (isAffected(g, 'albino')) {
    return {
      name: 'Albino',
      base: '#f7f2ec',
      accent: '#f0e7dc',
      nose: '#e0b3b3',
      eye: '#c9b8d8',
      merle: false,
      doubleMerle: false,
      harlequin: false,
      brindle: false,
      white: 0.05,
      ticked: false,
      mask: false,
      tanPoints: false,
    };
  }

  // --- Step 1: what colour is the dark pigment? ---------------------------
  const brown = copies(g, 'locusB', 'b') === 2;
  const cocoaBrown = copies(g, 'cocoa', 'co') === 2;
  const dilute = copies(g, 'locusD', 'd') === 2;

  let dark = EUMELANIN.black;
  if (cocoaBrown && brown) dark = dilute ? EUMELANIN.cocoaDilute : EUMELANIN.cocoa;
  else if (brown) dark = dilute ? EUMELANIN.lilac : EUMELANIN.chocolate;
  else if (cocoaBrown) dark = dilute ? EUMELANIN.cocoaDilute : EUMELANIN.cocoa;
  else if (dilute) dark = EUMELANIN.blue;

  // --- Step 2: how rich is the red pigment? -------------------------------
  const creamCopies = copies(g, 'intensity', 'i');
  const red = PHAEOMELANIN[2 - creamCopies];

  // --- Step 3: patterns ---------------------------------------------------
  const eLocus = expressed(g, 'locusE');
  const clearRed = copies(g, 'locusE', 'e') === 2;
  const kLocus = expressed(g, 'locusK');
  const aLocus = expressed(g, 'locusA');

  const merleCopies = copies(g, 'merle', 'M');
  const doubleMerle = merleCopies === 2;
  const merle = merleCopies >= 1;
  const harlequin = merle && copies(g, 'harlequin', 'H') === 1;

  const whiteCopies = copies(g, 'locusS', 'sp');
  let white = whiteCopies === 2 ? 0.55 : whiteCopies === 1 ? 0.18 : 0.04;
  if (doubleMerle) white = Math.max(white, 0.85);
  if (harlequin) white = Math.max(white, 0.6);

  const ticked = copies(g, 'ticking', 'T') >= 1 && white > 0.1;

  let base = dark.hex;
  let accent = red.hex;
  let name: string;
  let brindle = false;
  let tanPoints = false;
  let mask = false;

  if (clearRed) {
    // Two copies of the red allele erase all dark pigment from the coat.
    base = red.hex;
    accent = red.hex;
    name = red.name;
    if (creamCopies === 2) name = 'Cream';
  } else if (kLocus === 'KB') {
    base = dark.hex;
    accent = dark.hex;
    name = dark.name;
  } else if (kLocus === 'kbr') {
    brindle = true;
    base = red.hex;
    accent = dark.hex;
    name = `${dark.name === 'Black' ? '' : dark.name + ' '}Brindle`.trim();
  } else {
    switch (aLocus) {
      case 'ay':
        base = red.hex;
        accent = dark.hex;
        name = `${red.name === 'Red' ? 'Fawn' : red.name} sable`;
        if (dilute && !brown) name = 'Blue fawn';
        break;
      case 'aw':
        base = red.hex;
        accent = dark.hex;
        name = 'Wolf sable';
        break;
      case 'at':
        base = dark.hex;
        accent = red.hex;
        tanPoints = true;
        name = `${dark.name} and tan`;
        break;
      default:
        base = dark.hex;
        accent = dark.hex;
        name = dark.name;
        break;
    }
  }

  // A black mask only shows on a red or sable coat.
  if (eLocus === 'Em' && !clearRed && (aLocus === 'ay' || aLocus === 'aw') && kLocus !== 'KB') {
    mask = true;
    name += ' with a dark mask';
  }

  if (harlequin) name = `Harlequin ${dark.name.toLowerCase()}`;
  else if (doubleMerle) name = `Double merle ${dark.name.toLowerCase()}`;
  else if (merle && !clearRed) name = `${dark.name} merle`.replace(/^Black merle$/, 'Blue merle');
  else if (merle && clearRed) name = `${red.name} (hidden merle)`;

  if (white >= 0.5 && !doubleMerle && !harlequin) name += ', heavily marked white';
  else if (white >= 0.15) name += ' and white';
  if (ticked) name += ', ticked';

  // Eye colour: merle and the Husky blue-eye gene both do it, but only one of
  // them is harmless.
  let eye = '#5a3d28';
  if (copies(g, 'blueEyes', 'Be') >= 1 || doubleMerle) eye = '#7fb4d4';
  else if (merle) eye = '#8aa5b8';
  else if (dilute) eye = '#9a8757';

  return {
    name,
    base,
    accent,
    nose: dark.nose,
    eye,
    merle,
    doubleMerle,
    harlequin,
    brindle,
    white,
    ticked,
    mask,
    tanPoints,
  };
}

// ---------------------------------------------------------------------------
// Coat structure
// ---------------------------------------------------------------------------

export type CoatKind =
  | 'hairless'
  | 'smooth'
  | 'short'
  | 'wire'
  | 'long'
  | 'silky'
  | 'curly'
  | 'wavyFurnished'
  | 'doubleThick';

export interface CoatProfile {
  kind: CoatKind;
  /** Plain-language description, for example "Curly, furnished, low shedding". */
  label: string;
  /** 0-100. How much hair ends up on the sofa. */
  shedding: number;
  /** 0-100. Brushing, clipping and general upkeep. */
  grooming: number;
  /** 0-100. Warmth in genuinely cold weather. */
  coldTolerance: number;
  /** 0-100. Comfort in heat. */
  heatTolerance: number;
  /** 0-100. How well the coat repels water. */
  waterResistance: number;
  undercoat: boolean;
  hairless: boolean;
}

export function resolveCoat(g: Genotype, sizeLbs: number): CoatProfile {
  const hairlessDominant = copies(g, 'hairlessDom', 'Hd') === 1;
  const hairlessRecessive = isAffected(g, 'hairlessRec');
  const hairless = hairlessDominant || hairlessRecessive;

  if (hairless) {
    return {
      kind: 'hairless',
      label: hairlessRecessive
        ? 'Hairless (recessive type), completely bald'
        : 'Hairless (dominant type), tufts on head, feet and tail',
      shedding: 2,
      grooming: 45, // bald skin needs sunscreen, moisturiser and bathing
      coldTolerance: 6,
      heatTolerance: 78,
      waterResistance: 10,
      undercoat: false,
      hairless: true,
    };
  }

  const longCoat = copies(g, 'coatLength', 'l') === 2;
  const furnished = copies(g, 'furnishings', 'F') >= 1;
  const curlCopies = copies(g, 'curl', 'Cu');
  const lowShed = copies(g, 'shedding', 'sh') === 2;

  let kind: CoatKind;
  if (curlCopies === 2 && longCoat) kind = 'curly';
  else if (curlCopies >= 1 && furnished) kind = 'wavyFurnished';
  else if (longCoat && furnished) kind = 'long';
  else if (longCoat && !furnished) kind = 'silky';
  else if (furnished) kind = 'wire';
  else kind = 'smooth';

  // A long coat without curl or furnishings on a big dog reads as a true
  // weatherproof double coat.
  const undercoat = !lowShed && curlCopies === 0 && (longCoat || sizeLbs > 35);
  if (undercoat && longCoat && !furnished && curlCopies === 0) kind = 'doubleThick';

  // Shedding: the low-shed gene helps, but coat structure matters more. A curly
  // coat traps hair instead of dropping it; a plush double coat blows out twice
  // a year no matter what.
  let shedding = 62;
  if (kind === 'smooth') shedding = 58;
  if (kind === 'silky') shedding = 62;
  if (kind === 'long') shedding = 55;
  if (kind === 'doubleThick') shedding = 88;
  if (kind === 'wire') shedding = 30;
  if (kind === 'wavyFurnished') shedding = 22;
  if (kind === 'curly') shedding = 8;
  if (lowShed) shedding = Math.round(shedding * 0.45);
  if (undercoat) shedding = Math.min(99, shedding + 12);

  // Grooming: the inverse trade-off. Coats that do not shed must be brushed
  // and clipped, because the dead hair has nowhere to go.
  let grooming = 30;
  if (kind === 'smooth') grooming = 8;
  if (kind === 'silky') grooming = 48;
  if (kind === 'long') grooming = 62;
  if (kind === 'doubleThick') grooming = 55;
  if (kind === 'wire') grooming = 50;
  if (kind === 'wavyFurnished') grooming = 72;
  if (kind === 'curly') grooming = 88;

  let coldTolerance = 40;
  if (kind === 'smooth') coldTolerance = 20;
  if (kind === 'silky') coldTolerance = 42;
  if (kind === 'long') coldTolerance = 62;
  if (kind === 'doubleThick') coldTolerance = 92;
  if (kind === 'wire') coldTolerance = 55;
  if (kind === 'wavyFurnished') coldTolerance = 58;
  if (kind === 'curly') coldTolerance = 66;
  if (undercoat) coldTolerance = Math.min(99, coldTolerance + 10);
  // Small dogs lose heat quickly whatever they are wearing.
  coldTolerance = Math.round(coldTolerance * (0.62 + Math.min(0.38, sizeLbs / 130)));

  const heatTolerance = Math.max(5, Math.min(95, 108 - coldTolerance - (undercoat ? 12 : 0)));

  let waterResistance = 30;
  if (kind === 'curly') waterResistance = 82;
  if (kind === 'doubleThick') waterResistance = 78;
  if (kind === 'wire') waterResistance = 64;
  if (kind === 'wavyFurnished') waterResistance = 58;
  if (kind === 'smooth') waterResistance = 25;
  if (kind === 'silky') waterResistance = 22;
  if (kind === 'long') waterResistance = 40;

  const parts: string[] = [];
  const kindLabel: Record<CoatKind, string> = {
    hairless: 'Hairless',
    smooth: 'Smooth short coat',
    short: 'Short coat',
    wire: 'Wiry coat with beard and eyebrows',
    long: 'Long furnished coat',
    silky: 'Long silky coat',
    curly: 'Tight curly coat',
    wavyFurnished: 'Wavy furnished coat',
    doubleThick: 'Dense weatherproof double coat',
  };
  parts.push(kindLabel[kind]);
  if (lowShed) parts.push('low shedding');
  if (undercoat) parts.push('heavy undercoat');

  return {
    kind,
    label: parts.join(', '),
    shedding,
    grooming,
    coldTolerance,
    heatTolerance,
    waterResistance,
    undercoat,
    hairless: false,
  };
}

// ---------------------------------------------------------------------------
// Body shape
// ---------------------------------------------------------------------------

export type EarType = 'drop' | 'semiErect' | 'erect' | 'button';
export type TailType = 'full' | 'bobtail';

export function resolveEars(earSetScore: number): EarType {
  if (earSetScore >= 76) return 'erect';
  if (earSetScore >= 58) return 'semiErect';
  if (earSetScore >= 40) return 'button';
  return 'drop';
}

export const EAR_LABEL: Record<EarType, string> = {
  drop: 'Dropped ears',
  button: 'Button ears',
  semiErect: 'Semi-erect ears',
  erect: 'Erect ears',
};

export function resolveTail(g: Genotype): TailType {
  return copies(g, 'bobtail', 'Bt') >= 1 ? 'bobtail' : 'full';
}

/** Shortened legs from the Dachshund/Corgi gene. 0 = normal, 2 = very short. */
export function legShortening(g: Genotype): number {
  return copies(g, 'chondro', 'Cd');
}

// ---------------------------------------------------------------------------
// Health read-outs from the genes alone
// ---------------------------------------------------------------------------

export interface GeneticHealthFlag {
  locus: string;
  name: string;
  severity: 'affected' | 'carrier' | 'risk';
  text: string;
}

export function geneticHealthFlags(g: Genotype): GeneticHealthFlag[] {
  const flags: GeneticHealthFlag[] = [];

  for (const locus of DISEASE_LOCI) {
    if (isAffected(g, locus.key)) {
      flags.push({
        locus: locus.key,
        name: locus.name,
        severity: 'affected',
        text: `Affected by ${locus.name.toLowerCase()}. ${locus.note ?? ''}`.trim(),
      });
    } else if (isCarrier(g, locus.key)) {
      flags.push({
        locus: locus.key,
        name: locus.name,
        severity: 'carrier',
        text: `${locus.name} carrier: healthy, but should not be bred to another carrier.`,
      });
    }
  }

  if (copies(g, 'merle', 'M') === 2) {
    flags.push({
      locus: 'merle',
      name: 'Double merle',
      severity: 'affected',
      text: 'Double merle: high risk of deafness and impaired vision. This dog should never be bred.',
    });
  }
  if (copies(g, 'chondro', 'Cd') >= 1) {
    flags.push({
      locus: 'chondro',
      name: 'Disc disease risk',
      severity: 'risk',
      text:
        copies(g, 'chondro', 'Cd') === 2
          ? 'Two copies of the short-leg gene: markedly raised risk of spinal disc disease.'
          : 'One copy of the short-leg gene: somewhat raised risk of spinal disc disease.',
    });
  }
  if (copies(g, 'albino', 'al') === 2) {
    flags.push({
      locus: 'albino',
      name: 'Albinism',
      severity: 'affected',
      text: 'Albino: lifelong light sensitivity and a high risk of skin cancer without protection.',
    });
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Rare finds — the collectible layer
// ---------------------------------------------------------------------------

export type Rarity = 'uncommon' | 'rare' | 'very rare' | 'legendary';

export interface RareFind {
  key: string;
  title: string;
  rarity: Rarity;
  blurb: string;
}

export const RARITY_ORDER: Rarity[] = ['uncommon', 'rare', 'very rare', 'legendary'];

/**
 * Checks a dog against a list of genuinely unusual genetic outcomes. Anything
 * found here gets logged in the project's discovery book the first time it
 * appears, so hunting hidden recessives becomes its own long game.
 */
export function findRarities(g: Genotype, coat: CoatProfile, color: CoatColor): RareFind[] {
  const found: RareFind[] = [];
  const add = (key: string, title: string, rarity: Rarity, blurb: string) =>
    found.push({ key, title, rarity, blurb });

  const brown = copies(g, 'locusB', 'b') === 2;
  const dilute = copies(g, 'locusD', 'd') === 2;
  const cocoaBrown = copies(g, 'cocoa', 'co') === 2;
  const merle = copies(g, 'merle', 'M') === 1;
  const longCoat = copies(g, 'coatLength', 'l') === 2;

  if (brown && dilute) {
    add('lilac', 'Lilac', 'rare', 'Chocolate and dilution stacked together. Two hidden recessives had to meet.');
  }
  if (cocoaBrown) {
    add('cocoa', 'Cocoa', 'very rare', 'The second, far scarcer brown gene. Almost nobody knows their dogs carry it.');
  }
  if (cocoaBrown && brown) {
    add('doubleBrown', 'Double chocolate', 'legendary', 'Both brown genes at once, doubled up. A pale, almost unreal shade.');
  }
  if (brown && dilute && merle) {
    add('lilacMerle', 'Lilac merle', 'legendary', 'Lilac, marbled with merle. The kind of dog people build whole programmes around.');
  }
  if (color.harlequin) {
    add('harlequin', 'Harlequin', 'very rare', 'Pure white broken by torn black patches. Needs merle and the harlequin modifier together.');
  }
  if (coat.hairless && copies(g, 'hairlessRec', 'hr') === 2) {
    add('hairlessRec', 'True hairless', 'very rare', 'The recessive hairless gene, doubled up. Completely bald, and safe to breed to itself.');
  }
  if (copies(g, 'hairlessDom', 'Hd') === 1) {
    add('hairlessDom', 'Crested hairless', 'rare', 'The dominant hairless gene. Striking, but it kills any puppy that inherits two copies.');
  }
  if (copies(g, 'albino', 'al') === 2) {
    add('albino', 'Albino', 'legendary', 'True albinism. Breathtaking, genuinely fragile, and ethically loaded.');
  }
  if (longCoat && (coat.kind === 'silky' || coat.kind === 'long') && copies(g, 'chondro', 'Cd') >= 1) {
    add('fluffyShortLeg', 'Fluffy short-leg', 'rare', 'A long coat riding on a short-legged frame.');
  }
  if (copies(g, 'blueEyes', 'Be') >= 1 && !merle) {
    add('blueEyes', 'Safe blue eyes', 'uncommon', 'Blue eyes with no merle involved, so no hearing or sight risk attached.');
  }
  if (copies(g, 'bobtail', 'Bt') === 1) {
    add('bobtail', 'Natural bobtail', 'uncommon', 'Born with a short tail, no docking required.');
  }
  if (dilute && copies(g, 'locusE', 'e') === 2 && copies(g, 'intensity', 'i') === 2) {
    add('platinum', 'Platinum cream', 'very rare', 'Cream over a dilute base, with a soft grey nose. Nearly white without being albino.');
  }
  if (color.brindle && dilute) {
    add('blueBrindle', 'Blue brindle', 'rare', 'Brindle stripes faded to smoke grey.');
  }

  return found;
}
