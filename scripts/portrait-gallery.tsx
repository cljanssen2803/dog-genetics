/**
 * Renders the real DogPortrait component for a spread of very different dogs
 * and writes them into a single HTML page.
 *
 * Two jobs: it checks the drawing maths never produces NaN coordinates (which
 * would silently render nothing), and it gives a page that can actually be
 * looked at to judge whether the dogs read correctly.
 *
 * Run with:  npx tsx scripts/portrait-gallery.tsx
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DogPortrait } from '../src/ui/DogPortrait';
import { createFounder } from '../src/engine/dog';
import { Rng } from '../src/engine/rng';
import { BREEDS, BREED_BY_KEY } from '../src/engine/breeds';
import { resolveCoat, resolveColor } from '../src/engine/phenotype';
import { sizeToPounds } from '../src/engine/traits';

const here = dirname(fileURLToPath(import.meta.url));

/** Breeds chosen to stress every different part of the drawing code. */
const SHOWCASE = [
  'greatDane',
  'chihuahua',
  'poodleStandard',
  'dachshund',
  'corgi',
  'husky',
  'chineseCrested',
  'americanHairless',
  'ausShepherd',
  'greyhound',
  'miniSchnauzer',
  'shihTzu',
  'frenchie',
  'bernese',
  'basenji',
  'samoyed',
  'labrador',
  'papillon',
];

const rng = new Rng(20260911);
const cards: string[] = [];
let problems = 0;

for (const breedKey of SHOWCASE) {
  const breed = BREED_BY_KEY[breedKey];
  for (let variant = 0; variant < 2; variant++) {
    const dog = createFounder(rng, {
      breedKey,
      sex: variant === 0 ? 'F' : 'M',
      name: `${breed.name} ${variant + 1}`,
      currentMonth: 0,
      ageMonths: 30,
      wildcards: true,
    });

    const svg = renderToStaticMarkup(<DogPortrait dog={dog} size={200} />);

    // The classic silent failure: a NaN in a path turns the whole shape off.
    if (/NaN|Infinity|undefined/.test(svg)) {
      console.error(`  ✗ ${breed.name} (${dog.name}) produced an invalid drawing`);
      problems += 1;
    }

    const coat = resolveCoat(dog.genotype, sizeToPounds(dog.observed.size));
    const color = resolveColor(dog.genotype);

    cards.push(`
      <figure>
        ${svg}
        <figcaption>
          <strong>${breed.name}</strong>
          <span>${sizeToPounds(dog.observed.size).toFixed(1)} lb · ${dog.sex === 'M' ? 'male' : 'female'}</span>
          <span>${color.name}</span>
          <span>${coat.label}</span>
        </figcaption>
      </figure>`);
  }
}

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Dog portrait gallery</title>
<style>
  body { margin:0; padding:24px; background:#f4efe4; color:#221f1a;
         font-family: -apple-system, 'Segoe UI', system-ui, sans-serif; }
  h1 { font-family: Georgia, serif; font-size: 24px; margin:0 0 4px; }
  p.lede { color:#5c554a; font-size:14px; margin:0 0 24px; max-width:60ch; line-height:1.5; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(215px,1fr)); gap:14px; }
  figure { margin:0; background:#fdfaf3; border:1px solid #d8cfbc; border-radius:14px;
           padding:10px; }
  figure svg { display:block; width:100%; height:auto; }
  figcaption { display:flex; flex-direction:column; gap:1px; margin-top:6px;
               font-size:11.5px; color:#5c554a; line-height:1.35; }
  figcaption strong { font-size:13px; color:#221f1a; }
  @media (prefers-color-scheme: dark) {
    body { background:#16150f; color:#f0ead9; }
    figure { background:#24221a; border-color:#3a362b; }
    figcaption { color:#b9b1a0; } figcaption strong { color:#f0ead9; }
    p.lede { color:#b9b1a0; }
  }
</style></head>
<body>
  <h1>Every dog is drawn from its own genes</h1>
  <p class="lede">Two randomly generated individuals from each of ${SHOWCASE.length} breeds.
  Body length, leg length, muzzle, ears, tail, coat texture, colour and markings all come
  from what the dog actually inherited — nothing here is a stock picture.</p>
  <div class="grid">${cards.join('')}</div>
</body></html>`;

const out = join(here, '..', 'portrait-gallery.html');
writeFileSync(out, html);

console.log(`Rendered ${cards.length} portraits to ${out}`);
console.log(problems === 0 ? '✓ No invalid drawings.' : `✗ ${problems} invalid drawing(s).`);
process.exit(problems === 0 ? 0 : 1);
