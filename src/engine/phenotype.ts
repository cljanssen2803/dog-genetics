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
  /** Plain words for the export and the detail sheet. */
  noseName: string;
  eyeName: string;
  merle: boolean;
  doubleMerle: boolean;
  harlequin: boolean;
  /** The full-strength colour left in the patches a merle dog keeps. */
  merlePatch: string;
  /**
   * True on a sable or brindle merle. Merle only dilutes black pigment, so on
   * a fawn dog it barely shows — the coat stays blond with faint marbling.
   */
  merleSubtle: boolean;
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

/** What each dark pigment fades to across the diluted body of a merle. */
const MERLE_DILUTE: Record<string, string> = {
  Black: '#8e8f97',
  Blue: '#b3b4bb',
  Chocolate: '#c2a08a',
  Lilac: '#cfc2bb',
  Cocoa: '#c8a893',
  'Cocoa lilac': '#d5c6bd',
};

/** Red and cream shades, controlled mostly by the intensity gene. */
const PHAEOMELANIN = [
  { name: 'Cream', hex: '#efe2c6' },
  { name: 'Apricot', hex: '#e0b581' },
  { name: 'Red', hex: '#b9702f' },
];

/** Blend two hex colours; t = 0 keeps the first, t = 1 gives the second. */
function blend(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

export function resolveColor(g: Genotype): CoatColor {
  // Albinism overrides absolutely everything else.
  if (isAffected(g, 'albino')) {
    return {
      name: 'Albino',
      base: '#f7f2ec',
      accent: '#f0e7dc',
      nose: '#e0b3b3',
      eye: '#c9b8d8',
      noseName: 'pink',
      eyeName: 'pale lilac',
      merle: false,
      doubleMerle: false,
      harlequin: false,
      merlePatch: '#f0e7dc',
      merleSubtle: false,
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
  // Ticking on a piebald dog is the Dalmatian pattern: the white takes over
  // the whole coat and the colour survives only as spots.
  // Two ticking copies on a piebald dog: the spots take over. One copy is
  // ordinary ticking or roan in the white.
  const spotted = copies(g, 'ticking', 'T') === 2 && whiteCopies === 2 && !merle;
  if (spotted) white = 0.9;

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
        // Dilute mostly acts on black pigment, but it does cool the red to a
        // silvery champagne — and the mask and nose go slate. Drawn cooler
        // than life so it is visibly a different dog.
        if (dilute && !brown) {
          name = 'Blue fawn';
          base = blend(red.hex, '#b9bcc4', 0.45);
        } else if (dilute && brown) {
          name = 'Lilac fawn';
          base = blend(red.hex, '#cbbfc2', 0.45);
        }
        break;
      case 'aw':
        base = red.hex;
        accent = dark.hex;
        name = 'Wolf sable';
        if (dilute && !brown) {
          name = 'Blue wolf sable';
          base = blend(red.hex, '#b9bcc4', 0.45);
        }
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

  // --- Merle ---------------------------------------------------------------
  // Merle dilutes BLACK pigment across most of the body and leaves irregular
  // patches at full strength. So a blue merle is mostly grey with black torn
  // through it — not black with grey spots — and a fawn dog with merle stays
  // fawn, because there is almost no black pigment there to dilute.
  const eumelaninBody = !clearRed && (kLocus === 'KB' || (kLocus === 'ky' && (aLocus === 'a' || aLocus === 'at')));
  let merlePatch = dark.hex;
  let merleSubtle = false;

  if (harlequin) {
    name = `Harlequin ${dark.name.toLowerCase()}`;
  } else if (doubleMerle) {
    name = `Double merle ${dark.name.toLowerCase()}`;
    merlePatch = MERLE_DILUTE[dark.name] ?? '#a9a9b0';
  } else if (merle && eumelaninBody) {
    const merleName: Record<string, string> = {
      Black: 'Blue merle',
      Blue: 'Slate merle',
      Chocolate: 'Red merle',
      Lilac: 'Lilac merle',
      Cocoa: 'Cocoa merle',
      'Cocoa lilac': 'Cocoa lilac merle',
    };
    base = MERLE_DILUTE[dark.name] ?? '#8e8f97';
    if (tanPoints) accent = red.hex;
    else accent = base;
    name = (merleName[dark.name] ?? `${dark.name} merle`) + (tanPoints ? ' and tan' : '');
  } else if (merle && !clearRed) {
    // Sable or brindle: the merle is genetically there but visually faint.
    name = `${name} (sable merle)`;
    merleSubtle = true;
  } else if (merle && clearRed) {
    name = `${red.name} (hidden merle)`;
    merleSubtle = true;
  }

  if (spotted) name += ', white with spots';
  else if (white >= 0.5 && !doubleMerle && !harlequin) name += ', heavily marked white';
  else if (white >= 0.15) name += ' and white';
  if (ticked && !spotted) name += ', ticked';

  // Eye colour. Dark brown is the default. The Husky gene gives blue eyes on
  // any coat with no health cost; double merle gives them at a cost. A single
  // merle copy often washes the eye to a blue-grey. Chocolate dogs cannot make
  // dark pigment anywhere, so their eyes go amber; dilute lightens them too.
  let eye = '#4a3220';
  let eyeName = 'dark brown';
  if (copies(g, 'blueEyes', 'Be') >= 1 || doubleMerle) {
    eye = '#7fb4d4';
    eyeName = 'blue';
  } else if (merle && eumelaninBody) {
    eye = '#7e9db5';
    eyeName = 'blue-grey';
  } else if (brown && dilute) {
    eye = '#c9ad6e';
    eyeName = 'pale amber';
  } else if (brown || cocoaBrown) {
    eye = '#a8783a';
    eyeName = 'amber';
  } else if (dilute) {
    eye = '#b8975a';
    eyeName = 'light amber';
  } else if (clearRed && creamCopies === 2) {
    eye = '#6b4a2e';
    eyeName = 'hazel';
  }

  const noseName =
    dark.name === 'Black' ? 'black'
    : dark.name === 'Blue' ? 'slate grey'
    : dark.name === 'Chocolate' || dark.name === 'Cocoa' ? 'brown'
    : 'pale lilac';

  return {
    name,
    base,
    accent,
    nose: dark.nose,
    eye,
    noseName,
    eyeName,
    merle,
    doubleMerle,
    harlequin,
    merlePatch,
    merleSubtle,
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

  // The undercoat gene. A long straight plush coat is the classic double coat
  // and gets its own body art; a short plush coat (Husky, Labrador) keeps the
  // smooth body but is warmer and sheds more, and the label says so.
  const undercoat = copies(g, 'undercoat', 'U') >= 1 && curlCopies === 0;
  if (undercoat && longCoat && !furnished) kind = 'doubleThick';

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
  if (undercoat) waterResistance = Math.min(95, waterResistance + 30);

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
  parts.push(kind === 'smooth' && undercoat ? 'Short plush double coat' : kindLabel[kind]);
  if (lowShed) parts.push('low shedding');
  if (undercoat && kind !== 'smooth' && kind !== 'doubleThick') parts.push('heavy undercoat');

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
/**
 * Tail shapes. `full` is the ordinary hanging sabre. The rest come from the
 * tail-carriage trait, the bobtail gene, the muzzle (a screw tail goes with a
 * flat face) and the coat (a plume needs long hair to be a plume).
 */
export type TailType = 'full' | 'bobtail' | 'screw' | 'whip' | 'plume' | 'sickle' | 'curled';

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

export function resolveTail(g: Genotype, tailSet = 48, muzzle = 50, coat?: CoatKind): TailType {
  if (copies(g, 'bobtail', 'Bt') >= 1) return 'bobtail';
  if (tailSet >= 82) return 'curled';
  if (muzzle < 30 && tailSet < 68) return 'screw';
  if (tailSet >= 68) return 'sickle';
  if (tailSet <= 26) return 'whip';
  if (coat === 'long' || coat === 'silky' || coat === 'wavyFurnished' || coat === 'doubleThick') return 'plume';
  return 'full';
}

export const TAIL_LABEL: Record<TailType, string> = {
  full: 'Full tail',
  bobtail: 'Natural bobtail',
  screw: 'Screw tail',
  whip: 'Whip tail',
  plume: 'Plumed tail',
  sickle: 'Sickle tail',
  curled: 'Curled tail',
};

/** A sentence for the tail, for descriptions. */
export const TAIL_BLURB: Record<TailType, string> = {
  full: 'a full tail hanging in a gentle curve',
  bobtail: 'a natural bobtail',
  screw: 'a short tight screw tail',
  whip: 'a long thin whip tail carried low',
  plume: 'a long feathered plume of a tail',
  sickle: 'a sickle tail curving up over the back',
  curled: 'a tail curled tight over the back',
};

/**
 * Which body silhouette to draw. The coat decides it for most dogs — under a
 * heavy coat the frame is hidden anyway. But a smooth coat shows the build,
 * so it comes in three: the ordinary one, a racy sighthound and a heavy
 * flat-faced bull type. A thick double coat with pricked ears and a tail over
 * the back is a Spitz, and gets its own too.
 */
export type Silhouette = CoatKind | 'sighthound' | 'bull' | 'heavy' | 'spitz';

export function resolveSilhouette(
  coat: CoatProfile,
  substance: number,
  muzzle: number,
  earSet: number,
  sizeLbs: number,
): Silhouette {
  const plain = coat.kind === 'smooth' || coat.kind === 'short' || coat.kind === 'doubleThick';
  // Thresholds are loose on purpose: a dog's visible build wanders a good
  // twenty points either side of its breed's average.
  if (plain && coat.undercoat && earSet > 68) return 'spitz';
  if (coat.kind === 'smooth' || coat.kind === 'short') {
    if (muzzle <= 30) return 'bull';
    if (substance > 84) return 'heavy';
    if (substance < 46 && muzzle > 60 && !coat.undercoat) return 'sighthound';
    // A giant smooth dog with a long head — a Great Dane — is a sighthound
    // frame scaled up, and the build factor widens it to suit.
    if (sizeLbs > 95 && muzzle > 60 && substance < 78 && !coat.undercoat) return 'sighthound';
  }
  return coat.kind;
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

/**
 * HIDDEN CARRIERS
 *
 * What this dog is secretly carrying but not showing. A DNA panel reveals it.
 *
 * This is the single most useful thing a breeder can know. A smooth-coated
 * puppy carrying one copy of long coat looks worthless if you are chasing a
 * long coat — and is in fact the most valuable puppy in the litter, because
 * bred to another carrier, a quarter of ITS puppies will be long-coated.
 */
export interface HiddenTrait {
  locus: string;
  label: string;
  /** True when two copies would produce something genuinely rare. */
  prized: boolean;
}

const CARRIED_LABELS: {
  locus: string;
  allele: string;
  label: string;
  prized?: boolean;
  /** True when a single copy already shows, so one copy is not "hidden". */
  dominant?: boolean;
}[] = [
  { locus: 'coatLength', allele: 'l', label: 'long coat' },
  { locus: 'curl', allele: 'Cu', label: 'curl', dominant: true },
  { locus: 'shedding', allele: 'sh', label: 'low shedding' },
  { locus: 'furnishings', allele: 'F', label: 'furnishings', dominant: true },
  { locus: 'locusB', allele: 'b', label: 'chocolate' },
  { locus: 'locusD', allele: 'd', label: 'dilute' },
  { locus: 'cocoa', allele: 'co', label: 'cocoa', prized: true },
  { locus: 'locusS', allele: 'sp', label: 'piebald' },
  { locus: 'intensity', allele: 'i', label: 'cream' },
  { locus: 'locusE', allele: 'e', label: 'red' },
  { locus: 'merle', allele: 'M', label: 'merle', prized: true, dominant: true },
  { locus: 'harlequin', allele: 'H', label: 'harlequin', prized: true, dominant: true },
  { locus: 'blueEyes', allele: 'Be', label: 'blue eyes', dominant: true },
  { locus: 'bobtail', allele: 'Bt', label: 'bobtail', dominant: true },
  { locus: 'hairlessRec', allele: 'hr', label: 'hairlessness', prized: true },
  { locus: 'hairlessDom', allele: 'Hd', label: 'crested hairlessness', prized: true, dominant: true },
  { locus: 'albino', allele: 'al', label: 'albinism', prized: true },
  { locus: 'locusA', allele: 'at', label: 'tan points' },
];

/**
 * Everything this dog carries one copy of but does not show — the genes that
 * matter for planning and are invisible when you look at the dog.
 */
export function hiddenCarriers(g: Genotype): HiddenTrait[] {
  const out: HiddenTrait[] = [];
  for (const entry of CARRIED_LABELS) {
    if (entry.dominant) continue; // one copy already shows, so nothing is hidden
    if (copies(g, entry.locus, entry.allele) !== 1) continue;
    out.push({ locus: entry.locus, label: entry.label, prized: entry.prized ?? false });
  }
  return out;
}

/**
 * Every notable gene this dog has at least one copy of, whether it shows or
 * not. Used by the kennel search, so "show me everything carrying chocolate"
 * finds both the chocolate dogs and the black dogs hiding it.
 */
export function geneticTraits(g: Genotype): (HiddenTrait & { shown: boolean })[] {
  const out: (HiddenTrait & { shown: boolean })[] = [];
  for (const entry of CARRIED_LABELS) {
    const count = copies(g, entry.locus, entry.allele);
    if (count === 0) continue;
    out.push({
      locus: entry.locus,
      label: entry.label,
      prized: entry.prized ?? false,
      shown: entry.dominant ? count >= 1 : count === 2,
    });
  }
  return out;
}

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
