/**
 * THE BREED CLUB
 *
 * Real breeds are not fixed. Every so often the people who fancy them fall
 * for something — a colour, a size, a head — and the written standard drifts
 * to follow. A fault becomes a virtue; a virtue goes out of style.
 *
 * Every few generations the club that has grown up around the player's breed
 * proposes a fashion. The player can FOLLOW it (the standard changes, the
 * club is pleased) or HOLD THEIR LINE (nothing changes, the club sulks —
 * and comes round later if the dogs prove the point).
 *
 * Nothing here touches the standard by itself. A proposal sits in
 * `project.club.proposals` as pending until the player answers it.
 */

import { Rng, hashString } from '../engine/rng';
import { type BreedStandard, type Goal, type Priority } from '../engine/standard';
import { TRAITS, type PolyTrait, sizeToPounds } from '../engine/traits';
import {
  type CoatKind,
  type EarType,
  type TailType,
  EAR_LABEL,
  TAIL_LABEL,
  resolveCoat,
  resolveColor,
  resolveEars,
  resolveTail,
} from '../engine/phenotype';
import { type Project, activeDogs, addLog, breedingPopulation, takeSnapshot } from './project';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** What following a fashion would change in the standard. Stored, so it must be plain data. */
export type FashionChange =
  | { kind: 'colour'; text: string; priority: Priority }
  | { kind: 'trait'; trait: PolyTrait; goal: Goal }
  | { kind: 'coat'; kinds: CoatKind[]; priority: Priority }
  | { kind: 'ears'; types: EarType[]; priority: Priority }
  | { kind: 'tail'; types: TailType[]; priority: Priority };

export interface ClubProposal {
  id: string;
  month: number;
  generation: number;
  /** "Blue is in" */
  title: string;
  /** The gossip: what happened and why the club wants this. */
  text: string;
  /** What following would do to the standard, in plain words. */
  effect: string;
  change: FashionChange;
  /**
   * `fashion`: the club wants something new (harder, usually).
   * `virtue`: the club has decided the thing your dogs already do is the type
   * (easier — a fault made a virtue).
   */
  flavour: 'fashion' | 'virtue';
  status: 'pending' | 'followed' | 'resisted';
  answeredMonth?: number;
  /** Set when a resisted fashion later blew over and the club came round. */
  vindicated?: boolean;
}

export interface ClubState {
  proposals: ClubProposal[];
  /** The number of closed generations at which the next fashion arrives. */
  nextAt: number;
}

/** How many closed generations between fashions. */
const EVERY = 5;
/** The first fashion waits until the breed has some substance. */
const FIRST_AT = 4;

const COAT_WORD: Record<CoatKind, string> = {
  hairless: 'hairless',
  smooth: 'smooth-coated',
  short: 'short-coated',
  wire: 'wire-coated',
  long: 'long-coated',
  silky: 'silky-coated',
  curly: 'curly-coated',
  wavyFurnished: 'wavy, furnished',
  doubleThick: 'thick double-coated',
  corded: 'corded',
};

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function pendingProposal(project: Project): ClubProposal | null {
  return project.club?.proposals.find((p) => p.status === 'pending') ?? null;
}

/** The standard as it would be if this fashion were followed. */
export function applyFashion(standard: BreedStandard, change: FashionChange): BreedStandard {
  const next: BreedStandard = structuredClone(standard);
  switch (change.kind) {
    case 'colour':
      next.colorGoal = { text: change.text, priority: change.priority };
      break;
    case 'trait':
      next.traitGoals[change.trait] = change.goal;
      break;
    case 'coat':
      next.coatGoal = { kinds: change.kinds, priority: change.priority };
      break;
    case 'ears':
      next.earGoal = { types: change.types, priority: change.priority };
      break;
    case 'tail':
      next.tailGoal = { types: change.types, priority: change.priority };
      break;
  }
  return next;
}

// ---------------------------------------------------------------------------
// The player answers
// ---------------------------------------------------------------------------

export function answerClub(project: Project, proposal: ClubProposal, follow: boolean): string {
  const live = project.club?.proposals.find((p) => p.id === proposal.id);
  if (!live || live.status !== 'pending') return 'That notice has already been answered.';
  live.answeredMonth = project.month;
  if (follow) {
    live.status = 'followed';
    project.standard = applyFashion(project.standard, live.change);
    project.reputation = (project.reputation ?? 0) + 8;
    addLog(project, 'decision', `Followed the club: ${live.title.toLowerCase()}. ${live.effect}`);
    project.updatedAt = Date.now();
    return 'The standard has changed. Every dog has been re-scored.';
  }
  live.status = 'resisted';
  project.reputation = Math.max(0, (project.reputation ?? 0) - 4);
  addLog(project, 'decision', `Held the line against the club: ${live.title.toLowerCase()}. The standard is unchanged.`);
  project.updatedAt = Date.now();
  return 'You kept your standard. The club noticed — and may come round.';
}

// ---------------------------------------------------------------------------
// Time passes: fashions arrive, old ones blow over
// ---------------------------------------------------------------------------

/**
 * Call right after a generation is recorded. Returns the new proposal if one
 * arrived, and a note if a fashion the player resisted has since blown over.
 */
export function afterGenerationClosed(project: Project): { proposal: ClubProposal | null; vindication: string | null } {
  const club = (project.club ??= { proposals: [], nextAt: FIRST_AT });
  const closed = project.history.length;
  if (closed < club.nextAt) return { proposal: null, vindication: null };
  club.nextAt = closed + EVERY;

  // The club comes round: a fashion resisted a while ago, and the dogs have
  // gone on being good. That is what holding your line is for.
  let vindication: string | null = null;
  const snapshot = takeSnapshot(project);
  for (const old of club.proposals) {
    if (old.status !== 'resisted' || old.vindicated) continue;
    if (snapshot.averageScore < 68) continue;
    old.vindicated = true;
    project.reputation = (project.reputation ?? 0) + 14;
    vindication = `Remember "${old.title}"? The fashion blew over. Your ${project.standard.name} dogs went on being what they were, and the club has quietly decided that was the type all along. Your reputation has grown.`;
    addLog(project, 'milestone', vindication);
    break;
  }

  if (pendingProposal(project)) return { proposal: null, vindication };
  const proposal = proposeFashion(project);
  if (proposal) {
    club.proposals.push(proposal);
    addLog(project, 'warning', `A notice from the breed club: ${proposal.title}.`);
    project.updatedAt = Date.now();
  }
  return { proposal, vindication };
}

// ---------------------------------------------------------------------------
// Making up a fashion
// ---------------------------------------------------------------------------

function proposeFashion(project: Project): ClubProposal | null {
  // Seeded from the project and the moment, so the same save always gets the
  // same fashion at the same point.
  const rng = new Rng(hashString(`${project.seed}:club:${project.history.length}`));
  const makers: { weight: number; make: () => ClubProposal | null }[] = [
    { weight: 3, make: () => colourFashion(project, rng) },
    { weight: 2, make: () => sizeFashion(project, rng) },
    { weight: 2, make: () => traitFashion(project, rng) },
    { weight: 3, make: () => faultToVirtue(project, rng) },
    { weight: 1, make: () => earFashion(project, rng) },
    { weight: 1, make: () => tailFashion(project, rng) },
    { weight: 1, make: () => coatFashion(project, rng) },
  ];
  // Try makers in a weighted random order until one applies.
  const order: typeof makers = [];
  const pool = makers.slice();
  while (pool.length) {
    const chosen = rng.weighted(pool, pool.map((m) => m.weight));
    order.push(chosen);
    pool.splice(pool.indexOf(chosen), 1);
  }
  for (const m of order) {
    const p = m.make();
    if (p) return p;
  }
  return null;
}

function base(project: Project, rng: Rng): Pick<ClubProposal, 'id' | 'month' | 'generation' | 'status'> {
  return {
    id: `club${project.history.length}_${rng.int(1000, 9999)}`,
    month: project.month,
    generation: project.generation,
    status: 'pending',
  };
}

/** A colour that some dog in the kennel already wears — so it is reachable — but the standard does not ask for. */
function colourFashion(project: Project, rng: Rng): ClubProposal | null {
  const wanted = (project.standard.colorGoal?.text ?? '').toLowerCase();
  const counts = new Map<string, number>();
  for (const d of activeDogs(project)) {
    const name = resolveColor(d.genotype).name;
    if (wanted && name.toLowerCase().includes(wanted.split(/[\s,]+/)[0])) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const names = Array.from(counts.keys());
  if (names.length === 0) return null;
  // The rarer the colour in the kennel, the more of a fashion it is.
  const colour = rng.weighted(names, names.map((n) => 1 / Math.sqrt(counts.get(n)!)));
  const lower = colour.toLowerCase();
  const stories = [
    `A ${lower} ${project.standard.name} from another kennel took Best in Show at the national, and the breed magazine put ${lower} on its cover. Suddenly every judge wants one.`,
    `The club's new president keeps ${lower} dogs. Nobody is saying it out loud, but ${lower} is winning.`,
    `A film with a ${lower} dog in it has done something to the public. Enquiries for ${lower} puppies have tripled.`,
  ];
  const priority: Priority = Math.max(3, project.standard.colorGoal?.priority ?? 0) as Priority;
  return {
    ...base(project, rng),
    title: `${colour} is in`,
    text: rng.pick(stories),
    effect: `The colour goal becomes "${lower}" at ${priority === 4 ? 'Very high' : 'High'} priority. Dogs of other colours lose ground.`,
    change: { kind: 'colour', text: lower, priority },
    flavour: 'fashion',
  };
}

function sizeFashion(project: Project, rng: Rng): ClubProposal | null {
  const goal = project.standard.traitGoals.size;
  if (!goal || goal.mode !== 'range' || goal.priority === 0) return null;
  const smaller = rng.chance(0.5);
  const factor = smaller ? 0.86 : 1.16;
  const r = (v: number | undefined, fallback: number) => Math.round((v ?? fallback) * factor);
  const next: Goal = {
    ...goal,
    preferredLow: r(goal.preferredLow, 20),
    preferredHigh: r(goal.preferredHigh, 60),
    acceptableLow: r(goal.acceptableLow, goal.preferredLow ?? 20),
    acceptableHigh: r(goal.acceptableHigh, goal.preferredHigh ?? 60),
  };
  return {
    ...base(project, rng),
    title: smaller ? 'Smaller is the fashion' : 'Bigger is the fashion',
    text: smaller
      ? 'The judges have been putting up the neat, compact end of the ring all season. The word is that the club wants the breed "refined".'
      : 'The judges have been rewarding the big, imposing end of the ring all season. The word is that the club wants "more dog".',
    effect: `The size goal moves to ${next.preferredLow}–${next.preferredHigh} lb (from ${goal.preferredLow}–${goal.preferredHigh} lb).`,
    change: { kind: 'trait', trait: 'size', goal: next },
    flavour: 'fashion',
  };
}

function traitFashion(project: Project, rng: Rng): ClubProposal | null {
  // Fashion is about looks and manner, never about soundness: nobody's club
  // ever asked for less stability or a shorter life.
  const unfashionable = new Set<string>(['size', 'stability', 'structure', 'longevity', 'fertility', 'handling']);
  const options = Object.entries(project.standard.traitGoals).filter(
    ([k, g]) => !unfashionable.has(k) && g && g.priority >= 2 && g.mode === 'range',
  ) as [PolyTrait, Goal][];
  if (options.length === 0) return null;
  const [trait, goal] = rng.pick(options);
  const up = rng.chance(0.5);
  const shift = up ? 10 : -10;
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const next: Goal = {
    ...goal,
    preferredLow: clamp((goal.preferredLow ?? 40) + shift),
    preferredHigh: clamp((goal.preferredHigh ?? 60) + shift),
    acceptableLow: clamp((goal.acceptableLow ?? goal.preferredLow ?? 40) + shift),
    acceptableHigh: clamp((goal.acceptableHigh ?? goal.preferredHigh ?? 60) + shift),
  };
  const label = TRAITS[trait].label.toLowerCase();
  return {
    ...base(project, rng),
    title: `More ${label}`.replace('More', up ? 'More' : 'Less'),
    text: `This year's judges are asking for ${up ? 'more' : 'less'} ${label} than the standard says. A well-known breeder has written a column calling the current type "${up ? 'dull' : 'excessive'}".`,
    effect: `The ${label} goal moves to ${next.preferredLow}–${next.preferredHigh} (from ${goal.preferredLow}–${goal.preferredHigh}).`,
    change: { kind: 'trait', trait, goal: next },
    flavour: 'fashion',
  };
}

/**
 * The club decides the thing your dogs actually do IS the breed. The goal the
 * kennel misses most moves to where the kennel already is. This is how a lot
 * of real standards were written: after the fact, around the dogs people had.
 */
function faultToVirtue(project: Project, rng: Rng): ClubProposal | null {
  const population = breedingPopulation(project);
  if (population.length < 3) return null;
  const candidates: { trait: PolyTrait; goal: Goal; mean: number; miss: number }[] = [];
  for (const [k, goal] of Object.entries(project.standard.traitGoals)) {
    if (!goal || goal.mode !== 'range' || goal.priority < 2) continue;
    const trait = k as PolyTrait;
    const values = population.map((d) => (trait === 'size' ? sizeToPounds(d.observed.size) : d.observed[trait]));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const low = goal.preferredLow ?? -Infinity;
    const high = goal.preferredHigh ?? Infinity;
    const miss = mean < low ? low - mean : mean > high ? mean - high : 0;
    if (miss > (trait === 'size' ? 4 : 6)) candidates.push({ trait, goal, mean, miss });
  }
  if (candidates.length === 0) return null;
  const c = rng.weighted(candidates, candidates.map((x) => x.miss));
  const isSize = c.trait === 'size';
  const half = isSize ? Math.max(4, c.mean * 0.12) : 9;
  const next: Goal = {
    ...c.goal,
    preferredLow: Math.round(c.mean - half),
    preferredHigh: Math.round(c.mean + half),
    acceptableLow: Math.round(c.mean - half * 2),
    acceptableHigh: Math.round(c.mean + half * 2),
  };
  const label = TRAITS[c.trait].label.toLowerCase();
  const unit = isSize ? ' lb' : '';
  return {
    ...base(project, rng),
    title: `Your ${label} is the new type`,
    text: `Your dogs have been marked down for ${label} for years. Now enough of them have won that the club has changed its mind: the ${label} your kennel produces, it says, is what the breed was always meant to have.`,
    effect: `The ${label} goal moves to ${next.preferredLow}–${next.preferredHigh}${unit} — where your dogs already are (from ${c.goal.preferredLow}–${c.goal.preferredHigh}${unit}).`,
    change: { kind: 'trait', trait: c.trait, goal: next },
    flavour: 'virtue',
  };
}

function earFashion(project: Project, rng: Rng): ClubProposal | null {
  const current = project.standard.earGoal?.types ?? [];
  const present = new Set<EarType>();
  for (const d of activeDogs(project)) present.add(resolveEars(d.observed.earSet));
  const options = Array.from(present).filter((t) => !current.includes(t));
  if (options.length === 0) return null;
  const type = rng.pick(options);
  const priority: Priority = Math.max(2, project.standard.earGoal?.priority ?? 0) as Priority;
  return {
    ...base(project, rng),
    title: `${EAR_LABEL[type]} are the fashion`,
    text: `A dog with ${EAR_LABEL[type].toLowerCase()} has been winning everything, and the club has decided that is the "correct" head after all.`,
    effect: `The ear goal becomes ${EAR_LABEL[type].toLowerCase()} only${current.length ? ` (was ${current.map((t) => EAR_LABEL[t].toLowerCase()).join(' or ')})` : ''}.`,
    change: { kind: 'ears', types: [type], priority },
    flavour: 'fashion',
  };
}

function tailFashion(project: Project, rng: Rng): ClubProposal | null {
  const current = project.standard.tailGoal?.types ?? [];
  const present = new Set<TailType>();
  for (const d of activeDogs(project)) {
    const lbs = sizeToPounds(d.observed.size);
    present.add(resolveTail(d.genotype, d.observed.tailSet, d.observed.muzzle, resolveCoat(d.genotype, lbs).kind));
  }
  const options = Array.from(present).filter((t) => !current.includes(t));
  if (options.length === 0) return null;
  const type = rng.pick(options);
  const priority: Priority = Math.max(2, project.standard.tailGoal?.priority ?? 0) as Priority;
  return {
    ...base(project, rng),
    title: `The ${TAIL_LABEL[type].toLowerCase()} is in`,
    text: `The club's illustrated standard has been redrawn, and the artist gave the dog a ${TAIL_LABEL[type].toLowerCase()}. Now the judges expect one.`,
    effect: `The tail goal becomes ${TAIL_LABEL[type].toLowerCase()} only${current.length ? ` (was ${current.map((t) => TAIL_LABEL[t].toLowerCase()).join(' or ')})` : ''}.`,
    change: { kind: 'tail', types: [type], priority },
    flavour: 'fashion',
  };
}

function coatFashion(project: Project, rng: Rng): ClubProposal | null {
  const current = project.standard.coatGoal?.kinds ?? [];
  const present = new Set<CoatKind>();
  for (const d of activeDogs(project)) present.add(resolveCoat(d.genotype, sizeToPounds(d.observed.size)).kind);
  const options = Array.from(present).filter((k) => !current.includes(k));
  if (options.length === 0) return null;
  const kind = rng.pick(options);
  const priority: Priority = Math.max(3, project.standard.coatGoal?.priority ?? 0) as Priority;
  return {
    ...base(project, rng),
    title: `The ${COAT_WORD[kind]} look`,
    text: `Grooming fashions have moved on. The ${COAT_WORD[kind]} dogs are the ones being photographed, and the club is minded to make it official.`,
    effect: `The coat goal becomes ${COAT_WORD[kind]} only${current.length ? ` (was ${current.join(' or ')})` : ''}.`,
    change: { kind: 'coat', kinds: [kind], priority },
    flavour: 'fashion',
  };
}
