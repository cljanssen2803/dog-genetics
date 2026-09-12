/**
 * BREEDING
 *
 * Mating, conception, gestation and birth.
 *
 * An important detail the design document calls out explicitly: each embryo's
 * genetics are rolled EXACTLY ONCE, at conception. The embryo is then stored,
 * survives or does not survive on the strength of those same genes, and is
 * finally born as a puppy built from that identical record. Nothing is ever
 * re-rolled. This is what stops the old bug where a puppy's genes could be
 * generated twice and quietly disagree with the viability check.
 */

import { Rng } from './rng';
import {
  ALL_TRAITS,
  CORRELATION_FACTORS,
  type PolyTrait,
  TRAITS,
  TRAIT_FACTOR_MAP,
  TRAIT_PRIVATE_SHARE,
  clampScore,
  sizeToPounds,
} from './traits';
import { type Genotype, LOCI, orderPair, copies } from './loci';
import { type Dog, type Sex, ageMonths, newDogId } from './dog';
import { findRarities, resolveCoat, resolveColor } from './phenotype';
import { type NameRegistry, pickName } from './names';

/** How long a pregnancy lasts, in months. Real dogs take about 63 days. */
export const GESTATION_MONTHS = 2;

/**
 * An embryo: everything about a future puppy, decided at the moment of
 * conception and never touched again.
 */
export interface Embryo {
  sex: Sex;
  genotype: Genotype;
  bv: Record<PolyTrait, number>;
  het: Record<PolyTrait, number>;
  observed: Record<PolyTrait, number>;
  guessNoise: Record<PolyTrait, number>;
  /** Personal quirk number, decided here and carried through to the puppy. */
  seedValue: number;
  /** False when a lethal gene pairing stops this embryo developing. */
  viable: boolean;
  /** Plain-language reason, shown in the litter report. */
  lossReason?: string;
}

export interface Pregnancy {
  id: string;
  damId: string;
  sireId: string;
  conceivedMonth: number;
  dueMonth: number;
  coi: number;
  embryos: Embryo[];
  generation: number;
}

// ---------------------------------------------------------------------------
// Passing on single genes
// ---------------------------------------------------------------------------

/** One parent contributes one randomly chosen copy of each gene. */
function gamete(rng: Rng, parent: Dog): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locus of LOCI) {
    const pair = parent.genotype[locus.key];
    if (!pair) {
      out[locus.key] = locus.alleles[0].code;
      continue;
    }
    out[locus.key] = rng.chance(0.5) ? pair[0] : pair[1];
  }
  return out;
}

function combine(sireGamete: Record<string, string>, damGamete: Record<string, string>): Genotype {
  const genotype: Genotype = {};
  for (const locus of LOCI) {
    genotype[locus.key] = orderPair(locus.key, sireGamete[locus.key], damGamete[locus.key]);
  }
  return genotype;
}

// ---------------------------------------------------------------------------
// Passing on polygenic traits
// ---------------------------------------------------------------------------

/** The smallest amount of genetic variety a trait can be reduced to. */
function hetFloor(trait: PolyTrait): number {
  const def = TRAITS[trait];
  return def.sd * Math.sqrt(def.h2) * 0.22;
}

/**
 * Work out a puppy's hidden genetic hand from its parents.
 *
 * The rules, in plain language:
 *  - A puppy starts at the average of its two parents.
 *  - It is then nudged up or down at random. How big that nudge can be depends
 *    on how much genetic variety the parents still had left to shuffle.
 *  - Those nudges are not independent. A handful of hidden factors push on
 *    several traits at once, which is why breeding for prey drive quietly
 *    drags barking and alertness along with it.
 *  - The puppy's own remaining variety grows when its parents were very
 *    different from each other (this is why a first cross looks uniform but its
 *    children are all over the place) and shrinks when the parents were
 *    related.
 */
function inheritPolygenic(
  rng: Rng,
  sire: Dog,
  dam: Dog,
  coi: number,
): {
  bv: Record<PolyTrait, number>;
  het: Record<PolyTrait, number>;
  observed: Record<PolyTrait, number>;
  guessNoise: Record<PolyTrait, number>;
} {
  // Roll the shared hidden factors once for this embryo.
  const factors = CORRELATION_FACTORS.map(() => rng.clampedNormal(0, 1, 2.8));

  const bv = {} as Record<PolyTrait, number>;
  const het = {} as Record<PolyTrait, number>;
  const observed = {} as Record<PolyTrait, number>;
  const guessNoise = {} as Record<PolyTrait, number>;

  for (const trait of ALL_TRAITS) {
    const def = TRAITS[trait];

    // A correlated random draw with an overall spread of exactly 1.
    let draw = TRAIT_PRIVATE_SHARE[trait] * rng.clampedNormal(0, 1, 2.8);
    for (const { factor, loading } of TRAIT_FACTOR_MAP[trait]) {
      draw += loading * factors[factor];
    }

    const hetS = sire.het[trait];
    const hetD = dam.het[trait];
    const midParent = (sire.bv[trait] + dam.bv[trait]) / 2;
    const parentGap = Math.abs(sire.bv[trait] - dam.bv[trait]);

    // How far this puppy can drift from the midpoint of its parents.
    const segregationSd = Math.sqrt(0.25 * (hetS * hetS + hetD * hetD)) * Math.sqrt(Math.max(0, 1 - coi));

    bv[trait] = midParent + draw * segregationSd;

    // Variety carried forward. Big parental differences create a puppy holding
    // a lot of unexpressed variation; inbreeding and steady selection wear it
    // away, which is how a population eventually breeds true.
    const carried = Math.sqrt(0.5 * (hetS * hetS + hetD * hetD) + 0.25 * parentGap * parentGap);
    het[trait] = Math.max(hetFloor(trait), carried * (1 - coi) * 0.97);

    // What the puppy will actually grow into: its genes plus life's luck,
    // minus the cost of inbreeding on the traits that depend on vigour.
    const envSd = def.logScale
      ? def.sd * Math.sqrt(1 - def.h2)
      : def.sd * Math.sqrt(1 - def.h2);
    const depression = def.depression * coi;

    const raw = bv[trait] + rng.normal(0, envSd) - depression;
    observed[trait] = def.logScale ? raw : clampScore(raw);

    guessNoise[trait] = rng.clampedNormal(0, 1, 2.2);
  }

  return { bv, het, observed, guessNoise };
}

// ---------------------------------------------------------------------------
// Conception
// ---------------------------------------------------------------------------

export interface MatingAttempt {
  conceived: boolean;
  pregnancy: Pregnancy;
}

/** How many embryos a female is likely to carry. */
function litterTarget(rng: Rng, sire: Dog, dam: Dog, currentMonth: number, coi: number): number {
  // Litter size is the player's supply of choices. Too few puppies and every
  // generation becomes "take whatever you were given", which is not a game.
  // Nudged upward accordingly, and the floor is two rather than one so a
  // singleton stays a rare disappointment instead of a regular event.
  const weight = sizeToPounds(dam.observed.size);
  let base = 1.9 + 1.65 * Math.pow(weight, 0.33);

  base *= 0.8 + (dam.observed.fertility / 100) * 0.45;
  base *= 1 - Math.min(0.28, coi * 1.05);

  const damAge = ageMonths(dam, currentMonth);
  if (damAge < 24) base *= 0.92;
  if (damAge > 60) base *= 1 - Math.min(0.3, (damAge - 60) / 105);
  if (dam.observed.muzzle < 22) base *= 0.88;

  void sire;

  const rolled = Math.round(rng.normal(base, 1.25));
  // A true singleton is still possible, just uncommon.
  const floor = rng.chance(0.06) ? 1 : 2;
  return Math.max(floor, Math.min(14, rolled));
}

/**
 * Breed two dogs. Always produces a pregnancy, with every embryo fully decided
 * here and now — genes, sex, temperament, the lot.
 *
 * Matings never fail. In reality a good pairing misses perhaps a quarter of
 * the time, but a failed mating costs the player eight months of a female's
 * short career on a dice roll they could not influence or foresee. That is not
 * tension, it is a wasted turn. Fertility still matters — it just shows up in
 * how many puppies arrive rather than in whether any arrive at all.
 */
export function attemptMating(
  rng: Rng,
  sire: Dog,
  dam: Dog,
  currentMonth: number,
  coi: number,
  generation: number,
): MatingAttempt {
  const count = litterTarget(rng, sire, dam, currentMonth, coi);
  const embryos: Embryo[] = [];

  for (let i = 0; i < count; i++) {
    embryos.push(createEmbryo(rng, sire, dam, coi));
  }

  return {
    conceived: true,
    pregnancy: {
      id: `p${newDogId()}`,
      damId: dam.id,
      sireId: sire.id,
      conceivedMonth: currentMonth,
      dueMonth: currentMonth + GESTATION_MONTHS,
      coi,
      embryos,
      generation,
    },
  };
}

/**
 * Build one embryo. Everything is decided here and here only.
 */
function createEmbryo(rng: Rng, sire: Dog, dam: Dog, coi: number): Embryo {
  const genotype = combine(gamete(rng, sire), gamete(rng, dam));
  const sex: Sex = rng.chance(0.51) ? 'M' : 'F';
  const { bv, het, observed, guessNoise } = inheritPolygenic(rng, sire, dam, coi);

  const embryo: Embryo = {
    sex,
    genotype,
    bv,
    het,
    observed,
    guessNoise,
    seedValue: rng.int(0, 2147483646),
    viable: true,
  };

  // --- Viability, judged on the genes just rolled --------------------------

  for (const locus of LOCI) {
    if (!locus.lethalHomozygous) continue;
    if (copies(genotype, locus.key, locus.lethalHomozygous) === 2) {
      embryo.viable = false;
      embryo.lossReason =
        locus.key === 'bobtail'
          ? 'Two copies of the bobtail gene — never develops.'
          : locus.key === 'harlequin'
            ? 'Two copies of the harlequin modifier — never develops.'
            : 'Two copies of the hairless gene — never develops.';
      return embryo;
    }
  }

  // Heavy inbreeding costs puppies, but the penalty only really bites once the
  // player is doing something genuinely reckless. Below about 12% it is a
  // gentle nudge rather than a punishment.
  if (coi > 0.1 && rng.chance(Math.min(0.22, (coi - 0.1) * 1.3))) {
    embryo.viable = false;
    embryo.lossReason = 'Reabsorbed early. Closely bred litters lose more puppies.';
    return embryo;
  }

  // Very small or very flat-faced puppies have a higher newborn loss rate.
  const adultWeight = sizeToPounds(observed.size);
  if (adultWeight < 5 && rng.chance(0.09)) {
    embryo.viable = false;
    embryo.lossReason = 'Too small to survive the first days.';
    return embryo;
  }
  if (observed.muzzle < 15 && rng.chance(0.07)) {
    embryo.viable = false;
    embryo.lossReason = 'Could not breathe well enough to nurse.';
    return embryo;
  }

  return embryo;
}

// ---------------------------------------------------------------------------
// Birth
// ---------------------------------------------------------------------------

export interface LitterResult {
  litterId: string;
  puppies: Dog[];
  lost: { reason: string }[];
  /** Rare finds that appeared in this litter. */
  discoveries: { puppyId: string; key: string; title: string; rarity: string; blurb: string }[];
}

/**
 * Turn a due pregnancy into actual puppies. The embryos were decided two months
 * ago; this step only gives them names and writes them into the world.
 */
export function deliverLitter(
  rng: Rng,
  pregnancy: Pregnancy,
  sire: Dog,
  dam: Dog,
  currentMonth: number,
  names: NameRegistry,
  breedLabel: string,
): LitterResult {
  const litterId = `l${pregnancy.id}`;
  const puppies: Dog[] = [];
  const lost: { reason: string }[] = [];
  const discoveries: LitterResult['discoveries'] = [];

  for (const embryo of pregnancy.embryos) {
    if (!embryo.viable) {
      lost.push({ reason: embryo.lossReason ?? 'Did not survive.' });
      continue;
    }

    const puppy: Dog = {
      id: newDogId(),
      name: pickName(names, embryo.sex, rng),
      sex: embryo.sex,
      genotype: embryo.genotype,
      bv: embryo.bv,
      het: embryo.het,
      observed: embryo.observed,
      guessNoise: embryo.guessNoise,
      birthMonth: currentMonth,
      sireId: sire.id,
      damId: dam.id,
      breedLabel,
      generation: pregnancy.generation,
      coi: pregnancy.coi,
      litterId,
      status: 'kennel',
      // Every dog's health information is simply known. See the note on the
      // Dog type: withholding it created busywork, not decisions.
      tests: { dna: true, hips: true, eyes: true, cardiac: true },
      littersProduced: 0,
      offspringIds: [],
      rarities: [],
      breedingRetired: false,
      seedValue: embryo.seedValue,
    };

    // Look for anything genetically remarkable.
    const coat = resolveCoat(puppy.genotype, sizeToPounds(puppy.observed.size));
    const color = resolveColor(puppy.genotype);
    for (const find of findRarities(puppy.genotype, coat, color)) {
      puppy.rarities.push(find.key);
      discoveries.push({
        puppyId: puppy.id,
        key: find.key,
        title: find.title,
        rarity: find.rarity,
        blurb: find.blurb,
      });
    }

    puppies.push(puppy);
  }

  return { litterId, puppies, lost, discoveries };
}

// ---------------------------------------------------------------------------
// Predicting a litter before it exists
// ---------------------------------------------------------------------------

export interface DiseaseRisk {
  locus: string;
  name: string;
  /** Chance each puppy is affected. */
  affected: number;
  /** Chance each puppy is a healthy carrier. */
  carrier: number;
  /** True when neither parent has been DNA tested, so this is guesswork. */
  untested: boolean;
}

/**
 * Work out exactly what a pairing risks, gene by gene. Because single genes
 * follow fixed rules, these are real probabilities rather than estimates.
 */
export function diseaseRisks(sire: Dog, dam: Dog): DiseaseRisk[] {
  const risks: DiseaseRisk[] = [];

  for (const locus of LOCI) {
    if (locus.category !== 'disease' && locus.key !== 'merle') continue;

    const bad = locus.key === 'merle' ? 'M' : 'm';
    const sireCopies = copies(sire.genotype, locus.key, bad);
    const damCopies = copies(dam.genotype, locus.key, bad);
    if (sireCopies === 0 && damCopies === 0) continue;

    // Chance each parent passes the problem copy.
    const fromSire = sireCopies / 2;
    const fromDam = damCopies / 2;

    const affected = fromSire * fromDam;
    const carrier = fromSire * (1 - fromDam) + fromDam * (1 - fromSire);
    if (affected === 0 && carrier === 0) continue;

    risks.push({
      locus: locus.key,
      name: locus.key === 'merle' ? 'Double merle' : locus.name,
      affected,
      carrier,
      untested: !sire.tests.dna || !dam.tests.dna,
    });
  }

  return risks.sort((a, b) => b.affected - a.affected || b.carrier - a.carrier);
}

/** Expected average and spread for a polygenic trait in a planned litter. */
export function predictTrait(
  sire: Dog,
  dam: Dog,
  trait: PolyTrait,
  coi: number,
): { mean: number; low: number; high: number } {
  const mid = (sire.bv[trait] + dam.bv[trait]) / 2;
  const hetS = sire.het[trait];
  const hetD = dam.het[trait];
  const seg = Math.sqrt(0.25 * (hetS * hetS + hetD * hetD)) * Math.sqrt(Math.max(0, 1 - coi));
  const def = TRAITS[trait];
  const env = def.sd * Math.sqrt(1 - def.h2);
  const total = Math.sqrt(seg * seg + env * env);
  const depression = def.depression * coi;

  return {
    mean: mid - depression,
    low: mid - depression - total * 1.28,
    high: mid - depression + total * 1.28,
  };
}

/** Probability a pairing produces at least one puppy of each hidden coat gene. */
export function predictCoatOutcomes(sire: Dog, dam: Dog): { label: string; chance: number }[] {
  const out: { label: string; chance: number }[] = [];

  const pairChance = (locus: string, allele: string) => {
    const s = copies(sire.genotype, locus, allele) / 2;
    const d = copies(dam.genotype, locus, allele) / 2;
    return { both: s * d, either: s + d - s * d };
  };

  const long = pairChance('coatLength', 'l');
  if (long.both > 0) out.push({ label: 'Long coat', chance: long.both });

  const curl = pairChance('curl', 'Cu');
  if (curl.either > 0) {
    out.push({ label: 'Some curl or wave', chance: curl.either });
    if (curl.both > 0) out.push({ label: 'Full curl', chance: curl.both });
  }

  const lowShed = pairChance('shedding', 'sh');
  if (lowShed.both > 0) out.push({ label: 'Reduced shedding', chance: lowShed.both });

  const furnish = pairChance('furnishings', 'F');
  if (furnish.either > 0) out.push({ label: 'Beard and eyebrows', chance: furnish.either });

  const hairlessRec = pairChance('hairlessRec', 'hr');
  if (hairlessRec.both > 0) out.push({ label: 'Hairless (recessive)', chance: hairlessRec.both });

  const hairlessDom = pairChance('hairlessDom', 'Hd');
  if (hairlessDom.either > 0) {
    const s = copies(sire.genotype, 'hairlessDom', 'Hd') / 2;
    const d = copies(dam.genotype, 'hairlessDom', 'Hd') / 2;
    // Two hairless copies never survive, so the surviving ratio shifts.
    const lethal = s * d;
    out.push({ label: 'Hairless', chance: (s + d - 2 * lethal) / (1 - lethal) });
  }

  return out.sort((a, b) => b.chance - a.chance);
}
