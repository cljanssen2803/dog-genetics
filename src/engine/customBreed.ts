/**
 * FOUNDING A BREED
 *
 * When a dog comes out the way the player wanted, they can found a breed on
 * it. The new breed is a real entry in the bank: its trait averages are that
 * dog's traits, its gene frequencies are that dog's genes (a gene the dog
 * carries two copies of is fixed in the breed; one it carries a single copy
 * of is at fifty-fifty), and its typical weight is the dog's. Founders drawn
 * from it come out as close cousins of the original — the same look, with
 * the natural wobble a real breed has.
 */

import { type BreedProfile, CUSTOM_GROUP } from './breeds';
import type { Dog } from './dog';
import { LOCI } from './loci';
import { ALL_TRAITS, type PolyTrait, sizeToPounds } from './traits';

export interface FoundBreedOptions {
  name: string;
  blurb: string;
  projectName: string;
  generation: number;
}

export function breedFromDog(dog: Dog, opts: FoundBreedOptions): BreedProfile {
  const traits: Partial<Record<Exclude<PolyTrait, 'size'>, number>> = {};
  for (const trait of ALL_TRAITS) {
    if (trait === 'size') continue;
    traits[trait] = Math.round(dog.observed[trait]);
  }

  const alleles: Record<string, Record<string, number>> = {};
  const diseases: Record<string, number> = {};
  for (const locus of LOCI) {
    const pair = dog.genotype[locus.key];
    if (!pair) continue;
    if (locus.category === 'quirk') continue;
    if (locus.category === 'disease') {
      // A carrier founds a breed where half the copies are broken; an
      // affected dog, all of them. A clear dog leaves only the background whisper.
      const broken = (pair[0] === 'm' ? 1 : 0) + (pair[1] === 'm' ? 1 : 0);
      if (broken > 0) diseases[locus.key] = broken / 2;
      continue;
    }
    const table: Record<string, number> = {};
    for (const a of locus.alleles) table[a.code] = 0;
    table[pair[0]] = (table[pair[0]] ?? 0) + 0.5;
    table[pair[1]] = (table[pair[1]] ?? 0) + 0.5;
    alleles[locus.key] = table;
  }

  return {
    key: `custom_${Date.now().toString(36)}`,
    name: opts.name.trim(),
    group: CUSTOM_GROUP,
    weight: Math.round(sizeToPounds(dog.observed.size)),
    weightSpread: 0.08,
    traits,
    alleles,
    diseases,
    blurb: opts.blurb.trim(),
    custom: {
      createdAt: new Date().toISOString(),
      projectName: opts.projectName,
      dogName: dog.name,
      generation: opts.generation,
    },
  };
}
