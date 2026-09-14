/**
 * THE ASSISTANT
 *
 * Three hand-holding helpers that turn the game's own analysis into things
 * you can tap:
 *
 *   planGeneration  — the best set of pairings for the whole kennel, one per
 *                     female, spread across sires so no single dog floods
 *                     the gene pool.
 *   triageLitter    — a recommended Keep / Wait / Pet home for every puppy in
 *                     a litter, with the reason.
 *   nextStep        — the one thing to do now.
 *
 * None of these do anything by themselves. They recommend; the player taps.
 */

import { type Dog, ageMonths, breedingEligibility } from '../engine/dog';
import { scoreDog } from '../engine/standard';
import { geneticHealthFlags } from '../engine/phenotype';
import {
  type Litter,
  type Project,
  activeDogs,
  breedingPopulation,
  kennelCount,
  placementFit,
  puppiesOf,
  takeSnapshot,
} from './project';
import { type PairingPreview, previewPairing } from './matchmaking';

// ---------------------------------------------------------------------------
// Plan the generation
// ---------------------------------------------------------------------------

export interface PlannedPairing {
  dam: Dog;
  sire: Dog;
  preview: PairingPreview;
  /** One line: why this pair, in plain words. */
  reason: string;
}

export interface GenerationPlan {
  pairings: PlannedPairing[];
  /** Females left out, and why. */
  skipped: { dog: Dog; why: string }[];
  /** Puppies these litters are likely to add, against the space you have. */
  expectedPuppies: number;
  spaceLeft: number;
}

function shiftWords(p: PairingPreview): string {
  const ups = p.improvements.slice(0, 2).map((s) => s.label.toLowerCase());
  return ups.length ? `should lift ${ups.join(' and ')}` : 'holds what you have';
}

export function planGeneration(project: Project): GenerationPlan {
  const inWhelp = new Set(project.pregnancies.map((p) => p.damId));
  const eligible = activeDogs(project).filter(
    (d) => breedingEligibility(d, project.month, project.lastLitter[d.id]).eligible && !inWhelp.has(d.id),
  );
  const dams = eligible.filter((d) => d.sex === 'F');
  const sires = eligible.filter((d) => d.sex === 'M');
  const skipped: { dog: Dog; why: string }[] = [];

  if (sires.length === 0) {
    return { pairings: [], skipped: dams.map((dog) => ({ dog, why: 'no eligible male in the kennel' })), expectedPuppies: 0, spaceLeft: project.kennelCapacity - kennelCount(project) };
  }

  // Every usable combination, best first.
  const options: { dam: Dog; sire: Dog; preview: PairingPreview }[] = [];
  for (const dam of dams) {
    for (const sire of sires) {
      const preview = previewPairing(project, sire, dam);
      if (preview.verdict === 'Do not breed') continue;
      options.push({ dam, sire, preview });
    }
  }
  options.sort((a, b) => b.preview.meanScore - a.preview.meanScore);

  // Greedy: take the best option for each dam, but no sire more than twice
  // in a season — a kennel built on one stud runs out of unrelated mates.
  const sireUse = new Map<string, number>();
  const chosen: PlannedPairing[] = [];
  const damsDone = new Set<string>();
  for (const o of options) {
    if (damsDone.has(o.dam.id)) continue;
    if ((sireUse.get(o.sire.id) ?? 0) >= 2) continue;
    damsDone.add(o.dam.id);
    sireUse.set(o.sire.id, (sireUse.get(o.sire.id) ?? 0) + 1);
    const risky = o.preview.verdict === 'Risky pairing' ? ' Some risk — read the preview.' : '';
    chosen.push({
      dam: o.dam,
      sire: o.sire,
      preview: o.preview,
      reason: `Best mate available for ${o.dam.name}: average puppy ${Math.round(o.preview.meanScore)}, inbreeding ${(o.preview.coi * 100).toFixed(1)}%, ${shiftWords(o.preview)}.${risky}`,
    });
  }
  for (const dam of dams) {
    if (!damsDone.has(dam.id)) skipped.push({ dog: dam, why: 'every available male is too closely related' });
  }

  // Only as many litters as there is room to raise.
  const spaceLeft = project.kennelCapacity - kennelCount(project);
  let expected = 0;
  const fitting: PlannedPairing[] = [];
  for (const p of chosen) {
    if (fitting.length > 0 && expected + p.preview.expectedLitterSize > spaceLeft + 8) {
      skipped.push({ dog: p.dam, why: 'not enough kennel space for another litter this season' });
      continue;
    }
    fitting.push(p);
    expected += p.preview.expectedLitterSize;
  }

  return { pairings: fitting, skipped, expectedPuppies: Math.round(expected), spaceLeft };
}

// ---------------------------------------------------------------------------
// Sort the litter
// ---------------------------------------------------------------------------

export type Triage = 'keep' | 'wait' | 'retainNoBreed' | 'pet';

export interface PuppyAdvice {
  dog: Dog;
  choice: Triage;
  reason: string;
  /** For a pet placement, the home that suits the puppy best. */
  placement?: ReturnType<typeof placementFit>[number]['type'];
}

export function triageLitter(project: Project, litter: Litter): PuppyAdvice[] {
  const puppies = puppiesOf(project, litter.id).filter((p) => p.status === 'kennel');
  if (puppies.length === 0) return [];
  const age = project.month - litter.bornMonth;
  const space = project.kennelCapacity - kennelCount(project);

  // Rank by what each puppy would pass on, not what it looks like today.
  const ranked = puppies
    .map((dog) => {
      const bv = scoreDog(dog, project.standard, true).total;
      const shown = scoreDog(dog, project.standard).total;
      const affected = geneticHealthFlags(dog.genotype).some((f) => f.severity === 'affected');
      return { dog, bv, shown, affected };
    })
    .sort((a, b) => b.bv - a.bv);

  // How many to keep: the best two of a good litter, one of a middling one,
  // never more than the space allows (the kennel is counted with the puppies
  // already in it, so this is extra room beyond them).
  const adultAverage = breedingPopulation(project).length
    ? breedingPopulation(project).reduce((s, d) => s + scoreDog(d, project.standard, true).total, 0) / breedingPopulation(project).length
    : 50;
  const keepBudget = Math.max(1, Math.min(2, puppies.length, space + puppies.length));

  const advice: PuppyAdvice[] = [];
  let kept = 0;
  for (const r of ranked) {
    const better = r.bv - adultAverage;
    if (r.affected) {
      const home = placementFit(r.dog).sort((a, b) => b.fit - a.fit)[0];
      advice.push({ dog: r.dog, choice: 'pet', reason: 'Affected by an inherited condition — a loved pet, not a breeding dog.', placement: home?.type });
      continue;
    }
    if (kept < keepBudget && better >= -2) {
      kept += 1;
      advice.push({
        dog: r.dog,
        choice: 'keep',
        reason: `${kept === 1 ? 'Best' : 'Second best'} breeding value in the litter (${Math.round(r.bv)}), ${better >= 0 ? `${Math.round(better)} above` : 'level with'} your current adults.`,
      });
      continue;
    }
    if (age < 8 && better >= -6 && kept < keepBudget + 1) {
      advice.push({ dog: r.dog, choice: 'wait', reason: `Close call (${Math.round(r.bv)}). Give it a couple of months for the estimate to settle.` });
      continue;
    }
    const home = placementFit(r.dog).sort((a, b) => b.fit - a.fit)[0];
    advice.push({
      dog: r.dog,
      choice: 'pet',
      reason:
        better >= 0
          ? `A good one (${Math.round(r.bv)}), but you only have room to keep ${keepBudget} and the ones above are better.`
          : `Would not move the breed forward (${Math.round(r.bv)} against adults at ${Math.round(adultAverage)}).`,
      placement: home?.type,
    });
  }
  return advice;
}

// ---------------------------------------------------------------------------
// What next
// ---------------------------------------------------------------------------

export type NextAction =
  | { kind: 'evaluate' }
  | { kind: 'makeRoom'; over: number }
  | { kind: 'breed'; plan: GenerationPlan }
  | { kind: 'advance'; months?: number }
  | { kind: 'outcross'; why: string }
  | { kind: 'closeGeneration' }
  | { kind: 'wait' };

export interface NextStep {
  title: string;
  detail: string;
  action: NextAction;
  buttonLabel: string;
}

export function nextStep(project: Project): NextStep {
  const dogs = activeDogs(project);
  const over = kennelCount(project) - project.kennelCapacity;
  const undecided = dogs.filter((d) => d.litterId && !d.retention && ageMonths(d, project.month) >= 2);
  const babies = dogs.filter((d) => d.litterId && !d.retention && ageMonths(d, project.month) < 2);
  const pregnancies = project.pregnancies.length;

  if (undecided.length > 0) {
    return {
      title: `Sort the litter — ${undecided.length} ${undecided.length === 1 ? 'puppy' : 'puppies'} waiting on you`,
      detail: 'Decide who stays and who goes to a pet home. There is a Sort for me button if you would rather be told.',
      action: { kind: 'evaluate' },
      buttonLabel: 'Go to the puppies',
    };
  }
  // A brand-new litter takes you over capacity every time; that is normal.
  // Let them reach eight weeks before anyone is asked to leave.
  if (over > 0 && over > babies.length) {
    return {
      title: `Make room — ${over} over capacity`,
      detail: 'Nobody can be bred while the kennel is over capacity. Place your least useful dogs in pet homes.',
      action: { kind: 'makeRoom', over },
      buttonLabel: 'Go to the kennel',
    };
  }
  if (pregnancies > 0 || babies.length > 0) {
    const due = pregnancies > 0 ? Math.max(1, Math.min(...project.pregnancies.map((p) => p.dueMonth - project.month))) : 0;
    const grow = babies.length > 0 ? Math.max(1, 2 - Math.min(...babies.map((d) => ageMonths(d, project.month)))) : 0;
    const months = pregnancies > 0 ? due : grow;
    return {
      title: pregnancies > 0 ? 'Wait for the puppies' : 'Let the puppies grow',
      detail: pregnancies > 0 ? `${pregnancies} litter${pregnancies === 1 ? ' is' : 's are'} on the way.` : 'They are too young to judge. At eight weeks their estimates firm up.',
      action: { kind: 'advance', months },
      buttonLabel: `Advance ${months} month${months === 1 ? '' : 's'}`,
    };
  }

  const plan = planGeneration(project);
  const snapshot = takeSnapshot(project);
  const breeders = breedingPopulation(project);
  if (plan.pairings.length > 0) {
    const p = plan.pairings[0];
    return {
      title: plan.pairings.length === 1 ? `Breed ${p.dam.name} to ${p.sire.name}` : `Breed this season — ${plan.pairings.length} pairings ready`,
      detail: p.reason,
      action: { kind: 'breed', plan },
      buttonLabel: plan.pairings.length === 1 ? 'Breed them' : 'See the plan',
    };
  }
  if (breeders.length < 3 || snapshot.familyLines <= 1 || snapshot.averageCoi > 0.12) {
    const why = breeders.length < 3 ? 'Too few breeding adults.' : snapshot.familyLines <= 1 ? 'Everyone left is related.' : 'Inbreeding is climbing.';
    return {
      title: 'Bring in an outside dog',
      detail: `${why} Fresh blood resets relatedness and gives you mates again.`,
      action: { kind: 'outcross', why },
      buttonLabel: 'Find an outside dog',
    };
  }
  if (project.litters.some((l) => l.generation === project.generation)) {
    return {
      title: `Close out generation ${project.generation}`,
      detail: 'Every puppy is decided and nobody is in whelp. Record the generation and see what changed.',
      action: { kind: 'closeGeneration' },
      buttonLabel: 'Close out the generation',
    };
  }
  return {
    title: 'Move time on',
    detail: 'Nothing is ready to breed yet — puppies are growing up or mothers are resting.',
    action: { kind: 'advance' },
    buttonLabel: 'Advance time',
  };
}
