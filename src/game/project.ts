/**
 * THE PROJECT
 *
 * One breeding project is one save file. It owns its dogs, its family tree,
 * its calendar, its luck, and its own definition of a good dog.
 *
 * Everything that changes the world goes through a function in this file, so
 * there is exactly one place where the rules live.
 */

import { Rng, hashString, makeSeed } from '../engine/rng';
import {
  type Dog,
  type PlacementType,
  ageMonths,
  breedingEligibility,
  createFounder,
  createMixedFounder,
  idNumber,
  newDogId,
  primeIdCounter,
} from '../engine/dog';
import {
  GESTATION_MONTHS,
  type Pregnancy,
  attemptMating,
  deliverLitter,
} from '../engine/breeding';
import {
  Kinship,
  ancestorInfluence,
  averageCoi,
  countFamilyLines,
  effectiveFounders,
} from '../engine/pedigree';
import { type NameRegistry, createNameRegistry, pickName, registerName, validateName } from '../engine/names';
import { type BreedStandard, scoreDog } from '../engine/standard';
import { ALL_TRAITS, type PolyTrait, sizeToPounds } from '../engine/traits';
import { BREEDS } from '../engine/breeds';
import { LOCUS_BY_KEY } from '../engine/loci';
import { findRarities, resolveCoat, resolveColor } from '../engine/phenotype';
import type { Sex } from '../engine/names';

/**
 * Kennel capacity is the main source of pressure in the game, but twelve
 * turned out to be tight enough that a single good litter forced the player to
 * dismantle their breeding population. Fourteen leaves room to keep a promising
 * puppy without immediately giving up an adult, while still making "which two
 * do I keep?" a real question.
 */
export const DEFAULT_KENNEL_CAPACITY = 14;

export interface Litter {
  id: string;
  sireId: string;
  damId: string;
  bornMonth: number;
  generation: number;
  puppyIds: string[];
  lost: string[];
  coi: number;
}

export interface Discovery {
  key: string;
  title: string;
  rarity: string;
  blurb: string;
  dogId: string;
  dogName: string;
  month: number;
}

export interface LogEntry {
  month: number;
  text: string;
  kind: 'birth' | 'death' | 'breeding' | 'decision' | 'milestone' | 'warning';
}

export interface GenerationSnapshot {
  generation: number;
  month: number;
  averageScore: number;
  percentMeetingStandard: number;
  averageCoi: number;
  effectiveFounders: number;
  familyLines: number;
  averageWeight: number;
  traitAverages: Partial<Record<PolyTrait, number>>;
  carrierFrequency: Record<string, number>;
  populationSize: number;
  averageLifespan: number | null;
}

export interface Project {
  id: string;
  name: string;
  standard: BreedStandard;

  seed: number;
  rngCursor: number;

  /** Months since the project started. */
  month: number;
  generation: number;

  dogs: Record<string, Dog>;
  names: NameRegistry;
  pregnancies: Pregnancy[];
  litters: Litter[];
  /** When each female last whelped, used for recovery time. */
  lastLitter: Record<string, number>;
  /** When each dog was last entered in a show. */
  lastShown?: Record<string, number>;
  /** Total show points won. A respected kennel attracts better outside dogs. */
  reputation?: number;

  kennelCapacity: number;
  /** Kept only so older saves still load. Health information is always known. */
  testCredits?: number;

  discoveries: Discovery[];
  log: LogEntry[];
  history: GenerationSnapshot[];

  /** Outside dogs currently on offer, so the list is stable between screens. */
  candidates: Dog[];

  nerdMode: boolean;
  tutorialSeen: boolean;
  establishedMonth?: number;

  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Reading the project
// ---------------------------------------------------------------------------

export function rngFor(project: Project): Rng {
  return new Rng(project.seed, project.rngCursor);
}

export function commitRng(project: Project, rng: Rng): void {
  project.rngCursor = rng.snapshot().cursor;
}

export function lookupDog(project: Project) {
  return (id: string) => project.dogs[id];
}

export function kinshipFor(project: Project): Kinship {
  return new Kinship(lookupDog(project));
}

/** Dogs currently living in the kennel (not placed, retired out, or dead). */
export function activeDogs(project: Project): Dog[] {
  return Object.values(project.dogs).filter((d) => d.status === 'kennel');
}

/** Dogs that count against kennel capacity. Retired dogs move out of the count. */
export function kennelCount(project: Project): number {
  return activeDogs(project).filter((d) => !d.breedingRetired || ageMonths(d, project.month) < 96).length;
}

/** The breeding population: adults that could actually be used. */
export function breedingPopulation(project: Project): Dog[] {
  return activeDogs(project).filter((d) => {
    const e = breedingEligibility(d, project.month, project.lastLitter[d.id]);
    return e.eligible || (ageMonths(d, project.month) >= 12 && !d.breedingRetired);
  });
}

/**
 * What share of the current breeding population already descends from one
 * particular dog. This is the number behind the popular sire warning.
 */
export function ancestorInfluenceFor(project: Project, dogId: string): number {
  const population = breedingPopulation(project);
  return ancestorInfluence(dogId, population, lookupDog(project));
}

export function puppiesOf(project: Project, litterId: string): Dog[] {
  return Object.values(project.dogs).filter((d) => d.litterId === litterId);
}

// ---------------------------------------------------------------------------
// Lifespan
// ---------------------------------------------------------------------------

/**
 * How long this dog is fated to live, in months. Worked out once from its
 * genes rather than rolled every month, so the answer never changes.
 *
 * Body size dominates: a Great Dane and a Chihuahua differ by roughly seven
 * years before any other gene gets a say.
 */
export function expectedLifespanMonths(dog: Dog): number {
  const weight = Math.max(2, sizeToPounds(dog.observed.size));
  const sizeYears = 18.0 - 1.95 * Math.log(weight);
  const geneYears = ((dog.observed.longevity - 50) / 50) * 2.9;
  const structureYears = ((dog.observed.structure - 50) / 50) * 0.7;

  // A fixed personal quirk, drawn once when this dog came into being.
  const noise = (((dog.seedValue ?? hashString(dog.id)) % 2000) / 1000 - 1) * 1.5;

  const years = sizeYears + geneYears + structureYears + noise;
  return Math.round(Math.max(3, Math.min(20, years)) * 12);
}

// ---------------------------------------------------------------------------
// Creating a project
// ---------------------------------------------------------------------------

export interface NewProjectOptions {
  name: string;
  standard: BreedStandard;
  seed?: number;
  /** For designer crosses: start from these exact breeds instead of a mixture. */
  founderBreeds?: string[];
  foundationSize?: number;
}

export function createProject(opts: NewProjectOptions): Project {
  const seed = opts.seed ?? makeSeed();
  const project: Project = {
    id: `proj_${seed.toString(36)}_${Date.now().toString(36)}`,
    name: opts.name,
    standard: opts.standard,
    seed,
    rngCursor: 0,
    month: 0,
    generation: 1,
    dogs: {},
    names: createNameRegistry(),
    pregnancies: [],
    litters: [],
    lastLitter: {},
    kennelCapacity: DEFAULT_KENNEL_CAPACITY,
    discoveries: [],
    log: [],
    history: [],
    candidates: [],
    nerdMode: false,
    tutorialSeen: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  generateFoundation(project, opts.founderBreeds, opts.foundationSize ?? 8);
  return project;
}

/**
 * Choose which breeds the starting dogs come from.
 *
 * The foundation must be plausible but imperfect: dogs that get the player
 * partway there and bring real problems with them. We sample each breed,
 * score it against the standard, then pick from the upper-middle of the range
 * rather than the very top — so there is always somewhere to go.
 */
function pickFoundationBreeds(rng: Rng, standard: BreedStandard, count: number): string[] {
  const scored = BREEDS.map((breed) => {
    let total = 0;
    for (let i = 0; i < 3; i++) {
      const sample = createFounder(rng, {
        breedKey: breed.key,
        sex: i % 2 === 0 ? 'M' : 'F',
        name: 'sample',
        currentMonth: 0,
        ageMonths: 24,
        wildcards: false,
      });
      total += scoreDog(sample, standard).total;
    }
    return { key: breed.key, score: total / 3 };
  }).sort((a, b) => b.score - a.score);

  // Skip the single best breed so the player never starts already finished,
  // then take a spread from the next tier.
  const pool = scored.slice(1, Math.max(8, Math.min(14, scored.length)));
  const chosen: string[] = [];

  // Always take a couple of the strongest available.
  chosen.push(pool[0].key, pool[1].key);

  // Then add variety, weighted toward the better options but never limited to
  // them — genetic diversity matters more than any single starting score.
  const rest = pool.slice(2);
  while (chosen.length < count && rest.length > 0) {
    const weights = rest.map((r, i) => Math.max(1, r.score) / (1 + i * 0.25));
    const pick = rng.weighted(rest, weights);
    chosen.push(pick.key);
    rest.splice(rest.indexOf(pick), 1);
  }

  return chosen;
}

function generateFoundation(project: Project, founderBreeds: string[] | undefined, size: number) {
  const rng = rngFor(project);

  let breedPlan: string[];
  if (founderBreeds && founderBreeds.length > 0) {
    // Designer cross: split the foundation evenly between the chosen breeds.
    breedPlan = [];
    for (let i = 0; i < size; i++) breedPlan.push(founderBreeds[i % founderBreeds.length]);
  } else {
    const breeds = pickFoundationBreeds(rng, project.standard, Math.min(6, Math.ceil(size / 1.4)));
    breedPlan = [];
    for (let i = 0; i < size; i++) breedPlan.push(breeds[i % breeds.length]);
  }

  // Balance the sexes, since a kennel of eight males goes nowhere.
  const sexes: Sex[] = [];
  for (let i = 0; i < size; i++) sexes.push(i % 2 === 0 ? 'F' : 'M');

  breedPlan = rng.shuffle(breedPlan);

  for (let i = 0; i < size; i++) {
    const sex = sexes[i];
    const dog = createFounder(rng, {
      breedKey: breedPlan[i],
      sex,
      name: pickName(project.names, sex, rng),
      currentMonth: 0,
      ageMonths: rng.int(20, 38),
      wildcards: true,
    });
    project.dogs[dog.id] = dog;
    recordRarities(project, dog);
  }

  commitRng(project, rng);
  addLog(project, 'milestone', `${size} foundation dogs acquired. Generation 1 begins.`);
}

function recordRarities(project: Project, dog: Dog) {
  const coat = resolveCoat(dog.genotype, sizeToPounds(dog.observed.size));
  const color = resolveColor(dog.genotype);
  for (const find of findRarities(dog.genotype, coat, color)) {
    if (!dog.rarities.includes(find.key)) dog.rarities.push(find.key);
    if (!project.discoveries.some((d) => d.key === find.key)) {
      project.discoveries.push({
        key: find.key,
        title: find.title,
        rarity: find.rarity,
        blurb: find.blurb,
        dogId: dog.id,
        dogName: dog.name,
        month: project.month,
      });
      addLog(project, 'milestone', `Rare find: ${dog.name} is ${find.title.toLowerCase()}. ${find.blurb}`);
    }
  }
}

export function addLog(project: Project, kind: LogEntry['kind'], text: string) {
  project.log.unshift({ month: project.month, text, kind });
  if (project.log.length > 400) project.log.length = 400;
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

export interface MonthReport {
  month: number;
  births: { litterId: string; damName: string; sireName: string; count: number; lost: number }[];
  deaths: { name: string; age: number; cause: string }[];
  matured: string[];
  warnings: string[];
  /** Genes that appeared from nowhere this month. */
  mutations: string[];
}

/**
 * Move the calendar forward one month: puppies are born, dogs grow up, and
 * some dogs die. This is the only place time passes.
 */
export function advanceMonth(project: Project): MonthReport {
  const rng = rngFor(project);
  project.month += 1;

  const report: MonthReport = {
    month: project.month,
    births: [],
    deaths: [],
    matured: [],
    warnings: [],
    mutations: [],
  };

  // --- Births --------------------------------------------------------------
  const due = project.pregnancies.filter((p) => p.dueMonth <= project.month);
  project.pregnancies = project.pregnancies.filter((p) => p.dueMonth > project.month);

  for (const pregnancy of due) {
    const sire = project.dogs[pregnancy.sireId];
    const dam = project.dogs[pregnancy.damId];
    if (!sire || !dam) continue;

    const result = deliverLitter(
      rng,
      pregnancy,
      sire,
      dam,
      project.month,
      project.names,
      project.standard.name,
    );

    for (const puppy of result.puppies) {
      project.dogs[puppy.id] = puppy;
      sire.offspringIds.push(puppy.id);
      dam.offspringIds.push(puppy.id);

      for (const find of result.discoveries.filter((d) => d.puppyId === puppy.id)) {
        if (!project.discoveries.some((d) => d.key === find.key)) {
          project.discoveries.push({
            key: find.key,
            title: find.title,
            rarity: find.rarity,
            blurb: find.blurb,
            dogId: puppy.id,
            dogName: puppy.name,
            month: project.month,
          });
          addLog(project, 'milestone', `Rare find: ${puppy.name} is ${find.title.toLowerCase()}. ${find.blurb}`);
        }
      }
    }

    // A gene out of nowhere is the rarest thing that can happen in a project.
    for (const mutation of result.mutations) {
      addLog(
        project,
        'milestone',
        `MUTATION: ${mutation.puppyName} was born carrying ${mutation.story}. Neither parent had it.`,
      );
      report.mutations.push(`${mutation.puppyName} — ${mutation.story}`);
    }

    sire.littersProduced += 1;
    dam.littersProduced += 1;
    project.lastLitter[dam.id] = project.month;

    const litter: Litter = {
      id: result.litterId,
      sireId: sire.id,
      damId: dam.id,
      bornMonth: project.month,
      generation: pregnancy.generation,
      puppyIds: result.puppies.map((p) => p.id),
      lost: result.lost.map((l) => l.reason),
      coi: pregnancy.coi,
    };
    project.litters.unshift(litter);

    report.births.push({
      litterId: litter.id,
      damName: dam.name,
      sireName: sire.name,
      count: result.puppies.length,
      lost: result.lost.length,
    });

    if (result.puppies.length === 0) {
      addLog(project, 'warning', `${dam.name} lost her entire litter to ${sire.name}.`);
    } else {
      addLog(
        project,
        'birth',
        `${dam.name} whelped ${result.puppies.length} puppies by ${sire.name}${
          result.lost.length ? `, losing ${result.lost.length}` : ''
        }.`,
      );
    }

    project.generation = Math.max(project.generation, pregnancy.generation);
  }

  // --- Ageing and death ----------------------------------------------------
  for (const dog of Object.values(project.dogs)) {
    if (dog.status === 'deceased') continue;
    const age = ageMonths(dog, project.month);

    // Fated old age.
    const lifespan = expectedLifespanMonths(dog);
    let died = false;
    let cause = 'Old age';

    if (age >= lifespan) {
      died = true;
    } else if (rng.chance(0.00035)) {
      died = true;
      cause = rng.pick([
        'A sudden illness',
        'An accident',
        'A road accident',
        'An unexpected heart failure',
      ]);
    }

    if (died) {
      dog.status = 'deceased';
      dog.deathMonth = project.month;
      dog.deathCause = cause;
      report.deaths.push({ name: dog.name, age, cause });
      addLog(project, 'death', `${dog.name} died at ${(age / 12).toFixed(1)} years. ${cause}.`);
      continue;
    }

    // Automatic retirement from breeding.
    if (!dog.breedingRetired) {
      const retireAt = dog.sex === 'F' ? 84 : 120;
      if (age >= retireAt) {
        dog.breedingRetired = true;
        addLog(project, 'decision', `${dog.name} has retired from breeding at ${(age / 12).toFixed(1)} years.`);
      }
    }

    if (age === 24) report.matured.push(dog.name);
  }

  // --- Warnings ------------------------------------------------------------
  if (kennelCount(project) > project.kennelCapacity) {
    report.warnings.push(
      `Your kennel is over capacity: ${kennelCount(project)} dogs in ${project.kennelCapacity} spaces. Place some puppies before breeding again.`,
    );
  }

  commitRng(project, rng);
  project.updatedAt = Date.now();
  return report;
}

/** Advance several months at once, gathering everything that happened. */
export function advanceMonths(project: Project, count: number): MonthReport[] {
  const reports: MonthReport[] = [];
  for (let i = 0; i < count; i++) reports.push(advanceMonth(project));
  return reports;
}

// ---------------------------------------------------------------------------
// Breeding
// ---------------------------------------------------------------------------

export interface BreedOutcome {
  success: boolean;
  message: string;
  dueMonth?: number;
}

export function breedPair(project: Project, sireId: string, damId: string): BreedOutcome {
  const sire = project.dogs[sireId];
  const dam = project.dogs[damId];
  if (!sire || !dam) return { success: false, message: 'One of those dogs no longer exists.' };
  if (sire.sex !== 'M' || dam.sex !== 'F') {
    return { success: false, message: 'A mating needs one male and one female.' };
  }

  const sireCheck = breedingEligibility(sire, project.month, project.lastLitter[sire.id]);
  if (!sireCheck.eligible) return { success: false, message: `${sire.name}: ${sireCheck.reason}` };
  const damCheck = breedingEligibility(dam, project.month, project.lastLitter[dam.id]);
  if (!damCheck.eligible) return { success: false, message: `${dam.name}: ${damCheck.reason}` };

  if (project.pregnancies.some((p) => p.damId === damId)) {
    return { success: false, message: `${dam.name} is already in whelp.` };
  }

  const rng = rngFor(project);
  const kinship = kinshipFor(project);
  const coi = kinship.projectedCoi(sireId, damId);
  const generation = Math.max(sire.generation, dam.generation) + 1;

  const attempt = attemptMating(rng, sire, dam, project.month, coi, generation);
  commitRng(project, rng);
  project.updatedAt = Date.now();

  project.pregnancies.push(attempt.pregnancy);
  addLog(project, 'breeding', `${dam.name} was bred to ${sire.name} and is in whelp.`);

  return {
    success: true,
    message: `${dam.name} is in whelp to ${sire.name}. Puppies due in ${GESTATION_MONTHS} months.`,
    dueMonth: attempt.pregnancy.dueMonth,
  };
}

// ---------------------------------------------------------------------------
// Decisions about individual dogs
// ---------------------------------------------------------------------------

export const PLACEMENT_LABEL: Record<PlacementType, string> = {
  familyCompanion: 'Family companion',
  seniorHome: 'Senior home',
  activeHome: 'Active home',
  workingHome: 'Working home',
  farmHome: 'Farm home',
};

/**
 * How well a dog suits each kind of home. Used to give the player feedback
 * without turning placement into a separate management game.
 */
export function placementFit(dog: Dog): { type: PlacementType; fit: number; note: string }[] {
  const o = dog.observed;
  const coat = resolveCoat(dog.genotype, sizeToPounds(o.size));

  const entries: { type: PlacementType; fit: number; note: string }[] = [
    {
      type: 'familyCompanion',
      fit: o.handling * 0.35 + o.sociability * 0.3 + o.stability * 0.25 + (100 - o.preyDrive) * 0.1,
      note: 'Wants tolerance, friendliness and a steady head.',
    },
    {
      type: 'seniorHome',
      fit:
        (100 - o.energy) * 0.35 +
        o.handling * 0.25 +
        o.stability * 0.2 +
        (100 - o.vocality) * 0.1 +
        (100 - coat.grooming) * 0.1,
      note: 'Wants a quiet, easy, low-maintenance dog.',
    },
    {
      type: 'activeHome',
      fit: o.energy * 0.4 + o.structure * 0.25 + o.biddability * 0.2 + o.stability * 0.15,
      note: 'Wants stamina, soundness and willingness.',
    },
    {
      type: 'workingHome',
      fit: o.biddability * 0.3 + o.persistence * 0.25 + o.energy * 0.2 + o.preyDrive * 0.15 + o.stability * 0.1,
      note: 'Wants drive, focus and staying power.',
    },
    {
      type: 'farmHome',
      fit:
        o.preyDrive * 0.3 +
        o.independence * 0.2 +
        o.alertness * 0.2 +
        coat.coldTolerance * 0.15 +
        o.persistence * 0.15,
      note: 'Wants a hardy, self-directed dog that hunts vermin.',
    },
  ];

  return entries.sort((a, b) => b.fit - a.fit);
}

export function placeDog(project: Project, dogId: string, placement: PlacementType): string {
  const dog = project.dogs[dogId];
  if (!dog) return 'That dog no longer exists.';
  dog.status = 'placed';
  dog.placement = placement;
  dog.retention = 'pet';
  dog.breedingRetired = true;

  const fits = placementFit(dog);
  const rank = fits.findIndex((f) => f.type === placement);
  const best = fits[0];

  addLog(project, 'decision', `${dog.name} went to a ${PLACEMENT_LABEL[placement].toLowerCase()}.`);
  project.updatedAt = Date.now();

  if (rank === 0) return `${dog.name} is an excellent fit for that home. They will do well.`;
  if (rank <= 2) return `${dog.name} should settle in fine, though a ${PLACEMENT_LABEL[best.type].toLowerCase()} would have suited even better.`;
  return `${dog.name} is a poor match for that home — really a ${PLACEMENT_LABEL[best.type].toLowerCase()} dog. It will take some adjustment.`;
}

export function setRetention(project: Project, dogId: string, choice: Dog['retention']): void {
  const dog = project.dogs[dogId];
  if (!dog) return;
  dog.retention = choice;
  if (choice === 'retainNoBreed') {
    dog.breedingRetired = true;
    addLog(project, 'decision', `${dog.name} will be kept but not bred.`);
  }
  if (choice === 'keep') addLog(project, 'decision', `${dog.name} was retained for breeding.`);
  project.updatedAt = Date.now();
}

export function renameDog(project: Project, dogId: string, name: string): string | null {
  const dog = project.dogs[dogId];
  if (!dog) return 'That dog no longer exists.';
  const error = validateName(project.names, name, dog.name);
  if (error) return error;
  dog.name = name.trim();
  registerName(project.names, dog.name);
  project.updatedAt = Date.now();
  return null;
}

// ---------------------------------------------------------------------------
// Outside dogs
// ---------------------------------------------------------------------------

export type OutsideSearch =
  | { kind: 'breed'; breedKey: string; sex?: Sex }
  | { kind: 'traits'; needs: Partial<Record<PolyTrait, 'high' | 'low'>>; sex?: Sex }
  | { kind: 'random'; sex?: Sex };

/**
 * Generate a handful of outside dogs the player could bring in. They are
 * deliberately imperfect: every one of them brings something the project needs
 * and something it does not want.
 */
export function searchOutsideDogs(project: Project, search: OutsideSearch, count = 4): Dog[] {
  const rng = rngFor(project);
  const results: Dog[] = [];

  // A kennel with a reputation gets better dogs offered to it. This is the
  // point of winning at shows: it feeds back into the breeding game rather
  // than filling a trophy cabinet.
  const standing = reputationTier(project.reputation ?? 0).bonus;
  const reputationNudge: Partial<Record<PolyTrait, number>> = standing
    ? { structure: standing, longevity: standing, stability: standing * 0.6, fertility: standing * 0.5 }
    : {};

  for (let i = 0; i < count; i++) {
    const sex: Sex = search.sex ?? (rng.chance(0.5) ? 'M' : 'F');
    let dog: Dog;

    if (search.kind === 'breed') {
      dog = createFounder(rng, {
        breedKey: search.breedKey,
        sex,
        name: pickName(project.names, sex, rng),
        currentMonth: project.month,
        ageMonths: rng.int(14, 46),
        nudge: reputationNudge,
        wildcards: true,
      });
    } else if (search.kind === 'traits') {
      // Score every breed against what the player asked for, then pick from
      // the better ones — but never a perfect match.
      const scored = BREEDS.map((breed) => {
        let fit = 0;
        for (const [trait, direction] of Object.entries(search.needs)) {
          const mean =
            trait === 'size'
              ? 50
              : breed.traits[trait as Exclude<PolyTrait, 'size'>] ?? 50;
          fit += direction === 'high' ? mean : 100 - mean;
        }
        return { breed, fit };
      }).sort((a, b) => b.fit - a.fit);

      const pool = scored.slice(0, 10);
      const chosen = rng.weighted(pool, pool.map((_, idx) => 10 / (idx + 1)));

      const nudge: Partial<Record<PolyTrait, number>> = { ...reputationNudge };
      for (const [trait, direction] of Object.entries(search.needs)) {
        if (trait === 'size') continue;
        nudge[trait as PolyTrait] = direction === 'high' ? 7 : -7;
      }

      dog = createFounder(rng, {
        breedKey: chosen.breed.key,
        sex,
        name: pickName(project.names, sex, rng),
        currentMonth: project.month,
        ageMonths: rng.int(14, 46),
        nudge,
        wildcards: true,
      });
    } else {
      dog = createMixedFounder(rng, {
        sex,
        name: pickName(project.names, sex, rng),
        currentMonth: project.month,
        ageMonths: rng.int(12, 48),
        nudge: reputationNudge,
        wildcards: true,
      });
    }

    dog.status = 'outside';
    // Outside dogs arrive with a DNA panel already done — that is what you are
    // paying the other breeder for.
    dog.tests.dna = true;
    results.push(dog);
  }

  commitRng(project, rng);
  project.candidates = results;
  project.updatedAt = Date.now();
  return results;
}

export function adoptOutsideDog(project: Project, dog: Dog): string {
  if (kennelCount(project) >= project.kennelCapacity) {
    return `Your kennel is full (${project.kennelCapacity} dogs). Place a dog first.`;
  }
  const adopted: Dog = { ...dog, status: 'kennel' };
  project.dogs[adopted.id] = adopted;
  project.candidates = project.candidates.filter((c) => c.id !== dog.id);
  recordRarities(project, adopted);
  addLog(project, 'decision', `${adopted.name} (${adopted.breedLabel}) joined the kennel as an outcross.`);
  project.updatedAt = Date.now();
  return `${adopted.name} has joined your kennel.`;
}

// ---------------------------------------------------------------------------
// Snapshots for the analytics screen
// ---------------------------------------------------------------------------

export function takeSnapshot(project: Project): GenerationSnapshot {
  const population = activeDogs(project).filter((d) => ageMonths(d, project.month) >= 12);
  const kinship = kinshipFor(project);
  const lookup = lookupDog(project);

  const scores = population.map((d) => scoreDog(d, project.standard));
  const averageScore = scores.length
    ? scores.reduce((s, x) => s + x.total, 0) / scores.length
    : 0;
  const meeting = scores.filter((s) => s.meetsStandard).length;

  const traitAverages: Partial<Record<PolyTrait, number>> = {};
  for (const trait of ALL_TRAITS) {
    if (population.length === 0) break;
    const sum = population.reduce((s, d) => s + d.observed[trait], 0);
    traitAverages[trait] = sum / population.length;
  }

  // Carrier frequency for every disease gene actually present.
  // Only disease genes use "m" to mean a broken copy — the merle gene happens
  // to use the same letter for "not merle", so it must be excluded here or
  // every ordinary dog would be counted as a carrier.
  const carrierFrequency: Record<string, number> = {};
  if (population.length > 0) {
    for (const dog of population) {
      for (const [locusKey, pair] of Object.entries(dog.genotype)) {
        if (LOCUS_BY_KEY[locusKey]?.category !== 'disease') continue;
        if (pair[0] === 'm' || pair[1] === 'm') {
          carrierFrequency[locusKey] = (carrierFrequency[locusKey] ?? 0) + 1;
        }
      }
    }
    for (const key of Object.keys(carrierFrequency)) {
      carrierFrequency[key] = carrierFrequency[key] / population.length;
    }
  }

  const dead = Object.values(project.dogs).filter((d) => d.status === 'deceased' && d.deathMonth);
  const averageLifespan = dead.length
    ? dead.reduce((s, d) => s + (d.deathMonth! - d.birthMonth), 0) / dead.length / 12
    : null;

  return {
    generation: project.generation,
    month: project.month,
    averageScore,
    percentMeetingStandard: population.length ? (meeting / population.length) * 100 : 0,
    averageCoi: averageCoi(population),
    effectiveFounders: effectiveFounders(population, lookup),
    familyLines: countFamilyLines(population, kinship),
    averageWeight: population.length
      ? population.reduce((s, d) => s + sizeToPounds(d.observed.size), 0) / population.length
      : 0,
    traitAverages,
    carrierFrequency,
    populationSize: population.length,
    averageLifespan,
  };
}

export function recordGeneration(project: Project): GenerationSnapshot {
  const snapshot = takeSnapshot(project);
  project.history.push(snapshot);
  project.updatedAt = Date.now();
  return snapshot;
}

/**
 * Reputation gives winning at shows a purpose beyond a trophy cabinet: a
 * respected kennel gets better dogs offered to it when it goes looking for an
 * outcross.
 */
export function reputationTier(points: number): { label: string; bonus: number } {
  if (points >= 120) return { label: 'Renowned', bonus: 7 };
  if (points >= 70) return { label: 'Well regarded', bonus: 5 };
  if (points >= 35) return { label: 'Known locally', bonus: 3 };
  if (points >= 12) return { label: 'Getting noticed', bonus: 1.5 };
  return { label: 'Unknown', bonus: 0 };
}

export function ensureIds(project: Project) {
  let highest = 0;
  for (const id of Object.keys(project.dogs)) highest = Math.max(highest, idNumber(id));
  primeIdCounter(highest + 1);
}

export function makeDogId(): string {
  return newDogId();
}
