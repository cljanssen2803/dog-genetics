/**
 * THE BREED GALLERY
 *
 * Every breed in the bank, drawn by the real sprite renderer, just to look
 * through. Search by name, narrow to a group, flip everyone to puppies, and
 * tap a dog for a bigger portrait, its blurb, and a fresh roll (each dog is
 * one generated founder, so no two rolls come out quite the same).
 *
 * Also where a player's own breeds live — founded on a dog of theirs that
 * came out right — and the sheet that founds one.
 */

import { useMemo, useState } from 'react';
import { Dices, Search, Sparkles, Trash2 } from 'lucide-react';
import { Button, Card, Chip, Segmented, Sheet } from '../components';
import { DogSprite } from '../DogSprite';
import { type Dog, createFounder } from '../../engine/dog';
import { Rng } from '../../engine/rng';
import { BREEDS, BREED_BY_KEY, BREED_GROUPS, CUSTOM_GROUP, breedFamily, type BreedProfile } from '../../engine/breeds';
import { breedFromDog } from '../../engine/customBreed';
import { TAIL_LABEL, EAR_LABEL, resolveCoat, resolveColor, resolveEars, resolveTail } from '../../engine/phenotype';
import { sizeToPounds } from '../../engine/traits';
import { addCustomBreed, removeCustomBreed } from '../../game/storage';

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
  // Bumped when a breed is removed, so the list re-reads the bank.
  const [version, setVersion] = useState(0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    // The player's own breeds come first.
    const all = [...BREEDS.filter((b) => b.custom), ...BREEDS.filter((b) => !b.custom)];
    return all.filter((b) => (!group || breedFamily(b) === group) && (!q || b.name.toLowerCase().includes(q) || b.group.toLowerCase().includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, group, version]);

  const groups = [...(BREED_GROUPS.includes(CUSTOM_GROUP) ? [CUSTOM_GROUP] : []), ...BREED_GROUPS.filter((g) => g !== CUSTOM_GROUP)];
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
        {groups.map((g) => (
          <button key={g} onClick={() => setGroup(group === g ? null : g)}>
            <Chip tone={group === g ? 'info' : g === CUSTOM_GROUP ? 'rare' : 'neutral'}>{g}</Chip>
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
            <Card key={breed.key} onClick={() => setOpen(breed)} className="p-1.5 relative">
              {breed.custom && <YoursBadge />}
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
          onRemoved={() => {
            setOpen(null);
            setVersion((v) => v + 1);
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </Sheet>
  );
}

/** The sticker that marks a breed the player made. */
function YoursBadge() {
  return (
    <span className="absolute top-2 left-2 z-10 rotate-[-6deg]">
      <Chip tone="rare">
        <Sparkles size={11} /> Yours
      </Chip>
    </span>
  );
}

/** One breed, big: the portrait, what this particular dog came out as, and the blurb. */
function BreedSheet({
  breed,
  roll,
  age,
  onReroll,
  onRemoved,
  onClose,
}: {
  breed: BreedProfile;
  roll: number;
  age: Age;
  onReroll: () => void;
  onRemoved: () => void;
  onClose: () => void;
}) {
  const dog = useMemo(() => rollDog(breed.key, roll), [breed.key, roll]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const lbs = sizeToPounds(dog.observed.size);
  const coat = resolveCoat(dog.genotype, lbs);
  const colour = resolveColor(dog.genotype);
  const tail = TAIL_LABEL[resolveTail(dog.genotype, dog.observed.tailSet, dog.observed.muzzle, coat.kind, lbs)];
  const ears = EAR_LABEL[resolveEars(dog.observed.earSet)];
  const made = breed.custom;

  return (
    <Sheet open onClose={onClose} title={breed.name} subtitle={`${breed.group} · about ${breed.weight} lb`}>
      <div className="stage rounded-2xl p-2 mb-3 relative">
        {made && <YoursBadge />}
        <DogSprite dog={dog} size={320} fluid asAge={age === 'puppy' ? 3 : 30} />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Chip tone="info">{lbs.toFixed(0)} lb</Chip>
        <Chip>{colour.name}</Chip>
        <Chip>{ears}</Chip>
        <Chip>{tail}</Chip>
      </div>
      <div className="text-[12.5px] text-[var(--text-soft)] mb-3">{coat.label}.</div>
      <p className="text-[14px] leading-relaxed mb-3">{breed.blurb}</p>
      {made && (
        <p className="text-[12px] text-[var(--text-faint)] mb-4">
          Founded on {made.dogName} in the {made.projectName} kennel, generation {made.generation} ·{' '}
          {new Date(made.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
      <Button full tone="secondary" onClick={onReroll}>
        <Dices size={16} className="inline mr-1 -mt-0.5" />
        Roll another {breed.name}
      </Button>
      {made && (
        <div className="mt-3">
          {confirmRemove ? (
            <div className="card p-3">
              <div className="text-[13px] mb-2">
                Take {breed.name} out of the bank? Dogs already bred from it keep their genes; it just stops being offered as a breed.
              </div>
              <div className="flex gap-2">
                <Button small full tone="secondary" onClick={() => setConfirmRemove(false)}>
                  Keep it
                </Button>
                <Button
                  small
                  full
                  tone="danger"
                  onClick={() => {
                    void removeCustomBreed(breed.key).then(onRemoved);
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmRemove(true)} className="w-full text-center text-[12.5px] underline text-[var(--text-faint)] py-1">
              <Trash2 size={12} className="inline mr-1 -mt-0.5" />
              Remove from the bank
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Founding a breed on a dog
// ---------------------------------------------------------------------------

export function FoundBreedSheet({
  dog,
  projectName,
  generation,
  onFounded,
  onClose,
}: {
  dog: Dog;
  projectName: string;
  generation: number;
  onFounded: (breed: BreedProfile) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(projectName);
  const [blurb, setBlurb] = useState(`Founded on ${dog.name} in the ${projectName} kennel.`);
  const [saving, setSaving] = useState(false);

  // A preview of what founders of the new breed will look like: the dog
  // itself, then three cousins rolled from its genes.
  const preview = useMemo(() => {
    const profile = breedFromDog(dog, { name: name || 'New breed', blurb, projectName, generation });
    // Registered under a throwaway key so the renderer can draw from it.
    BREED_BY_KEY[profile.key] = profile;
    const rng = new Rng(11);
    const cousins = [1, 2, 3].map((i) =>
      createFounder(rng, { breedKey: profile.key, sex: i % 2 ? 'M' : 'F', name: 'x', currentMonth: 0, ageMonths: 30, wildcards: false }),
    );
    delete BREED_BY_KEY[profile.key];
    return cousins;
    // The preview depends on the dog only; the name is cosmetic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dog]);

  const ok = name.trim().length > 0;

  const found = async () => {
    if (!ok || saving) return;
    setSaving(true);
    const breed = breedFromDog(dog, { name, blurb, projectName, generation });
    await addCustomBreed(breed);
    setSaving(false);
    onFounded(breed);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Found a breed"
      subtitle={`${dog.name} becomes the first of a new breed`}
      footer={
        <Button full disabled={!ok || saving} onClick={() => void found()}>
          <Sparkles size={16} className="inline mr-1 -mt-0.5" />
          Add {name.trim() || 'it'} to the breed bank
        </Button>
      }
    >
      <p className="text-[13px] text-[var(--text-soft)] mb-3">
        The new breed takes {dog.name}'s traits, weight and genes. It shows up in the breed gallery with a{' '}
        <Chip tone="rare">
          <Sparkles size={11} /> Yours
        </Chip>{' '}
        sticker, and you can pick it as a founder breed, an outside dog, or in the Playground, just like any other.
      </p>

      <label className="block text-[12px] font-bold uppercase tracking-wide text-[var(--text-faint)] mb-1">Breed name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[15px] mb-3 outline-none"
      />
      <label className="block text-[12px] font-bold uppercase tracking-wide text-[var(--text-faint)] mb-1">A line about it</label>
      <textarea
        value={blurb}
        onChange={(e) => setBlurb(e.target.value)}
        maxLength={240}
        rows={3}
        className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[14px] mb-4 outline-none"
      />

      <div className="text-[12px] font-bold uppercase tracking-wide text-[var(--text-faint)] mb-1">How its dogs will come out</div>
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        <div className="card p-1">
          <DogSprite dog={dog} size={80} fluid asAge={30} />
          <div className="text-[9.5px] text-center text-[var(--text-faint)] mt-0.5">{dog.name}</div>
        </div>
        {preview.map((d, i) => (
          <div key={i} className="card p-1">
            <DogSprite dog={d} size={80} fluid asAge={30} />
            <div className="text-[9.5px] text-center text-[var(--text-faint)] mt-0.5">cousin</div>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-[var(--text-faint)]">
        Genes {dog.name} carries two copies of are fixed in the breed; anything it carries one copy of comes out half the time.
      </p>
    </Sheet>
  );
}
