/**
 * THE LAB
 *
 * Tick the features you want; watch the dog appear; find out which breeds
 * carry the parts and what the genes are doing. Then, if you like it, start
 * the breeding project with those breeds as founders.
 */

import { useMemo, useState } from 'react';
import { Button, Card, Chip, Section } from '../components';
import { DogSprite } from '../DogSprite';
import { sizeBandOf } from '../DogFacts';
import { createFounder, type Dog } from '../../engine/dog';
import { Rng, hashString } from '../../engine/rng';
import { BREED_BY_KEY } from '../../engine/breeds';
import { EAR_LABEL, TAIL_LABEL, resolveCoat, resolveColor, resolveEars, resolveTail } from '../../engine/phenotype';
import { sizeToPounds } from '../../engine/traits';
import { assessDifficulty } from '../../engine/standard';
import { DifficultyPanel } from '../StandardEditor';
import {
  LAB_FEATURES,
  LAB_BY_KEY,
  LAB_GROUP_LABEL,
  type LabGroup,
  buildDraft,
  buildStandard,
  estimateGenerations,
  founderPlan,
  matchBreeds,
  matchPairs,
  toggleFeature,
} from '../../game/lab';
import { createProject } from '../../game/project';
import { saveProject } from '../../game/storage';
import { assessEstablishment } from '../../game/analytics';

const GROUPS: LabGroup[] = ['size', 'coat', 'colour', 'markings', 'build', 'ears', 'tail', 'temperament'];

/** A dog object the sprite can draw, built from a draft rather than born. */
function designDog(selected: string[], seed: number, name: string): Dog {
  const draft = buildDraft(selected);
  const dog = createFounder(new Rng(seed), {
    breedKey: 'labrador',
    sex: 'F',
    name: name || 'Blueprint',
    currentMonth: 0,
    ageMonths: 30,
    wildcards: false,
  });
  dog.genotype = draft.genotype;
  dog.observed = { ...draft.traits };
  dog.bv = { ...draft.traits };
  dog.seedValue = seed;
  dog.breedLabel = 'Lab design';
  return dog;
}

/** One example dog from a breed, for the breed cards. Same one every time. */
function exampleOf(breedKey: string): Dog {
  return createFounder(new Rng(hashString(`lab:${breedKey}`)), {
    breedKey,
    sex: 'M',
    name: BREED_BY_KEY[breedKey].name,
    currentMonth: 0,
    ageMonths: 30,
    wildcards: false,
  });
}

export function Lab({ onBack, onCreated }: { onBack: () => void; onCreated: (id: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [seed, setSeed] = useState(4242);
  const [name, setName] = useState('');
  const [starting, setStarting] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);

  const pick = (key: string) => {
    const result = toggleFeature(selected, key);
    setSelected(result.selected);
    setNotes(result.notes);
  };

  const dog = useMemo(() => designDog(selected, seed, name), [selected, seed, name]);
  const lbs = sizeToPounds(dog.observed.size);
  const colour = resolveColor(dog.genotype);
  const coat = resolveCoat(dog.genotype, lbs);
  const ears = EAR_LABEL[resolveEars(dog.observed.earSet)];
  const tail = TAIL_LABEL[resolveTail(dog.genotype, dog.observed.tailSet, dog.observed.muzzle, coat.kind, lbs)];

  const singles = useMemo(() => matchBreeds(selected), [selected]);
  const pairs = useMemo(() => matchPairs(selected, singles), [selected, singles]);
  const plan = useMemo(() => founderPlan(singles, pairs), [singles, pairs]);
  const estimate = useMemo(() => estimateGenerations(selected, singles), [selected, singles]);
  const standard = useMemo(() => buildStandard(selected, name), [selected, name]);
  const difficulty = useMemo(() => assessDifficulty(standard), [standard]);

  const bestPair = pairs[0];
  const bestSingle = singles[0];
  const pairWins = !!bestPair && (!bestSingle || bestPair.fit > bestSingle.fit + 0.08);

  const start = async () => {
    setStarting(true);
    const project = createProject({ name: name.trim() || 'Lab design', standard, founderBreeds: plan });
    await saveProject(project, assessEstablishment(project).standardisation);
    onCreated(project.id);
  };

  return (
    <div className="paper min-h-full">
      <div className="safe-top" />

      {/* The design dog stays pinned while the wish list scrolls beneath it. */}
      <div className="sticky top-0 z-10 bg-[var(--bg)]/95 backdrop-blur border-b border-[var(--line)]">
        <div className="max-w-lg mx-auto px-4 pt-2 pb-2">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="text-[13px] text-[var(--text-faint)]">
              ‹ Back
            </button>
            <span className="display text-[15px] font-semibold">The Lab</span>
            <button
              onClick={() => setSeed((s) => (s * 1103515245 + 12345) % 2147483647)}
              className="text-[12px] text-[var(--brand)] font-semibold"
            >
              Shuffle markings
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <DogSprite dog={dog} size={170} />
            <div className="flex-1 min-w-0">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name your design"
                className="w-full bg-transparent display text-[18px] font-semibold placeholder:text-[var(--text-faint)] outline-none"
              />
              <div className="text-[12px] text-[var(--text-soft)] leading-snug mt-1">
                {sizeBandOf(lbs)} · {Math.round(lbs)} lb
                <br />
                {colour.name}
                <br />
                {coat.label}
                <br />
                {ears}, {tail.toLowerCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 pb-32">
        <p className="text-[13px] text-[var(--text-soft)] leading-relaxed mb-4">
          Tick what you want. The dog above changes as you go, and below it the Lab works out which
          breeds carry the parts and what the genes are doing.
        </p>

        {notes.length > 0 && (
          <div className="mb-4 rounded-xl border border-rust/30 bg-rust/10 px-3 py-2 text-[12.5px] leading-relaxed">
            {notes.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </div>
        )}

        {GROUPS.map((group) => (
          <Section key={group} title={LAB_GROUP_LABEL[group]}>
            <div className="flex flex-wrap gap-1.5">
              {LAB_FEATURES.filter((f) => f.group === group).map((f) => {
                const on = selected.includes(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() => pick(f.key)}
                    className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                      on
                        ? 'bg-[var(--brand)] text-white border-transparent'
                        : 'bg-[var(--card)] border-[var(--line)] text-[var(--text-soft)]'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </Section>
        ))}

        {selected.length === 0 ? (
          <Card className="text-[13px] text-[var(--text-faint)] leading-relaxed">
            Nothing ticked yet. Try "Extra large", "Tight curly coat" and "Low shedding" to see
            what a giant Poodle-coated dog would take.
          </Card>
        ) : (
          <>
            <Section
              title="Which breeds get you there"
              subtitle="How likely a founder from each breed is to bring what you asked for."
            >
              {pairWins && bestPair && (
                <Card className="mb-2 border-[var(--brand)]/40">
                  <div className="flex items-center gap-2 mb-1">
                    <Chip tone="good">Best plan: a cross</Chip>
                    <span className="text-[12px] text-[var(--text-faint)]">
                      {Math.round(bestPair.fit * 100)}% covered
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1 my-1">
                    <DogSprite dog={exampleOf(bestPair.a.key)} size={120} />
                    <span className="display text-[18px] text-[var(--text-faint)]">×</span>
                    <DogSprite dog={exampleOf(bestPair.b.key)} size={120} />
                  </div>
                  <div className="text-[13px] leading-relaxed">
                    <b>{bestPair.a.name}</b> brings {list(bestPair.aBrings)}.
                    <br />
                    <b>{bestPair.b.name}</b> brings {list(bestPair.bBrings)}.
                    {bestPair.neither.length > 0 && (
                      <>
                        <br />
                        <span className="text-[var(--text-faint)]">
                          Neither has {list(bestPair.neither)} — that would need a third breed or luck.
                        </span>
                      </>
                    )}
                  </div>
                </Card>
              )}

              {singles.slice(0, pairWins ? 3 : 4).map((m, i) => (
                <Card key={m.breed.key} className="mb-2">
                  <div className="flex items-center gap-2">
                    <DogSprite dog={exampleOf(m.breed.key)} size={96} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="display font-semibold text-[15px]">{m.breed.name}</span>
                        {i === 0 && !pairWins && <Chip tone="good">Best start</Chip>}
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--bg-2)] overflow-hidden my-1">
                        <div className="h-full bg-[var(--brand)] rounded-full" style={{ width: `${Math.round(m.fit * 100)}%` }} />
                      </div>
                      <div className="text-[12px] text-[var(--text-soft)] leading-snug">
                        {m.brings.length > 0 && <span>Brings {list(m.brings)}. </span>}
                        {m.carries.length > 0 && (
                          <span className="text-[var(--text-faint)]">Often carries {list(m.carries)} hidden. </span>
                        )}
                        {m.lacks.length > 0 && <span className="text-rust-deep">Lacks {list(m.lacks)}.</span>}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </Section>

            <Section title="The genetics" subtitle="What each wish actually asks of the genes.">
              {selected.map((key) => {
                const f = LAB_BY_KEY[key];
                return (
                  <Card key={key} className="mb-2">
                    <div className="display font-semibold text-[14px] mb-1">{f.label}</div>
                    <p className="text-[12.5px] leading-relaxed text-[var(--text-soft)]">{f.gene}</p>
                    <p className="text-[12.5px] leading-relaxed mt-1">
                      <span className="font-semibold">How to get it: </span>
                      {f.recipe}
                    </p>
                  </Card>
                );
              })}
            </Section>

            <Section title="How long it would take">
              <Card className="mb-3">
                <div className="display text-[22px] font-semibold">
                  {estimate.generations <= 1 ? 'A generation or two' : `About ${estimate.generations} generations`}
                </div>
                <p className="text-[12.5px] text-[var(--text-soft)] leading-relaxed mt-1">{estimate.why}</p>
              </Card>
              <DifficultyPanel difficulty={difficulty} />
            </Section>

            <Button full onClick={() => void start()} disabled={starting || plan.length === 0} className="mt-2">
              Start this project with {plan.map((k) => BREED_BY_KEY[k].name).join(' and ')}
            </Button>
            <p className="text-[11.5px] text-[var(--text-faint)] mt-2 text-center leading-relaxed">
              The wish list becomes your breed standard and those breeds become your founders. You can
              revise the standard later from the Project tab.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function list(items: string[]): string {
  // "Extra large (95 lb and up)" reads badly mid-sentence; drop the brackets.
  const lower = items.map((s) => s.replace(/\s*\(.*?\)/g, '').toLowerCase());
  if (lower.length <= 1) return lower.join('');
  return `${lower.slice(0, -1).join(', ')} and ${lower[lower.length - 1]}`;
}
