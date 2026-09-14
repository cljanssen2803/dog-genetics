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
import { colourGenesFor, scoreDog } from '../engine/standard';
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
  // Rank by what the puppies would pass on as much as by how they would look:
  // a designer cross is won by carriers, and the phenotype average hides them.
  // A sire that has already fathered a lot, or already sits under most of the
  // kennel, is marked down so the gene pool does not narrow to one stud.
  const worth = (o: { sire: Dog; preview: PairingPreview }) =>
    0.5 * o.preview.meanScore +
    0.5 * o.preview.meanBreedingValue -
    Math.min(8, o.sire.littersProduced * 1.5) -
    Math.max(0, o.preview.sireInfluence - 0.2) * 40 -
    o.preview.coi * 60;
  options.sort((a, b) => worth(b) - worth(a));

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
      reason: `Best mate for ${o.dam.name}: average puppy ${Math.round(o.preview.meanScore)}, passing on ${Math.round(o.preview.meanBreedingValue)}, inbreeding ${(o.preview.coi * 100).toFixed(1)}%, ${shiftWords(o.preview)}.${risky}`,
    });
  }
  for (const dam of dams) {
    if (!damsDone.has(dam.id)) skipped.push({ dog: dam, why: 'every available male is too closely related' });
  }

  // Never breed backwards: a litter whose puppies would pass on less than
  // the kennel already has is space wasted, however nice the dam. The single
  // best pairing is always allowed, so a weak kennel can still move.
  // The bar is the better half of the kennel, not the whole of it — the
  // whole includes the dogs you are trying to breed past.
  const adultBvs = breedingPopulation(project).map((d) => scoreDog(d, project.standard, true).total).sort((a, b) => b - a);
  const topHalf = adultBvs.slice(0, Math.max(1, Math.ceil(adultBvs.length / 2)));
  const adultBv = topHalf.length ? topHalf.reduce((t, v) => t + v, 0) / topHalf.length : 0;
  const forward = chosen.filter((p, i) => i === 0 || p.preview.meanBreedingValue >= adultBv - 1);
  for (const p of chosen) {
    if (!forward.includes(p)) skipped.push({ dog: p.dam, why: `her best litter would pass on less (${Math.round(p.preview.meanBreedingValue)}) than the kennel already has (${Math.round(adultBv)})` });
  }

  // Only as many litters as there is room to raise.
  const spaceLeft = project.kennelCapacity - kennelCount(project);
  let expected = 0;
  const fitting: PlannedPairing[] = [];
  for (const p of forward) {
    if (fitting.length > 0 && expected + p.preview.expectedLitterSize > spaceLeft + 10) {
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
  const puppies = puppiesOf(project, litter.id).filter((p) => p.status === 'kennel' && (!p.retention || p.retention === 'wait'));
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
  // Two from a good litter as a floor, more when the kennel has room to
  // raise them: one extra keeper for every four free spaces.
  // Selection only works if you keep FEW. Two from a litter when it stands
  // alone; one when another litter of the same season is competing for the
  // same spaces — the best of each, and the kennel stays sharp.
  const concurrent = project.litters.filter(
    (l) => l.id !== litter.id && Math.abs(l.bornMonth - litter.bornMonth) <= 3 && puppiesOf(project, l.id).some((d) => d.status === 'kennel' && !d.retention),
  ).length;
  const keepBudget = Math.max(1, Math.min(concurrent > 0 ? 1 : 2, puppies.length, space + puppies.length));

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
    // "Wait" only makes sense for a young litter with room to keep it: a close
    // call under four months old, when the kennel is not already bursting.
    if (age < 4 && space >= 0 && better >= -6 && kept < keepBudget + 1) {
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

export function missingColourGenes(project: Project): { locus: string; allele: string; label: string }[] {
  const goal = project.standard.colorGoal;
  if (!goal || goal.priority < 3) return [];
  const text = goal.text.toLowerCase();
  const needed = colourGenesFor(text);
  const dogs = activeDogs(project);
  const missing: { locus: string; allele: string; label: string }[] = [];
  for (const g of needed) {
    if (missing.some((m) => m.locus === g.locus && m.allele === g.allele)) continue;
    const anyone = dogs.some((d) => d.genotype[g.locus]?.includes(g.allele));
    if (!anyone) missing.push({ locus: g.locus, allele: g.allele, label: g.label });
  }
  return missing;
}

export type NextAction =
  | { kind: 'evaluate' }
  | { kind: 'makeRoom'; over: number }
  | { kind: 'breed'; plan: GenerationPlan }
  | { kind: 'advance'; months?: number }
  | { kind: 'outcross'; why: string; carrying?: { locus: string; allele: string } }
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
  // Puppies still needing a decision: never decided and at least eight
  // weeks old, or parked on "wait" and now four months old.
  const undecided = dogs.filter((d) => {
    if (!d.litterId) return false;
    const age = ageMonths(d, project.month);
    return (!d.retention && age >= 2) || (d.retention === 'wait' && age >= 4);
  });
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
    const inWhelp = new Set(project.pregnancies.map((p) => p.damId));
    const candidates = dogs
      .filter((d) => ageMonths(d, project.month) >= 4 && !inWhelp.has(d.id))
      .sort((a, b) => scoreDog(a, project.standard, true).total - scoreDog(b, project.standard, true).total)
      .slice(0, over)
      .map((d) => d.name);
    return {
      title: `Make room — ${over} over capacity`,
      detail: `Nobody can be bred while the kennel is over capacity. Lowest breeding value right now: ${candidates.join(', ')}. Place ${over === 1 ? 'one' : over} in a pet home from the dog's Decide tab.`,
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

  // A generation is a chapter the player closes. Prompt for it once the
  // chapter has some substance: two litters born and sorted, or one litter
  // and a year gone by.
  const last = project.history.length ? project.history[project.history.length - 1].month : -1;
  const sinceLast = project.litters.filter((l) => l.bornMonth > last);
  const chapterStart = sinceLast.length ? Math.min(...sinceLast.map((l) => l.bornMonth)) : project.month;
  const ripe = sinceLast.length >= 2 || (sinceLast.length === 1 && project.month - chapterStart >= 12);
  if (ripe) {
    return {
      title: `Close out generation ${project.generation}`,
      detail: `${sinceLast.length} litter${sinceLast.length === 1 ? '' : 's'} born and sorted since your last report. Record the generation to see what changed and what to aim at next.`,
      action: { kind: 'closeGeneration' },
      buttonLabel: 'Close out the generation',
    };
  }

  // A colour goal nobody in the kennel can produce: go and find a carrier.
  const missing = missingColourGenes(project);
  if (missing.length > 0) {
    return {
      title: `Find a carrier of ${missing[0].label}`,
      detail: `Your standard wants ${project.standard.colorGoal?.text}, and no dog in the kennel carries ${missing.map((m) => m.label).join(' or ')}. Search for an outside dog of your breed that must carry it.`,
      action: { kind: 'outcross', why: `No carrier of ${missing[0].label}.`, carrying: { locus: missing[0].locus, allele: missing[0].allele } },
      buttonLabel: 'Find a carrier',
    };
  }

  const plan = planGeneration(project);
  const snapshot = takeSnapshot(project);
  const breeders = breedingPopulation(project);

  // Fresh blood before the pool closes up, not after: two family lines left,
  // or inbreeding creeping past 8%, and no outsider in the last two years.
  const recentOutsider = dogs.some((d) =>
    (d.events ?? []).some((e) => e.kind === 'arrived' && e.month > 0 && project.month - e.month < 24),
  );
  const narrowing = snapshot.familyLines <= 2 || snapshot.averageCoi > 0.08;
  if (narrowing && !recentOutsider && breeders.length >= 3) {
    return {
      title: 'Bring in an outside dog',
      detail: snapshot.familyLines <= 2 ? 'Only a couple of family lines are left. An unrelated dog now keeps your options open.' : `Inbreeding is at ${(snapshot.averageCoi * 100).toFixed(0)}% and climbing. An unrelated dog resets it.`,
      action: { kind: 'outcross', why: 'The gene pool is narrowing.' },
      buttonLabel: 'Find an outside dog',
    };
  }

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
  return {
    title: 'Move time on',
    detail: 'Nothing is ready to breed yet — puppies are growing up or mothers are resting.',
    action: { kind: 'advance' },
    buttonLabel: 'Advance time',
  };
}
