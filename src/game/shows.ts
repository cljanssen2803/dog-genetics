/**
 * DOG SHOWS
 *
 * The obvious problem with showing dogs in this game is that every player
 * invents their own breed, so there is no shared yardstick to judge against.
 *
 * Real dog shows solve this already. They do not compare breeds to each other;
 * they compare each dog to ITS OWN breed's written standard and ask "how good
 * an example of this breed is this?" So your dog is judged against your
 * standard, and your rivals — dogs from established breeds, bred by other
 * people — are judged against theirs. Everyone answers the same question about
 * a different target.
 *
 * What stops it being "the highest score always wins":
 *
 *   - Judges have preferences. One rewards type, another soundness, another a
 *     dog that shows itself well. Your best dog on paper will not always win.
 *   - The ring tests things your kennel does not. A beautiful dog that cannot
 *     cope with crowds and a stranger going over it loses to a plainer, steadier
 *     one. This finally gives handling tolerance and emotional stability teeth.
 *   - Dogs compete inside their age class, so a promising youngster is not
 *     thrown against finished adults.
 */

import { type Dog, ageMonths } from '../engine/dog';
import { scoreDog } from '../engine/standard';
import { BREEDS } from '../engine/breeds';
import { type Project, addLog, commitRng, rngFor } from './project';

export type ShowClass = 'puppy' | 'junior' | 'open' | 'veteran';

export const CLASS_LABEL: Record<ShowClass, string> = {
  puppy: 'Puppy',
  junior: 'Junior',
  open: 'Open',
  veteran: 'Veteran',
};

/** Which class a dog competes in, by age. */
export function showClass(dog: Dog, month: number): ShowClass | null {
  const age = ageMonths(dog, month);
  if (age < 6) return null; // too young to be shown at all
  if (age < 12) return 'puppy';
  if (age < 24) return 'junior';
  if (age < 84) return 'open';
  return 'veteran';
}

export interface JudgeStyle {
  name: string;
  /** What this judge rewards, in plain language. */
  preference: string;
  weights: { type: number; soundness: number; showmanship: number };
}

const JUDGES: JudgeStyle[] = [
  {
    name: 'a traditionalist',
    preference: 'rewards breed type above all — does this dog look like what it is meant to be?',
    weights: { type: 0.72, soundness: 0.16, showmanship: 0.12 },
  },
  {
    name: 'a working-dog judge',
    preference: 'rewards soundness and structure — could this dog actually do a day’s work?',
    weights: { type: 0.4, soundness: 0.45, showmanship: 0.15 },
  },
  {
    name: 'a showman',
    preference: 'rewards presence and ring manners — a dog that shows itself off',
    weights: { type: 0.45, soundness: 0.15, showmanship: 0.4 },
  },
  {
    name: 'an all-rounder',
    preference: 'weighs everything fairly evenly',
    weights: { type: 0.5, soundness: 0.28, showmanship: 0.22 },
  },
];

export interface Entrant {
  name: string;
  breeder: string;
  /** How well the dog exemplifies its own breed. */
  type: number;
  soundness: number;
  showmanship: number;
  total: number;
  isPlayer: boolean;
}

export interface ShowResult {
  dogId: string;
  dogName: string;
  showClass: ShowClass;
  judge: JudgeStyle;
  entrants: Entrant[];
  /** 1 for first, 0 for unplaced. */
  placement: number;
  points: number;
  bestInShow: boolean;
  newTitle?: string;
  /** The judge's written critique of the player's dog. */
  critique: string;
}

/**
 * How well a dog handles being shown: standing still while a stranger goes over
 * it, in a noisy hall, surrounded by other dogs. Almost entirely temperament.
 */
function showmanshipOf(dog: Dog): number {
  return (
    dog.observed.handling * 0.4 +
    dog.observed.stability * 0.35 +
    dog.observed.sociability * 0.15 +
    (100 - dog.observed.vocality) * 0.1
  );
}

function soundnessOf(dog: Dog): number {
  return dog.observed.structure * 0.75 + dog.observed.longevity * 0.25;
}

/** Points for each placement. */
const PLACEMENT_POINTS = [0, 5, 3, 2, 1];

const TITLES: { points: number; title: string; label: string }[] = [
  { points: 40, title: 'Gr.Ch.', label: 'Grand Champion' },
  { points: 15, title: 'Ch.', label: 'Champion' },
];

export function titleFor(points: number): { title: string; label: string } | null {
  for (const entry of TITLES) {
    if (points >= entry.points) return { title: entry.title, label: entry.label };
  }
  return null;
}

/** How long a dog must wait between shows. */
export const SHOW_COOLDOWN_MONTHS = 3;

export function canShow(
  project: Project,
  dog: Dog,
): { ok: boolean; reason?: string; showClass?: ShowClass } {
  if (dog.status !== 'kennel') return { ok: false, reason: 'Not in your kennel' };
  const cls = showClass(dog, project.month);
  if (!cls) return { ok: false, reason: 'Too young to show — six months minimum' };

  const last = project.lastShown?.[dog.id];
  if (last !== undefined && project.month - last < SHOW_COOLDOWN_MONTHS) {
    return {
      ok: false,
      reason: `Shown recently — ${SHOW_COOLDOWN_MONTHS - (project.month - last)} months until next eligible`,
    };
  }
  return { ok: true, showClass: cls };
}

/**
 * Run a show. The player's dog is judged against their own standard; the rivals
 * are good examples of established breeds, judged against theirs.
 */
export function runShow(project: Project, dogId: string): ShowResult | null {
  const dog = project.dogs[dogId];
  if (!dog) return null;
  const eligibility = canShow(project, dog);
  if (!eligibility.ok || !eligibility.showClass) return null;

  const rng = rngFor(project);
  const judge = rng.pick(JUDGES);

  // --- The player's dog ----------------------------------------------------
  const type = scoreDog(dog, project.standard).total;
  const soundness = soundnessOf(dog);
  const showmanship = showmanshipOf(dog);

  // Young dogs are marked down a little; they are not finished animals yet.
  const maturity = eligibility.showClass === 'puppy' ? 0.9 : eligibility.showClass === 'junior' ? 0.96 : 1;

  const playerTotal =
    (type * judge.weights.type +
      soundness * judge.weights.soundness +
      showmanship * judge.weights.showmanship) *
      maturity +
    rng.normal(0, 4); // the judge is a person, not a formula

  const entrants: Entrant[] = [
    {
      name: dog.name,
      breeder: 'You',
      type,
      soundness,
      showmanship,
      total: playerTotal,
      isPlayer: true,
    },
  ];

  // --- The competition -----------------------------------------------------
  // Rivals come from established breeds, which by definition breed fairly true,
  // so their "type" scores are decent. Their soundness and ring manners come
  // from the breed's real temperament and structure.
  const rivalCount = rng.int(4, 6);
  for (let i = 0; i < rivalCount; i++) {
    const breed = rng.pick(BREEDS);
    const rivalType = Math.max(20, Math.min(98, rng.normal(70, 11)));
    const rivalSound = Math.max(
      10,
      Math.min(98, (breed.traits.structure ?? 55) * 0.75 + (breed.traits.longevity ?? 50) * 0.25 + rng.normal(0, 8)),
    );
    const rivalShow = Math.max(
      10,
      Math.min(
        98,
        (breed.traits.handling ?? 55) * 0.4 +
          (breed.traits.stability ?? 55) * 0.35 +
          (breed.traits.sociability ?? 55) * 0.15 +
          (100 - (breed.traits.vocality ?? 50)) * 0.1 +
          rng.normal(0, 8),
      ),
    );

    entrants.push({
      name: `${breed.name}`,
      breeder: rng.pick([
        'Ashwood',
        'Kestrelmoor',
        'Fennhollow',
        'Brackenridge',
        'Thistledown',
        'Harrowgate',
        'Merrivale',
        'Caldwater',
      ]),
      type: rivalType,
      soundness: rivalSound,
      showmanship: rivalShow,
      total:
        rivalType * judge.weights.type +
        rivalSound * judge.weights.soundness +
        rivalShow * judge.weights.showmanship +
        rng.normal(0, 4),
      isPlayer: false,
    });
  }

  entrants.sort((a, b) => b.total - a.total);

  const placement = entrants.findIndex((e) => e.isPlayer) + 1;
  const placed = placement <= 4 ? placement : 0;
  let points = PLACEMENT_POINTS[placed] ?? 0;

  // Winning a strong class counts for more.
  const bestInShow = placed === 1 && playerTotal >= 78;
  if (bestInShow) points += 3;

  // --- Record it -----------------------------------------------------------
  dog.showPoints = (dog.showPoints ?? 0) + points;
  dog.titles ??= [];

  const earned = titleFor(dog.showPoints);
  let newTitle: string | undefined;
  if (earned && !dog.titles.includes(earned.title)) {
    dog.titles.push(earned.title);
    newTitle = earned.label;
  }

  project.lastShown ??= {};
  project.lastShown[dog.id] = project.month;
  project.reputation = (project.reputation ?? 0) + points;

  commitRng(project, rng);

  const critique = writeCritique(dog, judge, { type, soundness, showmanship }, placed, bestInShow);

  if (placed === 1) {
    addLog(project, 'milestone', `${dog.name} won the ${CLASS_LABEL[eligibility.showClass]} class${bestInShow ? ' and took Best in Show' : ''}.`);
  } else if (placed > 0) {
    addLog(project, 'decision', `${dog.name} placed ${ordinal(placed)} in ${CLASS_LABEL[eligibility.showClass]}.`);
  } else {
    addLog(project, 'decision', `${dog.name} went unplaced.`);
  }
  if (newTitle) {
    addLog(project, 'milestone', `${dog.name} has earned the title of ${newTitle}.`);
  }

  project.updatedAt = Date.now();

  return {
    dogId: dog.id,
    dogName: dog.name,
    showClass: eligibility.showClass,
    judge,
    entrants,
    placement: placed,
    points,
    bestInShow,
    newTitle,
    critique,
  };
}

function ordinal(n: number): string {
  return n === 1 ? 'first' : n === 2 ? 'second' : n === 3 ? 'third' : 'fourth';
}

/**
 * The judge's written critique. Says what they actually liked and disliked, so
 * a show teaches the player something rather than just producing a rosette.
 */
function writeCritique(
  dog: Dog,
  judge: JudgeStyle,
  scores: { type: number; soundness: number; showmanship: number },
  placement: number,
  bestInShow: boolean,
): string {
  const parts: string[] = [];
  const he = dog.sex === 'M' ? 'he' : 'she';
  const him = dog.sex === 'M' ? 'him' : 'her';

  if (bestInShow) parts.push(`A standout. ${dog.name} held my eye the moment ${he} walked in.`);
  else if (placement === 1) parts.push(`A worthy winner of the class.`);
  else if (placement > 0) parts.push(`Placed ${ordinal(placement)} in a competitive class.`);
  else parts.push(`Not in the cards today, but there is something here.`);

  if (scores.type >= 72) parts.push(`Excellent type — ${he} is unmistakably what ${he} is meant to be.`);
  else if (scores.type >= 52) parts.push(`Reasonable type, though not yet consistent enough to stand out.`);
  else parts.push(`Type is the weakness. ${dog.name} does not yet read as a settled example of your breed.`);

  if (scores.soundness >= 72) parts.push(`Moves well and is soundly built.`);
  else if (scores.soundness < 45) parts.push(`I was not happy with the construction; I would want better joints on ${him}.`);

  if (scores.showmanship >= 72) parts.push(`Showed ${dog.sex === 'M' ? 'himself' : 'herself'} beautifully — steady on the table, unbothered by the hall.`);
  else if (scores.showmanship < 45) parts.push(`${dog.name} found the whole business a trial. A steadier temperament would transform ${him} in the ring.`);

  // No full stop added here: some preferences already end in a question mark.
  parts.push(`(This judge ${judge.preference})`);

  return parts.join(' ');
}

