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
import { BREEDS, BREED_BY_KEY } from './engine/breeds';
import { type EarType, type Silhouette, type TailType, TAIL_LABEL, legShortening, resolveCoat, resolveColor, resolveSilhouette, resolveTail } from './engine/phenotype';
import { sizeToPounds } from './engine/traits';

const SHOWCASE = [
  'greyhound', 'whippet', 'bulldog', 'pug', 'frenchie', 'dachshund', 'corgi', 'basset',
  'husky', 'akita', 'samoyed', 'pomeranian', 'shiba', 'chow',
  'greatDane', 'mastiff', 'labrador', 'golden', 'borderCollie', 'gsd',
  'poodleStandard', 'miniSchnauzer', 'westie', 'bichon', 'yorkie', 'afghan',
  'chineseCrested', 'bloodhound', 'boxer', 'dalmatian', 'ausShepherd', 'rottweiler', 'beagle', 'bernese', 'springer', 'cattleDog',
];

/** Every body, drawn with every tail and every ear. ?mode=combos[&body=spitz,bull] */
const ALL_SILHOUETTES: Silhouette[] = [
  'smooth', 'short', 'silky', 'long', 'doubleThick', 'wire', 'wavyFurnished', 'curly', 'hairless', 'corded',
  'sighthound', 'tallHound', 'bull', 'heavy', 'jowl', 'egg', 'terrier', 'spitz', 'lowSmooth', 'lowHeavy', 'lowWire',
  'flatLong', 'wrinkle', 'roughHound', 'silkyHound', 'retriever', 'pointer', 'shepherd', 'softWavy', 'hound', 'bully', 'spaniel', 'plush', 'mountain', 'basset', 'greyhound',
];
const ALL_TAILS: TailType[] = ['full', 'whip', 'plume', 'sickle', 'curled', 'screw', 'bobtail'];
const ALL_EARS: EarType[] = ['drop', 'button', 'semiErect', 'erect'];
/** A breed whose natural body is this one, so the coat and colour make sense. */
const REP: Partial<Record<Silhouette, string>> = {
  smooth: 'beagle', short: 'beagle', silky: 'cocker', long: 'coton', doubleThick: 'golden', wire: 'miniSchnauzer',
  wavyFurnished: 'havanese', curly: 'poodleStandard', hairless: 'xolo', corded: 'puli', sighthound: 'whippet', tallHound: 'pharaoh',
  bull: 'bulldog', heavy: 'mastiff', jowl: 'staffie', egg: 'bullTerrier', terrier: 'ratTerrier', spitz: 'shiba', lowSmooth: 'dachshund',
  lowHeavy: 'basset', lowWire: 'westie', flatLong: 'shihTzu', wrinkle: 'sharPei', roughHound: 'irishWolfhound', silkyHound: 'afghan',
  retriever: 'labrador', pointer: 'gsp', shepherd: 'gsd', softWavy: 'wheaten', hound: 'bloodhound',
  bully: 'boxer', spaniel: 'cocker', plush: 'golden', mountain: 'newfoundland', basset: 'basset', greyhound: 'greyhound',
};

function Combos() {
  const rng = new Rng(77);
  const params = new URLSearchParams(window.location.search);
  const only = params.get('body')?.split(',') as Silhouette[] | undefined;
  const size = Number(params.get('size') ?? 100);
  const bodies = only && only.length && only[0] ? only : ALL_SILHOUETTES;
  return (
    <div className="paper min-h-full p-2">
      <SpriteFilters />
      {bodies.map((sil) => {
        const key = REP[sil] && BREED_BY_KEY[REP[sil]!] ? REP[sil]! : 'beagle';
        const dog = createFounder(rng, { breedKey: key, sex: 'M', name: sil, currentMonth: 0, ageMonths: 30, wildcards: false });
        return (
          <div key={sil} className="mb-3">
            <div className="text-[12px] font-bold mb-1">{sil} <span className="font-normal text-[var(--text-faint)]">({BREED_BY_KEY[key].name})</span></div>
            <div className="flex flex-wrap gap-1">
              {ALL_TAILS.map((tail) => (
                <div key={tail} className="text-center" style={{ width: size }}>
                  <DogSprite dog={dog} size={size} force={{ silhouette: sil, tail }} />
                  <div className="text-[9px] text-[var(--text-faint)]">{tail}</div>
                </div>
              ))}
              {ALL_EARS.map((ears) => (
                <div key={ears} className="text-center" style={{ width: size }}>
                  <DogSprite dog={dog} size={size} force={{ silhouette: sil, ears }} />
                  <div className="text-[9px] text-[var(--text-faint)]">{ears}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Gallery() {
  if (new URLSearchParams(window.location.search).get('mode') === 'combos') return <Combos />;
  const rng = new Rng(4242);
  // ?breeds=dachshund,corgi narrows the page to a few breeds for comparison.
  const only = new URLSearchParams(window.location.search).get('breeds');
  const keys = only === 'all' ? BREEDS.map((b) => b.key) : only ? only.split(',').filter((k) => BREED_BY_KEY[k]) : SHOWCASE;
  const size = Number(new URLSearchParams(window.location.search).get('size') ?? 300);
  const cols = Number(new URLSearchParams(window.location.search).get('cols') ?? 0);
  // ?age=2 draws every dog as a puppy of that many months.
  const ageParam = new URLSearchParams(window.location.search).get('age');
  const asAge = ageParam ? Number(ageParam) : undefined;
  return (
    <div className="paper min-h-full p-4">
      <SpriteFilters />
      <h1 className="display text-[22px] font-semibold mb-1">Does it look like the breed?</h1>
      <p className="text-[13px] text-[var(--text-soft)] mb-4">One generated founder per breed, real renderer.</p>
      <div className="grid gap-3" style={{ gridTemplateColumns: cols ? `repeat(${cols}, 1fr)` : `repeat(auto-fill, minmax(${size}px, 1fr))` }}>
        {keys.map((key) => {
          const breed = BREED_BY_KEY[key];
          const dog = createFounder(rng, { breedKey: key, sex: 'F', name: breed.name, currentMonth: 0, ageMonths: 30, wildcards: false });
          const lbs = sizeToPounds(dog.observed.size);
          const coat = resolveCoat(dog.genotype, lbs);
          const colour = resolveColor(dog.genotype);
          const tail = TAIL_LABEL[resolveTail(dog.genotype, dog.observed.tailSet, dog.observed.muzzle, coat.kind, lbs)];
          const body = resolveSilhouette(coat, dog.observed.substance, dog.observed.muzzle, dog.observed.earSet, lbs, legShortening(dog.genotype), dog.observed.tailSet);
          return (
            <div key={key} className="card p-1">
              <DogSprite dog={dog} size={size} asAge={asAge} />
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
