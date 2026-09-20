/**
 * THE PLAYGROUND
 *
 * No standard, no kennel, no calendar. Make dogs from any breed, put any two
 * together, and see what comes out — then keep a puppy and cross it again.
 * It is the genetics engine with everything that scores you removed.
 *
 * One playground is kept per device. It is small (a bench of dogs and the
 * litters they made) and saves itself after every change.
 */

import { del, get, set } from 'idb-keyval';
import { type Dog, createFounder, createMixedFounder, newDogId, primeIdCounter, idNumber } from '../engine/dog';
import { attemptMating, deliverLitter } from '../engine/breeding';
import { Kinship } from '../engine/pedigree';
import { type NameRegistry, createNameRegistry, pickName } from '../engine/names';
import type { Sex } from '../engine/names';
import { Rng, makeSeed } from '../engine/rng';
import { orderPair } from '../engine/loci';
import { BREED_BY_KEY } from '../engine/breeds';
import { TWISTS, type Twist } from '../engine/twists';

const KEY = 'dogGenetics.playground';

/** Grown dogs are drawn and bred as thirty-month-olds. */
export const BENCH_AGE = 30;

export interface PlayLitter {
  id: string;
  sireId: string;
  damId: string;
  puppyIds: string[];
  lost: string[];
  coi: number;
}

export interface Playground {
  seed: number;
  cursor: number;
  /** Every dog ever made here, so relatedness can be worked out. */
  dogs: Record<string, Dog>;
  /** The dogs on the bench, ready to cross. */
  bench: string[];
  /** Newest first. */
  litters: PlayLitter[];
  names: NameRegistry;
  updatedAt: number;
}

export function newPlayground(): Playground {
  return {
    seed: makeSeed(),
    cursor: 0,
    dogs: {},
    bench: [],
    litters: [],
    names: createNameRegistry(),
    updatedAt: Date.now(),
  };
}

function rngFor(pg: Playground): Rng {
  return new Rng(pg.seed, pg.cursor);
}
function commit(pg: Playground, rng: Rng) {
  pg.cursor = rng.snapshot().cursor;
  pg.updatedAt = Date.now();
}

// ---------------------------------------------------------------------------
// Colour twists: make a fresh dog actually SHOW a colour
// ---------------------------------------------------------------------------

/** The shared catalogue, under the name this file has always used. */
export type PlayTwist = Twist;
export const PLAY_TWISTS: PlayTwist[] = TWISTS;

function applyTwist(dog: Dog, twist: PlayTwist, rng: Rng) {
  for (const s of twist.show) {
    const pair = dog.genotype[s.locus];
    if (!pair) continue;
    if (s.alleles.length === 2) {
      dog.genotype[s.locus] = orderPair(s.locus, s.alleles[0], s.alleles[1]);
    } else {
      // One copy: replace a random existing copy with it, unless it is already there.
      const a = s.alleles[0];
      if (pair[0] === a || pair[1] === a) continue;
      dog.genotype[s.locus] = orderPair(s.locus, a, rng.chance(0.5) ? pair[0] : pair[1]);
    }
  }
}

// ---------------------------------------------------------------------------
// Making dogs
// ---------------------------------------------------------------------------

export interface MakeDogOptions {
  /** A breed key, or 'mixed' for a dog of no particular breed. */
  breedKey: string;
  sex: Sex;
  twists?: string[];
}

/** A grown dog of any breed, wearing any colours you asked for, on the bench. */
export function makeDog(pg: Playground, opts: MakeDogOptions): Dog {
  const rng = rngFor(pg);
  const common = { sex: opts.sex, name: pickName(pg.names, opts.sex, rng), currentMonth: 0, ageMonths: BENCH_AGE, wildcards: true };
  const dog =
    opts.breedKey === 'mixed' || !BREED_BY_KEY[opts.breedKey]
      ? createMixedFounder(rng, common)
      : createFounder(rng, { ...common, breedKey: opts.breedKey });
  for (const key of opts.twists ?? []) {
    const twist = PLAY_TWISTS.find((t) => t.key === key);
    if (twist) applyTwist(dog, twist, rng);
  }
  dog.tests = { dna: true, hips: true, eyes: true, cardiac: true };
  pg.dogs[dog.id] = dog;
  pg.bench.push(dog.id);
  commit(pg, rng);
  return dog;
}

/** How related two bench dogs are, from the litters made here. */
export function playKinship(pg: Playground): Kinship {
  return new Kinship((id) => pg.dogs[id]);
}

/** Put two dogs together. Returns the litter; puppies are stored but not benched. */
export function crossDogs(pg: Playground, sireId: string, damId: string): PlayLitter | null {
  const sire = pg.dogs[sireId];
  const dam = pg.dogs[damId];
  if (!sire || !dam || sire.sex !== 'M' || dam.sex !== 'F') return null;
  const rng = rngFor(pg);
  const coi = playKinship(pg).projectedCoi(sireId, damId);
  const generation = Math.max(sire.generation, dam.generation) + 1;
  const attempt = attemptMating(rng, sire, dam, 0, coi, generation);
  const born = deliverLitter(rng, attempt.pregnancy, sire, dam, 0, pg.names, 'Playground cross');
  for (const p of born.puppies) {
    p.breedLabel = crossLabel(sire, dam);
    pg.dogs[p.id] = p;
    sire.offspringIds.push(p.id);
    dam.offspringIds.push(p.id);
  }
  sire.littersProduced += 1;
  dam.littersProduced += 1;
  const litter: PlayLitter = {
    id: born.litterId,
    sireId,
    damId,
    puppyIds: born.puppies.map((p) => p.id),
    lost: born.lost.map((l) => l.reason),
    coi,
  };
  pg.litters.unshift(litter);
  // Keep the playground small: the last twelve litters. Puppies from older
  // ones stay only if they made it to the bench or have descendants there.
  if (pg.litters.length > 12) {
    const dropped = pg.litters.splice(12);
    const keep = new Set<string>(pg.bench);
    for (const id of pg.bench) for (const anc of ancestorsOf(pg, id)) keep.add(anc);
    for (const l of dropped) for (const id of l.puppyIds) if (!keep.has(id)) delete pg.dogs[id];
  }
  commit(pg, rng);
  return litter;
}

function ancestorsOf(pg: Playground, id: string, out = new Set<string>()): Set<string> {
  const d = pg.dogs[id];
  if (!d) return out;
  for (const pid of [d.sireId, d.damId]) {
    if (pid && !out.has(pid)) {
      out.add(pid);
      ancestorsOf(pg, pid, out);
    }
  }
  return out;
}

/** "Great Dane × Standard Poodle", or shorter once the parents are crosses themselves. */
function crossLabel(sire: Dog, dam: Dog): string {
  const a = sire.breedLabel.replace(/ type$/, '');
  const b = dam.breedLabel.replace(/ type$/, '');
  if (a === b) return a;
  if (a.includes('×') || b.includes('×')) return 'Playground cross';
  return `${a} × ${b}`;
}

/** Move a puppy onto the bench as a grown dog. */
export function benchPuppy(pg: Playground, id: string): Dog | null {
  const d = pg.dogs[id];
  if (!d || pg.bench.includes(id)) return d ?? null;
  d.birthMonth = -BENCH_AGE;
  pg.bench.push(id);
  pg.updatedAt = Date.now();
  return d;
}

export function unbench(pg: Playground, id: string) {
  pg.bench = pg.bench.filter((x) => x !== id);
  pg.updatedAt = Date.now();
}

export function renamePlayDog(pg: Playground, id: string, name: string) {
  const d = pg.dogs[id];
  if (d && name.trim()) d.name = name.trim().slice(0, 24);
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

export async function loadPlayground(): Promise<Playground> {
  try {
    const stored = await get<Playground>(KEY);
    if (stored) {
      // Ids must keep counting up from wherever this playground got to.
      let highest = 0;
      for (const id of Object.keys(stored.dogs)) highest = Math.max(highest, idNumber(id));
      primeIdCounter(highest + 1);
      return stored;
    }
  } catch {
    // fall through to a fresh one
  }
  return newPlayground();
}

export async function savePlayground(pg: Playground): Promise<void> {
  try {
    await set(KEY, pg);
  } catch {
    // Losing a playground is not worth interrupting play for.
  }
}

export async function clearPlayground(): Promise<void> {
  await del(KEY);
}

/** A fresh id for anything the screen needs to key. */
export const freshId = newDogId;
