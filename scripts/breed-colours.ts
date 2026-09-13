/**
 * Prints the colours each breed actually produces, so the allele tables can
 * be checked against the real breed standards.
 *
 * Run with:  npx tsx --tsconfig tsconfig.app.json scripts/breed-colours.ts [breedKey]
 */

import { BREEDS } from '../src/engine/breeds';
import { createFounder } from '../src/engine/dog';
import { Rng } from '../src/engine/rng';
import { resolveCoat, resolveColor } from '../src/engine/phenotype';
import { sizeToPounds } from '../src/engine/traits';

const only = process.argv[2];
const rng = new Rng(777);

for (const breed of BREEDS) {
  if (only && breed.key !== only) continue;
  const colours = new Map<string, number>();
  const coats = new Map<string, number>();
  const N = 300;
  for (let i = 0; i < N; i++) {
    const dog = createFounder(rng, { breedKey: breed.key, sex: 'F', name: 'x', currentMonth: 0, wildcards: false });
    const c = resolveColor(dog.genotype).name;
    colours.set(c, (colours.get(c) ?? 0) + 1);
    const k = resolveCoat(dog.genotype, sizeToPounds(dog.observed.size)).label;
    coats.set(k, (coats.get(k) ?? 0) + 1);
  }
  const top = [...colours.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  const coatTop = [...coats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  console.log(`\n${breed.name} (${breed.key})`);
  console.log('  ' + top.map(([n, k]) => `${n} ${Math.round((k / N) * 100)}%`).join(' | '));
  console.log('  coat: ' + coatTop.map(([n, k]) => `${n} ${Math.round((k / N) * 100)}%`).join(' | '));
}
