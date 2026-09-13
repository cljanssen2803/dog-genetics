/**
 * MATCHMAKING
 *
 * Given one parent, work out how good every possible mate would be, and
 * explain why in language a person can actually act on.
 *
 * The honest way to predict a litter is to simulate one. Rather than guessing
 * with formulas, this file quietly breeds the pair a few dozen times in a
 * sandbox — using a fixed seed so the answer never changes between screens —
 * and reports what actually came out. Every number the player sees is
 * therefore produced by the same engine that will produce the real puppies.
 */

import { Rng, hashString } from '../engine/rng';
import { type Dog, ageMonths, breedingEligibility } from '../engine/dog';
import { attemptMating, diseaseRisks, predictCoatOutcomes, type DiseaseRisk } from '../engine/breeding';
import { DERIVED_LABEL, type DerivedKey, type DogScore, scoreDog } from '../engine/standard';
import { resolveCoat } from '../engine/phenotype';
import { ALL_TRAITS, TRAITS, sizeToPounds } from '../engine/traits';
import { describeCoi, sharedAncestors } from '../engine/pedigree';
import {
  type Project,
  activeDogs,
  ancestorInfluenceFor,
  kinshipFor,
  lookupDog,
} from './project';

export type MatchVerdict =
  | 'Excellent match'
  | 'Good match'
  | 'Useful outcross'
  | 'Risky pairing'
  | 'Do not breed';

export interface TraitShift {
  /** A polygenic trait key, or a coat property such as 'coldTolerance'. */
  trait: string;
  label: string;
  /** Change versus the better parent, in points (or pounds for size). */
  change: number;
  direction: 'up' | 'down';
  /** True when this change moves the litter toward the project standard. */
  helpful: boolean;
  text: string;
}

export interface PairingPreview {
  sire: Dog;
  dam: Dog;
  coi: number;
  coiLabel: string;
  coiTone: 'good' | 'ok' | 'warn' | 'bad';
  expectedLitterSize: number;

  /** Average project score of the simulated puppies. */
  meanScore: number;
  bestScore: number;
  /** Percentage of simulated puppies that met the standard. */
  standardLow: number;
  standardHigh: number;

  improvements: TraitShift[];
  weaknesses: TraitShift[];
  diseases: DiseaseRisk[];
  coatOutcomes: { label: string; chance: number }[];

  diversityGain: number;
  sharedAncestorNames: { name: string; generations: number }[];
  sireInfluence: number;

  verdict: MatchVerdict;
  verdictReason: string;
  /** The full explanation behind "Why this match?". */
  explanation: string[];
}

const SIM_COUNT = 30;

/** A stable private generator for one specific pairing. */
function previewRng(project: Project, sireId: string, damId: string): Rng {
  return new Rng(hashString(`${project.seed}:${sireId}:${damId}`));
}

/**
 * Build the full preview for one pairing.
 */
export function previewPairing(project: Project, sire: Dog, dam: Dog): PairingPreview {
  const kinship = kinshipFor(project);
  const coi = kinship.projectedCoi(sire.id, dam.id);
  const coiInfo = describeCoi(coi);

  const rng = previewRng(project, sire.id, dam.id);

  // --- Simulate a run of litters -----------------------------------------
  const simulated: Dog[] = [];
  let litterSizeTotal = 0;
  let litters = 0;

  for (let i = 0; i < SIM_COUNT && simulated.length < 90; i++) {
    const attempt = attemptMating(rng, sire, dam, project.month, coi, 0);
    if (!attempt.conceived || !attempt.pregnancy) continue;
    litters += 1;
    const viable = attempt.pregnancy.embryos.filter((e) => e.viable);
    litterSizeTotal += viable.length;

    for (const embryo of viable) {
      simulated.push({
        ...dam,
        id: `sim${i}_${simulated.length}`,
        name: 'simulated',
        sex: embryo.sex,
        genotype: embryo.genotype,
        bv: embryo.bv,
        het: embryo.het,
        observed: embryo.observed,
        guessNoise: embryo.guessNoise,
        birthMonth: project.month,
        sireId: sire.id,
        damId: dam.id,
        coi,
        littersProduced: 0,
        offspringIds: [],
        rarities: [],
        tests: { dna: true, hips: true, eyes: true, cardiac: true },
      });
    }
  }

  const scores: DogScore[] = simulated.map((d) => scoreDog(d, project.standard));
  const meanScore = scores.length ? scores.reduce((s, x) => s + x.total, 0) / scores.length : 0;
  const bestScore = scores.length ? Math.max(...scores.map((s) => s.total)) : 0;
  const meetingRate = scores.length ? scores.filter((s) => s.meetsStandard).length / scores.length : 0;

  // Report the pass rate as a range, because a single percentage would be
  // pretending to more precision than a simulation can give.
  const margin = scores.length ? 1.1 / Math.sqrt(scores.length) : 0.25;
  const standardLow = Math.max(0, Math.round((meetingRate - margin) * 100));
  const standardHigh = Math.min(100, Math.round((meetingRate + margin) * 100));

  // --- What would change compared with the current population -------------
  const population = activeDogs(project).filter((d) => ageMonths(d, project.month) >= 12);
  const shifts: TraitShift[] = [];

  for (const trait of ALL_TRAITS) {
    const goal = project.standard.traitGoals[trait];
    if (!goal || goal.priority === 0) continue;
    if (simulated.length === 0 || population.length === 0) continue;

    const def = TRAITS[trait];
    const litterMean = simulated.reduce((s, d) => s + d.observed[trait], 0) / simulated.length;
    const popMean = population.reduce((s, d) => s + d.observed[trait], 0) / population.length;

    const litterDisplay = def.logScale ? sizeToPounds(litterMean) : litterMean;
    const popDisplay = def.logScale ? sizeToPounds(popMean) : popMean;
    const change = litterDisplay - popDisplay;

    // Is this movement in the direction the standard wants?
    const target = goalCentre(goal, def.logScale ?? false);
    const closerBefore = Math.abs(popDisplay - target);
    const closerAfter = Math.abs(litterDisplay - target);
    const helpful = closerAfter < closerBefore;

    const magnitude = def.logScale
      ? Math.abs(change) / Math.max(1, popDisplay)
      : Math.abs(change) / 12;
    if (magnitude < 0.08) continue;

    const unit = def.logScale ? ' lb' : ' points';
    const amount = def.logScale ? Math.abs(change).toFixed(1) : Math.abs(change).toFixed(0);

    shifts.push({
      trait,
      label: def.label,
      change,
      direction: change > 0 ? 'up' : 'down',
      helpful,
      text: `${def.label} ${change > 0 ? 'up' : 'down'} about ${amount}${unit}`,
    });
  }

  // Coat properties — shedding, grooming, cold and heat tolerance, water
  // resistance — come from the coat genes rather than a polygenic trait, so
  // they need their own pass. Without this a project whose biggest need is a
  // warmer coat would never see it mentioned on a pairing.
  for (const [key, goal] of Object.entries(project.standard.derivedGoals)) {
    if (!goal || goal.priority === 0) continue;
    if (simulated.length === 0 || population.length === 0) continue;
    const derived = key as DerivedKey;
    const coatOf = (d: Dog) => resolveCoat(d.genotype, sizeToPounds(d.observed.size))[derived];
    const litterMean = simulated.reduce((sum, d) => sum + coatOf(d), 0) / simulated.length;
    const popMean = population.reduce((sum, d) => sum + coatOf(d), 0) / population.length;
    const change = litterMean - popMean;
    if (Math.abs(change) < 4) continue;
    const target = goalCentre(goal, false);
    const helpful = Math.abs(litterMean - target) < Math.abs(popMean - target);
    shifts.push({
      trait: derived,
      label: DERIVED_LABEL[derived],
      change,
      direction: change > 0 ? 'up' : 'down',
      helpful,
      text: `${DERIVED_LABEL[derived]} ${change > 0 ? 'up' : 'down'} about ${Math.abs(change).toFixed(0)} points`,
    });
  }

  shifts.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const improvements = shifts.filter((s) => s.helpful).slice(0, 4);
  const weaknesses = shifts.filter((s) => !s.helpful).slice(0, 4);

  // --- Diversity ----------------------------------------------------------
  const shared = sharedAncestors(sire.id, dam.id, lookupDog(project), 3);
  const sireInfluence = ancestorInfluenceFor(project, sire.id);

  // How much fresh blood this pairing brings, versus the average relatedness
  // already in the population.
  let popKinshipSum = 0;
  let popKinshipCount = 0;
  for (let i = 0; i < population.length; i++) {
    for (let j = i + 1; j < population.length; j++) {
      popKinshipSum += kinship.between(population[i].id, population[j].id);
      popKinshipCount += 1;
    }
  }
  const averagePopKinship = popKinshipCount > 0 ? popKinshipSum / popKinshipCount : 0;
  const diversityGain = averagePopKinship - coi;

  // --- Verdict ------------------------------------------------------------
  const diseases = diseaseRisks(sire, dam);
  const worstAffected = diseases.reduce((m, d) => Math.max(m, d.affected), 0);
  const doubleMerleRisk = diseases.find((d) => d.locus === 'merle')?.affected ?? 0;

  let verdict: MatchVerdict;
  let verdictReason: string;

  if (doubleMerleRisk > 0 || worstAffected >= 0.24) {
    verdict = 'Do not breed';
    verdictReason =
      doubleMerleRisk > 0
        ? 'Both dogs carry merle. A quarter of the puppies would be double merle, with a high risk of deafness and blindness.'
        : 'A quarter of this litter would be born affected by an inherited disease.';
  } else if (coi >= 0.2) {
    verdict = 'Do not breed';
    verdictReason = 'These two are as closely related as full siblings. Fertility, litter size and lifespan all suffer badly at this level.';
  } else if (worstAffected > 0 || coi >= 0.125) {
    verdict = 'Risky pairing';
    verdictReason =
      worstAffected > 0
        ? 'Both parents carry the same disease gene, so some puppies would be affected.'
        : 'Closely related. Usable once if the gain is real, but not something to repeat.';
  } else if (meanScore >= 62 && meetingRate >= 0.28 && coi < 0.065) {
    verdict = 'Excellent match';
    verdictReason = 'Strong expected puppies, low inbreeding and no disease risk.';
  } else if (diversityGain > 0.045 && meanScore >= 42) {
    verdict = 'Useful outcross';
    verdictReason = 'Brings genuinely fresh blood into a population that is starting to close up, at an acceptable cost in quality.';
  } else if (meanScore >= 48) {
    verdict = 'Good match';
    verdictReason = 'A solid, sensible pairing that should move the population forward.';
  } else if (meanScore >= 34) {
    verdict = 'Good match';
    verdictReason = 'Workable, but do not expect a breakthrough litter.';
  } else {
    verdict = 'Risky pairing';
    verdictReason = 'The expected puppies fall well short of your standard.';
  }

  // --- The long explanation ------------------------------------------------
  const explanation: string[] = [];

  explanation.push(
    `Simulating ${litters} litters from this pairing produced ${simulated.length} puppies. Their average score against the ${project.standard.name} standard was ${Math.round(
      meanScore,
    )}, and the best single puppy reached ${Math.round(bestScore)}.`,
  );

  if (coi < 0.005) {
    explanation.push('These two share no recorded ancestors at all, so inbreeding is not a concern here.');
  } else {
    const names = shared.map((s) => `${s.dog.name} (${s.generations} generations back)`);
    explanation.push(
      `Projected inbreeding is ${(coi * 100).toFixed(1)}% — ${coiInfo.label.toLowerCase()}.${
        names.length ? ` They share ${names.join(' and ')}.` : ''
      }`,
    );
  }

  if (diseases.length === 0) {
    explanation.push('Neither dog carries a disease gene that the other one also carries, so no puppies would be born affected.');
  } else {
    for (const risk of diseases.slice(0, 3)) {
      if (risk.affected > 0) {
        explanation.push(
          `${risk.name}: about ${Math.round(risk.affected * 100)}% of puppies would be affected and ${Math.round(
            risk.carrier * 100,
          )}% would be healthy carriers.${risk.untested ? ' Neither dog has had a DNA panel, so this is inferred rather than confirmed.' : ''}`,
        );
      } else if (risk.carrier > 0.2) {
        explanation.push(
          `${risk.name}: no affected puppies, but roughly ${Math.round(risk.carrier * 100)}% would carry the gene forward.`,
        );
      }
    }
  }

  if (improvements.length > 0) {
    explanation.push(
      `Compared with your current breeding population this litter should improve ${improvements
        .map((i) => i.label.toLowerCase())
        .join(', ')}.`,
    );
  }
  if (weaknesses.length > 0) {
    explanation.push(
      `It would cost you ground on ${weaknesses.map((w) => w.label.toLowerCase()).join(', ')}.`,
    );
  }

  if (sireInfluence > 0.3) {
    explanation.push(
      `Be careful: ${sire.name} already appears in the ancestry of ${Math.round(
        sireInfluence * 100,
      )}% of your breeding population. Using him again narrows your future options.`,
    );
  }

  if (diversityGain > 0.04) {
    explanation.push('This pairing is noticeably less related than the typical pair in your kennel, so it widens the gene pool.');
  }

  explanation.push(
    `Expect about ${(litterSizeTotal / Math.max(1, litters)).toFixed(1)} live puppies from this pairing.`,
  );

  return {
    sire,
    dam,
    coi,
    coiLabel: coiInfo.label,
    coiTone: coiInfo.tone,
    expectedLitterSize: litterSizeTotal / Math.max(1, litters),
    meanScore,
    bestScore,
    standardLow,
    standardHigh,
    improvements,
    weaknesses,
    diseases,
    coatOutcomes: predictCoatOutcomes(sire, dam),
    diversityGain,
    sharedAncestorNames: shared.map((s) => ({ name: s.dog.name, generations: s.generations })),
    sireInfluence,
    verdict,
    verdictReason,
    explanation,
  };
}

function goalCentre(
  goal: { mode: string; preferredLow?: number; preferredHigh?: number },
  logScale: boolean,
): number {
  if (goal.mode === 'higher') return logScale ? 999 : 100;
  if (goal.mode === 'lower') return logScale ? 0 : 0;
  return ((goal.preferredLow ?? 50) + (goal.preferredHigh ?? 50)) / 2;
}

// ---------------------------------------------------------------------------
// Ranking every available mate
// ---------------------------------------------------------------------------

export interface RankedMate {
  dog: Dog;
  preview: PairingPreview;
  rank: number;
}

const VERDICT_ORDER: Record<MatchVerdict, number> = {
  'Excellent match': 0,
  'Good match': 1,
  'Useful outcross': 2,
  'Risky pairing': 3,
  'Do not breed': 4,
};

/**
 * Rank every dog in the kennel that could legally be bred to the chosen
 * parent. Ordering puts safe, high-value pairings first and clearly dangerous
 * ones last, but nothing is ever hidden — the player can always overrule.
 */
export function rankMates(project: Project, parent: Dog): RankedMate[] {
  const wantedSex = parent.sex === 'M' ? 'F' : 'M';

  const candidates = activeDogs(project).filter((d) => {
    if (d.sex !== wantedSex) return false;
    return breedingEligibility(d, project.month, project.lastLitter[d.id]).eligible;
  });

  const ranked = candidates.map((dog) => {
    const sire = parent.sex === 'M' ? parent : dog;
    const dam = parent.sex === 'F' ? parent : dog;
    const preview = previewPairing(project, sire, dam);
    return { dog, preview, rank: 0 };
  });

  ranked.sort((a, b) => {
    const order = VERDICT_ORDER[a.preview.verdict] - VERDICT_ORDER[b.preview.verdict];
    if (order !== 0) return order;
    return b.preview.meanScore - a.preview.meanScore;
  });

  ranked.forEach((r, i) => (r.rank = i + 1));
  return ranked;
}
