/**
 * GENERATION REPORTS AND POPULATION ANALYTICS
 *
 * This is what turns a series of individual matings into a campaign. After
 * each generation the game compares the population with where it was, says
 * plainly what improved and what slipped, and suggests where to aim next.
 *
 * All recommendations are advisory. The game never blocks a decision.
 */

import { LOCUS_BY_KEY } from '../engine/loci';
import { TRAITS, type PolyTrait } from '../engine/traits';
import {
  type GenerationSnapshot,
  type Project,
  activeDogs,
  ancestorInfluenceFor,
  breedingPopulation,
  lookupDog,
  takeSnapshot,
} from './project';
import { genomeContribution } from '../engine/pedigree';

export interface ReportLine {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

export interface GenerationReport {
  generation: number;
  headline: string;
  lines: ReportLine[];
  suggestions: string[];
  snapshot: GenerationSnapshot;
  previous?: GenerationSnapshot;
}

function delta(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === null) return null;
  return current - previous;
}

export function buildGenerationReport(project: Project): GenerationReport {
  const snapshot = takeSnapshot(project);
  const previous = project.history[project.history.length - 1];
  const lines: ReportLine[] = [];
  const suggestions: string[] = [];

  // --- Standard compliance ------------------------------------------------
  const meetDelta = delta(snapshot.percentMeetingStandard, previous?.percentMeetingStandard);
  if (meetDelta === null) {
    lines.push({
      text: `${Math.round(snapshot.percentMeetingStandard)}% of your adult dogs currently meet the ${project.standard.name} standard. This is your starting point.`,
      tone: 'neutral',
    });
  } else {
    lines.push({
      text: `Standard compliance ${meetDelta >= 0 ? 'rose' : 'fell'} from ${Math.round(
        previous!.percentMeetingStandard,
      )}% to ${Math.round(snapshot.percentMeetingStandard)}%.`,
      tone: meetDelta >= 0 ? 'good' : 'bad',
    });
  }

  const scoreDelta = delta(snapshot.averageScore, previous?.averageScore);
  if (scoreDelta !== null && Math.abs(scoreDelta) >= 0.7) {
    lines.push({
      text: `Average project score ${scoreDelta > 0 ? 'improved' : 'dropped'} by ${Math.abs(scoreDelta).toFixed(
        1,
      )} points to ${Math.round(snapshot.averageScore)}.`,
      tone: scoreDelta > 0 ? 'good' : 'bad',
    });
  }

  // --- Individual traits the player actually cares about -------------------
  const watched = (Object.keys(project.standard.traitGoals) as PolyTrait[]).filter(
    (t) => (project.standard.traitGoals[t]?.priority ?? 0) >= 2,
  );

  for (const trait of watched) {
    const now = snapshot.traitAverages[trait];
    const before = previous?.traitAverages?.[trait];
    if (now === undefined || before === undefined) continue;
    const change = now - before;
    const def = TRAITS[trait];

    if (def.logScale) {
      const pct = (Math.exp(now) / Math.exp(before) - 1) * 100;
      if (Math.abs(pct) >= 3) {
        lines.push({
          text: `Average adult size ${pct > 0 ? 'increased' : 'decreased'} by ${Math.abs(pct).toFixed(0)}%, now ${snapshot.averageWeight.toFixed(
            1,
          )} lb.`,
          tone: 'neutral',
        });
      }
      continue;
    }

    if (Math.abs(change) >= 2) {
      lines.push({
        text: `Average ${def.label.toLowerCase()} ${change > 0 ? 'rose' : 'fell'} ${Math.abs(change).toFixed(0)} points to ${Math.round(
          now,
        )}.`,
        tone: 'neutral',
      });
    }
  }

  // --- Disease carrier frequencies ----------------------------------------
  for (const [locusKey, freq] of Object.entries(snapshot.carrierFrequency)) {
    const locus = LOCUS_BY_KEY[locusKey];
    if (!locus || locus.category !== 'disease') continue;
    const before = previous?.carrierFrequency?.[locusKey];
    if (before === undefined) {
      if (freq >= 0.15) {
        lines.push({
          text: `${locus.name} carriers sit at ${Math.round(freq * 100)}% of the breeding population.`,
          tone: freq > 0.3 ? 'bad' : 'neutral',
        });
      }
      continue;
    }
    const change = freq - before;
    if (Math.abs(change) >= 0.04) {
      lines.push({
        text: `${locus.name} carrier frequency ${change < 0 ? 'fell' : 'rose'} from ${Math.round(
          before * 100,
        )}% to ${Math.round(freq * 100)}%.`,
        tone: change < 0 ? 'good' : 'bad',
      });
    }
  }

  // --- Diversity -----------------------------------------------------------
  const coiDelta = delta(snapshot.averageCoi, previous?.averageCoi);
  if (coiDelta !== null && Math.abs(coiDelta) >= 0.005) {
    lines.push({
      text: `Average inbreeding ${coiDelta > 0 ? 'rose' : 'fell'} from ${(previous!.averageCoi * 100).toFixed(
        1,
      )}% to ${(snapshot.averageCoi * 100).toFixed(1)}%.`,
      tone: coiDelta > 0 ? 'bad' : 'good',
    });
  }

  // Popular sire check.
  const population = breedingPopulation(project);
  const contributions = genomeContribution(population, lookupDog(project));
  let topAncestor: { name: string; share: number } | null = null;
  for (const [id, share] of contributions) {
    const dog = project.dogs[id];
    if (!dog) continue;
    if (!topAncestor || share > topAncestor.share) topAncestor = { name: dog.name, share };
  }

  if (topAncestor && topAncestor.share > 0.22) {
    lines.push({
      text: `Genetic diversity is narrowing: the ${topAncestor.name} line now accounts for ${Math.round(
        topAncestor.share * 100,
      )}% of your breeding population's ancestry.`,
      tone: 'bad',
    });
  }

  if (snapshot.familyLines <= 2 && population.length >= 4) {
    lines.push({
      text: `Only ${snapshot.familyLines} genuinely separate family line${
        snapshot.familyLines === 1 ? '' : 's'
      } remain${snapshot.familyLines === 1 ? 's' : ''} in your kennel.`,
      tone: 'bad',
    });
  }

  if (snapshot.averageLifespan !== null) {
    lines.push({
      text: `Dogs in this project are living an average of ${snapshot.averageLifespan.toFixed(1)} years.`,
      tone: 'neutral',
    });
  }

  // --- Suggestions ---------------------------------------------------------
  if (snapshot.averageCoi > 0.08 || snapshot.familyLines <= 2 || (topAncestor?.share ?? 0) > 0.3) {
    suggestions.push(
      'Bring in an outside dog. Your gene pool is closing up, and that gets harder to fix the longer you leave it.',
    );
  }

  const worstCarrier = Object.entries(snapshot.carrierFrequency)
    .filter(([k]) => LOCUS_BY_KEY[k]?.category === 'disease')
    .sort((a, b) => b[1] - a[1])[0];
  if (worstCarrier && worstCarrier[1] > 0.3) {
    suggestions.push(
      `${LOCUS_BY_KEY[worstCarrier[0]].name} carriers are at ${Math.round(
        worstCarrier[1] * 100,
      )}%. Start pairing carriers only to confirmed-clear dogs, and keep the clear puppies.`,
    );
  }

  // Which goal is furthest from being met?
  let worstGoal: { label: string; gap: number } | null = null;
  for (const trait of watched) {
    const goal = project.standard.traitGoals[trait];
    const now = snapshot.traitAverages[trait];
    if (!goal || now === undefined) continue;
    const def = TRAITS[trait];
    if (def.logScale) continue;
    const target =
      goal.mode === 'higher' ? 88 : goal.mode === 'lower' ? 12 : ((goal.preferredLow ?? 50) + (goal.preferredHigh ?? 50)) / 2;
    const gap = Math.abs(now - target) * (goal.priority / 4);
    if (!worstGoal || gap > worstGoal.gap) worstGoal = { label: def.label, gap };
  }
  if (worstGoal && worstGoal.gap > 8) {
    suggestions.push(`${worstGoal.label} is the goal you are furthest from. Make it the priority next generation.`);
  }

  if (population.length < 4) {
    suggestions.push('Your breeding population is very small. Keep more puppies, or bring in outside dogs, before you lose options entirely.');
  }

  if (suggestions.length === 0) {
    suggestions.push('Nothing urgent. Keep selecting on your highest-priority goals and watch that inbreeding does not creep up.');
  }

  const headline =
    meetDelta === null
      ? `Generation ${snapshot.generation} established.`
      : meetDelta > 2
        ? `Generation ${snapshot.generation} made real progress.`
        : meetDelta < -2
          ? `Generation ${snapshot.generation} lost ground.`
          : `Generation ${snapshot.generation} held steady.`;

  return { generation: snapshot.generation, headline, lines, suggestions, snapshot, previous };
}

// ---------------------------------------------------------------------------
// Breed establishment
// ---------------------------------------------------------------------------

export interface EstablishmentCriterion {
  label: string;
  met: boolean;
  detail: string;
}

export interface EstablishmentStatus {
  established: boolean;
  /** 0-100, how close the project is to a stable breed. */
  standardisation: number;
  criteria: EstablishmentCriterion[];
}

/**
 * Is this a breed yet? One outstanding dog proves nothing — what matters is a
 * population that reliably reproduces itself without falling apart.
 */
export function assessEstablishment(project: Project): EstablishmentStatus {
  const snapshot = takeSnapshot(project);
  const population = breedingPopulation(project);

  const affected = activeDogs(project).filter((d) =>
    Object.entries(d.genotype).some(
      ([k, pair]) => LOCUS_BY_KEY[k]?.category === 'disease' && pair[0] === 'm' && pair[1] === 'm',
    ),
  ).length;
  const affectedRate = activeDogs(project).length ? affected / activeDogs(project).length : 0;

  // Set to be a genuine achievement that a thoughtful player reaches somewhere
  // around generation ten, rather than a perfectionist's checklist that almost
  // nobody completes. Reaching it is not the end — the project continues.
  const criteria: EstablishmentCriterion[] = [
    {
      label: 'At least seven generations bred',
      met: project.generation >= 7,
      detail: `Currently on generation ${project.generation}.`,
    },
    {
      label: '72% of adults meet your standard',
      met: snapshot.percentMeetingStandard >= 72,
      detail: `Currently ${Math.round(snapshot.percentMeetingStandard)}%.`,
    },
    {
      label: 'Average inbreeding below 13%',
      met: snapshot.averageCoi < 0.13,
      detail: `Currently ${(snapshot.averageCoi * 100).toFixed(1)}%.`,
    },
    {
      label: 'At least two separate family lines',
      met: snapshot.familyLines >= 2,
      detail: `Currently ${snapshot.familyLines}.`,
    },
    {
      label: 'At least six breeding adults',
      met: population.length >= 6,
      detail: `Currently ${population.length}.`,
    },
    {
      label: 'Serious inherited disease under 8%',
      met: affectedRate < 0.08,
      detail: `Currently ${Math.round(affectedRate * 100)}% of your dogs are affected by something.`,
    },
    {
      label: 'Effective founder number of three or more',
      met: snapshot.effectiveFounders >= 3,
      detail: `Currently ${snapshot.effectiveFounders.toFixed(1)}.`,
    },
  ];

  const met = criteria.filter((c) => c.met).length;
  return {
    established: met === criteria.length,
    standardisation: Math.round((met / criteria.length) * 100),
    criteria,
  };
}

/**
 * A quick health check the player can see at any time, without waiting for a
 * generation to end.
 */
export function populationWarnings(project: Project): string[] {
  const warnings: string[] = [];
  const population = breedingPopulation(project);
  if (population.length === 0) return ['You have no dogs old enough to breed.'];

  const males = population.filter((d) => d.sex === 'M').length;
  const females = population.filter((d) => d.sex === 'F').length;
  if (males === 0) warnings.push('You have no breeding males. Find an outside stud before your females age out.');
  if (females === 0) warnings.push('You have no breeding females. Without one, the project cannot continue.');

  for (const dog of population) {
    const influence = ancestorInfluenceFor(project, dog.id);
    if (influence > 0.38 && dog.offspringIds.length > 0) {
      warnings.push(
        `${Math.round(influence * 100)}% of your breeding population already descends from ${dog.name}. Continued use of this line will reduce your future mating options.`,
      );
    }
  }

  const snapshot = takeSnapshot(project);
  if (snapshot.averageCoi > 0.12) {
    warnings.push(
      `Average inbreeding across your breeding dogs is ${(snapshot.averageCoi * 100).toFixed(
        1,
      )}%. Fertility and lifespan are already being affected.`,
    );
  }

  return warnings;
}
