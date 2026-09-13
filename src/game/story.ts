/**
 * STORIES AND MILESTONES
 *
 * The research on what makes sandbox games satisfying keeps landing on the
 * same thing: players enjoy games where they care about someone in them. A
 * dog that is a portrait and a stat block is hard to care about. A dog with a
 * life — born to these two, kept for that reason, won there, went on to this —
 * is not.
 *
 * This file turns the events recorded on each dog into prose, and watches the
 * project for moments worth marking properly rather than as a line in a log.
 */

import { type Dog, ageMonths, formatAge } from '../engine/dog';
import { quirkText, visibleQuirks } from '../engine/quirks';
import { scoreDog } from '../engine/standard';
import {
  type Milestone,
  type Project,
  activeDogs,
  descendantsOf,
  takeSnapshot,
} from './project';
import { assessEstablishment } from './analytics';

// ---------------------------------------------------------------------------
// A dog's life, as prose
// ---------------------------------------------------------------------------

export interface StoryParagraph {
  /** Year the paragraph refers to, for a small margin label. */
  year: string;
  text: string;
}

export function lifeStory(dog: Dog, project: Project): StoryParagraph[] {
  const events = (dog.events ?? []).slice().sort((a, b) => a.month - b.month);
  const out: StoryParagraph[] = [];
  const he = dog.sex === 'M' ? 'he' : 'she';
  const He = dog.sex === 'M' ? 'He' : 'She';
  const his = dog.sex === 'M' ? 'his' : 'her';

  // Group events by month so a busy month reads as one paragraph.
  const byMonth = new Map<number, string[]>();
  for (const e of events) {
    const list = byMonth.get(e.month) ?? [];
    list.push(e.text);
    byMonth.set(e.month, list);
  }

  for (const [month, texts] of byMonth) {
    out.push({ year: `Year ${(month / 12).toFixed(1)}`, text: texts.join(' ') });
  }

  // The present, if the dog is still with us.
  if (dog.status === 'kennel') {
    const age = ageMonths(dog, project.month);
    const score = scoreDog(dog, project.standard);
    const kids = descendantsOf(project, dog.id).length;
    const bits: string[] = [];
    if (dog.breedingRetired) bits.push(`${He} is retired now, ${formatAge(age)} old, and has earned the quiet.`);
    else if (age < 12) bits.push(`${He} is ${formatAge(age)} old and still growing into ${his} own shape.`);
    else bits.push(`${He} is ${formatAge(age)} old and in ${his} prime.`);
    if (kids > 0) bits.push(`${kids} of the dogs in the kennel today descend from ${dog.sex === 'M' ? 'him' : 'her'}.`);
    if (score.meetsStandard) bits.push(`${He} meets the ${project.standard.name} standard.`);
    if (project.heartDogId === dog.id) bits.push(`${He} is the heart of this whole project.`);
    out.push({ year: 'Now', text: bits.join(' ') });
  }

  if (out.length === 0) {
    out.push({ year: 'Now', text: `${dog.name} came to the kennel before anyone was keeping notes. What ${he} does next is up to you.` });
  }

  return out;
}

/** The habits a dog has shown so far, as full sentences. */
export function quirkLines(dog: Dog, project: Project): string[] {
  const age = ageMonths(dog, project.month);
  return visibleQuirks(dog.genotype, age).map((q) => quirkText(q, dog.name, dog.sex));
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

/**
 * Look for moments that deserve a proper card. Returns only the ones that are
 * new since the last check, and records them so they are never shown twice.
 */
export function checkMilestones(project: Project): Milestone[] {
  project.milestones ??= [];
  const have = new Set(project.milestones.map((m) => m.key));
  const fresh: Milestone[] = [];
  const add = (key: string, title: string, text: string, dogIds: string[] = []) => {
    if (have.has(key)) return;
    const m: Milestone = { key, month: project.month, title, text, dogIds };
    project.milestones!.push(m);
    fresh.push(m);
  };

  const dogs = Object.values(project.dogs);
  const bred = dogs.filter((d) => d.sireId && d.damId);

  // First litter.
  if (project.litters.length >= 1) {
    const first = project.litters[project.litters.length - 1];
    add('firstLitter', 'The first litter', `${project.dogs[first.damId]?.name ?? 'A female'} and ${project.dogs[first.sireId]?.name ?? 'a male'} produced the first puppies of the ${project.standard.name}. Everything after this descends from a decision you made.`, first.puppyIds.slice(0, 4));
  }

  // First home-bred dog to meet the standard.
  const firstMeets = bred.find((d) => d.status === 'kennel' && ageMonths(d, project.month) >= 12 && scoreDog(d, project.standard).meetsStandard);
  if (firstMeets) {
    add('firstMeets', 'The first one that fits', `${firstMeets.name} is the first dog you bred yourself that meets the ${project.standard.name} standard. Until now the standard was a description. Now it is a dog.`, [firstMeets.id]);
  }

  // Standard compliance thresholds.
  const snap = takeSnapshot(project);
  if (snap.populationSize >= 4) {
    for (const pct of [25, 50, 75]) {
      if (snap.percentMeetingStandard >= pct) {
        add(`meets${pct}`, `${pct}% of the kennel meets the standard`, pct === 25
          ? 'A quarter of your breeding dogs are now what you set out to make. The rest are what you have to work with.'
          : pct === 50
            ? 'Half your breeding population fits the standard. This is the point where the breed starts to feel real.'
            : 'Three in four of your breeding dogs meet the standard. You are no longer chasing it — you are maintaining it.');
      }
    }
  }

  // First champion.
  const firstChampion = dogs.find((d) => d.titles && d.titles.length > 0);
  if (firstChampion) {
    add('firstChampion', 'The first champion', `${firstChampion.name} is the first ${project.standard.name} to earn a title. Someone outside your kennel looked at a dog you made and agreed.`, [firstChampion.id]);
  }

  // First rare find.
  if (project.discoveries.length > 0) {
    const d = project.discoveries[0];
    add('firstRare', 'The first rare find', `${d.dogName} turned out to be ${d.title.toLowerCase()}. ${d.blurb}`, [d.dogId]);
  }

  // Five generations.
  if (project.generation >= 5) add('gen5', 'Five generations', 'Five generations of the ' + project.standard.name + '. The founders are mostly gone; what remains is what you chose to keep.');
  if (project.generation >= 10) add('gen10', 'Ten generations', 'Ten generations. Most breeds that exist today did not get this far with this much care.');

  // Established.
  const status = assessEstablishment(project);
  if (status.established) {
    const best = activeDogs(project)
      .slice()
      .sort((a, b) => scoreDog(b, project.standard).total - scoreDog(a, project.standard).total)
      .slice(0, 4);
    add('established', `The ${project.standard.name} is a breed`, 'Consistent, healthy, and with enough genetic room to keep going. You did the thing the game is about.', best.map((d) => d.id));
  }

  // A dog with many descendants.
  for (const d of dogs) {
    if (d.offspringIds.length === 0) continue;
    const count = descendantsOf(project, d.id).length;
    if (count >= 12) {
      add(`patriarch_${d.id}`, `${d.name}'s line`, `${count} of the dogs in your kennel descend from ${d.name}. That is a foundation dog in every sense.`, [d.id]);
      break;
    }
  }

  return fresh;
}

// ---------------------------------------------------------------------------
// The retrospective
// ---------------------------------------------------------------------------

export interface Retrospective {
  founders: Dog[];
  bestNow: Dog[];
  then: { score: number; meets: number; weight: number } | null;
  now: { score: number; meets: number; weight: number };
  years: number;
  generations: number;
  everLived: number;
  champions: number;
}

export function retrospective(project: Project): Retrospective {
  const founders = Object.values(project.dogs)
    .filter((d) => !d.sireId && !d.damId && d.birthMonth <= 0)
    .slice(0, 4);
  const bestNow = activeDogs(project)
    .filter((d) => ageMonths(d, project.month) >= 12)
    .sort((a, b) => scoreDog(b, project.standard).total - scoreDog(a, project.standard).total)
    .slice(0, 4);

  const first = project.history[0];
  const snap = takeSnapshot(project);

  return {
    founders,
    bestNow,
    then: first
      ? { score: first.averageScore, meets: first.percentMeetingStandard, weight: first.averageWeight }
      : null,
    now: { score: snap.averageScore, meets: snap.percentMeetingStandard, weight: snap.averageWeight },
    years: project.month / 12,
    generations: project.generation,
    everLived: Object.keys(project.dogs).length,
    champions: Object.values(project.dogs).filter((d) => d.titles && d.titles.length > 0).length,
  };
}
