/**
 * Seeded random number generator.
 *
 * Why this exists: JavaScript's built-in Math.random() cannot be reproduced.
 * If a bug happens we would never be able to replay it. This generator starts
 * from a "seed" number, and the same seed always produces the same sequence of
 * numbers. Each saved game stores its seed and its current position, so a save
 * file completely describes its own luck.
 */

/** A serialisable snapshot of where the generator currently is. */
export interface RngSnapshot {
  seed: number;
  cursor: number;
}

export class Rng {
  /** The original seed the project was created with (never changes). */
  readonly seed: number;
  /** Internal position. Advances every time a number is drawn. */
  private cursor: number;

  constructor(seed: number, cursor = 0) {
    this.seed = seed >>> 0;
    this.cursor = cursor >>> 0;
  }

  /** Save the exact current position so it can be restored later. */
  snapshot(): RngSnapshot {
    return { seed: this.seed, cursor: this.cursor };
  }

  static restore(snap: RngSnapshot): Rng {
    return new Rng(snap.seed, snap.cursor);
  }

  /**
   * Core generator (the "mulberry32" algorithm). Returns a number from 0 up to
   * but not including 1. Small, fast, and good enough for a game.
   */
  next(): number {
    this.cursor = (this.cursor + 0x6d2b79f5) >>> 0;
    let t = this.cursor;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Random number between min and max (never exactly max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Random whole number from min to max, both ends included. */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  /** True with the given probability (0 = never, 1 = always). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Pick one item from a list. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /**
   * Pick one item where some items are more likely than others.
   * `weights` must be the same length as `items`; bigger weight = more likely.
   */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    let total = 0;
    for (const w of weights) total += w;
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /**
   * Pick a key from an object of { key: weight } pairs.
   * Used constantly for breed allele frequencies.
   */
  weightedKey<K extends string>(table: Record<K, number>): K {
    const keys = Object.keys(table) as K[];
    return this.weighted(
      keys,
      keys.map((k) => table[k]),
    );
  }

  /**
   * A "bell curve" random number (normal distribution).
   * Most results land near `mean`; big deviations are rare.
   * `sd` (standard deviation) controls the spread.
   */
  normal(mean = 0, sd = 1): number {
    // Box-Muller transform.
    let u = this.next();
    if (u < 1e-12) u = 1e-12;
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** A bell curve that never strays more than `limit` deviations from centre. */
  clampedNormal(mean: number, sd: number, limit = 3): number {
    const raw = this.normal(0, 1);
    const capped = Math.max(-limit, Math.min(limit, raw));
    return mean + capped * sd;
  }

  /** Shuffle a copy of a list into random order. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Sample `count` distinct items (or as many as exist). */
  sample<T>(items: readonly T[], count: number): T[] {
    return this.shuffle(items).slice(0, Math.max(0, count));
  }

  /**
   * Create an independent generator branched off this one. Useful when we want
   * a sub-system (for example, generating one outside dog) to have its own
   * stream of luck without disturbing the main sequence.
   */
  fork(): Rng {
    return new Rng(Math.floor(this.next() * 0xffffffff));
  }
}

/** Turn any text into a stable number, so "Hearthdog" always seeds the same. */
export function hashString(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A fresh unpredictable seed for a brand-new project. */
export function makeSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
