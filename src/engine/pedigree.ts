/**
 * PEDIGREES, INBREEDING AND POPULATION STRUCTURE
 *
 * COI — the "coefficient of inbreeding" — is the single most useful number in
 * a breeding programme. It answers one question: how likely is it that a
 * puppy inherits two copies of the same gene from the same ancestor on both
 * sides of its family?
 *
 *   0%    parents share no ancestors at all
 *   6.25% first cousins
 *   12.5% half siblings, or grandparent to grandchild
 *   25%   full siblings, or parent to offspring
 *
 * High COI is not instantly fatal, but it quietly drains fertility, litter
 * size, lifespan and soundness, and it brings hidden recessive diseases to the
 * surface. Keeping it low across a whole population is the real long game.
 */

import type { Dog } from './dog';

export type DogLookup = (id: string) => Dog | undefined;

/**
 * KINSHIP is the chance that a gene picked at random from one dog matches a
 * gene picked at random from another. It is the building block for everything
 * else here.
 *
 * A puppy's COI is simply the kinship between its two parents.
 */
export class Kinship {
  private cache = new Map<string, number>();
  private lookup: DogLookup;

  constructor(lookup: DogLookup) {
    this.lookup = lookup;
  }

  /** Clear the memory, for example after a new generation is born. */
  reset() {
    this.cache.clear();
  }

  between(aId: string | undefined, bId: string | undefined): number {
    if (!aId || !bId) return 0;
    const a = this.lookup(aId);
    const b = this.lookup(bId);
    if (!a || !b) return 0;

    const key = aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;

    let result: number;

    if (aId === bId) {
      // A dog's kinship with itself depends on how inbred it is.
      result = 0.5 * (1 + this.inbreeding(a));
    } else {
      // Walk up from whichever dog was born later, so we always move backwards
      // in time and the recursion is guaranteed to end.
      const [younger, older] = a.birthMonth >= b.birthMonth ? [a, b] : [b, a];
      if (!younger.sireId && !younger.damId) {
        result = 0;
      } else {
        result =
          0.5 *
          (this.between(younger.sireId, older.id) + this.between(younger.damId, older.id));
      }
    }

    this.cache.set(key, result);
    return result;
  }

  /** How inbred a particular dog is: the kinship between its own parents. */
  inbreeding(dog: Dog): number {
    if (!dog.sireId || !dog.damId) return 0;
    return this.between(dog.sireId, dog.damId);
  }

  /** COI of a puppy that has not been born yet. */
  projectedCoi(sireId: string, damId: string): number {
    return this.between(sireId, damId);
  }
}

// ---------------------------------------------------------------------------
// Reading a family tree
// ---------------------------------------------------------------------------

export interface PedigreeNode {
  dog: Dog | null;
  sire: PedigreeNode | null;
  dam: PedigreeNode | null;
  depth: number;
}

export function buildPedigree(dogId: string, lookup: DogLookup, depth = 4): PedigreeNode {
  const build = (id: string | undefined, level: number): PedigreeNode => {
    const dog = id ? lookup(id) ?? null : null;
    if (!dog || level >= depth) {
      return { dog, sire: null, dam: null, depth: level };
    }
    return {
      dog,
      sire: build(dog.sireId, level + 1),
      dam: build(dog.damId, level + 1),
      depth: level,
    };
  };
  return build(dogId, 0);
}

/** Every ancestor of a dog, with how many generations back each one sits. */
export function ancestorSet(dogId: string, lookup: DogLookup, maxDepth = 12): Map<string, number> {
  const found = new Map<string, number>();
  const walk = (id: string | undefined, level: number) => {
    if (!id || level > maxDepth) return;
    const dog = lookup(id);
    if (!dog) return;
    const existing = found.get(id);
    if (existing === undefined || level < existing) found.set(id, level);
    walk(dog.sireId, level + 1);
    walk(dog.damId, level + 1);
  };
  const start = lookup(dogId);
  if (start) {
    walk(start.sireId, 1);
    walk(start.damId, 1);
  }
  return found;
}

/** Names of the ancestors two dogs have in common, closest first. */
export function sharedAncestors(
  aId: string,
  bId: string,
  lookup: DogLookup,
  limit = 4,
): { dog: Dog; generations: number }[] {
  const a = ancestorSet(aId, lookup);
  const b = ancestorSet(bId, lookup);
  const shared: { dog: Dog; generations: number }[] = [];

  for (const [id, depthA] of a) {
    const depthB = b.get(id);
    if (depthB === undefined) continue;
    const dog = lookup(id);
    if (dog) shared.push({ dog, generations: Math.min(depthA, depthB) });
  }

  shared.sort((x, y) => x.generations - y.generations);
  return shared.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Population-level measures
// ---------------------------------------------------------------------------

/**
 * How much of the current breeding population traces back to each founder.
 * This is what exposes a popular sire: one name quietly creeping toward a
 * third of the gene pool while every individual pairing still looks fine.
 */
export function genomeContribution(
  population: Dog[],
  lookup: DogLookup,
): Map<string, number> {
  const totals = new Map<string, number>();
  if (population.length === 0) return totals;

  // Each living dog contributes one whole genome, split backwards through its
  // ancestry by halves until it reaches a dog with no recorded parents.
  const distribute = (id: string | undefined, share: number, depth: number) => {
    if (!id || share < 0.0005 || depth > 20) return;
    const dog = lookup(id);
    if (!dog) return;
    if (!dog.sireId && !dog.damId) {
      totals.set(id, (totals.get(id) ?? 0) + share);
      return;
    }
    distribute(dog.sireId, share / 2, depth + 1);
    distribute(dog.damId, share / 2, depth + 1);
  };

  for (const dog of population) distribute(dog.id, 1, 0);

  // Convert to a share of the whole population.
  for (const [id, value] of totals) totals.set(id, value / population.length);
  return totals;
}

/**
 * How much any single named ancestor contributes to the living population,
 * whether or not that ancestor is a founder. Used for the popular sire warning.
 */
export function ancestorInfluence(
  ancestorId: string,
  population: Dog[],
  lookup: DogLookup,
): number {
  if (population.length === 0) return 0;
  let descendants = 0;
  for (const dog of population) {
    if (dog.id === ancestorId) {
      descendants += 1;
      continue;
    }
    if (ancestorSet(dog.id, lookup).has(ancestorId)) descendants += 1;
  }
  return descendants / population.length;
}

/**
 * "Effective number of founders": if the gene pool were spread perfectly
 * evenly, how many founders would give this much diversity? A programme with
 * twelve founders but an effective number of three is in trouble.
 */
export function effectiveFounders(population: Dog[], lookup: DogLookup): number {
  const contributions = genomeContribution(population, lookup);
  let sumSquares = 0;
  for (const share of contributions.values()) sumSquares += share * share;
  return sumSquares > 0 ? 1 / sumSquares : 0;
}

/**
 * How many genuinely separate family lines exist. Two dogs count as the same
 * line when their kinship is high enough that they are effectively relatives.
 */
export function countFamilyLines(population: Dog[], kinship: Kinship, threshold = 0.12): number {
  const unassigned = population.map((d) => d.id);
  const lines: string[][] = [];

  while (unassigned.length > 0) {
    const seed = unassigned.shift()!;
    const line = [seed];
    for (let i = unassigned.length - 1; i >= 0; i--) {
      if (kinship.between(seed, unassigned[i]) >= threshold) {
        line.push(unassigned[i]);
        unassigned.splice(i, 1);
      }
    }
    lines.push(line);
  }

  return lines.length;
}

/** Average COI across a group of dogs. */
export function averageCoi(population: Dog[]): number {
  if (population.length === 0) return 0;
  return population.reduce((sum, d) => sum + d.coi, 0) / population.length;
}

/**
 * Plain-language reading of a COI figure, so the player never has to remember
 * what counts as high.
 */
export function describeCoi(coi: number): { label: string; tone: 'good' | 'ok' | 'warn' | 'bad' } {
  const pct = coi * 100;
  if (pct < 1) return { label: 'Completely unrelated', tone: 'good' };
  if (pct < 3.2) return { label: 'Distantly related', tone: 'good' };
  if (pct < 6.5) return { label: 'Related, roughly cousins', tone: 'ok' };
  if (pct < 12.6) return { label: 'Closely related', tone: 'warn' };
  if (pct < 20) return { label: 'Very close — like half siblings', tone: 'bad' };
  return { label: 'Extremely close — like full siblings', tone: 'bad' };
}
