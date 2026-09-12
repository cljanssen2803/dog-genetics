/**
 * THE BREED BANK
 *
 * Every dog that enters your project from the outside world comes from here.
 * Each entry describes a real breed-type population: how big they run, what
 * their coats are made of, how they typically behave, and which inherited
 * diseases genuinely circulate in that gene pool.
 *
 * The numbers are approximations chosen to play well, not veterinary data —
 * but the shape of each breed is honest. Labradors really are more biddable
 * than Basenjis, Cavaliers really do carry heart disease, and the chocolate
 * gene really is sitting in far more Labrador lines than Great Dane lines.
 *
 * TEMPERAMENT numbers are on the 1-100 scale where 50 is the average of all
 * dogs everywhere. WEIGHT is in pounds. ALLELE numbers are frequencies: how
 * common that version of the gene is in that breed, where all versions of one
 * gene add up to 1.
 */

import type { PolyTrait } from './traits';

export interface BreedProfile {
  key: string;
  name: string;
  group: string;
  /** Typical adult weight in pounds. */
  weight: number;
  /** How much weight varies inside the breed, as a fraction. 0.10 = ±10%. */
  weightSpread?: number;
  /** Trait averages. Anything not listed sits at the all-dogs average of 50. */
  traits: Partial<Record<Exclude<PolyTrait, 'size'>, number>>;
  /** Gene version frequencies. Anything not listed uses the defaults below. */
  alleles?: Record<string, Record<string, number>>;
  /** How common each broken disease copy is in this breed. */
  diseases?: Record<string, number>;
  blurb: string;
}

/**
 * What a dog of no particular breed carries. Breeds override only the genes
 * that actually make them distinctive, which keeps the table below readable.
 */
export const DEFAULT_ALLELES: Record<string, Record<string, number>> = {
  coatLength: { L: 0.5, l: 0.5 },
  furnishings: { F: 0.15, f: 0.85 },
  curl: { Cu: 0.08, cu: 0.92 },
  shedding: { Sh: 0.82, sh: 0.18 },
  hairlessDom: { Hd: 0, hd: 1 },
  hairlessRec: { N: 1, hr: 0 },
  chondro: { Cd: 0, cd: 1 },
  locusE: { Em: 0.15, E: 0.55, e: 0.3 },
  locusK: { KB: 0.3, kbr: 0.1, ky: 0.6 },
  locusA: { ay: 0.4, aw: 0.05, at: 0.35, a: 0.2 },
  locusB: { B: 0.88, b: 0.12 },
  locusD: { D: 0.88, d: 0.12 },
  cocoa: { Co: 1, co: 0 },
  locusS: { S: 0.7, sp: 0.3 },
  merle: { M: 0, m: 1 },
  harlequin: { H: 0, h: 1 },
  intensity: { I: 0.6, i: 0.4 },
  albino: { N: 1, al: 0 },
  ticking: { T: 0.15, t: 0.85 },
  blueEyes: { Be: 0, be: 1 },
  bobtail: { Bt: 0, bt: 1 },
};

// Shorthand used all through the table below.
const coatShort = { L: 0.97, l: 0.03 };
const coatLong = { L: 0.02, l: 0.98 };
const smoothFace = { F: 0, f: 1 };
const bearded = { F: 0.97, f: 0.03 };
const straight = { Cu: 0, cu: 1 };
const curly = { Cu: 0.97, cu: 0.03 };
const shedsHeavily = { Sh: 0.98, sh: 0.02 };
const shedsLittle = { Sh: 0.03, sh: 0.97 };

export const BREEDS: BreedProfile[] = [
  // ============================================================ COMPANION ===
  {
    key: 'poodleStandard',
    name: 'Standard Poodle',
    group: 'Companion / Gundog',
    weight: 55,
    traits: {
      biddability: 82, sociability: 68, energy: 68, stability: 66, preyDrive: 46,
      persistence: 64, independence: 34, alertness: 66, vocality: 58, handling: 62,
      structure: 62, longevity: 66, fertility: 62, substance: 46, muzzle: 74, earSet: 14,
    },
    alleles: {
      coatLength: coatLong, curl: curly, furnishings: bearded, shedding: shedsLittle,
      locusE: { Em: 0.05, E: 0.35, e: 0.6 }, locusK: { KB: 0.55, kbr: 0.02, ky: 0.43 },
      locusA: { ay: 0.2, aw: 0.02, at: 0.28, a: 0.5 },
      locusB: { B: 0.72, b: 0.28 }, locusD: { D: 0.82, d: 0.18 },
      locusS: { S: 0.86, sp: 0.14 },
    },
    diseases: { prcdPRA: 0.09, dm: 0.05, vwd: 0.02 },
    blurb: 'Athletic, clever and almost non-shedding, at the cost of relentless clipping.',
  },
  {
    key: 'poodleMini',
    name: 'Miniature Poodle',
    group: 'Companion',
    weight: 15,
    traits: {
      biddability: 80, sociability: 62, energy: 62, stability: 56, preyDrive: 44,
      persistence: 60, independence: 34, alertness: 74, vocality: 70, handling: 56,
      structure: 60, longevity: 76, fertility: 58, substance: 38, muzzle: 68, earSet: 14,
    },
    alleles: {
      coatLength: coatLong, curl: curly, furnishings: bearded, shedding: shedsLittle,
      locusE: { Em: 0.05, E: 0.3, e: 0.65 }, locusK: { KB: 0.5, kbr: 0.02, ky: 0.48 },
      locusB: { B: 0.7, b: 0.3 }, locusD: { D: 0.8, d: 0.2 },
    },
    diseases: { prcdPRA: 0.16, pll: 0.03, huu: 0.04 },
    blurb: 'The same brain in a smaller, longer-lived and noticeably more opinionated package.',
  },
  {
    key: 'bichon',
    name: 'Bichon Frise',
    group: 'Companion',
    weight: 14,
    traits: {
      biddability: 62, sociability: 84, energy: 54, stability: 52, preyDrive: 28,
      persistence: 40, independence: 26, alertness: 62, vocality: 68, handling: 62,
      structure: 58, longevity: 74, fertility: 56, substance: 44, muzzle: 46, earSet: 12,
    },
    alleles: {
      coatLength: coatLong, curl: curly, furnishings: bearded, shedding: shedsLittle,
      locusE: { Em: 0, E: 0.15, e: 0.85 }, intensity: { I: 0.1, i: 0.9 },
      locusS: { S: 0.2, sp: 0.8 },
    },
    diseases: { huu: 0.12, prcdPRA: 0.04 },
    blurb: 'A white cloud bred purely for company. Cheerful, sturdy, and a full-time grooming commitment.',
  },
  {
    key: 'cavalier',
    name: 'Cavalier King Charles Spaniel',
    group: 'Companion',
    weight: 16,
    traits: {
      biddability: 70, sociability: 92, energy: 42, stability: 58, preyDrive: 36,
      persistence: 32, independence: 16, alertness: 44, vocality: 40, handling: 84,
      structure: 44, longevity: 26, fertility: 60, substance: 48, muzzle: 40, earSet: 6,
    },
    alleles: {
      coatLength: coatLong, curl: straight, furnishings: smoothFace,
      locusE: { Em: 0, E: 0.35, e: 0.65 }, locusK: { KB: 0, kbr: 0, ky: 1 },
      locusA: { ay: 0.1, aw: 0, at: 0.9, a: 0 }, locusS: { S: 0.25, sp: 0.75 },
      locusB: { B: 1, b: 0 },
    },
    diseases: { dcm: 0.42, prcdPRA: 0.03 },
    blurb: 'Possibly the sweetest temperament in dogs, wrapped around a heart that usually fails early.',
  },
  {
    key: 'pug',
    name: 'Pug',
    group: 'Companion',
    weight: 17,
    traits: {
      biddability: 44, sociability: 86, energy: 30, stability: 62, preyDrive: 20,
      persistence: 46, independence: 30, alertness: 40, vocality: 34, handling: 82,
      structure: 36, longevity: 42, fertility: 28, substance: 74, muzzle: 6, earSet: 8,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusE: { Em: 0.9, E: 0.05, e: 0.05 }, locusK: { KB: 0.1, kbr: 0, ky: 0.9 },
      locusA: { ay: 0.88, aw: 0, at: 0.02, a: 0.1 }, locusS: { S: 1, sp: 0 },
      locusB: { B: 1, b: 0 }, locusD: { D: 1, d: 0 },
    },
    diseases: {},
    blurb: 'Comic, devoted and physically compromised. A flat face is charming and expensive.',
  },
  {
    key: 'frenchie',
    name: 'French Bulldog',
    group: 'Companion',
    weight: 24,
    traits: {
      biddability: 46, sociability: 78, energy: 34, stability: 58, preyDrive: 28,
      persistence: 54, independence: 36, alertness: 52, vocality: 30, handling: 74,
      structure: 30, longevity: 34, fertility: 18, substance: 82, muzzle: 8, earSet: 92,
    },
    alleles: {
      coatLength: { L: 0.94, l: 0.06 }, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusE: { Em: 0.35, E: 0.25, e: 0.4 }, locusK: { KB: 0.25, kbr: 0.4, ky: 0.35 },
      locusA: { ay: 0.7, aw: 0.02, at: 0.2, a: 0.08 },
      locusB: { B: 0.9, b: 0.1 }, locusD: { D: 0.72, d: 0.28 },
      cocoa: { Co: 0.93, co: 0.07 }, locusS: { S: 0.4, sp: 0.6 },
      merle: { M: 0.015, m: 0.985 }, blueEyes: { Be: 0.02, be: 0.98 },
    },
    diseases: { dm: 0.07, huu: 0.03 },
    blurb: 'The richest hoard of rare colour genes in dogs — fluffies, cocoa, lilac — sitting on top of serious breathing and whelping problems.',
  },
  {
    key: 'boston',
    name: 'Boston Terrier',
    group: 'Companion',
    weight: 18,
    traits: {
      biddability: 60, sociability: 80, energy: 54, stability: 58, preyDrive: 34,
      persistence: 50, independence: 34, alertness: 62, vocality: 44, handling: 72,
      structure: 44, longevity: 54, fertility: 30, substance: 58, muzzle: 14, earSet: 94,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace,
      locusE: { Em: 0.1, E: 0.85, e: 0.05 }, locusK: { KB: 0.6, kbr: 0.35, ky: 0.05 },
      locusS: { S: 0.05, sp: 0.95 }, locusB: { B: 0.92, b: 0.08 },
    },
    diseases: { pll: 0.02 },
    blurb: 'A tidy, tuxedoed little dog with more athleticism than its flat face can always support.',
  },
  {
    key: 'shihTzu',
    name: 'Shih Tzu',
    group: 'Companion',
    weight: 12,
    traits: {
      biddability: 44, sociability: 76, energy: 34, stability: 54, preyDrive: 20,
      persistence: 48, independence: 44, alertness: 52, vocality: 48, handling: 66,
      structure: 48, longevity: 72, fertility: 46, substance: 52, muzzle: 10, earSet: 8,
    },
    alleles: {
      coatLength: coatLong, curl: straight, furnishings: smoothFace, shedding: shedsLittle,
      locusS: { S: 0.25, sp: 0.75 }, locusA: { ay: 0.55, aw: 0.05, at: 0.3, a: 0.1 },
    },
    diseases: {},
    blurb: 'Bred for a thousand years to sit on a cushion, and extremely good at it.',
  },
  {
    key: 'maltese',
    name: 'Maltese',
    group: 'Companion',
    weight: 6,
    traits: {
      biddability: 54, sociability: 70, energy: 46, stability: 40, preyDrive: 26,
      persistence: 42, independence: 22, alertness: 72, vocality: 78, handling: 52,
      structure: 50, longevity: 80, fertility: 40, substance: 26, muzzle: 44, earSet: 10,
    },
    alleles: {
      coatLength: coatLong, curl: straight, furnishings: smoothFace, shedding: shedsLittle,
      locusE: { Em: 0, E: 0.1, e: 0.9 }, intensity: { I: 0.02, i: 0.98 },
      locusS: { S: 0.15, sp: 0.85 },
    },
    diseases: { huu: 0.05 },
    blurb: 'A long-lived white companion with a coat that reaches the floor and never stops needing attention.',
  },
  {
    key: 'yorkie',
    name: 'Yorkshire Terrier',
    group: 'Companion / Terrier',
    weight: 6,
    traits: {
      biddability: 48, sociability: 54, energy: 58, stability: 38, preyDrive: 72,
      persistence: 66, independence: 52, alertness: 84, vocality: 86, handling: 42,
      structure: 48, longevity: 78, fertility: 40, substance: 24, muzzle: 48, earSet: 84,
    },
    alleles: {
      coatLength: coatLong, curl: straight, furnishings: smoothFace, shedding: shedsLittle,
      locusK: { KB: 0, kbr: 0, ky: 1 }, locusA: { ay: 0.05, aw: 0, at: 0.95, a: 0 },
      locusD: { D: 0.45, d: 0.55 },
    },
    diseases: { pll: 0.03, huu: 0.02 },
    blurb: 'A working rat-killer shrunk into a lapdog. The prey drive and the opinions both survived the shrinking.',
  },
  {
    key: 'pomeranian',
    name: 'Pomeranian',
    group: 'Companion / Spitz',
    weight: 6,
    traits: {
      biddability: 50, sociability: 56, energy: 56, stability: 36, preyDrive: 40,
      persistence: 56, independence: 50, alertness: 88, vocality: 90, handling: 40,
      structure: 48, longevity: 76, fertility: 42, substance: 32, muzzle: 40, earSet: 90,
    },
    alleles: {
      coatLength: coatLong, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusE: { Em: 0.15, E: 0.25, e: 0.6 }, locusA: { ay: 0.8, aw: 0.05, at: 0.1, a: 0.05 },
      locusB: { B: 0.85, b: 0.15 }, locusD: { D: 0.8, d: 0.2 },
    },
    diseases: {},
    blurb: 'A sled dog compressed to six pounds, complete with a double coat and a firm belief that it is enormous.',
  },
  {
    key: 'papillon',
    name: 'Papillon',
    group: 'Companion',
    weight: 8,
    traits: {
      biddability: 84, sociability: 66, energy: 62, stability: 54, preyDrive: 44,
      persistence: 64, independence: 30, alertness: 78, vocality: 64, handling: 56,
      structure: 62, longevity: 84, fertility: 52, substance: 24, muzzle: 56, earSet: 94,
    },
    alleles: {
      coatLength: coatLong, curl: straight, furnishings: smoothFace,
      locusK: { KB: 0, kbr: 0, ky: 1 }, locusS: { S: 0.05, sp: 0.95 },
      locusA: { ay: 0.35, aw: 0, at: 0.6, a: 0.05 },
    },
    diseases: { prcdPRA: 0.03 },
    blurb: 'The most trainable of the toys, and one of the longest-lived dogs of any size.',
  },
  {
    key: 'chihuahua',
    name: 'Chihuahua',
    group: 'Companion',
    weight: 5,
    weightSpread: 0.16,
    traits: {
      biddability: 40, sociability: 32, energy: 46, stability: 28, preyDrive: 42,
      persistence: 58, independence: 44, alertness: 86, vocality: 84, handling: 30,
      structure: 44, longevity: 86, fertility: 34, substance: 22, muzzle: 38, earSet: 92,
    },
    alleles: {
      coatLength: { L: 0.6, l: 0.4 }, curl: straight, furnishings: smoothFace,
      locusB: { B: 0.8, b: 0.2 }, locusD: { D: 0.75, d: 0.25 },
      merle: { M: 0.03, m: 0.97 }, locusS: { S: 0.5, sp: 0.5 },
    },
    diseases: {},
    blurb: 'The smallest dog there is, and the longest-lived. Fragile, suspicious of strangers, and utterly devoted to one person.',
  },
  {
    key: 'italianGreyhound',
    name: 'Italian Greyhound',
    group: 'Companion / Sighthound',
    weight: 10,
    traits: {
      biddability: 44, sociability: 46, energy: 50, stability: 30, preyDrive: 72,
      persistence: 34, independence: 46, alertness: 66, vocality: 38, handling: 34,
      structure: 40, longevity: 78, fertility: 44, substance: 8, muzzle: 80, earSet: 44,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace,
      locusB: { B: 0.75, b: 0.25 }, locusD: { D: 0.5, d: 0.5 },
      locusK: { KB: 0.5, kbr: 0.05, ky: 0.45 }, locusS: { S: 0.45, sp: 0.55 },
    },
    diseases: { pll: 0.02 },
    blurb: 'A sighthound in miniature. Delicate legs, a deep dislike of cold, and a surprising amount of speed.',
  },

  // ============================================================== TERRIER ===
  {
    key: 'miniSchnauzer',
    name: 'Miniature Schnauzer',
    group: 'Terrier',
    weight: 14,
    traits: {
      biddability: 72, sociability: 58, energy: 62, stability: 54, preyDrive: 86,
      persistence: 80, independence: 44, alertness: 88, vocality: 84, handling: 58,
      structure: 60, longevity: 70, fertility: 58, substance: 48, muzzle: 62, earSet: 40,
    },
    alleles: {
      coatLength: { L: 0.35, l: 0.65 }, curl: straight, furnishings: bearded, shedding: shedsLittle,
      locusE: { Em: 0.05, E: 0.9, e: 0.05 }, locusK: { KB: 0.25, kbr: 0, ky: 0.75 },
      locusA: { ay: 0.05, aw: 0.7, at: 0.15, a: 0.1 },
      locusB: { B: 0.96, b: 0.04 },
    },
    diseases: { prcdPRA: 0.07, mdr1: 0.02 },
    blurb: 'The classic ratting terrier: low shedding, hugely persistent, and utterly convinced that every sound deserves a comment.',
  },
  {
    key: 'jackRussell',
    name: 'Jack Russell Terrier',
    group: 'Terrier',
    weight: 15,
    traits: {
      biddability: 58, sociability: 56, energy: 92, stability: 58, preyDrive: 96,
      persistence: 94, independence: 66, alertness: 86, vocality: 78, handling: 60,
      structure: 70, longevity: 78, fertility: 74, substance: 44, muzzle: 66, earSet: 40,
    },
    alleles: {
      coatLength: { L: 0.8, l: 0.2 }, curl: straight, furnishings: { F: 0.4, f: 0.6 },
      locusE: { Em: 0.05, E: 0.9, e: 0.05 }, locusK: { KB: 0.02, kbr: 0.03, ky: 0.95 },
      locusA: { ay: 0.8, aw: 0.02, at: 0.15, a: 0.03 },
      locusS: { S: 0.02, sp: 0.98 }, ticking: { T: 0.35, t: 0.65 },
      chondro: { Cd: 0.2, cd: 0.8 },
    },
    diseases: { pll: 0.08, cystinuria: 0.02 },
    blurb: 'The most driven small dog alive. Brilliant at vermin, exhausting in a flat.',
  },
  {
    key: 'ratTerrier',
    name: 'Rat Terrier',
    group: 'Terrier',
    weight: 16,
    traits: {
      biddability: 68, sociability: 62, energy: 78, stability: 62, preyDrive: 92,
      persistence: 84, independence: 52, alertness: 84, vocality: 62, handling: 62,
      structure: 72, longevity: 80, fertility: 74, substance: 42, muzzle: 68, earSet: 74,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace,
      locusS: { S: 0.05, sp: 0.95 }, ticking: { T: 0.5, t: 0.5 },
      locusA: { ay: 0.5, aw: 0.02, at: 0.45, a: 0.03 },
      locusB: { B: 0.85, b: 0.15 }, locusD: { D: 0.85, d: 0.15 },
      hairlessRec: { N: 0.97, hr: 0.03 }, bobtail: { Bt: 0.08, bt: 0.92 },
    },
    diseases: { prcdPRA: 0.04 },
    blurb: 'An American farm terrier: healthier and more biddable than most of its relatives, and the source population for the hairless gene.',
  },
  {
    key: 'norwich',
    name: 'Norwich Terrier',
    group: 'Terrier',
    weight: 12,
    traits: {
      biddability: 62, sociability: 70, energy: 70, stability: 66, preyDrive: 88,
      persistence: 82, independence: 50, alertness: 78, vocality: 60, handling: 66,
      structure: 62, longevity: 74, fertility: 50, substance: 54, muzzle: 58, earSet: 88,
    },
    alleles: {
      coatLength: { L: 0.6, l: 0.4 }, curl: straight, furnishings: bearded,
      locusE: { Em: 0.1, E: 0.35, e: 0.55 }, locusK: { KB: 0.05, kbr: 0, ky: 0.95 },
      locusA: { ay: 0.8, aw: 0.05, at: 0.15, a: 0 },
    },
    diseases: {},
    blurb: 'A hard little vermin dog with an unusually friendly streak. Harsh jacket, modest grooming, considerable opinions.',
  },
  {
    key: 'staffie',
    name: 'Staffordshire Bull Terrier',
    group: 'Terrier',
    weight: 34,
    traits: {
      biddability: 68, sociability: 88, energy: 70, stability: 72, preyDrive: 66,
      persistence: 82, independence: 40, alertness: 62, vocality: 40, handling: 86,
      structure: 66, longevity: 64, fertility: 64, substance: 82, muzzle: 34, earSet: 56,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusK: { KB: 0.35, kbr: 0.45, ky: 0.2 }, locusE: { Em: 0.15, E: 0.55, e: 0.3 },
      locusB: { B: 0.9, b: 0.1 }, locusD: { D: 0.8, d: 0.2 },
      locusS: { S: 0.4, sp: 0.6 },
    },
    diseases: { huu: 0.08, ichthyosis: 0.12 },
    blurb: 'Astonishingly good with people, famously tough with other dogs. All muscle and enthusiasm.',
  },
  {
    key: 'schipperke',
    name: 'Schipperke',
    group: 'Terrier / Spitz',
    weight: 14,
    traits: {
      biddability: 58, sociability: 44, energy: 74, stability: 58, preyDrive: 82,
      persistence: 76, independence: 68, alertness: 94, vocality: 82, handling: 48,
      structure: 68, longevity: 80, fertility: 56, substance: 46, muzzle: 56, earSet: 94,
    },
    alleles: {
      coatLength: { L: 0.45, l: 0.55 }, curl: straight, furnishings: smoothFace,
      locusK: { KB: 0.95, kbr: 0, ky: 0.05 }, locusE: { Em: 0, E: 0.98, e: 0.02 },
      bobtail: { Bt: 0.45, bt: 0.55 }, locusS: { S: 1, sp: 0 },
    },
    diseases: { mdr1: 0.02 },
    blurb: 'A tiny black barge-guard. Naturally bobtailed, endlessly watchful, and impossible to sneak past.',
  },

  // ============================================================== WORKING ===
  {
    key: 'labrador',
    name: 'Labrador Retriever',
    group: 'Gundog',
    weight: 70,
    traits: {
      biddability: 84, sociability: 90, energy: 72, stability: 76, preyDrive: 62,
      persistence: 72, independence: 26, alertness: 46, vocality: 38, handling: 88,
      structure: 50, longevity: 52, fertility: 78, substance: 72, muzzle: 62, earSet: 8,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusE: { Em: 0.02, E: 0.68, e: 0.3 }, locusK: { KB: 0.92, kbr: 0, ky: 0.08 },
      locusB: { B: 0.7, b: 0.3 }, locusD: { D: 0.94, d: 0.06 },
      locusS: { S: 0.97, sp: 0.03 },
    },
    diseases: { prcdPRA: 0.05, eic: 0.16, dm: 0.08 },
    blurb: 'The default family dog for good reason: biddable, tolerant, tireless. Hips and waistlines are the weak points.',
  },
  {
    key: 'golden',
    name: 'Golden Retriever',
    group: 'Gundog',
    weight: 65,
    traits: {
      biddability: 86, sociability: 94, energy: 64, stability: 74, preyDrive: 56,
      persistence: 68, independence: 22, alertness: 44, vocality: 36, handling: 90,
      structure: 48, longevity: 38, fertility: 74, substance: 66, muzzle: 64, earSet: 6,
    },
    alleles: {
      coatLength: coatLong, curl: { Cu: 0.2, cu: 0.8 }, furnishings: smoothFace, shedding: shedsHeavily,
      locusE: { Em: 0, E: 0.05, e: 0.95 }, intensity: { I: 0.55, i: 0.45 },
      locusB: { B: 0.95, b: 0.05 }, locusS: { S: 0.95, sp: 0.05 },
    },
    diseases: { prcdPRA: 0.06, ichthyosis: 0.18, dm: 0.04 },
    blurb: 'Softer and even more people-focused than the Labrador, with a heavy coat and a heartbreaking cancer rate.',
  },
  {
    key: 'cocker',
    name: 'Cocker Spaniel',
    group: 'Gundog',
    weight: 28,
    traits: {
      biddability: 72, sociability: 80, energy: 64, stability: 48, preyDrive: 62,
      persistence: 60, independence: 28, alertness: 56, vocality: 56, handling: 64,
      structure: 54, longevity: 62, fertility: 66, substance: 58, muzzle: 46, earSet: 2,
    },
    alleles: {
      coatLength: coatLong, curl: { Cu: 0.15, cu: 0.85 }, furnishings: smoothFace,
      locusE: { Em: 0.05, E: 0.35, e: 0.6 }, locusB: { B: 0.7, b: 0.3 },
      locusS: { S: 0.35, sp: 0.65 }, ticking: { T: 0.45, t: 0.55 },
      locusA: { ay: 0.35, aw: 0.02, at: 0.55, a: 0.08 },
    },
    diseases: { prcdPRA: 0.14, vwd: 0.04 },
    blurb: 'Merry and affectionate, with heavy ears that need constant attention and a streak of nervousness in some lines.',
  },
  {
    key: 'brittany',
    name: 'Brittany',
    group: 'Gundog',
    weight: 35,
    traits: {
      biddability: 78, sociability: 74, energy: 86, stability: 58, preyDrive: 80,
      persistence: 76, independence: 40, alertness: 62, vocality: 44, handling: 70,
      structure: 68, longevity: 70, fertility: 70, substance: 48, muzzle: 68, earSet: 6,
    },
    alleles: {
      coatLength: { L: 0.3, l: 0.7 }, curl: straight, furnishings: smoothFace,
      locusE: { Em: 0, E: 0.9, e: 0.1 }, locusK: { KB: 0.02, kbr: 0, ky: 0.98 },
      locusA: { ay: 0.9, aw: 0.02, at: 0.08, a: 0 },
      locusB: { B: 0.55, b: 0.45 }, locusS: { S: 0.05, sp: 0.95 },
      ticking: { T: 0.7, t: 0.3 }, bobtail: { Bt: 0.35, bt: 0.65 },
    },
    diseases: { cea: 0.03 },
    blurb: 'A compact, biddable hunting dog, often born with a natural bobtail. Needs a serious amount of exercise.',
  },
  {
    key: 'portugueseWater',
    name: 'Portuguese Water Dog',
    group: 'Working',
    weight: 48,
    traits: {
      biddability: 78, sociability: 70, energy: 82, stability: 62, preyDrive: 50,
      persistence: 78, independence: 40, alertness: 70, vocality: 62, handling: 66,
      structure: 66, longevity: 70, fertility: 62, substance: 58, muzzle: 62, earSet: 8,
    },
    alleles: {
      coatLength: coatLong, curl: { Cu: 0.7, cu: 0.3 }, furnishings: { F: 0.6, f: 0.4 }, shedding: shedsLittle,
      locusK: { KB: 0.85, kbr: 0, ky: 0.15 }, locusE: { Em: 0, E: 0.9, e: 0.1 },
      locusB: { B: 0.8, b: 0.2 }, locusS: { S: 0.35, sp: 0.65 },
    },
    diseases: { prcdPRA: 0.09, dm: 0.03 },
    blurb: 'Built for cold water: a waterproof curly coat, webbed feet, and enough stamina to work all day.',
  },
  {
    key: 'borderCollie',
    name: 'Border Collie',
    group: 'Herding',
    weight: 40,
    traits: {
      biddability: 94, sociability: 46, energy: 94, stability: 44, preyDrive: 84,
      persistence: 92, independence: 40, alertness: 92, vocality: 52, handling: 58,
      structure: 66, longevity: 76, fertility: 70, substance: 40, muzzle: 70, earSet: 62,
    },
    alleles: {
      coatLength: { L: 0.35, l: 0.65 }, curl: straight, furnishings: smoothFace,
      locusK: { KB: 0.75, kbr: 0, ky: 0.25 }, locusE: { Em: 0, E: 0.92, e: 0.08 },
      locusB: { B: 0.82, b: 0.18 }, locusS: { S: 0.05, sp: 0.95 },
      merle: { M: 0.08, m: 0.92 }, bobtail: { Bt: 0.05, bt: 0.95 },
    },
    diseases: { cea: 0.28, mdr1: 0.1, prcdPRA: 0.02 },
    blurb: 'The most trainable dog on earth and the least suited to an ordinary home. Genius-level, and never switches off.',
  },
  {
    key: 'ausShepherd',
    name: 'Australian Shepherd',
    group: 'Herding',
    weight: 48,
    traits: {
      biddability: 86, sociability: 54, energy: 84, stability: 48, preyDrive: 72,
      persistence: 82, independence: 38, alertness: 88, vocality: 64, handling: 60,
      structure: 62, longevity: 70, fertility: 68, substance: 52, muzzle: 66, earSet: 34,
    },
    alleles: {
      coatLength: coatLong, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusK: { KB: 0.2, kbr: 0, ky: 0.8 }, locusE: { Em: 0, E: 0.92, e: 0.08 },
      locusA: { ay: 0.1, aw: 0.02, at: 0.85, a: 0.03 },
      locusB: { B: 0.6, b: 0.4 }, merle: { M: 0.3, m: 0.7 },
      bobtail: { Bt: 0.25, bt: 0.75 }, locusS: { S: 0.4, sp: 0.6 },
      blueEyes: { Be: 0.04, be: 0.96 },
    },
    diseases: { mdr1: 0.3, cea: 0.05, prcdPRA: 0.03 },
    blurb: 'The richest source of merle and natural bobtail — and of the MDR1 drug-sensitivity mutation, which sits in roughly a third of the breed.',
  },
  {
    key: 'gsd',
    name: 'German Shepherd Dog',
    group: 'Herding / Guardian',
    weight: 72,
    traits: {
      biddability: 84, sociability: 42, energy: 78, stability: 58, preyDrive: 80,
      persistence: 86, independence: 42, alertness: 92, vocality: 58, handling: 62,
      structure: 34, longevity: 44, fertility: 72, substance: 66, muzzle: 72, earSet: 92,
    },
    alleles: {
      coatLength: { L: 0.72, l: 0.28 }, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusE: { Em: 0.55, E: 0.4, e: 0.05 }, locusK: { KB: 0.1, kbr: 0, ky: 0.9 },
      locusA: { ay: 0.15, aw: 0.3, at: 0.45, a: 0.1 },
      locusB: { B: 0.96, b: 0.04 }, locusS: { S: 0.95, sp: 0.05 },
    },
    diseases: { dm: 0.3, eic: 0.03 },
    blurb: 'Serious, versatile and devoted to its own people. Hips and degenerative myelopathy are the breed-defining problems.',
  },
  {
    key: 'malinois',
    name: 'Belgian Malinois',
    group: 'Herding / Working',
    weight: 62,
    traits: {
      biddability: 90, sociability: 38, energy: 96, stability: 62, preyDrive: 94,
      persistence: 94, independence: 42, alertness: 94, vocality: 58, handling: 58,
      structure: 70, longevity: 66, fertility: 74, substance: 46, muzzle: 76, earSet: 96,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusE: { Em: 0.9, E: 0.08, e: 0.02 }, locusK: { KB: 0.05, kbr: 0, ky: 0.95 },
      locusA: { ay: 0.9, aw: 0.05, at: 0.05, a: 0 },
      locusB: { B: 1, b: 0 }, locusS: { S: 0.98, sp: 0.02 },
    },
    diseases: { dm: 0.06 },
    blurb: 'The most intense working dog in common use. Tremendous drive, tremendous soundness, and no off switch whatsoever.',
  },
  {
    key: 'corgi',
    name: 'Pembroke Welsh Corgi',
    group: 'Herding',
    weight: 27,
    traits: {
      biddability: 74, sociability: 62, energy: 64, stability: 60, preyDrive: 62,
      persistence: 74, independence: 48, alertness: 88, vocality: 86, handling: 62,
      structure: 52, longevity: 72, fertility: 62, substance: 68, muzzle: 62, earSet: 92,
    },
    alleles: {
      coatLength: { L: 0.75, l: 0.25 }, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      chondro: { Cd: 0.98, cd: 0.02 }, locusE: { Em: 0.1, E: 0.45, e: 0.45 },
      locusK: { KB: 0.05, kbr: 0, ky: 0.95 }, locusA: { ay: 0.7, aw: 0.02, at: 0.28, a: 0 },
      locusS: { S: 0.2, sp: 0.8 }, bobtail: { Bt: 0.5, bt: 0.5 },
      locusB: { B: 0.97, b: 0.03 },
    },
    diseases: { dm: 0.35, vwd: 0.05 },
    blurb: 'A full-sized herding dog on short legs. Loud, clever, and prone to both back problems and degenerative myelopathy.',
  },
  {
    key: 'dachshund',
    name: 'Dachshund',
    group: 'Hound',
    weight: 16,
    traits: {
      biddability: 46, sociability: 50, energy: 58, stability: 46, preyDrive: 88,
      persistence: 90, independence: 70, alertness: 82, vocality: 84, handling: 46,
      structure: 40, longevity: 76, fertility: 58, substance: 56, muzzle: 72, earSet: 2,
    },
    alleles: {
      coatLength: { L: 0.6, l: 0.4 }, curl: straight, furnishings: { F: 0.3, f: 0.7 },
      chondro: { Cd: 1, cd: 0 }, locusE: { Em: 0.1, E: 0.75, e: 0.15 },
      locusK: { KB: 0.05, kbr: 0.1, ky: 0.85 }, locusA: { ay: 0.3, aw: 0.02, at: 0.65, a: 0.03 },
      locusB: { B: 0.75, b: 0.25 }, locusD: { D: 0.85, d: 0.15 },
      merle: { M: 0.12, m: 0.88 },
    },
    diseases: { prcdPRA: 0.05, pll: 0.02 },
    blurb: 'A badger-hunting hound built into a tube. Enormous persistence, enormous voice, and a spine that regularly fails.',
  },
  {
    key: 'beagle',
    name: 'Beagle',
    group: 'Hound',
    weight: 24,
    traits: {
      biddability: 40, sociability: 84, energy: 72, stability: 70, preyDrive: 86,
      persistence: 88, independence: 74, alertness: 62, vocality: 92, handling: 80,
      structure: 70, longevity: 74, fertility: 78, substance: 60, muzzle: 66, earSet: 2,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusK: { KB: 0, kbr: 0, ky: 1 }, locusE: { Em: 0, E: 0.95, e: 0.05 },
      locusA: { ay: 0.25, aw: 0.05, at: 0.7, a: 0 },
      locusS: { S: 0.05, sp: 0.95 }, ticking: { T: 0.35, t: 0.65 },
    },
    diseases: { huu: 0.06, prcdPRA: 0.02 },
    blurb: 'Cheerful, sturdy, and utterly governed by its nose. The baying carries for miles.',
  },
  {
    key: 'greyhound',
    name: 'Greyhound',
    group: 'Sighthound',
    weight: 68,
    traits: {
      biddability: 52, sociability: 58, energy: 34, stability: 56, preyDrive: 92,
      persistence: 30, independence: 54, alertness: 48, vocality: 20, handling: 66,
      structure: 74, longevity: 62, fertility: 66, substance: 18, muzzle: 86, earSet: 40,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace,
      locusK: { KB: 0.4, kbr: 0.35, ky: 0.25 }, locusE: { Em: 0.25, E: 0.5, e: 0.25 },
      locusD: { D: 0.8, d: 0.2 }, locusS: { S: 0.5, sp: 0.5 },
    },
    diseases: {},
    blurb: 'Explosive for forty seconds, then asleep for twenty hours. Almost silent, and hopeless with small fleeing animals.',
  },
  {
    key: 'whippet',
    name: 'Whippet',
    group: 'Sighthound',
    weight: 30,
    traits: {
      biddability: 56, sociability: 60, energy: 40, stability: 48, preyDrive: 90,
      persistence: 32, independence: 44, alertness: 54, vocality: 18, handling: 60,
      structure: 76, longevity: 78, fertility: 66, substance: 16, muzzle: 84, earSet: 42,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace,
      locusK: { KB: 0.35, kbr: 0.35, ky: 0.3 }, locusD: { D: 0.75, d: 0.25 },
      locusS: { S: 0.45, sp: 0.55 },
    },
    diseases: {},
    blurb: 'The quietest dog in this bank and one of the healthiest. A sprinting couch ornament.',
  },
  {
    key: 'basenji',
    name: 'Basenji',
    group: 'Primitive',
    weight: 23,
    traits: {
      biddability: 22, sociability: 36, energy: 70, stability: 44, preyDrive: 90,
      persistence: 72, independence: 94, alertness: 84, vocality: 6, handling: 36,
      structure: 74, longevity: 74, fertility: 34, substance: 40, muzzle: 70, earSet: 96,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace,
      locusK: { KB: 0.1, kbr: 0.25, ky: 0.65 }, locusE: { Em: 0, E: 0.98, e: 0.02 },
      locusA: { ay: 0.95, aw: 0, at: 0.05, a: 0 }, locusS: { S: 0.2, sp: 0.8 },
      locusB: { B: 1, b: 0 }, locusD: { D: 1, d: 0 },
    },
    diseases: { huu: 0.18, prcdPRA: 0.06 },
    blurb: 'Cannot bark at all, and only comes into season once a year. The most cat-like and least biddable dog here.',
  },
  {
    key: 'shiba',
    name: 'Shiba Inu',
    group: 'Primitive / Spitz',
    weight: 21,
    traits: {
      biddability: 26, sociability: 30, energy: 58, stability: 52, preyDrive: 86,
      persistence: 78, independence: 92, alertness: 88, vocality: 42, handling: 22,
      structure: 72, longevity: 80, fertility: 58, substance: 52, muzzle: 62, earSet: 96,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusE: { Em: 0.05, E: 0.7, e: 0.25 }, locusK: { KB: 0.02, kbr: 0, ky: 0.98 },
      locusA: { ay: 0.75, aw: 0.05, at: 0.2, a: 0 },
      locusB: { B: 1, b: 0 }, locusD: { D: 0.98, d: 0.02 },
    },
    diseases: {},
    blurb: 'Fastidious, aloof and famously difficult to handle. Blows its double coat twice a year in spectacular fashion.',
  },
  {
    key: 'husky',
    name: 'Siberian Husky',
    group: 'Spitz / Sled',
    weight: 48,
    traits: {
      biddability: 28, sociability: 74, energy: 92, stability: 66, preyDrive: 88,
      persistence: 90, independence: 88, alertness: 54, vocality: 76, handling: 64,
      structure: 78, longevity: 74, fertility: 74, substance: 46, muzzle: 74, earSet: 94,
    },
    alleles: {
      coatLength: { L: 0.85, l: 0.15 }, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusE: { Em: 0, E: 0.85, e: 0.15 }, locusK: { KB: 0.05, kbr: 0, ky: 0.95 },
      locusA: { ay: 0.15, aw: 0.7, at: 0.1, a: 0.05 },
      locusS: { S: 0.1, sp: 0.9 }, blueEyes: { Be: 0.4, be: 0.6 },
      locusB: { B: 0.85, b: 0.15 },
    },
    diseases: {},
    blurb: 'Built to run for a hundred miles in a blizzard. Superb cold tolerance, an escape artist, and completely uninterested in obedience.',
  },
  {
    key: 'malamute',
    name: 'Alaskan Malamute',
    group: 'Spitz / Sled',
    weight: 82,
    traits: {
      biddability: 34, sociability: 68, energy: 74, stability: 68, preyDrive: 82,
      persistence: 92, independence: 84, alertness: 62, vocality: 62, handling: 66,
      structure: 60, longevity: 58, fertility: 70, substance: 82, muzzle: 68, earSet: 90,
    },
    alleles: {
      coatLength: { L: 0.8, l: 0.2 }, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusE: { Em: 0, E: 0.95, e: 0.05 }, locusK: { KB: 0.02, kbr: 0, ky: 0.98 },
      locusA: { ay: 0.1, aw: 0.85, at: 0.05, a: 0 },
      locusS: { S: 0.15, sp: 0.85 }, locusB: { B: 0.95, b: 0.05 },
    },
    diseases: {},
    blurb: 'A freight-hauling sled dog. Enormous strength, a coat that laughs at forty below, and a stubborn streak to match.',
  },
  {
    key: 'samoyed',
    name: 'Samoyed',
    group: 'Spitz / Sled',
    weight: 50,
    traits: {
      biddability: 52, sociability: 88, energy: 74, stability: 66, preyDrive: 62,
      persistence: 72, independence: 62, alertness: 70, vocality: 84, handling: 74,
      structure: 66, longevity: 70, fertility: 66, substance: 62, muzzle: 66, earSet: 92,
    },
    alleles: {
      coatLength: coatLong, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusE: { Em: 0, E: 0.1, e: 0.9 }, intensity: { I: 0.05, i: 0.95 },
      locusB: { B: 1, b: 0 }, locusD: { D: 1, d: 0 },
    },
    diseases: { prcdPRA: 0.04 },
    blurb: 'The friendliest sled dog and the most demanding coat in this bank. Sheds a second dog every spring.',
  },

  // ============================================================== GIANTS ===
  {
    key: 'greatDane',
    name: 'Great Dane',
    group: 'Giant / Guardian',
    weight: 140,
    weightSpread: 0.11,
    traits: {
      biddability: 62, sociability: 72, energy: 40, stability: 56, preyDrive: 44,
      persistence: 46, independence: 36, alertness: 62, vocality: 44, handling: 78,
      structure: 40, longevity: 12, fertility: 58, substance: 76, muzzle: 70, earSet: 30,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace,
      locusE: { Em: 0.45, E: 0.5, e: 0.05 }, locusK: { KB: 0.45, kbr: 0.2, ky: 0.35 },
      locusA: { ay: 0.75, aw: 0.02, at: 0.15, a: 0.08 },
      merle: { M: 0.28, m: 0.72 }, harlequin: { H: 0.16, h: 0.84 },
      locusS: { S: 0.6, sp: 0.4 }, locusB: { B: 0.97, b: 0.03 },
      locusD: { D: 0.85, d: 0.15 },
    },
    diseases: { dcm: 0.2 },
    blurb: 'A gentle, low-energy giant that rarely reaches eight years old. The only realistic source of the harlequin gene.',
  },
  {
    key: 'newfoundland',
    name: 'Newfoundland',
    group: 'Giant / Working',
    weight: 130,
    traits: {
      biddability: 74, sociability: 84, energy: 38, stability: 82, preyDrive: 26,
      persistence: 62, independence: 32, alertness: 46, vocality: 34, handling: 86,
      structure: 38, longevity: 16, fertility: 62, substance: 92, muzzle: 56, earSet: 4,
    },
    alleles: {
      coatLength: coatLong, curl: { Cu: 0.25, cu: 0.75 }, furnishings: smoothFace, shedding: shedsHeavily,
      locusK: { KB: 0.85, kbr: 0, ky: 0.15 }, locusE: { Em: 0, E: 0.95, e: 0.05 },
      locusB: { B: 0.85, b: 0.15 }, locusS: { S: 0.6, sp: 0.4 },
    },
    diseases: { cystinuria: 0.1, dcm: 0.06 },
    blurb: 'The steadiest temperament in dogs, attached to a water-rescue body that wears out fast. Drools professionally.',
  },
  {
    key: 'stBernard',
    name: 'Saint Bernard',
    group: 'Giant / Working',
    weight: 150,
    traits: {
      biddability: 62, sociability: 80, energy: 30, stability: 78, preyDrive: 22,
      persistence: 56, independence: 38, alertness: 52, vocality: 38, handling: 84,
      structure: 32, longevity: 12, fertility: 54, substance: 96, muzzle: 42, earSet: 4,
    },
    alleles: {
      coatLength: { L: 0.5, l: 0.5 }, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusE: { Em: 0.5, E: 0.45, e: 0.05 }, locusK: { KB: 0.05, kbr: 0.05, ky: 0.9 },
      locusA: { ay: 0.9, aw: 0.02, at: 0.08, a: 0 },
      locusS: { S: 0.02, sp: 0.98 }, locusB: { B: 1, b: 0 },
    },
    diseases: { dcm: 0.05 },
    blurb: 'An alpine rescue dog with a famously kind nature, a very short life, and a heat problem in any real summer.',
  },
  {
    key: 'bernese',
    name: 'Bernese Mountain Dog',
    group: 'Giant / Working',
    weight: 92,
    traits: {
      biddability: 72, sociability: 78, energy: 48, stability: 68, preyDrive: 34,
      persistence: 58, independence: 34, alertness: 58, vocality: 40, handling: 82,
      structure: 42, longevity: 14, fertility: 60, substance: 82, muzzle: 60, earSet: 6,
    },
    alleles: {
      coatLength: coatLong, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusK: { KB: 0, kbr: 0, ky: 1 }, locusE: { Em: 0, E: 1, e: 0 },
      locusA: { ay: 0, aw: 0, at: 1, a: 0 },
      locusS: { S: 0.05, sp: 0.95 }, locusB: { B: 1, b: 0 }, locusD: { D: 1, d: 0 },
    },
    diseases: { dm: 0.05 },
    blurb: 'Beautiful, affectionate, and cancer-ridden: the average Bernese does not see eight. Superb in cold weather.',
  },
  {
    key: 'irishWolfhound',
    name: 'Irish Wolfhound',
    group: 'Giant / Sighthound',
    weight: 130,
    traits: {
      biddability: 58, sociability: 74, energy: 42, stability: 66, preyDrive: 78,
      persistence: 40, independence: 50, alertness: 46, vocality: 22, handling: 78,
      structure: 44, longevity: 8, fertility: 54, substance: 58, muzzle: 84, earSet: 38,
    },
    alleles: {
      coatLength: { L: 0.3, l: 0.7 }, curl: straight, furnishings: bearded, shedding: { Sh: 0.5, sh: 0.5 },
      locusE: { Em: 0.1, E: 0.85, e: 0.05 }, locusK: { KB: 0.2, kbr: 0.3, ky: 0.5 },
      locusA: { ay: 0.7, aw: 0.15, at: 0.1, a: 0.05 },
      locusB: { B: 1, b: 0 }, locusD: { D: 0.8, d: 0.2 },
    },
    diseases: { dcm: 0.14 },
    blurb: 'The tallest dog there is, and the shortest lived. Quiet, gentle indoors, and gone by seven.',
  },
  {
    key: 'doberman',
    name: 'Doberman Pinscher',
    group: 'Guardian',
    weight: 75,
    traits: {
      biddability: 84, sociability: 48, energy: 76, stability: 54, preyDrive: 74,
      persistence: 84, independence: 34, alertness: 94, vocality: 52, handling: 62,
      structure: 62, longevity: 30, fertility: 68, substance: 52, muzzle: 80, earSet: 40,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace,
      locusK: { KB: 0.02, kbr: 0, ky: 0.98 }, locusE: { Em: 0, E: 0.98, e: 0.02 },
      locusA: { ay: 0, aw: 0, at: 1, a: 0 },
      locusB: { B: 0.7, b: 0.3 }, locusD: { D: 0.7, d: 0.3 },
      locusS: { S: 1, sp: 0 }, albino: { N: 0.995, al: 0.005 },
    },
    diseases: { dcm: 0.45, vwd: 0.35 },
    blurb: 'Elegant, hyper-alert and deeply bonded to its family. Carries the heaviest load of heart disease and bleeding disorder in this bank.',
  },
  {
    key: 'rottweiler',
    name: 'Rottweiler',
    group: 'Guardian',
    weight: 105,
    traits: {
      biddability: 76, sociability: 42, energy: 58, stability: 74, preyDrive: 62,
      persistence: 82, independence: 44, alertness: 86, vocality: 36, handling: 76,
      structure: 46, longevity: 30, fertility: 70, substance: 90, muzzle: 52, earSet: 10,
    },
    alleles: {
      coatLength: coatShort, curl: straight, furnishings: smoothFace, shedding: shedsHeavily,
      locusK: { KB: 0, kbr: 0, ky: 1 }, locusE: { Em: 0, E: 1, e: 0 },
      locusA: { ay: 0, aw: 0, at: 1, a: 0 },
      locusB: { B: 1, b: 0 }, locusD: { D: 1, d: 0 }, locusS: { S: 1, sp: 0 },
    },
    diseases: { dm: 0.04 },
    blurb: 'Calm, confident and very physically strong. Needs clear handling and a great deal of early socialisation.',
  },

  // ============================================================ HAIRLESS ===
  {
    key: 'chineseCrested',
    name: 'Chinese Crested',
    group: 'Companion / Hairless',
    weight: 10,
    traits: {
      biddability: 58, sociability: 66, energy: 48, stability: 38, preyDrive: 30,
      persistence: 44, independence: 30, alertness: 72, vocality: 58, handling: 44,
      structure: 50, longevity: 78, fertility: 46, substance: 20, muzzle: 62, earSet: 78,
    },
    alleles: {
      hairlessDom: { Hd: 0.62, hd: 0.38 },
      coatLength: { L: 0.15, l: 0.85 }, curl: straight, furnishings: smoothFace,
      locusS: { S: 0.1, sp: 0.9 }, locusB: { B: 0.75, b: 0.25 },
      locusD: { D: 0.7, d: 0.3 }, merle: { M: 0.02, m: 0.98 },
    },
    diseases: { prcdPRA: 0.1, pll: 0.04 },
    blurb: 'Carries the dominant hairless gene. Hairless bred to hairless loses a quarter of every litter before birth and still produces coated puppies.',
  },
  {
    key: 'xolo',
    name: 'Xoloitzcuintli',
    group: 'Primitive / Hairless',
    weight: 30,
    weightSpread: 0.3,
    traits: {
      biddability: 56, sociability: 40, energy: 52, stability: 60, preyDrive: 58,
      persistence: 66, independence: 76, alertness: 88, vocality: 48, handling: 52,
      structure: 74, longevity: 82, fertility: 52, substance: 38, muzzle: 74, earSet: 94,
    },
    alleles: {
      hairlessDom: { Hd: 0.7, hd: 0.3 },
      coatLength: coatShort, curl: straight, furnishings: smoothFace,
      locusK: { KB: 0.8, kbr: 0, ky: 0.2 }, locusE: { Em: 0, E: 0.98, e: 0.02 },
      locusB: { B: 0.9, b: 0.1 }, locusS: { S: 0.85, sp: 0.15 },
    },
    diseases: {},
    blurb: 'An ancient Mexican hairless breed: remarkably healthy, long-lived, watchful, and reserved with strangers.',
  },
  {
    key: 'americanHairless',
    name: 'American Hairless Terrier',
    group: 'Terrier / Hairless',
    weight: 14,
    traits: {
      biddability: 70, sociability: 66, energy: 72, stability: 60, preyDrive: 80,
      persistence: 78, independence: 48, alertness: 82, vocality: 64, handling: 62,
      structure: 72, longevity: 80, fertility: 66, substance: 40, muzzle: 66, earSet: 76,
    },
    alleles: {
      hairlessRec: { N: 0.25, hr: 0.75 },
      coatLength: coatShort, curl: straight, furnishings: smoothFace,
      locusS: { S: 0.1, sp: 0.9 }, ticking: { T: 0.4, t: 0.6 },
      locusB: { B: 0.85, b: 0.15 }, locusD: { D: 0.85, d: 0.15 },
    },
    diseases: {},
    blurb: 'The safe route to a bald dog: its hairlessness is recessive, so two hairless parents produce a full litter of healthy hairless puppies.',
  },
];

export const BREED_BY_KEY: Record<string, BreedProfile> = Object.fromEntries(
  BREEDS.map((b) => [b.key, b]),
);

export const BREED_GROUPS = Array.from(new Set(BREEDS.map((b) => b.group))).sort();

/**
 * Occasionally the outside world hands you something nobody knew was there.
 * When a random outside dog is generated there is a small chance one of these
 * genuinely rare alleles is slipped in as a single hidden copy — which is
 * exactly how rare colours actually spread through real breeds.
 */
export const WILDCARD_ALLELES: { locus: string; allele: string; weight: number }[] = [
  { locus: 'coatLength', allele: 'l', weight: 30 },
  { locus: 'locusB', allele: 'b', weight: 20 },
  { locus: 'locusD', allele: 'd', weight: 20 },
  { locus: 'cocoa', allele: 'co', weight: 8 },
  { locus: 'hairlessRec', allele: 'hr', weight: 6 },
  { locus: 'blueEyes', allele: 'Be', weight: 6 },
  { locus: 'bobtail', allele: 'Bt', weight: 5 },
  { locus: 'intensity', allele: 'i', weight: 10 },
  { locus: 'albino', allele: 'al', weight: 1 },
];

/** How often a random outside dog hides one of the above. */
export const WILDCARD_CHANCE = 0.11;
