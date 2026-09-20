/**
 * THE BREED GALLERY
 *
 * Every breed in the bank, drawn by the real sprite renderer, just to look
 * through. Search by name, narrow to a group, flip everyone to puppies, and
 * tap a dog for a bigger portrait, its blurb, and a fresh roll (each dog is
 * one generated founder, so no two rolls come out quite the same).
 */

import { useMemo, useState } from 'react';
import { Dices, Search } from 'lucide-react';
import { Button, Card, Chip, Segmented, Sheet } from '../components';
import { DogSprite } from '../DogSprite';
import { createFounder } from '../../engine/dog';
import { Rng } from '../../engine/rng';
import { BREEDS, BREED_BY_KEY, BREED_GROUPS, breedFamily, type BreedProfile } from '../../engine/breeds';
import { TAIL_LABEL, EAR_LABEL, resolveCoat, resolveColor, resolveEars, resolveTail } from '../../engine/phenotype';
import { sizeToPounds } from '../../engine/traits';

/** One rolled founder for a breed; `roll` picks which one. */
function rollDog(key: string, roll: number) {
  const rng = new Rng(4242 + roll * 7919);
  return createFounder(rng, { breedKey: key, sex: roll % 2 ? 'M' : 'F', name: BREED_BY_KEY[key].name, currentMonth: 0, ageMonths: 30, wildcards: false });
}

type Age = 'adult' | 'puppy';

export function BreedGallerySheet({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [age, setAge] = useState<Age>('adult');
  const [open, setOpen] = useState<BreedProfile | null>(null);
  // Bumping a breed's roll re-generates its dog.
  const [rolls, setRolls] = useState<Record<string, number>>({});

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BREEDS.filter((b) => (!group || breedFamily(b) === group) && (!q || b.name.toLowerCase().includes(q) || b.group.toLowerCase().includes(q)));
  }, [query, group]);

  const reroll = (key: string) => setRolls((r) => ({ ...r, [key]: (r[key] ?? 0) + 1 }));

  return (
    <Sheet open onClose={onClose} title="Breed gallery" subtitle={`${BREEDS.length} breeds in the bank, drawn as they come`}>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--card)] px-2 py-1.5 mb-2">
        <Search size={15} className="text-[var(--text-faint)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a breed"
          className="flex-1 bg-transparent outline-none text-[14px]"
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        <button onClick={() => setGroup(null)}>
          <Chip tone={group === null ? 'info' : 'neutral'}>All</Chip>
        </button>
        {BREED_GROUPS.map((g) => (
          <button key={g} onClick={() => setGroup(group === g ? null : g)}>
            <Chip tone={group === g ? 'info' : 'neutral'}>{g}</Chip>
          </button>
        ))}
      </div>
      <div className="mb-3">
        <Segmented<Age> options={[{ value: 'adult', label: 'Grown up' }, { value: 'puppy', label: 'Puppies' }]} value={age} onChange={setAge} />
      </div>

      {shown.length === 0 && <div className="text-[13px] text-[var(--text-faint)] py-6 text-center">No breed by that name.</div>}
      <div className="grid grid-cols-2 gap-2">
        {shown.map((breed) => {
          const dog = rollDog(breed.key, rolls[breed.key] ?? 0);
          return (
            <Card key={breed.key} onClick={() => setOpen(breed)} className="p-1.5">
              <DogSprite dog={dog} size={150} fluid asAge={age === 'puppy' ? 3 : 30} />
              <div className="text-[12.5px] font-semibold mt-1 leading-tight">{breed.name}</div>
              <div className="text-[10.5px] text-[var(--text-faint)]">
                {breed.group} · {breed.weight} lb
              </div>
            </Card>
          );
        })}
      </div>

      {open && (
        <BreedSheet
          breed={open}
          roll={rolls[open.key] ?? 0}
          age={age}
          onReroll={() => reroll(open.key)}
          onClose={() => setOpen(null)}
        />
      )}
    </Sheet>
  );
}

/** One breed, big: the portrait, what this particular dog came out as, and the blurb. */
function BreedSheet({ breed, roll, age, onReroll, onClose }: { breed: BreedProfile; roll: number; age: Age; onReroll: () => void; onClose: () => void }) {
  const dog = useMemo(() => rollDog(breed.key, roll), [breed.key, roll]);
  const lbs = sizeToPounds(dog.observed.size);
  const coat = resolveCoat(dog.genotype, lbs);
  const colour = resolveColor(dog.genotype);
  const tail = TAIL_LABEL[resolveTail(dog.genotype, dog.observed.tailSet, dog.observed.muzzle, coat.kind, lbs)];
  const ears = EAR_LABEL[resolveEars(dog.observed.earSet)];

  return (
    <Sheet open onClose={onClose} title={breed.name} subtitle={`${breed.group} · about ${breed.weight} lb`}>
      <div className="stage rounded-2xl p-2 mb-3">
        <DogSprite dog={dog} size={320} fluid asAge={age === 'puppy' ? 3 : 30} />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Chip tone="info">{lbs.toFixed(0)} lb</Chip>
        <Chip>{colour.name}</Chip>
        <Chip>{ears}</Chip>
        <Chip>{tail}</Chip>
      </div>
      <div className="text-[12.5px] text-[var(--text-soft)] mb-3">{coat.label}.</div>
      <p className="text-[14px] leading-relaxed mb-4">{breed.blurb}</p>
      <Button full tone="secondary" onClick={onReroll}>
        <Dices size={16} className="inline mr-1 -mt-0.5" />
        Roll another {breed.name}
      </Button>
    </Sheet>
  );
}
