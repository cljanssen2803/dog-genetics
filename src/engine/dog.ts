/**
 * THE DOG
 *
 * One object that describes any dog in the game: a founder bought in from a
 * breed, a puppy born in your kennel, a retired veteran or a dog that died six
 * generations ago. Nothing in this file knows anything about Hearthdogs or
 * Mousies — the breed standard is applied separately, so the same dog can be
 * scored differently by different projects.
 *
 * A dog carries three layers of information:
 *   GENOTYPE    the single genes it carries (exact, revealed by a DNA test)
 *   BREEDING    its hidden genetic hand for polygenic traits — the only part
 *   VALUE       it can actually pass on
 *   OBSERVED    what it grew up to actually be: breeding value plus life's luck
 *
 * Players never see breeding values directly. They see estimates that get
 * sharper as the dog grows up and as it produces puppies.
 */

import { Rng } from './rng';
import {
  ALL_TRAITS,
  type PolyTrait,
  TRAITS,
  clampScore,
  sizeToPounds,
} from './traits';
import {
  type Genotype,
  LOCI,
  LOCUS_BY_KEY,
  orderPair,
} from './loci';
import { BREED_BY_KEY, type BreedProfile, DEFAULT_ALLELES, WILDCARD_ALLELES, WILDCARD_CHANCE } from './breeds';
import type { Sex } from './names';
import { QUIRK_BY_KEY } from './quirks';

export type { Sex };

export type LifeStage =
  | 'puppy'
  | 'adolescent'
  | 'youngAdult'
  | 'breedingAdult'
  | 'matureAdult'
  | 'retired'
  | 'deceased';

export type DogStatus = 'kennel' | 'placed' | 'retired' | 'deceased' | 'outside';

export type PlacementType =
  | 'familyCompanion'
  | 'seniorHome'
  | 'activeHome'
  | 'workingHome'
  | 'farmHome';

/**
 * Health information is always fully known for every dog in this game.
 *
 * The original design gated it behind paid tests, but that turned out to be
 * busywork rather than a decision: the answer was always "yes, test it", and
 * the only thing the cost achieved was occasionally hiding a crucial fact from
 * the player until after they had made an irreversible choice. The flags are
 * kept so older saves still load and so the interface can say where a piece of
 * information comes from.
 */
export interface HealthTests {
  dna: boolean;
  hips: boolean;
  eyes: boolean;
  cardiac: boolean;
}

export const ALL_KNOWN: HealthTests = { dna: true, hips: true, eyes: true, cardiac: true };

export interface Dog {
  id: string;
  name: string;
  sex: Sex;

  /** The single genes. Exact and unchanging. */
  genotype: Genotype;

  /** Hidden genetic hand for polygenic traits. Half of this goes to each puppy. */
  bv: Record<PolyTrait, number>;
  /** How much genetic variety is still left to shuffle. Drives litter spread. */
  het: Record<PolyTrait, number>;
  /** What the dog actually grew into. Hidden until it is old enough to tell. */
  observed: Record<PolyTrait, number>;
  /**
   * A fixed set of random nudges used to build the "estimate" shown for young
   * dogs. Stored so the estimate never jitters between screens — an early guess
   * that keeps changing would feel like a bug rather than uncertainty.
   */
  guessNoise: Record<PolyTrait, number>;

  birthMonth: number;
  deathMonth?: number;
  /** Cause shown in the history log. */
  deathCause?: string;

  sireId?: string;
  damId?: string;
  /** Which breed this dog came from, if it was bought in rather than bred. */
  originBreed?: string;
  /** What to call this dog's type on its card. */
  breedLabel: string;
  generation: number;
  /** Inbreeding coefficient: 0 = parents unrelated, 0.25 = full siblings. */
  coi: number;
  litterId?: string;

  status: DogStatus;
  placement?: PlacementType;
  /** Player decision recorded on the puppy screen. */
  retention?: 'keep' | 'wait' | 'pet' | 'retainNoBreed';

  tests: HealthTests;
  littersProduced: number;
  offspringIds: string[];
  /** Rare finds this dog was the first to show. */
  rarities: string[];
  /** True if this dog has been spayed, neutered or is otherwise out of the pool. */
  breedingRetired: boolean;
  /**
   * A fixed personal number drawn from the project's seeded generator at the
   * moment this dog came into being. It decides the small individual quirks
   * that are not inherited — exactly how long this particular dog lives, and
   * where the patches land when it is drawn.
   *
   * It matters that this is stored rather than derived from the dog's id: ids
   * are assigned in creation order, so deriving from them would make a project
   * behave differently depending on what else the player happened to do first.
   * Storing it keeps a seed genuinely reproducible.
   */
  seedValue: number;
  /** Set when this dog was born carrying a gene neither parent had. */
  mutation?: string;
  /** Show titles this dog has earned. */
  titles?: string[];
  /** Points accumulated toward the next title. */
  showPoints?: number;
  /** Pinned to the top of the kennel by the player. */
  favourite?: boolean;
  /**
   * The dog's life, one line at a time: birth, decisions, litters, shows,
   * a new home, retirement, death. Read back as prose on the Story tab.
   */
  events?: DogEvent[];
}

export interface DogEvent {
  month: number;
  kind:
    | 'birth'
    | 'arrived'
    | 'kept'
    | 'litter'
    | 'show'
    | 'title'
    | 'placed'
    | 'postcard'
    | 'retired'
    | 'died'
    | 'rare'
    | 'mutation';
  text: string;
}

/** Append to a dog's life, creating the list on first use. */
export function remember(dog: Dog, month: number, kind: DogEvent['kind'], text: string) {
  (dog.events ??= []).push({ month, kind, text });
}

// ---------------------------------------------------------------------------
// Age and life stage
// ---------------------------------------------------------------------------

export function ageMonths(dog: Dog, currentMonth: number): number {
  const end = dog.deathMonth ?? currentMonth;
  return Math.max(0, end - dog.birthMonth);
}

export function lifeStage(dog: Dog, currentMonth: number): LifeStage {
  if (dog.status === 'deceased') return 'deceased';
  const months = ageMonths(dog, currentMonth);
  if (dog.breedingRetired && months >= 12) return 'retired';
  if (months < 6) return 'puppy';
  if (months < 12) return 'adolescent';
  if (months < 18) return 'youngAdult';
  if (months < 72) return 'breedingAdult';
  if (months < 96) return 'matureAdult';
  return 'retired';
}

export const STAGE_LABEL: Record<LifeStage, string> = {
  puppy: 'Puppy',
  adolescent: 'Adolescent',
  youngAdult: 'Young adult',
  breedingAdult: 'Breeding adult',
  matureAdult: 'Mature adult',
  retired: 'Retired',
  deceased: 'Deceased',
};

/** Human-readable age, for example "2 years 3 months" or "9 weeks". */
export function formatAge(months: number): string {
  if (months < 3) {
    const weeks = Math.max(1, Math.round(months * 4.33));
    return `${weeks} week${weeks === 1 ? '' : 's'}`;
  }
  if (months < 24) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years} years` : `${years} yr ${rem} mo`;
}

/**
 * Can this dog be bred right now?
 *
 * Females need to be physically mature and are limited to roughly one litter
 * every eight months, with a hard cap on total litters and a retirement age.
 * Males stay usable for longer, which is exactly how the popular sire problem
 * gets started in real breeds.
 */
export function breedingEligibility(
  dog: Dog,
  currentMonth: number,
  lastLitterMonth: number | undefined,
): { eligible: boolean; reason?: string } {
  if (dog.status === 'deceased') return { eligible: false, reason: 'Deceased' };
  if (dog.status === 'placed') return { eligible: false, reason: 'Living in a pet home' };
  if (dog.breedingRetired) return { eligible: false, reason: 'Retired from breeding' };
  if (dog.retention === 'retainNoBreed') return { eligible: false, reason: 'Kept, but not for breeding' };

  const months = ageMonths(dog, currentMonth);

  if (dog.sex === 'F') {
    if (months < 18) return { eligible: false, reason: `Too young — ready at 18 months` };
    if (months > 84) return { eligible: false, reason: 'Past safe breeding age for a female' };
    if (dog.littersProduced >= 5) return { eligible: false, reason: 'Has had her maximum of five litters' };
    if (lastLitterMonth !== undefined && currentMonth - lastLitterMonth < 8) {
      return {
        eligible: false,
        reason: `Needs ${8 - (currentMonth - lastLitterMonth)} more months to recover`,
      };
    }
  } else {
    if (months < 12) return { eligible: false, reason: 'Too young — ready at 12 months' };
    if (months > 120) return { eligible: false, reason: 'Past safe breeding age for a male' };
  }

  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Estimates and uncertainty
// ---------------------------------------------------------------------------

/**
 * How much we still do not know about a trait, from 1 (a newborn: pure guess)
 * down to 0 (a fully grown, fully assessed adult).
 *
 * Different traits settle at different speeds. Adult size is obvious long
 * before adult temperament is, which is why an eight-week puppy can have a
 * decent weight prediction and a nearly meaningless confidence score.
 */
export function uncertainty(trait: PolyTrait, months: number): number {
  // These ages are a little earlier than real life. A puppy whose temperament
  // is still a coin flip at eighteen months gives the player nothing to reason
  // about — the decision stops being judgement and becomes a lottery. Settling
  // sooner means a careful player who waits an extra few months is genuinely
  // rewarded with better information.
  const settleAge: Partial<Record<PolyTrait, number>> = {
    size: 10,
    substance: 12,
    muzzle: 10,
    earSet: 7,
    energy: 15,
    preyDrive: 13,
    vocality: 12,
    alertness: 12,
    sociability: 15,
    biddability: 15,
    stability: 19,
    persistence: 16,
    independence: 16,
    handling: 15,
    structure: 18,
    longevity: 60,
    fertility: 22,
  };
  const settle = settleAge[trait] ?? 20;
  if (months >= settle) return 0;
  // Uncertainty falls away fastest in the first weeks, then tails off.
  return Math.pow(1 - months / settle, 0.7);
}

export interface TraitEstimate {
  /** Best single guess. */
  center: number;
  low: number;
  high: number;
  /** 0-1, where 1 means fully known. */
  confidence: number;
  confidenceLabel: 'Low' | 'Moderate' | 'Good' | 'High' | 'Confirmed';
  /** True once the dog is old enough that this is an observation, not a guess. */
  known: boolean;
}

export function estimateTrait(dog: Dog, trait: PolyTrait, currentMonth: number): TraitEstimate {
  const months = ageMonths(dog, currentMonth);
  const u = uncertainty(trait, months);
  const def = TRAITS[trait];
  const spread = def.sd * 0.85;

  const center = dog.observed[trait] + dog.guessNoise[trait] * u * spread * 0.7;
  const halfRange = u * spread * 1.15;

  const confidence = 1 - u;
  let confidenceLabel: TraitEstimate['confidenceLabel'] = 'Confirmed';
  if (u > 0.7) confidenceLabel = 'Low';
  else if (u > 0.45) confidenceLabel = 'Moderate';
  else if (u > 0.22) confidenceLabel = 'Good';
  else if (u > 0.001) confidenceLabel = 'High';

  if (def.logScale) {
    return {
      center,
      low: center - halfRange,
      high: center + halfRange,
      confidence,
      confidenceLabel,
      known: u <= 0.001,
    };
  }

  return {
    center: clampScore(center),
    low: clampScore(center - halfRange),
    high: clampScore(center + halfRange),
    confidence,
    confidenceLabel,
    known: u <= 0.001,
  };
}

/** Adult weight estimate in pounds, with a range for young dogs. */
export function weightEstimate(dog: Dog, currentMonth: number) {
  const est = estimateTrait(dog, 'size', currentMonth);
  return {
    center: sizeToPounds(est.center),
    low: sizeToPounds(est.low),
    high: sizeToPounds(est.high),
    known: est.known,
    confidenceLabel: est.confidenceLabel,
  };
}

/**
 * Current weight, which for a puppy is a fraction of its adult weight. Used
 * for display so a newborn does not claim to weigh fourteen pounds.
 */
export function currentWeight(dog: Dog, currentMonth: number): number {
  const adult = sizeToPounds(dog.observed.size);
  const months = ageMonths(dog, currentMonth);
  if (months >= 14) return adult;
  // Puppies reach roughly 50% of adult weight at four months.
  const fraction = Math.min(1, 0.06 + 0.94 * (1 - Math.exp(-months / 4.6)));
  return adult * fraction;
}

// ---------------------------------------------------------------------------
// Creating dogs
// ---------------------------------------------------------------------------

let idCounter = 0;

/**
 * Ids are a plain running count. Deliberately no timestamp: anything that
 * varies between sessions would leak into the simulation and stop a seed from
 * reproducing the same world.
 */
export function newDogId(): string {
  idCounter += 1;
  return `d${idCounter.toString(36)}`;
}

/** After loading a save, carry on from the highest id already used. */
export function primeIdCounter(value: number) {
  idCounter = Math.max(idCounter, value);
}

/** Read the numeric part back out of an id, used when restoring a save. */
export function idNumber(id: string): number {
  const parsed = parseInt(id.replace(/^d/, ''), 36);
  return Number.isFinite(parsed) ? parsed : 0;
}

function drawGenotype(rng: Rng, breed: BreedProfile | undefined, wildcards: boolean): Genotype {
  const genotype: Genotype = {};

  for (const locus of LOCI) {
    let table: Record<string, number>;

    if (locus.category === 'quirk') {
      // Quirk genes are not breed-specific; every dog draws from the same pool.
      const freq = QUIRK_BY_KEY[locus.key]?.frequency ?? 0.1;
      table = { Q: freq, n: 1 - freq };
    } else if (locus.category === 'disease') {
      // Disease frequencies are listed per breed. Anything not listed still
      // gets a whisper of background frequency, so no gene pool is ever
      // guaranteed spotless.
      const freq = breed?.diseases?.[locus.key] ?? 0.004;
      table = { N: 1 - freq, m: freq };
    } else {
      table = breed?.alleles?.[locus.key] ?? DEFAULT_ALLELES[locus.key] ?? {};
      if (Object.keys(table).length === 0) {
        table = Object.fromEntries(locus.alleles.map((a, i) => [a.code, i === 0 ? 1 : 0]));
      }
    }

    // Draw two copies. If the result would be a lethal pairing, redraw — that
    // puppy simply would not have been born.
    let pair: [string, string] = [rng.weightedKey(table), rng.weightedKey(table)];
    if (locus.lethalHomozygous) {
      let guard = 0;
      while (pair[0] === locus.lethalHomozygous && pair[1] === locus.lethalHomozygous && guard < 20) {
        pair = [rng.weightedKey(table), rng.weightedKey(table)];
        guard++;
      }
      if (pair[0] === locus.lethalHomozygous && pair[1] === locus.lethalHomozygous) {
        pair = [locus.lethalHomozygous, locus.alleles[locus.alleles.length - 1].code];
      }
    }
    genotype[locus.key] = orderPair(locus.key, pair[0], pair[1]);
  }

  // A small chance of a genuinely rare hidden allele that the breed is not
  // supposed to have. This is how surprises enter a closed population.
  if (wildcards && rng.chance(WILDCARD_CHANCE)) {
    const pick = rng.weighted(WILDCARD_ALLELES, WILDCARD_ALLELES.map((w) => w.weight));
    const current = genotype[pick.locus];
    if (current && current[0] !== pick.allele && current[1] !== pick.allele) {
      const keep = rng.chance(0.5) ? current[0] : current[1];
      genotype[pick.locus] = orderPair(pick.locus, keep, pick.allele);
    }
  }

  return genotype;
}

export interface FounderOptions {
  breedKey: string;
  sex: Sex;
  name: string;
  currentMonth: number;
  ageMonths?: number;
  /** Slide the whole breed toward a target, used by the trait-based search. */
  nudge?: Partial<Record<PolyTrait, number>>;
  wildcards?: boolean;
  generation?: number;
}

export function createFounder(rng: Rng, opts: FounderOptions): Dog {
  const breed = BREED_BY_KEY[opts.breedKey];
  const genotype = drawGenotype(rng, breed, opts.wildcards ?? true);

  const bv = {} as Record<PolyTrait, number>;
  const het = {} as Record<PolyTrait, number>;
  const observed = {} as Record<PolyTrait, number>;
  const guessNoise = {} as Record<PolyTrait, number>;

  for (const trait of ALL_TRAITS) {
    const def = TRAITS[trait];

    if (trait === 'size') {
      const totalSd = breed?.weightSpread ?? 0.11;
      const geneticSd = totalSd * Math.sqrt(def.h2);
      const envSd = totalSd * Math.sqrt(1 - def.h2);
      const mean = Math.log(breed?.weight ?? 35) + (opts.nudge?.size ?? 0);
      bv[trait] = rng.clampedNormal(mean, geneticSd);
      het[trait] = geneticSd;
      observed[trait] = bv[trait] + rng.normal(0, envSd);
    } else {
      const geneticSd = def.sd * Math.sqrt(def.h2) * 0.85;
      const envSd = def.sd * Math.sqrt(1 - def.h2);
      const breedMean = breed?.traits?.[trait as Exclude<PolyTrait, 'size'>] ?? 50;
      const mean = breedMean + (opts.nudge?.[trait] ?? 0);
      bv[trait] = rng.clampedNormal(mean, geneticSd);
      het[trait] = geneticSd;
      observed[trait] = clampScore(bv[trait] + rng.normal(0, envSd));
    }

    guessNoise[trait] = rng.clampedNormal(0, 1, 2.2);
  }

  const age = opts.ageMonths ?? rng.int(18, 40);

  return {
    id: newDogId(),
    name: opts.name,
    sex: opts.sex,
    genotype,
    bv,
    het,
    observed,
    guessNoise,
    birthMonth: opts.currentMonth - age,
    originBreed: opts.breedKey,
    breedLabel: breed ? `${breed.name} type` : 'Mixed background',
    generation: opts.generation ?? 0,
    coi: 0,
    status: 'kennel',
    tests: { ...ALL_KNOWN },
    littersProduced: 0,
    offspringIds: [],
    rarities: [],
    breedingRetired: false,
    seedValue: rng.int(0, 2147483646),
  };
}

/**
 * A dog of no particular breed, drawn from the general population. Used for
 * the "random unrelated dog" outcross option and for foundation stock in
 * projects that do not start from named breeds.
 */
export function createMixedFounder(
  rng: Rng,
  opts: Omit<FounderOptions, 'breedKey'> & { blend?: string[] },
): Dog {
  const pool = opts.blend && opts.blend.length > 0 ? opts.blend : Object.keys(BREED_BY_KEY);
  const chosen = rng.pick(pool);
  const dog = createFounder(rng, { ...opts, breedKey: chosen });
  const breed = BREED_BY_KEY[chosen];
  dog.breedLabel = opts.blend ? `${breed.name} cross` : 'Village dog';
  // Mixed dogs carry more hidden variety than a settled breed does.
  for (const trait of ALL_TRAITS) dog.het[trait] *= 1.35;
  return dog;
}

// ---------------------------------------------------------------------------
// Reading a dog
// ---------------------------------------------------------------------------

/** Traits the player is allowed to see exactly, given which tests were run. */
export function genotypeVisible(dog: Dog, locusKey: string): boolean {
  const locus = LOCUS_BY_KEY[locusKey];
  if (!locus) return false;
  // Coat and colour are visible on the dog itself for most genes, but what the
  // dog CARRIES hidden underneath always needs the DNA panel.
  return dog.tests.dna;
}

/** Short one-line summary used on compact cards and in lists. */
export function shortSummary(dog: Dog, currentMonth: number): string {
  const stage = STAGE_LABEL[lifeStage(dog, currentMonth)];
  const weight = currentWeight(dog, currentMonth);
  return `${stage} · ${weight.toFixed(weight < 20 ? 1 : 0)} lb`;
}
