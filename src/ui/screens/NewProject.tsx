/**
 * NEW PROJECT
 *
 * Four ways to start:
 *   - the two preset projects, which teach two very different parts of the game
 *   - a completely custom breed standard
 *   - a designer cross, where you pick two real breeds and chase a look
 */

import { useMemo, useState } from 'react';
import { Button, Card, Chip, Section, Segmented } from '../components';
import {
  type BreedStandard,
  type DerivedKey,
  type Goal,
  type Priority,
  HEARTHDOG,
  MOUSIE,
  PRIORITY_LABEL,
  assessDifficulty,
  blankStandard,
  designerCrossStandard,
} from '../../engine/standard';
import { BEHAVIOR_TRAITS, HEALTH_TRAITS, type PolyTrait, TRAITS } from '../../engine/traits';
import { BREEDS, BREED_GROUPS } from '../../engine/breeds';
import type { CoatKind, EarType } from '../../engine/phenotype';
import { createProject } from '../../game/project';
import { saveProject } from '../../game/storage';
import { assessEstablishment } from '../../game/analytics';

type Mode = 'choose' | 'custom' | 'designer';

export function NewProject({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
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

type Want = 'dontCare' | 'low' | 'middle' | 'high';

function goalFor(want: Want, priority: Priority): Goal | undefined {
  if (want === 'dontCare' || priority === 0) return undefined;
  if (want === 'low') return { mode: 'range', priority, preferredLow: 0, preferredHigh: 32, acceptableLow: 0, acceptableHigh: 48 };
  if (want === 'high') return { mode: 'range', priority, preferredLow: 70, preferredHigh: 100, acceptableLow: 54, acceptableHigh: 100 };
  return { mode: 'range', priority, preferredLow: 40, preferredHigh: 64, acceptableLow: 28, acceptableHigh: 76 };
}

function CustomBuilder({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (name: string, standard: BreedStandard, founders?: string[]) => void;
}) {
  const [name, setName] = useState('');
  const [sizeLow, setSizeLow] = useState(25);
  const [sizeHigh, setSizeHigh] = useState(45);
  const [sizePriority, setSizePriority] = useState<Priority>(3);

  const [wants, setWants] = useState<Record<string, { want: Want; priority: Priority }>>({});
  const [coatKinds, setCoatKinds] = useState<CoatKind[]>([]);
  const [coatPriority, setCoatPriority] = useState<Priority>(0);
  const [earTypes, setEarTypes] = useState<EarType[]>([]);
  const [colorText, setColorText] = useState('');
  const [healthPriority, setHealthPriority] = useState<Priority>(3);

  const setWant = (key: string, want: Want) =>
    setWants((w) => ({ ...w, [key]: { want, priority: w[key]?.priority ?? 2 } }));
  const setPriority = (key: string, priority: Priority) =>
    setWants((w) => ({ ...w, [key]: { want: w[key]?.want ?? 'middle', priority } }));

  const standard = useMemo<BreedStandard>(() => {
    const s = blankStandard(name.trim() || 'My breed');
    s.traitGoals.size = {
      mode: 'range',
      priority: sizePriority,
      preferredLow: Math.min(sizeLow, sizeHigh),
      preferredHigh: Math.max(sizeLow, sizeHigh),
      acceptableLow: Math.round(Math.min(sizeLow, sizeHigh) * 0.75),
      acceptableHigh: Math.round(Math.max(sizeLow, sizeHigh) * 1.3),
    };

    for (const [key, entry] of Object.entries(wants)) {
      const goal = goalFor(entry.want, entry.priority);
      if (!goal) continue;
      if ((TRAITS as Record<string, unknown>)[key]) {
        s.traitGoals[key as PolyTrait] = goal;
      } else {
        s.derivedGoals[key as DerivedKey] = goal;
      }
    }

    if (coatKinds.length > 0 && coatPriority > 0) s.coatGoal = { kinds: coatKinds, priority: coatPriority };
    if (earTypes.length > 0) s.earGoal = { types: earTypes, priority: 2 };
    if (colorText.trim()) s.colorGoal = { text: colorText.trim(), priority: 1 };
    s.healthPriority = healthPriority;
    s.vision = `A custom breed of roughly ${sizeLow}–${sizeHigh} lb.`;
    return s;
  }, [name, sizeLow, sizeHigh, sizePriority, wants, coatKinds, coatPriority, earTypes, colorText, healthPriority]);

  const difficulty = useMemo(() => assessDifficulty(standard), [standard]);

  return (
    <div className="paper min-h-full">
      <div className="safe-top" />
      <div className="max-w-lg mx-auto px-4 pt-4 pb-32">
        <button onClick={onBack} className="text-[13px] text-[var(--text-faint)] mb-4">
          ‹ Back
        </button>
        <h1 className="display text-[24px] font-semibold mb-4">Breed goal builder</h1>

        <Section title="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="For example: Barn Sprite"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-3 text-[15px]"
          />
        </Section>

        <Section title="Size" subtitle="The single most important decision. Everything else bends around it.">
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <label className="text-[12px] text-[var(--text-soft)] flex-1">
                From
                <input
                  type="number"
                  min={3}
                  max={200}
                  value={sizeLow}
                  onChange={(e) => setSizeLow(Number(e.target.value))}
                  className="w-full mt-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-[15px]"
                />
              </label>
              <label className="text-[12px] text-[var(--text-soft)] flex-1">
                To
                <input
                  type="number"
                  min={3}
                  max={250}
                  value={sizeHigh}
                  onChange={(e) => setSizeHigh(Number(e.target.value))}
                  className="w-full mt-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-[15px]"
                />
              </label>
              <span className="text-[12px] text-[var(--text-faint)] self-end pb-3">lb</span>
            </div>
            <PrioritySelect value={sizePriority} onChange={setSizePriority} />
          </Card>
        </Section>

        <Section title="Temperament" subtitle="Anything left on Don't care is ignored completely, including by the scoring.">
          {BEHAVIOR_TRAITS.map((trait) => (
            <WantRow
              key={trait}
              label={TRAITS[trait].label}
              hint={`${TRAITS[trait].low} → ${TRAITS[trait].high}`}
              entry={wants[trait]}
              onWant={(w) => setWant(trait, w)}
              onPriority={(p) => setPriority(trait, p)}
            />
          ))}
        </Section>

        <Section title="Coat">
          {(
            [
              ['shedding', 'Shedding'],
              ['grooming', 'Grooming burden'],
              ['coldTolerance', 'Cold tolerance'],
              ['heatTolerance', 'Heat tolerance'],
              ['waterResistance', 'Water resistance'],
            ] as const
          ).map(([key, label]) => (
            <WantRow
              key={key}
              label={label}
              entry={wants[key]}
              onWant={(w) => setWant(key, w)}
              onPriority={(p) => setPriority(key, p)}
            />
          ))}

          <Card className="mt-2">
            <div className="text-[13px] font-semibold mb-2">Coat type</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(
                [
                  ['smooth', 'Smooth'],
                  ['silky', 'Long silky'],
                  ['long', 'Long furnished'],
                  ['doubleThick', 'Dense double'],
                  ['wire', 'Wiry'],
                  ['wavyFurnished', 'Wavy furnished'],
                  ['curly', 'Curly'],
                  ['hairless', 'Hairless'],
                ] as [CoatKind, string][]
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  onClick={() =>
                    setCoatKinds((k) => (k.includes(kind) ? k.filter((x) => x !== kind) : [...k, kind]))
                  }
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                    coatKinds.includes(kind)
                      ? 'bg-[var(--brand)] text-white border-transparent'
                      : 'bg-[var(--bg-2)] border-[var(--line)] text-[var(--text-soft)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {coatKinds.length > 0 && <PrioritySelect value={coatPriority} onChange={setCoatPriority} />}
          </Card>
        </Section>

        <Section title="Health and constitution">
          {HEALTH_TRAITS.map((trait) => (
            <WantRow
              key={trait}
              label={TRAITS[trait].label}
              hint={TRAITS[trait].blurb}
              entry={wants[trait]}
              onWant={(w) => setWant(trait, w)}
              onPriority={(p) => setPriority(trait, p)}
            />
          ))}
          <Card className="mt-2">
            <div className="text-[13px] font-semibold mb-2">How harshly should inherited disease count against a dog?</div>
            <PrioritySelect value={healthPriority} onChange={setHealthPriority} />
          </Card>
        </Section>

        <Section title="Appearance" subtitle="Entirely optional. Functional projects can ignore all of this.">
          <Card>
            <div className="text-[13px] font-semibold mb-2">Ears</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(
                [
                  ['drop', 'Dropped'],
                  ['button', 'Button'],
                  ['semiErect', 'Semi-erect'],
                  ['erect', 'Erect'],
                ] as [EarType, string][]
              ).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() =>
                    setEarTypes((t) => (t.includes(type) ? t.filter((x) => x !== type) : [...t, type]))
                  }
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                    earTypes.includes(type)
                      ? 'bg-[var(--brand)] text-white border-transparent'
                      : 'bg-[var(--bg-2)] border-[var(--line)] text-[var(--text-soft)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="text-[13px] font-semibold mb-1">Colour wish</div>
            <input
              value={colorText}
              onChange={(e) => setColorText(e.target.value)}
              placeholder="For example: merle, lilac, brindle"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[14px]"
            />
          </Card>
        </Section>

        <DifficultyPanel difficulty={difficulty} />

        <Button full onClick={() => onStart(name.trim() || 'My breed', standard)} className="mt-4">
          Create this project
        </Button>
      </div>
    </div>
  );
}

function WantRow({
  label,
  hint,
  entry,
  onWant,
  onPriority,
}: {
  label: string;
  hint?: string;
  entry?: { want: Want; priority: Priority };
  onWant: (want: Want) => void;
  onPriority: (priority: Priority) => void;
}) {
  const want = entry?.want ?? 'dontCare';
  return (
    <Card className="mb-2">
      <div className="text-[13px] font-semibold">{label}</div>
      {hint && <div className="text-[11.5px] text-[var(--text-faint)] mb-2 leading-snug">{hint}</div>}
      <Segmented
        value={want}
        onChange={onWant}
        options={[
          { value: 'dontCare', label: "Don't care" },
          { value: 'low', label: 'Low' },
          { value: 'middle', label: 'Middle' },
          { value: 'high', label: 'High' },
        ]}
      />
      {want !== 'dontCare' && (
        <div className="mt-2">
          <PrioritySelect value={entry?.priority ?? 2} onChange={onPriority} />
        </div>
      )}
    </Card>
  );
}

function PrioritySelect({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="flex gap-1">
      {([1, 2, 3, 4] as Priority[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`flex-1 rounded-lg border px-1 py-1.5 text-[11px] font-semibold ${
            value === p
              ? 'bg-rust text-white border-transparent'
              : 'bg-[var(--bg-2)] border-[var(--line)] text-[var(--text-faint)]'
          }`}
        >
          {PRIORITY_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

export function DifficultyPanel({
  difficulty,
}: {
  difficulty: ReturnType<typeof assessDifficulty>;
}) {
  const tone =
    difficulty.level === 'Gentle' || difficulty.level === 'Moderate'
      ? 'good'
      : difficulty.level === 'High'
        ? 'warn'
        : 'bad';

  return (
    <Section title="Difficulty">
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[13px] font-semibold">Breeding difficulty</span>
          <Chip tone={tone}>{difficulty.level}</Chip>
        </div>
        {difficulty.conflicts.length === 0 ? (
          <p className="text-[13px] text-[var(--text-soft)] leading-relaxed">
            Nothing in this standard fights itself. Progress should be steady.
          </p>
        ) : (
          difficulty.conflicts.map((c, i) => (
            <div key={i} className="py-2 border-b border-[var(--line)] last:border-0">
              <div className="flex items-center gap-2 mb-1">
                <Chip tone={c.severity === 'conflict' ? 'warn' : 'neutral'}>
                  {c.severity === 'conflict' ? 'Conflict' : 'Note'}
                </Chip>
                <span className="text-[13px] font-semibold">{c.title}</span>
              </div>
              <p className="text-[12.5px] text-[var(--text-soft)] leading-relaxed">{c.body}</p>
            </div>
          ))
        )}
        <p className="text-[11.5px] text-[var(--text-faint)] mt-2 leading-relaxed">
          Difficult is not the same as impossible. The game never blocks an unusual combination — it
          only warns you that it will take longer.
        </p>
      </Card>
    </Section>
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
    if (group !== 'All' && b.group !== group) return false;
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
