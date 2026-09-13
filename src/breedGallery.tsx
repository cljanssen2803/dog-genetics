/**
 * Dev-only page: one generated dog from each of a spread of breeds, drawn with
 * the real sprite renderer, so we can judge honestly whether the artwork
 * actually reads as the breed. Served by Vite at /breed-gallery.html.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { DogSprite, SpriteFilters } from './ui/DogSprite';
import { createFounder } from './engine/dog';
import { Rng } from './engine/rng';
import { BREED_BY_KEY } from './engine/breeds';
import { TAIL_LABEL, legShortening, resolveCoat, resolveColor, resolveSilhouette, resolveTail } from './engine/phenotype';
import { sizeToPounds } from './engine/traits';

const SHOWCASE = [
  'greyhound', 'whippet', 'bulldog', 'pug', 'frenchie', 'dachshund', 'corgi', 'basset',
  'husky', 'akita', 'samoyed', 'pomeranian', 'shiba', 'chow',
  'greatDane', 'mastiff', 'labrador', 'golden', 'borderCollie', 'gsd',
  'poodleStandard', 'miniSchnauzer', 'westie', 'bichon', 'yorkie', 'afghan',
  'chineseCrested', 'bloodhound', 'boxer', 'dalmatian', 'ausShepherd', 'rottweiler', 'beagle', 'bernese', 'springer', 'cattleDog',
];

function Gallery() {
  const rng = new Rng(4242);
  // ?breeds=dachshund,corgi narrows the page to a few breeds for comparison.
  const only = new URLSearchParams(window.location.search).get('breeds');
  const keys = only ? only.split(',').filter((k) => BREED_BY_KEY[k]) : SHOWCASE;
  const size = Number(new URLSearchParams(window.location.search).get('size') ?? 300);
  return (
    <div className="paper min-h-full p-4">
      <SpriteFilters />
      <h1 className="display text-[22px] font-semibold mb-1">Does it look like the breed?</h1>
      <p className="text-[13px] text-[var(--text-soft)] mb-4">One generated founder per breed, real renderer.</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))` }}>
        {keys.map((key) => {
          const breed = BREED_BY_KEY[key];
          const dog = createFounder(rng, { breedKey: key, sex: 'F', name: breed.name, currentMonth: 0, ageMonths: 30, wildcards: false });
          const lbs = sizeToPounds(dog.observed.size);
          const coat = resolveCoat(dog.genotype, lbs);
          const colour = resolveColor(dog.genotype);
          const tail = TAIL_LABEL[resolveTail(dog.genotype, dog.observed.tailSet, dog.observed.muzzle, coat.kind)];
          const body = resolveSilhouette(coat, dog.observed.substance, dog.observed.muzzle, dog.observed.earSet, lbs, legShortening(dog.genotype));
          return (
            <div key={key} className="card p-2">
              <DogSprite dog={dog} size={size} />
              <div className="text-[12.5px] font-semibold mt-1">{breed.name}</div>
              <div className="text-[10.5px] text-[var(--text-faint)] leading-snug">
                {lbs.toFixed(0)} lb · {colour.name}
                <br />
                {coat.label}
                <br />
                {body} body · {tail.toLowerCase()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
