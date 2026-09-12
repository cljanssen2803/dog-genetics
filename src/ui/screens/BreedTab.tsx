/**
 * BREED
 *
 * Choose one parent, compare every possible mate, look at the predicted litter,
 * and commit. This is where the game actually happens.
 */

import { useMemo, useState } from 'react';
import { Button, Card, Chip, Empty, Explain, Section, Segmented, Sheet, StatRow } from '../components';
import { DogPortrait } from '../DogPortrait';
import { useGame } from '../GameContext';
import { type Dog, ageMonths, breedingEligibility, formatAge } from '../../engine/dog';
import { type PolyTrait, TRAITS, sizeToPounds } from '../../engine/traits';
import {
  type OutsideSearch,
  activeDogs,
  adoptOutsideDog,
  breedPair,
  kennelCount,
  searchOutsideDogs,
} from '../../game/project';
import { type MatchVerdict, type PairingPreview, previewPairing, rankMates } from '../../game/matchmaking';
import { scoreDog } from '../../engine/standard';
import { populationWarnings } from '../../game/analytics';
import { BreedPicker } from './NewProject';
import { BEHAVIOR_TRAITS } from '../../engine/traits';

const VERDICT_TONE: Record<MatchVerdict, 'good' | 'neutral' | 'info' | 'warn' | 'bad'> = {
  'Excellent match': 'good',
  'Good match': 'neutral',
  'Useful outcross': 'info',
  'Risky pairing': 'warn',
  'Do not breed': 'bad',
};

export function BreedTab() {
  const { project, refresh, say } = useGame();
  const [parentId, setParentId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PairingPreview | null>(null);
  const [outsideOpen, setOutsideOpen] = useState(false);

  const warnings = useMemo(() => populationWarnings(project), [project, project.month]);

  const eligible = activeDogs(project).filter(
    (d) => breedingEligibility(d, project.month, project.lastLitter[d.id]).eligible,
  );
  const parent = parentId ? project.dogs[parentId] : null;

  const ranked = useMemo(
    () => (parent ? rankMates(project, parent) : []),
    [parent, project, project.month, project.rngCursor],
  );

  const doBreed = (p: PairingPreview) => {
    const result = breedPair(project, p.sire.id, p.dam.id);
    say(result.message);
    setPreview(null);
    setParentId(null);
    refresh();
  };

  return (
    <div className="px-4 pb-28 pt-3">
      {warnings.length > 0 && (
        <div className="card p-3 mb-4 border-rust/40">
          <div className="text-[13px] font-semibold mb-1">Population warning</div>
          {warnings.map((w, i) => (
            <p key={i} className="text-[12.5px] text-[var(--text-soft)] leading-relaxed mb-1 last:mb-0">
              {w}
            </p>
          ))}
        </div>
      )}

      {project.pregnancies.length > 0 && (
        <Section title="In whelp">
          {project.pregnancies.map((p) => {
            const dam = project.dogs[p.damId];
            const sire = project.dogs[p.sireId];
            return (
              <Card key={p.id} className="mb-2">
                <div className="text-[14px] font-semibold">
                  {dam?.name} × {sire?.name}
                </div>
                <div className="text-[12px] text-[var(--text-faint)]">
                  Due in {Math.max(0, p.dueMonth - project.month)} month
                  {p.dueMonth - project.month === 1 ? '' : 's'} · projected inbreeding{' '}
                  {(p.coi * 100).toFixed(1)}%
                </div>
              </Card>
            );
          })}
        </Section>
      )}

      {!parent ? (
        <>
          <Section
            title="Choose a parent"
            subtitle="Pick the dog you want to build this litter around."
          >
            {eligible.length === 0 ? (
              <Empty>
                No dogs are currently available to breed. Females need to be 18 months old and eight
                months clear of their last litter; males need to be a year old. Advance time, or bring
                in an outside dog.
              </Empty>
            ) : (
              eligible.map((dog) => (
                <ParentRow key={dog.id} dog={dog} onSelect={() => setParentId(dog.id)} />
              ))
            )}
          </Section>

          <Button full tone="secondary" onClick={() => setOutsideOpen(true)}>
            Find an outside dog
          </Button>

          <Explain title="When should I bring in an outside dog?">
            <p>
              Every dog you breed inside your own kennel makes the next generation slightly more
              related. That is fine for a while — it is how a population becomes consistent — but
              past a point it costs you fertility, litter size and lifespan.
            </p>
            <p>
              Bring in fresh blood when your average inbreeding climbs above about 8%, when you are
              down to two family lines, or when one dog's name starts appearing on every pedigree.
            </p>
          </Explain>
        </>
      ) : (
        <>
          <button onClick={() => setParentId(null)} className="text-[13px] text-[var(--text-faint)] mb-3">
            ‹ Choose a different parent
          </button>

          <Card className="mb-4 border-[var(--brand)]">
            <div className="flex gap-3 items-center">
              <DogPortrait dog={parent} size={78} />
              <div>
                <div className="display text-[16px] font-semibold">
                  {parent.name} {parent.sex === 'M' ? '♂' : '♀'}
                </div>
                <div className="text-[12px] text-[var(--text-faint)]">
                  {formatAge(ageMonths(parent, project.month))} ·{' '}
                  {sizeToPounds(parent.observed.size).toFixed(1)} lb
                </div>
                <div className="text-[12px] text-[var(--text-soft)]">
                  {project.standard.name} score {scoreDog(parent, project.standard).total}
                </div>
              </div>
            </div>
          </Card>

          <Section
            title={`${ranked.length} possible mate${ranked.length === 1 ? '' : 's'}`}
            subtitle="Ranked best first. Nothing is hidden — you can always overrule the ranking."
          >
            {ranked.length === 0 ? (
              <Empty>
                There is no dog of the opposite sex available to breed to {parent.name} right now.
                Try an outside dog.
              </Empty>
            ) : (
              ranked.map((r) => (
                <MateCard key={r.dog.id} dog={r.dog} preview={r.preview} onOpen={() => setPreview(r.preview)} />
              ))
            )}
          </Section>

          <Button full tone="secondary" onClick={() => setOutsideOpen(true)}>
            Find an outside dog instead
          </Button>
        </>
      )}

      {preview && (
        <PairingSheet preview={preview} onClose={() => setPreview(null)} onBreed={() => doBreed(preview)} />
      )}

      <OutsideSheet open={outsideOpen} onClose={() => setOutsideOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rows and cards
// ---------------------------------------------------------------------------

function ParentRow({ dog, onSelect }: { dog: Dog; onSelect: () => void }) {
  const { project } = useGame();
  const score = scoreDog(dog, project.standard);

  return (
    <Card onClick={onSelect} className="mb-2">
      <div className="flex items-center gap-3">
        <DogPortrait dog={dog} size={64} />
        <div className="flex-1 min-w-0">
          <div className="display font-semibold text-[14.5px]">
            {dog.name} <span className="text-[var(--text-faint)]">{dog.sex === 'M' ? '♂' : '♀'}</span>
          </div>
          <div className="text-[11.5px] text-[var(--text-faint)]">
            {formatAge(ageMonths(dog, project.month))} · {sizeToPounds(dog.observed.size).toFixed(1)} lb ·{' '}
            {dog.littersProduced} litter{dog.littersProduced === 1 ? '' : 's'}
          </div>
          <Chip tone={score.total >= 70 ? 'good' : score.total >= 45 ? 'neutral' : 'bad'} className="mt-1">
            score {score.total}
          </Chip>
        </div>
        <span className="text-[var(--text-faint)] text-[20px]">›</span>
      </div>
    </Card>
  );
}

function MateCard({
  dog,
  preview,
  onOpen,
}: {
  dog: Dog;
  preview: PairingPreview;
  onOpen: () => void;
}) {
  const { project } = useGame();

  return (
    <Card onClick={onOpen} className="mb-2">
      <div className="flex gap-3">
        <DogPortrait dog={dog} size={74} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="display font-semibold text-[14.5px] truncate">{dog.name}</span>
            <Chip tone={VERDICT_TONE[preview.verdict]}>{preview.verdict}</Chip>
          </div>
          <div className="text-[11.5px] text-[var(--text-faint)] mb-1">
            {formatAge(ageMonths(dog, project.month))} · {sizeToPounds(dog.observed.size).toFixed(1)} lb ·{' '}
            {dog.breedLabel}
          </div>
          <div className="text-[11.5px] text-[var(--text-soft)] leading-snug">
            Projected inbreeding {(preview.coi * 100).toFixed(1)}% · average puppy{' '}
            {Math.round(preview.meanScore)} · {preview.standardLow}–{preview.standardHigh}% meet standard
          </div>
          {preview.diseases.some((d) => d.affected > 0) && (
            <Chip tone="bad" className="mt-1">
              disease risk
            </Chip>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Pairing preview
// ---------------------------------------------------------------------------

function PairingSheet({
  preview,
  onClose,
  onBreed,
}: {
  preview: PairingPreview;
  onClose: () => void;
  onBreed: () => void;
}) {
  const [showWhy, setShowWhy] = useState(false);

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${preview.dam.name} × ${preview.sire.name}`}
      subtitle={preview.verdict}
      footer={
        <div className="flex gap-2">
          <Button tone="secondary" onClick={() => setShowWhy((v) => !v)} className="flex-none">
            {showWhy ? 'Hide' : 'Why this match?'}
          </Button>
          <Button full onClick={onBreed} tone={preview.verdict === 'Do not breed' ? 'danger' : 'primary'}>
            Breed this pair
          </Button>
        </div>
      }
    >
      <div className="flex justify-center gap-2 mb-3">
        <DogPortrait dog={preview.dam} size={110} />
        <DogPortrait dog={preview.sire} size={110} />
      </div>

      <div className="card p-3 mb-4">
        <p className="text-[13px] leading-relaxed">{preview.verdictReason}</p>
      </div>

      {showWhy && (
        <div className="card p-3 mb-4 border-[var(--brand)]">
          <div className="text-[13px] font-semibold mb-2">Why this match?</div>
          {preview.explanation.map((line, i) => (
            <p key={i} className="text-[12.5px] text-[var(--text-soft)] leading-relaxed mb-2 last:mb-0">
              {line}
            </p>
          ))}
        </div>
      )}

      <Section title="Genetic diversity">
        <div className="card p-3">
          <StatRow
            label="Projected inbreeding (COI)"
            value={`${(preview.coi * 100).toFixed(1)}% — ${preview.coiLabel.toLowerCase()}`}
            tone={preview.coiTone === 'bad' ? 'bad' : preview.coiTone === 'warn' ? 'warn' : 'good'}
          />
          {preview.sharedAncestorNames.length > 0 && (
            <StatRow
              label="Shared ancestors"
              value={preview.sharedAncestorNames
                .map((s) => `${s.name} (${s.generations} back)`)
                .join(', ')}
            />
          )}
          {preview.sireInfluence > 0.25 && (
            <StatRow
              label={`Population already descended from ${preview.sire.name}`}
              value={`${Math.round(preview.sireInfluence * 100)}%`}
              tone={preview.sireInfluence > 0.35 ? 'bad' : 'warn'}
            />
          )}
        </div>
      </Section>

      <Section title="Expected litter">
        <div className="card p-3">
          <StatRow label="Expected live puppies" value={preview.expectedLitterSize.toFixed(1)} />
          <StatRow
            label="Puppies meeting your standard"
            value={`${preview.standardLow}–${preview.standardHigh}%`}
          />
          <StatRow label="Average puppy score" value={Math.round(preview.meanScore)} />
          <StatRow label="Best puppy seen in simulation" value={Math.round(preview.bestScore)} />
        </div>
      </Section>

      {preview.improvements.length > 0 && (
        <Section title="Likely improvements">
          <div className="card p-3">
            {preview.improvements.map((s) => (
              <div key={s.trait} className="flex items-center gap-2 py-1.5 border-b border-[var(--line)] last:border-0">
                <Chip tone="good">↑</Chip>
                <span className="text-[13px]">{s.text}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {preview.weaknesses.length > 0 && (
        <Section title="Likely costs">
          <div className="card p-3">
            {preview.weaknesses.map((s) => (
              <div key={s.trait} className="flex items-center gap-2 py-1.5 border-b border-[var(--line)] last:border-0">
                <Chip tone="warn">↓</Chip>
                <span className="text-[13px]">{s.text}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Health">
        <div className="card p-3">
          {preview.diseases.length === 0 ? (
            <p className="text-[13px] text-moss font-medium">
              No affected puppies expected. These two do not share any disease gene.
            </p>
          ) : (
            preview.diseases.map((d) => (
              <div key={d.locus} className="py-2 border-b border-[var(--line)] last:border-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Chip tone={d.affected > 0 ? 'bad' : 'warn'}>
                    {d.affected > 0 ? `${Math.round(d.affected * 100)}% affected` : 'carriers only'}
                  </Chip>
                  <span className="text-[13px] font-semibold">{d.name}</span>
                </div>
                <p className="text-[12px] text-[var(--text-soft)]">
                  About {Math.round(d.carrier * 100)}% of puppies would be healthy carriers.
                  {d.untested && ' Neither parent has a DNA panel, so this is inferred.'}
                </p>
              </div>
            ))
          )}
        </div>
      </Section>

      {preview.coatOutcomes.length > 0 && (
        <Section title="Coat outcomes">
          <div className="card p-3">
            {preview.coatOutcomes.map((c) => (
              <StatRow key={c.label} label={c.label} value={`${Math.round(c.chance * 100)}% of puppies`} />
            ))}
          </div>
        </Section>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Outside dogs
// ---------------------------------------------------------------------------

function OutsideSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, refresh, say } = useGame();
  const [mode, setMode] = useState<'breed' | 'traits' | 'random'>('breed');
  const [breedKey, setBreedKey] = useState('miniSchnauzer');
  const [needs, setNeeds] = useState<Partial<Record<PolyTrait, 'high' | 'low'>>>({});
  const [results, setResults] = useState<Dog[]>([]);

  if (!open) return null;

  const runSearch = () => {
    const search: OutsideSearch =
      mode === 'breed'
        ? { kind: 'breed', breedKey }
        : mode === 'traits'
          ? { kind: 'traits', needs }
          : { kind: 'random' };
    setResults(searchOutsideDogs(project, search, 4));
    refresh();
  };

  const adopt = (dog: Dog) => {
    say(adoptOutsideDog(project, dog));
    setResults((r) => r.filter((d) => d.id !== dog.id));
    refresh();
  };

  const full = kennelCount(project) >= project.kennelCapacity;

  return (
    <Sheet open onClose={onClose} title="Find an outside dog" subtitle="Fresh blood, with strings attached">
      <Explain title="What is an outcross, and why would I want one?">
        <p>
          An outcross is a dog from outside your programme. It resets relatedness — a puppy from an
          unrelated dog has zero inbreeding — which buys back fertility, litter size and lifespan.
        </p>
        <p>
          The catch is that outside dogs are not built to your standard. Every one of them brings
          something you want and something you do not. That trade is the decision.
        </p>
      </Explain>

      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'breed', label: 'By breed' },
          { value: 'traits', label: 'By traits' },
          { value: 'random', label: 'Random' },
        ]}
      />

      <div className="mt-3 mb-3">
        {mode === 'breed' && <BreedPicker value={breedKey} onChange={setBreedKey} />}

        {mode === 'traits' && (
          <Card>
            <p className="text-[12.5px] text-[var(--text-soft)] mb-3 leading-relaxed">
              Tell the search what your population is missing. It will look for breeds that tend to
              have it.
            </p>
            {BEHAVIOR_TRAITS.map((trait) => (
              <div key={trait} className="flex items-center gap-2 py-1.5 border-b border-[var(--line)] last:border-0">
                <span className="flex-1 text-[12.5px]">{TRAITS[trait].label}</span>
                {(['low', 'high'] as const).map((dir) => (
                  <button
                    key={dir}
                    onClick={() =>
                      setNeeds((n) => {
                        const next = { ...n };
                        if (next[trait] === dir) delete next[trait];
                        else next[trait] = dir;
                        return next;
                      })
                    }
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                      needs[trait] === dir
                        ? 'bg-[var(--brand)] text-white border-transparent'
                        : 'bg-[var(--bg-2)] border-[var(--line)] text-[var(--text-faint)]'
                    }`}
                  >
                    {dir === 'low' ? 'less' : 'more'}
                  </button>
                ))}
              </div>
            ))}
          </Card>
        )}

        {mode === 'random' && (
          <Card>
            <p className="text-[13px] text-[var(--text-soft)] leading-relaxed">
              A dog from the general population, with no particular breed behind it. Completely
              unrelated to everything you own, usually healthier than a purebred, and almost never
              what your standard asks for.
            </p>
          </Card>
        )}
      </div>

      <Button full onClick={runSearch} className="mb-4">
        Search
      </Button>

      {full && (
        <div className="card p-3 mb-3 border-rust/40 text-[12.5px] text-[var(--text-soft)]">
          Your kennel is full ({project.kennelCapacity} dogs). Place a dog in a pet home before
          bringing anyone new in.
        </div>
      )}

      {results.map((dog) => (
        <OutsideCard key={dog.id} dog={dog} onAdopt={() => adopt(dog)} disabled={full} />
      ))}
    </Sheet>
  );
}

function OutsideCard({
  dog,
  onAdopt,
  disabled,
}: {
  dog: Dog;
  onAdopt: () => void;
  disabled: boolean;
}) {
  const { project } = useGame();
  const score = scoreDog(dog, project.standard);

  // What this dog would actually contribute: compare against the best mate
  // currently available in the kennel.
  const bestMatch = useMemo(() => {
    const mates = activeDogs(project).filter(
      (d) => d.sex !== dog.sex && breedingEligibility(d, project.month, project.lastLitter[d.id]).eligible,
    );
    if (mates.length === 0) return null;
    let best: PairingPreview | null = null;
    for (const mate of mates.slice(0, 6)) {
      const sire = dog.sex === 'M' ? dog : mate;
      const dam = dog.sex === 'F' ? dog : mate;
      const p = previewPairing(project, sire, dam);
      if (!best || p.meanScore > best.meanScore) best = p;
    }
    return best;
  }, [dog, project]);

  return (
    <Card className="mb-3">
      <div className="flex gap-3 mb-2">
        <DogPortrait dog={dog} size={86} />
        <div className="flex-1 min-w-0">
          <div className="display font-semibold text-[15px]">
            {dog.name} <span className="text-[var(--text-faint)]">{dog.sex === 'M' ? '♂' : '♀'}</span>
          </div>
          <div className="text-[12px] text-[var(--text-faint)]">
            {dog.breedLabel} · {formatAge(ageMonths(dog, project.month))} ·{' '}
            {sizeToPounds(dog.observed.size).toFixed(1)} lb
          </div>
          <Chip tone={score.total >= 60 ? 'good' : score.total >= 40 ? 'neutral' : 'bad'} className="mt-1">
            {project.standard.name} score {score.total}
          </Chip>
        </div>
      </div>

      {score.strengths.length > 0 && (
        <div className="mb-1.5">
          <div className="text-[11.5px] font-semibold text-moss mb-0.5">Brings</div>
          <div className="text-[12px] text-[var(--text-soft)]">
            {score.strengths.map((s) => s.label.toLowerCase()).join(', ')}
          </div>
        </div>
      )}

      {(score.weaknesses.length > 0 || score.healthNotes.length > 0) && (
        <div className="mb-2">
          <div className="text-[11.5px] font-semibold text-rust mb-0.5">Concerns</div>
          <div className="text-[12px] text-[var(--text-soft)]">
            {[...score.weaknesses.map((s) => s.label.toLowerCase()), ...score.healthNotes].join('; ')}
          </div>
        </div>
      )}

      {bestMatch && (
        <div className="text-[12px] text-[var(--text-soft)] mb-2">
          Best pairing here would be with <strong>{bestMatch.sire.id === dog.id ? bestMatch.dam.name : bestMatch.sire.name}</strong>
          : inbreeding {(bestMatch.coi * 100).toFixed(1)}%, average puppy {Math.round(bestMatch.meanScore)}.
        </div>
      )}

      <Button full small onClick={onAdopt} disabled={disabled}>
        Bring {dog.name} into the kennel
      </Button>
    </Card>
  );
}
