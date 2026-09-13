/**
 * THE BREED STANDARD EDITOR
 *
 * Shared by the new-project wizard and the "revise your standard" sheet, so
 * there is exactly one place where goals are defined.
 *
 * An important subtlety: the editor's controls are coarse (Low / Middle /
 * High), but a preset standard like Hearthdog uses precise ranges that do not
 * map exactly onto those buttons. So the editor only rewrites a goal the player
 * has actually touched. Everything else is passed through untouched, and
 * opening the editor and closing it again changes nothing.
 */

import { type ReactNode, useState } from 'react';
import { Card, Chip, Section, Segmented } from './components';
import {
  type BreedStandard,
  type DerivedKey,
  type Goal,
  type Priority,
  PRIORITY_LABEL,
  assessDifficulty,
} from '../engine/standard';
import { BEHAVIOR_TRAITS, HEALTH_TRAITS, type PolyTrait, TRAITS } from '../engine/traits';
import { type CoatKind, type EarType, type TailType, TAIL_LABEL } from '../engine/phenotype';

export type Want = 'dontCare' | 'low' | 'middle' | 'high';

export interface EditorState {
  base: BreedStandard;
  name: string;
  sizeLow: number;
  sizeHigh: number;
  sizePriority: Priority;
  /** Only keys present here have been edited by the player. */
  wants: Record<string, { want: Want; priority: Priority }>;
  touched: Set<string>;
  coatKinds: CoatKind[];
  coatPriority: Priority;
  earTypes: EarType[];
  tailTypes: TailType[];
  colorText: string;
  healthPriority: Priority;
}

/** Turn an existing goal into the nearest coarse control position. */
function wantFromGoal(goal: Goal | undefined): Want {
  if (!goal || goal.priority === 0) return 'dontCare';
  if (goal.mode === 'higher') return 'high';
  if (goal.mode === 'lower') return 'low';
  const mid = ((goal.preferredLow ?? 50) + (goal.preferredHigh ?? 50)) / 2;
  if (mid >= 66) return 'high';
  if (mid <= 38) return 'low';
  return 'middle';
}

function goalFromWant(want: Want, priority: Priority): Goal | undefined {
  if (want === 'dontCare' || priority === 0) return undefined;
  if (want === 'low')
    return { mode: 'range', priority, preferredLow: 0, preferredHigh: 32, acceptableLow: 0, acceptableHigh: 48 };
  if (want === 'high')
    return { mode: 'range', priority, preferredLow: 70, preferredHigh: 100, acceptableLow: 54, acceptableHigh: 100 };
  return { mode: 'range', priority, preferredLow: 40, preferredHigh: 64, acceptableLow: 28, acceptableHigh: 76 };
}

export function editorStateFrom(standard: BreedStandard): EditorState {
  const size = standard.traitGoals.size;
  const wants: EditorState['wants'] = {};

  for (const [key, goal] of Object.entries(standard.traitGoals)) {
    if (key === 'size' || !goal) continue;
    wants[key] = { want: wantFromGoal(goal), priority: goal.priority };
  }
  for (const [key, goal] of Object.entries(standard.derivedGoals)) {
    if (!goal) continue;
    wants[key] = { want: wantFromGoal(goal), priority: goal.priority };
  }

  return {
    base: standard,
    name: standard.name,
    sizeLow: size?.preferredLow ?? 25,
    sizeHigh: size?.preferredHigh ?? 45,
    sizePriority: size?.priority ?? 3,
    wants,
    touched: new Set<string>(),
    coatKinds: standard.coatGoal?.kinds ?? [],
    coatPriority: standard.coatGoal?.priority ?? 0,
    earTypes: standard.earGoal?.types ?? [],
    tailTypes: standard.tailGoal?.types ?? [],
    colorText: standard.colorGoal?.text ?? '',
    healthPriority: standard.healthPriority,
  };
}

export function standardFrom(state: EditorState): BreedStandard {
  // Start from what was already there, so untouched goals keep their exact
  // definitions rather than being flattened into Low / Middle / High.
  const next: BreedStandard = {
    ...structuredClone(state.base),
    name: state.name.trim() || 'My breed',
    healthPriority: state.healthPriority,
  };

  const low = Math.min(state.sizeLow, state.sizeHigh);
  const high = Math.max(state.sizeLow, state.sizeHigh);
  next.traitGoals.size = {
    mode: 'range',
    priority: state.sizePriority,
    preferredLow: low,
    preferredHigh: high,
    acceptableLow: Math.round(low * 0.75),
    acceptableHigh: Math.round(high * 1.3),
  };

  for (const key of state.touched) {
    if (key === 'size') continue;
    const entry = state.wants[key];
    const goal = entry ? goalFromWant(entry.want, entry.priority) : undefined;
    const isTrait = (TRAITS as Record<string, unknown>)[key] !== undefined;

    if (isTrait) {
      if (goal) next.traitGoals[key as PolyTrait] = goal;
      else delete next.traitGoals[key as PolyTrait];
    } else if (goal) {
      next.derivedGoals[key as DerivedKey] = goal;
    } else {
      delete next.derivedGoals[key as DerivedKey];
    }
  }

  if (state.coatKinds.length > 0 && state.coatPriority > 0) {
    next.coatGoal = { kinds: state.coatKinds, priority: state.coatPriority };
  } else {
    delete next.coatGoal;
  }

  if (state.earTypes.length > 0) next.earGoal = { types: state.earTypes, priority: 2 };
  else delete next.earGoal;
  if (state.tailTypes.length > 0) next.tailGoal = { types: state.tailTypes, priority: 2 };
  else delete next.tailGoal;

  if (state.colorText.trim()) next.colorGoal = { text: state.colorText.trim(), priority: 1 };
  else delete next.colorGoal;

  return next;
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

export function StandardFields({
  state,
  setState,
  showName = true,
}: {
  state: EditorState;
  setState: (updater: (previous: EditorState) => EditorState) => void;
  showName?: boolean;
}) {
  const setWant = (key: string, want: Want) =>
    setState((s) => ({
      ...s,
      wants: { ...s.wants, [key]: { want, priority: s.wants[key]?.priority ?? 2 } },
      touched: new Set(s.touched).add(key),
    }));

  const setPriority = (key: string, priority: Priority) =>
    setState((s) => ({
      ...s,
      wants: { ...s.wants, [key]: { want: s.wants[key]?.want ?? 'middle', priority } },
      touched: new Set(s.touched).add(key),
    }));

  return (
    <>
      {showName && (
        <Section title="Name">
          <input
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            placeholder="For example: Barn Sprite"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-3 text-[15px]"
          />
        </Section>
      )}

      <Section title="Size" subtitle="The single most important decision. Everything else bends around it.">
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <label className="text-[12px] text-[var(--text-soft)] flex-1">
              From
              <input
                type="number"
                min={3}
                max={200}
                value={state.sizeLow}
                onChange={(e) => setState((s) => ({ ...s, sizeLow: Number(e.target.value) }))}
                className="w-full mt-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-[15px]"
              />
            </label>
            <label className="text-[12px] text-[var(--text-soft)] flex-1">
              To
              <input
                type="number"
                min={3}
                max={250}
                value={state.sizeHigh}
                onChange={(e) => setState((s) => ({ ...s, sizeHigh: Number(e.target.value) }))}
                className="w-full mt-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-[15px]"
              />
            </label>
            <span className="text-[12px] text-[var(--text-faint)] self-end pb-3">lb</span>
          </div>
          <PrioritySelect
            value={state.sizePriority}
            onChange={(p) => setState((s) => ({ ...s, sizePriority: p }))}
          />
        </Card>
      </Section>

      <Section
        title="Temperament"
        subtitle="Anything left on Don't care is ignored completely, including by the scoring."
      >
        {BEHAVIOR_TRAITS.map((trait) => (
          <WantRow
            key={trait}
            label={TRAITS[trait].label}
            hint={`${TRAITS[trait].low} → ${TRAITS[trait].high}`}
            entry={state.wants[trait]}
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
            entry={state.wants[key]}
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
                  setState((s) => ({
                    ...s,
                    coatKinds: s.coatKinds.includes(kind)
                      ? s.coatKinds.filter((x) => x !== kind)
                      : [...s.coatKinds, kind],
                    coatPriority: s.coatPriority === 0 ? 3 : s.coatPriority,
                  }))
                }
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                  state.coatKinds.includes(kind)
                    ? 'bg-[var(--brand)] text-white border-transparent'
                    : 'bg-[var(--bg-2)] border-[var(--line)] text-[var(--text-soft)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {state.coatKinds.length > 0 && (
            <PrioritySelect
              value={state.coatPriority}
              onChange={(p) => setState((s) => ({ ...s, coatPriority: p }))}
            />
          )}
        </Card>
      </Section>

      <Section title="Health and constitution">
        {HEALTH_TRAITS.map((trait) => (
          <WantRow
            key={trait}
            label={TRAITS[trait].label}
            hint={TRAITS[trait].blurb}
            entry={state.wants[trait]}
            onWant={(w) => setWant(trait, w)}
            onPriority={(p) => setPriority(trait, p)}
          />
        ))}
        <Card className="mt-2">
          <div className="text-[13px] font-semibold mb-2">
            How harshly should inherited disease count against a dog?
          </div>
          <PrioritySelect
            value={state.healthPriority}
            onChange={(p) => setState((s) => ({ ...s, healthPriority: p }))}
          />
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
                  setState((s) => ({
                    ...s,
                    earTypes: s.earTypes.includes(type)
                      ? s.earTypes.filter((x) => x !== type)
                      : [...s.earTypes, type],
                  }))
                }
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                  state.earTypes.includes(type)
                    ? 'bg-[var(--brand)] text-white border-transparent'
                    : 'bg-[var(--bg-2)] border-[var(--line)] text-[var(--text-soft)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="text-[13px] font-semibold mb-2">Tail</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(Object.keys(TAIL_LABEL) as TailType[]).map((type) => (
              <button
                key={type}
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    tailTypes: s.tailTypes.includes(type)
                      ? s.tailTypes.filter((x) => x !== type)
                      : [...s.tailTypes, type],
                  }))
                }
                className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${
                  state.tailTypes.includes(type)
                    ? 'bg-[var(--brand)] text-white border-transparent'
                    : 'bg-[var(--bg-2)] border-[var(--line)] text-[var(--text-soft)]'
                }`}
              >
                {TAIL_LABEL[type].replace(' tail', '').replace('Natural ', '')}
              </button>
            ))}
          </div>
          <div className="text-[13px] font-semibold mb-1">Colour wish</div>
          <input
            value={state.colorText}
            onChange={(e) => setState((s) => ({ ...s, colorText: e.target.value }))}
            placeholder="For example: merle, lilac, brindle"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[14px]"
          />
        </Card>
      </Section>
    </>
  );
}

export function WantRow({
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

export function PrioritySelect({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
}) {
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
  children,
}: {
  difficulty: ReturnType<typeof assessDifficulty>;
  children?: ReactNode;
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
        {children}
      </Card>
    </Section>
  );
}

/** Convenience hook used by both the wizard and the revise sheet. */
export function useStandardEditor(initial: BreedStandard) {
  const [state, setState] = useState<EditorState>(() => editorStateFrom(initial));
  return { state, setState, standard: standardFrom(state) };
}
