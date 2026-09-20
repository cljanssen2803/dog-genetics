/**
 * Prints which body and ear each breed actually lands on, across a spread of
 * founders, so the silhouette rules can be checked against the real breeds.
 *
 * Run with:  npx tsx --tsconfig tsconfig.app.json scripts/breed-bodies.ts [breedKey ...]
 */

import { BREEDS } from '../src/engine/breeds';
import { createFounder } from '../src/engine/dog';
import { Rng } from '../src/engine/rng';
import { legShortening, resolveCoat, resolveEars, resolveSilhouette } from '../src/engine/phenotype';
import { sizeToPounds } from '../src/engine/traits';

const only = process.argv.slice(2);
const rng = new Rng(4242);

for (const breed of BREEDS) {
  if (only.length && !only.includes(breed.key)) continue;
  const bodies = new Map<string, number>();
  const N = 40;
  for (let i = 0; i < N; i++) {
    const dog = createFounder(rng, { breedKey: breed.key, sex: 'F', name: 'x', currentMonth: 0, wildcards: false });
    const lbs = sizeToPounds(dog.observed.size);
    const coat = resolveCoat(dog.genotype, lbs);
    const o = dog.observed;
    const s = resolveSilhouette(coat, o.substance, o.muzzle, o.earSet, lbs, legShortening(dog.genotype), o.tailSet);
    const k = `${s}/${resolveEars(o.earSet)}`;
    bodies.set(k, (bodies.get(k) ?? 0) + 1);
  }
  const top = [...bodies.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${Math.round((100 * n) / N)}%`);
  console.log(`${breed.key.padEnd(16)} ${top.join('  ')}`);
}
