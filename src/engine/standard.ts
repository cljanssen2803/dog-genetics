/**
 * THE BREED STANDARD
 *
 * A breed standard is the player's written definition of the dog they are
 * trying to create. Everything in the game is scored against it, and nothing
 * is scored against anything else — there is deliberately no universal "good
 * dog". The same animal can be a 91 for one project and a 42 for another.
 *
 * A standard is built from goals. Each goal says what the player wants for one
 * characteristic and how much they care. Anything set to "Don't care" is
 * completely ignored, including by the difficulty warnings.
 */

import {
  type PolyTrait,
  TRAITS,
  poundsToSize,
  sizeToPounds,
  calmnessFrom,
} from './traits';
import type { Dog } from './dog';
import { type CoatKind, type EarType, type TailType, TAIL_LABEL, resolveCoat, resolveColor, resolveEars, resolveTail, geneticHealthFlags } from './phenotype';
import { copies } from './loci';

export type Priority = 0 | 1 | 2 | 3 | 4;

export const PRIORITY_LABEL: Record<Priority, string> = {
  0: "Don't care",
  1: 'Nice to have',
  2: 'Moderate',
  3: 'High',
  4: 'Very high',
};

/** How much each priority level counts when the scores are averaged. */
export const PRIORITY_WEIGHT: Record<Priority, number> = { 0: 0, 1: 1, 2: 2, 3: 4, 4: 7 };

export type GoalMode = 'range' | 'higher' | 'lower';

export interface Goal {
  mode: GoalMode;
  priority: Priority;
  /** Used by "range" goals. In pounds for size, on the 1-100 scale otherwise. */
  preferredLow?: number;
  preferredHigh?: number;
  acceptableLow?: number;
  acceptableHigh?: number;
}

/** Characteristics worked out from the coat rather than inherited directly. */
export type DerivedKey =
  | 'shedding'
  | 'grooming'
  | 'coldTolerance'
  | 'heatTolerance'
  | 'waterResistance';

export const DERIVED_LABEL: Record<DerivedKey, string> = {
  shedding: 'Shedding',
  grooming: 'Grooming burden',
  coldTolerance: 'Cold tolerance',
  heatTolerance: 'Heat tolerance',
  waterResistance: 'Water resistance',
};

export interface BreedStandard {
  name: string;
  /** One or two sentences describing the dog, shown at the top of the project. */
  vision: string;
  traitGoals: Partial<Record<PolyTrait, Goal>>;
  derivedGoals: Partial<Record<DerivedKey, Goal>>;
  coatGoal?: { kinds: CoatKind[]; priority: Priority };
  earGoal?: { types: EarType[]; priority: Priority };
  tailGoal?: { types: TailType[]; priority: Priority };
  /** Free-text colour wish. Scored loosely, mostly for flavour. */
  colorGoal?: { text: string; priority: Priority };
  /** How harshly inherited disease is punished. */
  healthPriority: Priority;
}

// ---------------------------------------------------------------------------
// Scoring one dog against one standard
// ---------------------------------------------------------------------------

/** Score a single value against a goal, from 0 (miss) to 1 (perfect). */
function scoreGoal(value: number, goal: Goal): number {
  if (goal.priority === 0) return 1;

  if (goal.mode === 'higher') {
    return Math.max(0, Math.min(1, value / 100));
  }
  if (goal.mode === 'lower') {
    return Math.max(0, Math.min(1, (100 - value) / 100));
  }

  const pLow = goal.preferredLow ?? -Infinity;
  const pHigh = goal.preferredHigh ?? Infinity;
  if (value >= pLow && value <= pHigh) return 1;

  const aLow = goal.acceptableLow ?? pLow;
  const aHigh = goal.acceptableHigh ?? pHigh;

  if (value < pLow) {
    if (value <= aLow) {
      // Outside the acceptable range entirely: fall away, but never below zero.
      const overshoot = (aLow - value) / Math.max(1, pLow - aLow || 10);
      return Math.max(0, 0.35 - overshoot * 0.35);
    }
    return 0.35 + 0.65 * ((value - aLow) / Math.max(0.0001, pLow - aLow));
  }

  if (value >= aHigh) {
    const overshoot = (value - aHigh) / Math.max(1, aHigh - pHigh || 10);
    return Math.max(0, 0.35 - overshoot * 0.35);
  }
  return 0.35 + 0.65 * ((aHigh - value) / Math.max(0.0001, aHigh - pHigh));
}

export interface ScoreBreakdown {
  key: string;
  label: string;
  /** What the dog actually is, in words. */
  actual: string;
  score: number;
  priority: Priority;
  weight: number;
}

export interface DogScore {
  /** 0-100 against this project's standard. */
  total: number;
  /** True when the dog satisfies every goal the player marked High or above. */
  meetsStandard: boolean;
  /**
   * How many of the standard's goals this dog hits, out of how many there
   * are. "Meets the standard" is a cliff — a dog either clears every High
   * goal or it does not — and a project can sit at 0% for years while it
   * quietly improves. Six of nine is a slope you can watch.
   */
  goalsHit: number;
  goalsTotal: number;
  breakdown: ScoreBreakdown[];
  /** Goals this dog fails, worst first. Used for "likely weaknesses". */
  weaknesses: ScoreBreakdown[];
  strengths: ScoreBreakdown[];
  healthPenalty: number;
  healthNotes: string[];
}

/**
 * Score a dog. `useBreedingValue` switches from "what this dog is" to "what
 * this dog is likely to pass on", which is the more useful figure when you are
 * choosing breeding stock rather than admiring a pet.
 */
/** The genes a colour wish needs, by the words the wish uses. */
export const COLOUR_GENES: { word: RegExp; locus: string; allele: string; label: string }[] = [
  { word: /dudley/, locus: 'locusE', allele: 'e', label: 'recessive red' },
  { word: /dudley/, locus: 'locusB', allele: 'b', label: 'chocolate' },
  { word: /chocolate|liver|brown/, locus: 'locusB', allele: 'b', label: 'chocolate' },
  // "blue" the colour, but not "blue eyes".
  { word: /\bblue\b(?!\s*eyes)|dilute|grey/, locus: 'locusD', allele: 'd', label: 'dilute' },
  { word: /blue eyes/, locus: 'blueEyes', allele: 'Be', label: 'blue eyes' },
  { word: /fawn|sable/, locus: 'locusA', allele: 'ay', label: 'sable' },
  { word: /wolf/, locus: 'locusA', allele: 'aw', label: 'wolf sable' },
  { word: /mask/, locus: 'locusE', allele: 'Em', label: 'dark mask' },
  { word: /cocoa/, locus: 'cocoa', allele: 'co', label: 'cocoa' },
  { word: /tick|roan|spots/, locus: 'ticking', allele: 'T', label: 'ticking' },
  { word: /lilac|isabella/, locus: 'locusB', allele: 'b', label: 'chocolate' },
  { word: /lilac|isabella/, locus: 'locusD', allele: 'd', label: 'dilute' },
  { word: /\bred\b|yellow|gold|apricot/, locus: 'locusE', allele: 'e', label: 'recessive red' },
  { word: /cream/, locus: 'locusE', allele: 'e', label: 'recessive red' },
  { word: /cream/, locus: 'intensity', allele: 'i', label: 'cream' },
  { word: /brindle/, locus: 'locusK', allele: 'kbr', label: 'brindle' },
  { word: /merle/, locus: 'merle', allele: 'M', label: 'merle' },
  { word: /harlequin/, locus: 'harlequin', allele: 'H', label: 'harlequin' },
  { word: /harlequin/, locus: 'merle', allele: 'M', label: 'merle' },
  { word: /\btan\b|points/, locus: 'locusA', allele: 'at', label: 'tan points' },
  { word: /white|piebald|pied/, locus: 'locusS', allele: 'sp', label: 'piebald' },
];

/** The genes a colour wish (free text) needs, deduplicated. */
export function colourGenesFor(text: string): { locus: string; allele: string; label: string }[] {
  const out: { locus: string; allele: string; label: string }[] = [];
  for (const g of COLOUR_GENES) {
    if (!g.word.test(text.toLowerCase())) continue;
    if (out.some((o) => o.locus === g.locus && o.allele === g.allele)) continue;
    out.push({ locus: g.locus, allele: g.allele, label: g.label });
  }
  return out;
}

/** The per-goal score at which a goal is counted as hit for the pips. */
export const GOAL_HIT = 0.7;

export function scoreDog(
  dog: Dog,
  standard: BreedStandard,
  useBreedingValue = false,
): DogScore {
  const values = useBreedingValue ? dog.bv : dog.observed;
  const breakdown: ScoreBreakdown[] = [];

  // The legendary coat scores a perfect hundred against any standard. That
  // is the whole point of it.
  if (dog.genotype.rainbow && dog.genotype.rainbow[0] === 'Rb' && dog.genotype.rainbow[1] === 'Rb') {
    const perfect: ScoreBreakdown = { key: 'rainbow', label: 'Sparkling rainbow', actual: 'Perfect, by definition', score: 1, priority: 4, weight: 7 };
    return { total: 100, meetsStandard: true, goalsHit: 1, goalsTotal: 1, breakdown: [perfect], weaknesses: [], strengths: [perfect], healthPenalty: 0, healthNotes: [] };
  }
  let weightedSum = 0;
  let weightTotal = 0;
  let meets = true;

  // --- Polygenic trait goals ---------------------------------------------
  for (const [traitKey, goal] of Object.entries(standard.traitGoals)) {
    const trait = traitKey as PolyTrait;
    if (!goal || goal.priority === 0) continue;
    const def = TRAITS[trait];

    const raw = values[trait];
    const displayValue = def.logScale ? sizeToPounds(raw) : raw;
    const score = scoreGoal(displayValue, goal);
    const weight = PRIORITY_WEIGHT[goal.priority];

    breakdown.push({
      key: trait,
      label: def.label,
      actual: def.logScale
        ? `${displayValue.toFixed(displayValue < 20 ? 1 : 0)} lb`
        : `${Math.round(displayValue)}`,
      score,
      priority: goal.priority,
      weight,
    });

    weightedSum += score * weight;
    weightTotal += weight;
    if (goal.priority >= 3 && score < 0.35) meets = false;
  }

  // --- Coat-derived goals -------------------------------------------------
  const weightLbs = sizeToPounds(values.size);
  const coat = resolveCoat(dog.genotype, weightLbs);

  for (const [key, goal] of Object.entries(standard.derivedGoals)) {
    const derived = key as DerivedKey;
    if (!goal || goal.priority === 0) continue;
    const value = coat[derived];
    const score = scoreGoal(value, goal);
    const weight = PRIORITY_WEIGHT[goal.priority];

    breakdown.push({
      key: derived,
      label: DERIVED_LABEL[derived],
      actual: `${Math.round(value)}`,
      score,
      priority: goal.priority,
      weight,
    });

    weightedSum += score * weight;
    weightTotal += weight;
    if (goal.priority >= 3 && score < 0.35) meets = false;
  }

  // --- Categorical goals --------------------------------------------------
  if (standard.coatGoal && standard.coatGoal.priority > 0) {
    const hit = standard.coatGoal.kinds.includes(coat.kind);
    const weight = PRIORITY_WEIGHT[standard.coatGoal.priority];

    // What the dog IS scores one way; what it can PRODUCE scores another.
    //
    // Coat genes are mostly recessive, so the first cross between two breeds
    // almost never shows the coat you want — it just carries it. Judged purely
    // on appearance those first-cross dogs score terribly, and a sensible
    // player culls the only animals holding the genes they need. That is a
    // valley with no way across.
    //
    // So when we are asking "what will this dog give me?", a dog carrying
    // every gene the target coat requires gets most of the credit even though
    // it does not wear the coat itself.
    const potential = coatPotential(dog, standard.coatGoal.kinds);
    const score = useBreedingValue ? Math.max(hit ? 1 : 0.1, potential) : hit ? 1 : 0.1;

    breakdown.push({
      key: 'coatKind',
      label: 'Coat type',
      actual: hit || !useBreedingValue ? coat.label : `${coat.label} (carries the target coat)`,
      score,
      priority: standard.coatGoal.priority,
      weight,
    });
    weightedSum += score * weight;
    weightTotal += weight;
    if (standard.coatGoal.priority >= 3 && !hit) meets = false;
  }

  if (standard.earGoal && standard.earGoal.priority > 0) {
    const ears = resolveEars(values.earSet);
    const hit = standard.earGoal.types.includes(ears);
    const weight = PRIORITY_WEIGHT[standard.earGoal.priority];
    breakdown.push({
      key: 'ears',
      label: 'Ear carriage',
      actual: ears,
      score: hit ? 1 : 0.2,
      priority: standard.earGoal.priority,
      weight,
    });
    weightedSum += (hit ? 1 : 0.2) * weight;
    weightTotal += weight;
  }

  if (standard.tailGoal && standard.tailGoal.priority > 0) {
    const tail = resolveTail(dog.genotype, dog.observed.tailSet, dog.observed.muzzle, coat.kind, weightLbs);
    const hit = standard.tailGoal.types.includes(tail);
    const weight = PRIORITY_WEIGHT[standard.tailGoal.priority];
    breakdown.push({
      key: 'tail',
      label: 'Tail',
      actual: TAIL_LABEL[tail],
      score: hit ? 1 : 0.2,
      priority: standard.tailGoal.priority,
      weight,
    });
    weightedSum += (hit ? 1 : 0.2) * weight;
    weightTotal += weight;
  }

  if (standard.colorGoal && standard.colorGoal.priority > 0) {
    const color = resolveColor(dog.genotype);
    const wanted = standard.colorGoal.text.toLowerCase().trim();
    const hit =
      wanted.length === 0 ||
      wanted.split(/[\s,]+/).some((word) => word.length > 2 && color.name.toLowerCase().includes(word));
    const weight = PRIORITY_WEIGHT[standard.colorGoal.priority];
    // Breeding value gives credit for CARRYING the genes the colour needs —
    // a chocolate carrier is most of the way to a chocolate puppy. Without
    // this the planner could never see a carrier's worth, and a colour that
    // nobody shows yet could never be bred toward.
    let colourScore = hit ? 1 : 0.25;
    if (!hit && useBreedingValue) {
      const needed = colourGenesFor(wanted);
      if (needed.length > 0) {
        const carried = needed.filter((g) => dog.genotype[g.locus]?.includes(g.allele)).length;
        colourScore = 0.25 + 0.55 * (carried / needed.length);
      }
    }
    breakdown.push({
      key: 'color',
      label: 'Colour',
      actual: color.name,
      score: colourScore,
      priority: standard.colorGoal.priority,
      weight,
    });
    weightedSum += colourScore * weight;
    weightTotal += weight;
  }

  // --- Health --------------------------------------------------------------
  const flags = geneticHealthFlags(dog.genotype);
  const healthNotes: string[] = [];
  let healthPenalty = 0;
  const healthWeight = PRIORITY_WEIGHT[standard.healthPriority] / 7;

  for (const flag of flags) {
    if (flag.severity === 'affected') {
      healthPenalty += 16 * healthWeight;
      healthNotes.push(flag.text);
      meets = false;
    } else if (flag.severity === 'carrier') {
      healthPenalty += 2.2 * healthWeight;
    } else {
      healthPenalty += 4 * healthWeight;
      healthNotes.push(flag.text);
    }
  }

  // Being heavily inbred is itself a fault in a breeding programme.
  healthPenalty += Math.min(14, dog.coi * 100 * 0.45) * healthWeight;

  /**
   * How the goals are combined into one number.
   *
   * A plain average would let a dog abandon one important goal completely and
   * still score well by being excellent at everything else. That is not how
   * breeding works: if you asked for a 140 lb dog, a superb 30 lb dog has not
   * partially succeeded, it has failed.
   *
   * So we blend the average with a GEOMETRIC mean, which collapses toward zero
   * as soon as any heavily-weighted goal is badly missed. The average keeps
   * useful separation between decent dogs; the geometric mean makes sure a
   * total miss on a Very high priority cannot be bought off elsewhere.
   */
  // A standard with no goals judges nothing: every dog scores zero and none
  // "meets" it, so nothing downstream celebrates a fit that was never asked for.
  if (weightTotal === 0) {
    return { total: 0, meetsStandard: false, goalsHit: 0, goalsTotal: 0, breakdown: [], weaknesses: [], strengths: [], healthPenalty: Math.round(healthPenalty), healthNotes };
  }
  const arithmetic = weightedSum / weightTotal;

  let logSum = 0;
  for (const entry of breakdown) {
    logSum += entry.weight * Math.log(Math.max(0.04, entry.score));
  }
  const geometric = Math.exp(logSum / weightTotal);

  // Leaning a little back toward the average, so that real progress on most
  // goals still shows up as a rising number rather than being flattened by one
  // stubborn trait. The geometric half keeps a badly-missed priority from being
  // ignored; it just no longer dominates everything else.
  const base = (arithmetic * 0.48 + geometric * 0.52) * 100;
  const total = Math.max(0, Math.min(100, base - healthPenalty));

  const sorted = breakdown.slice().sort((a, b) => a.score * a.weight - b.score * b.weight);

  // A goal counts as hit when the dog is inside, or right at the edge of,
  // the preferred range — a categorical goal is simply hit or missed.
  const goalsHit = breakdown.filter((b) => b.score >= GOAL_HIT).length;

  return {
    total: Math.round(total),
    meetsStandard: meets && healthPenalty < 8,
    goalsHit,
    goalsTotal: breakdown.length,
    breakdown,
    weaknesses: sorted.filter((b) => b.score < 0.7).slice(0, 4),
    strengths: sorted
      .slice()
      .reverse()
      .filter((b) => b.score > 0.85 && b.priority >= 2)
      .slice(0, 4),
    healthPenalty: Math.round(healthPenalty),
    healthNotes,
  };
}

/**
 * The genes each target coat actually needs. Used to give a dog credit for
 * carrying a coat it does not wear.
 */
const COAT_REQUIREMENTS: Record<CoatKind, { locus: string; allele: string; needed: number }[]> = {
  corded: [
    { locus: 'curl', allele: 'Cu', needed: 2 },
    { locus: 'coatLength', allele: 'l', needed: 2 },
    { locus: 'undercoat', allele: 'U', needed: 1 },
  ],
  curly: [
    { locus: 'curl', allele: 'Cu', needed: 2 },
    { locus: 'coatLength', allele: 'l', needed: 2 },
  ],
  wavyFurnished: [
    { locus: 'curl', allele: 'Cu', needed: 1 },
    { locus: 'furnishings', allele: 'F', needed: 1 },
  ],
  long: [
    { locus: 'coatLength', allele: 'l', needed: 2 },
    { locus: 'furnishings', allele: 'F', needed: 1 },
  ],
  silky: [{ locus: 'coatLength', allele: 'l', needed: 2 }],
  doubleThick: [{ locus: 'coatLength', allele: 'l', needed: 2 }],
  wire: [{ locus: 'furnishings', allele: 'F', needed: 1 }],
  smooth: [{ locus: 'coatLength', allele: 'L', needed: 1 }],
  short: [{ locus: 'coatLength', allele: 'L', needed: 1 }],
  hairless: [{ locus: 'hairlessDom', allele: 'Hd', needed: 1 }],
};

/**
 * How much of a target coat this dog is holding, from 0 (none of the genes) to
 * 0.65 (carries everything needed but does not show it). Capped below 1 so a
 * dog that actually wears the coat still scores higher than one that merely
 * carries it.
 */
function coatPotential(dog: Dog, kinds: CoatKind[]): number {
  let best = 0;

  for (const kind of kinds) {
    const requirements = COAT_REQUIREMENTS[kind];
    if (!requirements || requirements.length === 0) continue;

    let held = 0;
    for (const requirement of requirements) {
      const carried = copies(dog.genotype, requirement.locus, requirement.allele);
      if (carried >= requirement.needed) held += 1;
      // One copy of a gene that needs two: the dog is halfway there, and can
      // produce the coat when bred to another carrier.
      else if (carried >= 1) held += 0.7;
    }

    best = Math.max(best, (held / requirements.length) * 0.65);
  }

  return best;
}

// ---------------------------------------------------------------------------
// Goal conflict detection
// ---------------------------------------------------------------------------

export interface GoalConflict {
  severity: 'note' | 'conflict';
  title: string;
  body: string;
}

export interface DifficultyReport {
  level: 'Gentle' | 'Moderate' | 'High' | 'Very high' | 'Extreme';
  score: number;
  conflicts: GoalConflict[];
}

function wants(standard: BreedStandard, trait: PolyTrait, direction: 'high' | 'low'): number {
  const goal = standard.traitGoals[trait];
  if (!goal || goal.priority === 0) return 0;
  const weight = PRIORITY_WEIGHT[goal.priority] / 7;

  if (goal.mode === 'higher') return direction === 'high' ? weight : 0;
  if (goal.mode === 'lower') return direction === 'low' ? weight : 0;

  const mid = ((goal.preferredLow ?? 50) + (goal.preferredHigh ?? 50)) / 2;
  if (direction === 'high' && mid >= 68) return weight * ((mid - 68) / 32 + 0.4);
  if (direction === 'low' && mid <= 32) return weight * ((32 - mid) / 32 + 0.4);
  return 0;
}

function wantsDerived(standard: BreedStandard, key: DerivedKey, direction: 'high' | 'low'): number {
  const goal = standard.derivedGoals[key];
  if (!goal || goal.priority === 0) return 0;
  const weight = PRIORITY_WEIGHT[goal.priority] / 7;
  if (goal.mode === 'higher') return direction === 'high' ? weight : 0;
  if (goal.mode === 'lower') return direction === 'low' ? weight : 0;
  const mid = ((goal.preferredLow ?? 50) + (goal.preferredHigh ?? 50)) / 2;
  if (direction === 'high' && mid >= 68) return weight;
  if (direction === 'low' && mid <= 32) return weight;
  return 0;
}

/**
 * Look at the standard as a whole and tell the player honestly how hard it is
 * going to be. The game never refuses an unusual combination — it just warns
 * that some of them fight each other.
 */
export function assessDifficulty(standard: BreedStandard): DifficultyReport {
  const conflicts: GoalConflict[] = [];
  let score = 0;

  const sizeGoal = standard.traitGoals.size;
  const targetWeight = sizeGoal
    ? ((sizeGoal.preferredLow ?? 25) + (sizeGoal.preferredHigh ?? 25)) / 2
    : 35;

  // --- drive versus calm ---------------------------------------------------
  const drive = Math.max(wants(standard, 'preyDrive', 'high'), wants(standard, 'persistence', 'high'));
  const calm = Math.max(wants(standard, 'energy', 'low'), wants(standard, 'stability', 'high'));
  if (drive > 0.4 && calm > 0.4) {
    score += 22;
    conflicts.push({
      severity: 'conflict',
      title: 'Strong drive alongside a calm household',
      body: 'You want real hunting motivation and a dog that switches off indoors. These can coexist — plenty of working terriers manage it — but the same hidden genes push drive, alertness and barking up together. Expect several generations of selecting the quiet ones out of otherwise driven litters.',
    });
  }

  const quiet = wants(standard, 'vocality', 'low');
  if (drive > 0.4 && quiet > 0.4) {
    score += 16;
    conflicts.push({
      severity: 'conflict',
      title: 'High drive with a quiet voice',
      body: 'Barking and predatory drive travel together. You can separate them, but you will lose good puppies to noise along the way.',
    });
  }

  const alertLow = wants(standard, 'alertness', 'low');
  if (drive > 0.4 && alertLow > 0.4) {
    score += 12;
    conflicts.push({
      severity: 'note',
      title: 'Driven but unobservant',
      body: 'A dog that hunts hard but notices little is an unusual combination. It is achievable, but it works against the natural correlation.',
    });
  }

  // --- coat conflicts ------------------------------------------------------
  const lowShed = wantsDerived(standard, 'shedding', 'low');
  const lowGroom = wantsDerived(standard, 'grooming', 'low');
  const cold = wantsDerived(standard, 'coldTolerance', 'high');

  if (lowShed > 0.4 && lowGroom > 0.4) {
    score += 20;
    conflicts.push({
      severity: 'conflict',
      title: 'Low shedding and low grooming',
      body: 'This is the hardest coat request in dogs. Coats that do not shed hold on to their dead hair, so it has to be brushed and clipped out instead. A wiry, moderately furnished coat is your best compromise — never a curly one.',
    });
  }

  if (lowShed > 0.4 && cold > 0.5) {
    score += 18;
    conflicts.push({
      severity: 'conflict',
      title: 'Dense winter coat with very low shedding',
      body: 'Cold tolerance comes largely from a thick undercoat, and an undercoat is precisely what sheds. A dense curly coat gets you part of the way, at a real cost in grooming.',
    });
  }

  if (standard.coatGoal?.kinds.includes('hairless') && cold > 0.3) {
    score += 30;
    conflicts.push({
      severity: 'conflict',
      title: 'Hairless and cold-hardy',
      body: 'A hairless dog cannot be cold tolerant. You can select for a hardy constitution, but this pair of goals cannot both be satisfied.',
    });
  }

  const heat = wantsDerived(standard, 'heatTolerance', 'high');
  if (cold > 0.5 && heat > 0.5) {
    score += 14;
    conflicts.push({
      severity: 'note',
      title: 'Comfortable in both extremes',
      body: 'Coats that hold heat in also hold heat in during summer. A moderate double coat is the usual compromise and will score middling at both ends.',
    });
  }

  // --- size conflicts ------------------------------------------------------
  const wantsLongLife = wants(standard, 'longevity', 'high');
  if (targetWeight > 85 && wantsLongLife > 0.4) {
    score += 25;
    conflicts.push({
      severity: 'conflict',
      title: 'A giant dog that lives a long time',
      body: 'Body size and lifespan pull against each other more strongly than almost any other pair of traits in dogs. This is an excellent, genuinely valuable project — just expect it to take many generations, and expect to lose good dogs young along the way.',
    });
  }

  if (targetWeight < 9) {
    score += 16;
    conflicts.push({
      severity: 'note',
      title: 'Very small target size',
      body: 'Under about nine pounds you will start meeting dental crowding, fragile bones, difficult whelping and smaller litters. The game will not stop you, but every generation will be slower because there are fewer puppies to choose from.',
    });
  }

  if (targetWeight > 110) {
    score += 12;
    conflicts.push({
      severity: 'note',
      title: 'Very large target size',
      body: 'Giant dogs carry more joint problems, more heart disease and much shorter lives. Selecting hard on soundness and longevity from the start will save you a great deal of trouble later.',
    });
  }

  // --- social conflicts ----------------------------------------------------
  const social = wants(standard, 'sociability', 'high');
  const alert = wants(standard, 'alertness', 'high');
  if (social > 0.5 && alert > 0.5) {
    score += 8;
    conflicts.push({
      severity: 'note',
      title: 'Friendly and watchful at once',
      body: 'A dog that loves everybody and also announces everybody is common enough, but a dog that is friendly and discriminating takes careful selection.',
    });
  }

  const independent = wants(standard, 'independence', 'high');
  const biddable = wants(standard, 'biddability', 'high');
  if (independent > 0.5 && biddable > 0.5) {
    score += 14;
    conflicts.push({
      severity: 'conflict',
      title: 'Independent but eager to please',
      body: 'These sit at opposite ends of the same underlying tendency. You are asking for a dog that works happily alone and still wants to cooperate closely — possible, but slow.',
    });
  }

  // --- sheer number of demands --------------------------------------------
  const demanding = [
    ...Object.values(standard.traitGoals),
    ...Object.values(standard.derivedGoals),
  ].filter((g) => g && g.priority >= 3).length;

  score += Math.max(0, demanding - 4) * 3.5;
  if (demanding >= 9) {
    conflicts.push({
      severity: 'note',
      title: 'A great many high priorities',
      body: `You have marked ${demanding} characteristics as High or Very high. Every additional demand means fewer puppies qualify, so progress on each one slows down. Consider dropping one or two to Moderate.`,
    });
  }

  const level: DifficultyReport['level'] =
    score >= 65 ? 'Extreme' : score >= 45 ? 'Very high' : score >= 28 ? 'High' : score >= 14 ? 'Moderate' : 'Gentle';

  return { level, score, conflicts };
}

// ---------------------------------------------------------------------------
// Preset standards
// ---------------------------------------------------------------------------

const g = (
  priority: Priority,
  mode: GoalMode,
  preferredLow?: number,
  preferredHigh?: number,
  acceptableLow?: number,
  acceptableHigh?: number,
): Goal => ({ mode, priority, preferredLow, preferredHigh, acceptableLow, acceptableHigh });

export const HEARTHDOG: BreedStandard = {
  name: 'Hearthdog',
  vision:
    'A calm, confident, healthy family companion that sheds very little, needs manageable grooming, and lives a long time.',
  traitGoals: {
    size: g(3, 'range', 30, 50, 22, 62),
    stability: g(4, 'range', 78, 100, 62, 100),
    sociability: g(3, 'range', 70, 92, 55, 100),
    biddability: g(3, 'range', 70, 95, 55, 100),
    energy: g(3, 'range', 30, 52, 18, 66),
    handling: g(3, 'range', 74, 100, 58, 100),
    vocality: g(2, 'range', 12, 40, 5, 55),
    preyDrive: g(2, 'range', 15, 45, 5, 62),
    alertness: g(1, 'range', 35, 62, 20, 78),
    longevity: g(4, 'higher'),
    structure: g(4, 'higher'),
    fertility: g(2, 'higher'),
    independence: g(1, 'range', 30, 58, 15, 72),
  },
  derivedGoals: {
    shedding: g(4, 'range', 0, 25, 0, 42),
    grooming: g(3, 'range', 20, 50, 8, 66),
  },
  healthPriority: 4,
};

export const MOUSIE: BreedStandard = {
  name: 'Mousie',
  vision:
    'A tiny, cold-hardy companion for an older owner: calm and easy indoors, but with enough drive and persistence to genuinely clear a barn of mice.',
  traitGoals: {
    size: g(4, 'range', 10, 18, 7, 23),
    preyDrive: g(4, 'range', 78, 100, 62, 100),
    persistence: g(4, 'range', 76, 100, 60, 100),
    energy: g(3, 'range', 32, 55, 20, 68),
    stability: g(3, 'range', 68, 100, 52, 100),
    handling: g(3, 'range', 72, 100, 55, 100),
    biddability: g(2, 'range', 60, 88, 45, 100),
    sociability: g(2, 'range', 55, 85, 40, 100),
    vocality: g(2, 'range', 20, 52, 8, 68),
    longevity: g(3, 'higher'),
    structure: g(3, 'higher'),
    fertility: g(2, 'higher'),
  },
  derivedGoals: {
    coldTolerance: g(4, 'range', 72, 100, 55, 100),
    grooming: g(2, 'range', 15, 50, 5, 65),
    shedding: g(1, 'range', 0, 55, 0, 75),
  },
  healthPriority: 3,
};

/**
 * Starting point for a brand new custom project: everything set to "Don't
 * care" except basic health, which is always worth something.
 */
/** True when the standard asks for nothing at all — a free-play project. */
export function isScoreless(standard: BreedStandard): boolean {
  const goals = [...Object.values(standard.traitGoals), ...Object.values(standard.derivedGoals)];
  if (goals.some((g) => g && g.priority > 0)) return false;
  if (standard.coatGoal && standard.coatGoal.priority > 0) return false;
  if (standard.earGoal && standard.earGoal.priority > 0) return false;
  if (standard.tailGoal && standard.tailGoal.priority > 0) return false;
  if (standard.colorGoal && standard.colorGoal.priority > 0) return false;
  return true;
}

/** The standard a free-play project runs on: no goals, nothing judged. */
export const FREE_PLAY: BreedStandard = {
  name: 'Free play',
  vision: 'No standard, no goals. Put any dogs together and see what you get.',
  traitGoals: {},
  derivedGoals: {},
  healthPriority: 0,
};

export function blankStandard(name = 'My breed'): BreedStandard {
  return {
    name,
    vision: '',
    traitGoals: {
      size: g(3, 'range', 25, 45, 18, 55),
    },
    derivedGoals: {},
    healthPriority: 3,
  };
}

/**
 * PUREBRED WITH A TWIST
 *
 * A standard built from a real breed's profile — its size, coat, ears and
 * the temperament it is known for — plus one thing the breed does not
 * normally come in: a Dudley Newfoundland, a merle Poodle, a brindle Lab.
 * The founders come from the breed; the twist has to be hunted for.
 */
export function purebredStandard(
  breed: { name: string; weight: number; traits: Partial<Record<Exclude<PolyTrait, 'size'>, number>>; alleles?: Record<string, Record<string, number>> },
  twist?: { label: string; colourText: string },
): BreedStandard {
  const f = (locus: string, allele: string) => breed.alleles?.[locus]?.[allele] ?? 0;
  const long = f('coatLength', 'l') >= 0.6;
  const furnished = f('furnishings', 'F') >= 0.5;
  const curl = f('curl', 'Cu');
  const plush = f('undercoat', 'U') >= 0.5;
  const hairless = f('hairlessDom', 'Hd') >= 0.3 || f('hairlessRec', 'hr') >= 0.6;

  let kinds: CoatKind[];
  if (hairless) kinds = ['hairless'];
  else if (curl >= 0.8 && long) kinds = plush ? ['corded', 'curly'] : ['curly'];
  else if (curl >= 0.4 && furnished) kinds = ['wavyFurnished', 'curly'];
  else if (long && furnished) kinds = ['long'];
  else if (long) kinds = plush ? ['doubleThick', 'silky'] : ['silky', 'doubleThick'];
  else if (furnished) kinds = ['wire'];
  else kinds = ['smooth', 'short'];

  const earSet = breed.traits.earSet ?? 50;
  const ears: EarType[] = earSet >= 76 ? ['erect'] : earSet >= 58 ? ['semiErect', 'erect'] : earSet >= 40 ? ['button', 'semiErect'] : ['drop', 'button'];

  const traitGoals: BreedStandard['traitGoals'] = {
    size: g(4, 'range', Math.round(breed.weight * 0.85), Math.round(breed.weight * 1.15), Math.round(breed.weight * 0.7), Math.round(breed.weight * 1.3)),
    structure: g(3, 'higher'),
    longevity: g(2, 'higher'),
  };
  // The temperament the breed is known for: anything well away from average.
  for (const trait of ['biddability', 'sociability', 'energy', 'stability', 'preyDrive', 'independence', 'vocality', 'alertness'] as const) {
    const mean = breed.traits[trait] ?? 50;
    if (mean >= 70) traitGoals[trait] = g(2, 'higher');
    else if (mean <= 30) traitGoals[trait] = g(2, 'lower');
  }

  return {
    name: twist ? `${twist.label} ${breed.name}` : breed.name,
    vision: twist
      ? `A true-to-type ${breed.name} in a colour the breed does not come in: ${twist.label.toLowerCase()}. The look has to be hunted for and bred back into the breed without losing the breed.`
      : `A true-to-type ${breed.name}: the size, coat and character of the breed, kept sound.`,
    traitGoals,
    derivedGoals: {},
    coatGoal: { kinds, priority: 3 },
    earGoal: { types: ears, priority: 2 },
    colorGoal: twist ? { text: twist.colourText, priority: 4 } : undefined,
    healthPriority: 3,
  };
}

/**
 * DESIGNER CROSS
 *
 * Build a standard that says "take the shape of breed A and the coat of breed
 * B" — for example a Great Dane in a Standard Poodle's curly, low-shedding
 * coat. The result is usually difficult and always interesting.
 */
export function designerCrossStandard(
  name: string,
  bodyBreed: { name: string; weight: number },
  coatBreed: { name: string },
  coatKinds: CoatKind[],
): BreedStandard {
  const low = Math.round(bodyBreed.weight * 0.82);
  const high = Math.round(bodyBreed.weight * 1.18);

  return {
    name,
    vision: `The size and build of a ${bodyBreed.name} carrying the coat of a ${coatBreed.name}.`,
    traitGoals: {
      size: g(4, 'range', low, high, Math.round(low * 0.78), Math.round(high * 1.22)),
      structure: g(3, 'higher'),
      longevity: g(3, 'higher'),
      stability: g(2, 'range', 62, 100, 45, 100),
      handling: g(2, 'range', 62, 100, 45, 100),
    },
    derivedGoals: {},
    coatGoal: { kinds: coatKinds, priority: 4 },
    healthPriority: 3,
  };
}

// ---------------------------------------------------------------------------
// Helpers used by the interface
// ---------------------------------------------------------------------------

/** Convert a size goal from pounds into the internal log scale for prediction. */
export function sizeGoalInternal(goal: Goal | undefined) {
  if (!goal) return undefined;
  return {
    preferredLow: poundsToSize(goal.preferredLow ?? 1),
    preferredHigh: poundsToSize(goal.preferredHigh ?? 300),
    acceptableLow: poundsToSize(goal.acceptableLow ?? 1),
    acceptableHigh: poundsToSize(goal.acceptableHigh ?? 300),
  };
}

/** A short, readable summary line for a dog's temperament, in plain language. */
export function temperamentLine(dog: Dog): string {
  const calm = calmnessFrom(dog.observed.energy, dog.observed.stability, dog.observed.vocality);
  return `Calm ${Math.round(calm)} · Trainable ${Math.round(dog.observed.biddability)} · Prey drive ${Math.round(
    dog.observed.preyDrive,
  )}`;
}
