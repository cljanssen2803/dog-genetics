/**
 * NEW PROJECT
 *
 * Four ways to start:
 *   - the two preset projects, which teach two very different parts of the game
 *   - a completely custom breed standard
 *   - a designer cross, where you pick two real breeds and chase a look
 */

import { useMemo, useState } from 'react';
import { Button, Card, Chip, Section } from '../components';
import { DifficultyPanel, StandardFields, useStandardEditor } from '../StandardEditor';
import {
  type BreedStandard,
  HEARTHDOG,
  MOUSIE,
  assessDifficulty,
  blankStandard,
  designerCrossStandard,
} from '../../engine/standard';
import { BREEDS, BREED_GROUPS, breedFamily } from '../../engine/breeds';
import type { CoatKind } from '../../engine/phenotype';
import { createProject } from '../../game/project';
import { saveProject } from '../../game/storage';
import { assessEstablishment } from '../../game/analytics';

type Mode = 'choose' | 'custom' | 'designer';

export function NewProject({
  onCreated,
  onCancel,
  onLab,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
  onLab: () => void;
}) {
  const [mode, setMode] = useState<Mode>('choose');

  const start = async (name: string, standard: BreedStandard, founderBreeds?: string[]) => {
    const project = createProject({ name, standard, founderBreeds });
    await saveProject(project, assessEstablishment(project).standardisation);
    onCreated(project.id);
  };

  if (mode === 'custom') {
    return <CustomBuilder onBack={() => setMode('choose')} onStart={start} />;
  }
  if (mode === 'designer') {
    return <DesignerBuilder onBack={() => setMode('choose')} onStart={start} />;
  }

  return (
    <div className="paper min-h-full">
      <div className="safe-top" />
      <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
        <button onClick={onCancel} className="text-[13px] text-[var(--text-faint)] mb-4">
          ‹ Back
        </button>

        <h1 className="display text-[26px] font-semibold leading-tight mb-1">
          What are you trying to create?
        </h1>
        <p className="text-[13px] text-[var(--text-soft)] mb-6 leading-relaxed">
          Pick a ready-made project to learn the game, or define your own dog from scratch.
        </p>

        <Section title="Preset projects">
          <PresetCard
            title="Hearthdog"
            tagline="Medium family companion"
            body="A calm, steady, sociable dog that sheds very little and lives a long time. The gentlest introduction: the goals mostly agree with each other."
            bullets={['30–50 lb', 'Very low shedding', 'Rock-solid temperament', 'Long lived']}
            onStart={() => start('Hearthdog', structuredClone(HEARTHDOG))}
          />
          <PresetCard
            title="Mousie"
            tagline="Tiny cold-weather vermin hunter"
            body="A small, dense-coated companion for an older owner that is calm indoors but genuinely effective on mice. Much harder: drive and calmness fight each other."
            bullets={['10–18 lb', 'Dense winter coat', 'Strong prey drive', 'Calm in the house']}
            onStart={() => start('Mousie', structuredClone(MOUSIE))}
          />
        </Section>

        <Section title="Build your own">
          <PresetCard
            title="The Lab"
            tagline="Start from the features, not the breeds"
            body="Tick what you want — size, coat, colour, ears, tail, temperament — and watch the dog appear. The Lab tells you which breeds carry the genes and explains each one, then starts the project for you."
            bullets={[]}
            onStart={onLab}
            action="Open the Lab"
          />
          <PresetCard
            title="Custom breed"
            tagline="Define every goal yourself"
            body="Choose the size, coat, temperament and looks you want, and how much each one matters. The game will tell you honestly how hard your combination is."
            bullets={[]}
            onStart={() => setMode('custom')}
            action="Open the builder"
          />
          <PresetCard
            title="Designer cross"
            tagline="Two real breeds, one new dog"
            body="Pick a breed for the body and a breed for the coat — a Great Dane in a Standard Poodle's coat, say — and see whether you can actually stabilise it. Genetically the most chaotic way to play."
            bullets={[]}
            onStart={() => setMode('designer')}
            action="Choose breeds"
          />
        </Section>
      </div>
    </div>
  );
}

function PresetCard({
  title,
  tagline,
  body,
  bullets,
  onStart,
  action = 'Start this project',
}: {
  title: string;
  tagline: string;
  body: string;
  bullets: string[];
  onStart: () => void;
  action?: string;
}) {
  return (
    <Card className="mb-3">
      <div className="display text-[18px] font-semibold">{title}</div>
      <div className="text-[12px] text-rust font-semibold mb-1.5">{tagline}</div>
      <p className="text-[13px] text-[var(--text-soft)] leading-relaxed mb-2">{body}</p>
      {bullets.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {bullets.map((b) => (
            <Chip key={b}>{b}</Chip>
          ))}
        </div>
      )}
      <Button full small onClick={onStart}>
        {action}
      </Button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Custom builder
// ---------------------------------------------------------------------------

function CustomBuilder({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (name: string, standard: BreedStandard, founders?: string[]) => void;
}) {
  const { state, setState, standard } = useStandardEditor(blankStandard(''));
  const difficulty = useMemo(() => assessDifficulty(standard), [standard]);

  const finished: BreedStandard = {
    ...standard,
    vision: `A custom breed of roughly ${Math.min(state.sizeLow, state.sizeHigh)}–${Math.max(
      state.sizeLow,
      state.sizeHigh,
    )} lb.`,
  };

  return (
    <div className="paper min-h-full">
      <div className="safe-top" />
      <div className="max-w-lg mx-auto px-4 pt-4 pb-32">
        <button onClick={onBack} className="text-[13px] text-[var(--text-faint)] mb-4">
          ‹ Back
        </button>
        <h1 className="display text-[24px] font-semibold mb-4">Breed goal builder</h1>

        <StandardFields state={state} setState={setState} />

        <DifficultyPanel difficulty={difficulty} />

        <Button full onClick={() => onStart(finished.name, finished)} className="mt-4">
          Create this project
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Designer cross
// ---------------------------------------------------------------------------

function DesignerBuilder({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (name: string, standard: BreedStandard, founders?: string[]) => void;
}) {
  const [bodyKey, setBodyKey] = useState('greatDane');
  const [coatKey, setCoatKey] = useState('poodleStandard');
  const [name, setName] = useState('');

  const body = BREEDS.find((b) => b.key === bodyKey)!;
  const coatBreed = BREEDS.find((b) => b.key === coatKey)!;

  // What a first cross would actually weigh: the geometric mean of the parents,
  // which is how body size really behaves in dogs.
  const f1Weight = Math.sqrt(body.weight * coatBreed.weight);

  const coatKinds = useMemo<CoatKind[]>(() => {
    const a = coatBreed.alleles ?? {};
    if ((a.hairlessDom?.Hd ?? 0) > 0.2 || (a.hairlessRec?.hr ?? 0) > 0.4) return ['hairless'];
    const curly = (a.curl?.Cu ?? 0) > 0.5;
    const long = (a.coatLength?.l ?? 0.5) > 0.6;
    const furnished = (a.furnishings?.F ?? 0.15) > 0.5;
    if (curly && long) return ['curly'];
    if (curly || (furnished && long)) return ['wavyFurnished', 'curly'];
    if (furnished) return ['wire'];
    if (long) return ['silky', 'doubleThick', 'long'];
    return ['smooth'];
  }, [coatBreed]);

  const standard = useMemo(
    () =>
      designerCrossStandard(
        name.trim() || `${body.name} × ${coatBreed.name}`,
        { name: body.name, weight: body.weight },
        { name: coatBreed.name },
        coatKinds,
      ),
    [name, body, coatBreed, coatKinds],
  );

  const difficulty = useMemo(() => assessDifficulty(standard), [standard]);

  return (
    <div className="paper min-h-full">
      <div className="safe-top" />
      <div className="max-w-lg mx-auto px-4 pt-4 pb-32">
        <button onClick={onBack} className="text-[13px] text-[var(--text-faint)] mb-4">
          ‹ Back
        </button>
        <h1 className="display text-[24px] font-semibold mb-1">Designer cross</h1>
        <p className="text-[13px] text-[var(--text-soft)] mb-5 leading-relaxed">
          Pick one breed for the size and build, and another for the coat. You will start with
          founders from both, and the interesting part is generation two: first crosses look uniform,
          but their puppies scatter wildly.
        </p>

        <Section title="Body and size">
          <BreedPicker value={bodyKey} onChange={setBodyKey} />
        </Section>

        <Section title="Coat">
          <BreedPicker value={coatKey} onChange={setCoatKey} />
        </Section>

        <Section title="What you are aiming at">
          <Card>
            <div className="display text-[17px] font-semibold mb-1">
              {name.trim() || `${body.name} × ${coatBreed.name}`}
            </div>
            <p className="text-[13px] text-[var(--text-soft)] leading-relaxed mb-2">
              {standard.vision}
            </p>
            <div className="flex flex-wrap gap-1 mb-3">
              <Chip>Target {Math.round(body.weight * 0.82)}–{Math.round(body.weight * 1.18)} lb</Chip>
              <Chip tone="info">First cross would be about {f1Weight.toFixed(0)} lb</Chip>
              {coatKinds.map((k) => (
                <Chip key={k} tone="rare">
                  {k}
                </Chip>
              ))}
            </div>
            <p className="text-[12px] text-[var(--text-faint)] leading-relaxed">
              To hit the target size you will have to breed back toward the {body.name} side while
              holding on to the {coatBreed.name} coat — and the coat genes are mostly recessive, so
              they will keep disappearing and reappearing.
            </p>
          </Card>
        </Section>

        <Section title="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`${body.name} × ${coatBreed.name}`}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-3 text-[15px]"
          />
        </Section>

        <DifficultyPanel difficulty={difficulty} />

        <Button
          full
          className="mt-4"
          onClick={() =>
            onStart(name.trim() || `${body.name} × ${coatBreed.name}`, standard, [bodyKey, coatKey])
          }
        >
          Create this project
        </Button>
      </div>
    </div>
  );
}

export function BreedPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('All');

  const filtered = BREEDS.filter((b) => {
    if (group !== 'All' && breedFamily(b) !== group) return false;
    if (!query.trim()) return true;
    return b.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  const selected = BREEDS.find((b) => b.key === value);

  return (
    <>
      {selected && (
        <Card className="mb-2 border-[var(--brand)]">
          <div className="display text-[15px] font-semibold">{selected.name}</div>
          <div className="text-[12px] text-[var(--text-faint)] mb-1">
            {selected.group} · about {selected.weight} lb
          </div>
          <p className="text-[12.5px] text-[var(--text-soft)] leading-relaxed">{selected.blurb}</p>
        </Card>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search breeds…"
        className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2.5 text-[14px] mb-2"
      />

      <div className="scroll-x flex gap-1.5 mb-2 pb-1">
        {['All', ...BREED_GROUPS].map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className={`flex-none rounded-full border px-3 py-1.5 text-[11.5px] font-medium whitespace-nowrap ${
              group === g
                ? 'bg-[var(--brand)] text-white border-transparent'
                : 'bg-[var(--bg-2)] border-[var(--line)] text-[var(--text-soft)]'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="max-h-64 overflow-y-auto card p-1">
        {filtered.map((b) => (
          <button
            key={b.key}
            onClick={() => onChange(b.key)}
            className={`w-full text-left px-2.5 py-2 rounded-lg text-[13px] flex justify-between items-center gap-2 ${
              b.key === value ? 'bg-[var(--brand)] text-white' : 'active:bg-[var(--bg-2)]'
            }`}
          >
            <span className="truncate">{b.name}</span>
            <span className={`text-[11px] tabular-nums ${b.key === value ? 'text-white/70' : 'text-[var(--text-faint)]'}`}>
              {b.weight} lb
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-[13px] text-[var(--text-faint)]">No breeds match that.</div>
        )}
      </div>
    </>
  );
}
