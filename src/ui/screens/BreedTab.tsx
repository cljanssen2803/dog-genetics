/**
 * BREED
 *
 * Choose one parent, compare every possible mate, look at the predicted litter,
 * and commit. This is where the game actually happens.
 */

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, Empty, Explain, Section, Segmented, Sheet, StatRow } from '../components';
import { DogPortrait } from '../DogPortrait';
import { useGame } from '../GameContext';
import { type Dog, breedingEligibility } from '../../engine/dog';
import { type PolyTrait, TRAITS } from '../../engine/traits';
import {
  type OutsideSearch,
  activeDogs,
  adoptOutsideDog,
  breedPair,
  kennelCount,
  searchOutsideDogs,
} from '../../game/project';
import { type MatchVerdict, type PairingPreview, previewPairing, rankMates } from '../../game/matchmaking';
import { goalGaps, populationWarnings } from '../../game/analytics';
import { type GenerationPlan, planGeneration } from '../../game/assist';
import { BreedPicker } from './NewProject';
import { FactChips, FactLine, LookLine, NameLine, TemperamentLine, describeDog } from '../DogFacts';
import { BEHAVIOR_TRAITS } from '../../engine/traits';
import { quirkOdds, quirkText } from '../../engine/quirks';

const VERDICT_TONE: Record<MatchVerdict, 'good' | 'neutral' | 'info' | 'warn' | 'bad'> = {
  'Excellent match': 'good',
  'Good match': 'neutral',
  'Useful outcross': 'info',
  'Risky pairing': 'warn',
  'Do not breed': 'bad',
};

export type BreedIntent = 'plan' | 'outside' | null;

export function BreedTab({ intent, onIntentUsed }: { intent?: BreedIntent; onIntentUsed?: () => void }) {
  const { project, refresh, say } = useGame();
  const [parentId, setParentId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PairingPreview | null>(null);
  const [outsideOpen, setOutsideOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  // The Project tab can send the player here with a job in mind.
  useEffect(() => {
    if (intent === 'plan') setPlanOpen(true);
    if (intent === 'outside') setOutsideOpen(true);
    if (intent) onIntentUsed?.();
  }, [intent, onIntentUsed]);

  const warnings = useMemo(() => populationWarnings(project), [project, project.month]);

  const eligible = activeDogs(project).filter(
    (d) =>
      breedingEligibility(d, project.month, project.lastLitter[d.id]).eligible &&
      !project.pregnancies.some((p) => p.damId === d.id),
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
          {eligible.length > 0 && (
            <Card className="mb-4 border-[var(--brand)]">
              <div className="display text-[15px] mb-1">Let the game plan this season</div>
              <p className="text-[12.5px] text-[var(--text-soft)] leading-relaxed mb-2">
                It works out the best mate for every female you have, keeps the sires spread out, and
                shows you why. You accept the ones you like.
              </p>
              <Button full onClick={() => setPlanOpen(true)}>
                Plan my pairings
              </Button>
            </Card>
          )}

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
            {(() => {
              const f = describeDog(parent, project);
              return (
                <div className="flex gap-3 items-center">
                  <DogPortrait dog={parent} size={78} />
                  <div className="flex-1 min-w-0">
                    <NameLine f={f} />
                    <FactLine f={f} />
                    <TemperamentLine f={f} />
                    <LookLine f={f} />
                    <FactChips f={f} standardName={project.standard.name} />
                  </div>
                </div>
              );
            })()}
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
      <PlanSheet open={planOpen} onClose={() => setPlanOpen(false)} onPreview={(p) => setPreview(p)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rows and cards
// ---------------------------------------------------------------------------

function ParentRow({ dog, onSelect }: { dog: Dog; onSelect: () => void }) {
  const { project } = useGame();
  const f = describeDog(dog, project);

  return (
    <Card onClick={onSelect} className="mb-2">
      <div className="flex items-center gap-3">
        <DogPortrait dog={dog} size={72} />
        <div className="flex-1 min-w-0">
          <NameLine f={f} />
          <FactLine f={f} />
          <TemperamentLine f={f} />
          <LookLine f={f} />
          <FactChips
            f={f}
            standardName={project.standard.name}
            extra={
              <Chip>
                {dog.littersProduced} litter{dog.littersProduced === 1 ? '' : 's'}
              </Chip>
            }
          />
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
  const f = describeDog(dog, project);

  return (
    <Card onClick={onOpen} className="mb-2">
      <div className="flex gap-3">
        <DogPortrait dog={dog} size={78} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <NameLine f={f} />
            <Chip tone={VERDICT_TONE[preview.verdict]} className="flex-none">
              {preview.verdict}
            </Chip>
          </div>
          <FactLine f={f} />
          <TemperamentLine f={f} />
          <LookLine f={f} />
          <div className="text-[11.5px] text-[var(--text-soft)] leading-snug mt-1">
            Inbreeding {(preview.coi * 100).toFixed(1)}% · average puppy {Math.round(preview.meanScore)} ·{' '}
            {preview.standardLow}–{preview.standardHigh}% meet standard
          </div>
          <FactChips
            f={f}
            standardName={project.standard.name}
            extra={
              preview.diseases.some((d) => d.affected > 0) ? <Chip tone="bad">disease risk</Chip> : null
            }
          />
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

      {(() => {
        const odds = quirkOdds(preview.sire.genotype, preview.dam.genotype).filter((o) => o.chance >= 0.2).slice(0, 5);
        return odds.length > 0 ? (
          <Section title="Habits the puppies might inherit" subtitle="Personality runs in families too.">
            <div className="card p-3">
              {odds.map((o) => (
                <StatRow
                  key={o.quirk.key}
                  label={quirkText(o.quirk, 'a puppy', 'M').replace(/^(He|She|His|Her)\b/, 'A puppy').replace(/\bhis\b/g, 'its').replace(/\bhe\b/g, 'it')}
                  value={`${Math.round(o.chance * 100)}%`}
                />
              ))}
            </div>
          </Section>
        ) : null;
      })()}

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
// The season plan
// ---------------------------------------------------------------------------

function PlanSheet({ open, onClose, onPreview }: { open: boolean; onClose: () => void; onPreview: (p: PairingPreview) => void }) {
  const { project, refresh, say } = useGame();
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const plan: GenerationPlan | null = useMemo(
    () => (open ? planGeneration(project) : null),
    // Recomputed whenever the kennel changes underneath it.
    [open, project, project.month, project.rngCursor, project.pregnancies.length],
  );

  if (!open || !plan) return null;
  const pairings = plan.pairings.filter((p) => !skippedIds.includes(p.dam.id));

  const accept = (damId: string, sireId: string, name: string) => {
    const result = breedPair(project, sireId, damId);
    say(result.success ? `${name}: bred.` : result.message);
    refresh();
  };

  const acceptAll = () => {
    let n = 0;
    for (const p of pairings) {
      const r = breedPair(project, p.sire.id, p.dam.id);
      if (r.success) n += 1;
    }
    say(`${n} pairing${n === 1 ? '' : 's'} made. Puppies in two months.`);
    refresh();
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="This season's plan"
      subtitle={`${pairings.length} pairing${pairings.length === 1 ? '' : 's'} · about ${plan.expectedPuppies} puppies · ${plan.spaceLeft} spaces free`}
      footer={
        pairings.length > 0 ? (
          <Button full onClick={acceptAll}>
            Breed all {pairings.length}
          </Button>
        ) : (
          <Button full tone="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {pairings.length === 0 && (
        <Empty>
          Nothing to pair right now. {plan.skipped.length > 0 ? plan.skipped[0].why.charAt(0).toUpperCase() + plan.skipped[0].why.slice(1) + '.' : 'Advance time until someone is ready.'}
        </Empty>
      )}
      {pairings.map((p) => (
        <Card key={p.dam.id} className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <DogPortrait dog={p.dam} size={72} />
            <span className="display text-[16px] text-[var(--text-faint)]">×</span>
            <DogPortrait dog={p.sire} size={72} />
            <div className="flex-1 min-w-0">
              <div className="display text-[15px] leading-tight">
                {p.dam.name} × {p.sire.name}
              </div>
              <Chip tone={VERDICT_TONE[p.preview.verdict]} className="mt-1">
                {p.preview.verdict}
              </Chip>
            </div>
          </div>
          <p className="text-[12.5px] text-[var(--text-soft)] leading-relaxed mb-2">{p.reason}</p>
          <div className="flex gap-2">
            <Button small tone="secondary" onClick={() => onPreview(p.preview)}>
              Details
            </Button>
            <Button small tone="secondary" onClick={() => setSkippedIds((s) => [...s, p.dam.id])}>
              Skip
            </Button>
            <Button small full onClick={() => accept(p.dam.id, p.sire.id, `${p.dam.name} × ${p.sire.name}`)}>
              Breed this pair
            </Button>
          </div>
        </Card>
      ))}
      {plan.skipped.length > 0 && (
        <div className="text-[12px] text-[var(--text-faint)] leading-relaxed mt-1">
          Left out: {plan.skipped.map((s) => `${s.dog.name} (${s.why})`).join('; ')}.
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Outside dogs
// ---------------------------------------------------------------------------

/** Hidden genes a specialist breeder can be asked for. */
const CARRIER_OPTIONS: { locus: string; allele: string; label: string }[] = [
  { locus: 'locusE', allele: 'e', label: 'recessive red / yellow' },
  { locus: 'locusB', allele: 'b', label: 'chocolate' },
  { locus: 'locusD', allele: 'd', label: 'dilute (blue)' },
  { locus: 'cocoa', allele: 'co', label: 'cocoa' },
  { locus: 'intensity', allele: 'i', label: 'cream' },
  { locus: 'locusK', allele: 'kbr', label: 'brindle' },
  { locus: 'locusA', allele: 'at', label: 'tan points' },
  { locus: 'locusS', allele: 'sp', label: 'piebald' },
  { locus: 'merle', allele: 'M', label: 'merle' },
  { locus: 'ticking', allele: 'T', label: 'ticking' },
  { locus: 'blueEyes', allele: 'Be', label: 'blue eyes' },
  { locus: 'coatLength', allele: 'l', label: 'long coat' },
  { locus: 'curl', allele: 'Cu', label: 'curl' },
  { locus: 'furnishings', allele: 'F', label: 'furnishings' },
  { locus: 'shedding', allele: 'sh', label: 'low shedding' },
  { locus: 'undercoat', allele: 'U', label: 'undercoat' },
  { locus: 'hairlessRec', allele: 'hr', label: 'hairless' },
  { locus: 'chondro', allele: 'Cd', label: 'short legs' },
  { locus: 'bobtail', allele: 'Bt', label: 'bobtail' },
];

function OutsideSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, refresh, say } = useGame();
  const [mode, setMode] = useState<'breed' | 'traits' | 'random'>('breed');
  const [breedKey, setBreedKey] = useState('miniSchnauzer');
  const [carrying, setCarrying] = useState<{ locus: string; allele: string } | null>(null);
  const [needs, setNeeds] = useState<Partial<Record<PolyTrait, 'high' | 'low'>>>({});
  const [results, setResults] = useState<Candidate[]>([]);
  const gaps = useMemo(() => goalGaps(project).slice(0, 3), [project, project.month]);

  if (!open) return null;

  const runSearch = () => {
    const search: OutsideSearch =
      mode === 'breed'
        ? { kind: 'breed', breedKey, carrying: carrying ?? undefined }
        : mode === 'traits'
          ? { kind: 'traits', needs }
          : { kind: 'random' };
    const found = searchOutsideDogs(project, search, 5);
    // Judge every candidate by the best litter it could give you with what you
    // already own, then put the most useful one first.
    const judged = found
      .map((dog) => ({ dog, best: bestPairingFor(project, dog) }))
      .sort((a, b) => (b.best?.meanScore ?? -1) - (a.best?.meanScore ?? -1));
    setResults(judged);
    refresh();
  };

  const adopt = (dog: Dog) => {
    say(adoptOutsideDog(project, dog));
    setResults((r) => r.filter((c) => c.dog.id !== dog.id));
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
        {mode === 'breed' && (
          <>
            <BreedPicker value={breedKey} onChange={setBreedKey} />
            <Card className="mt-2">
              <div className="text-[13px] font-semibold mb-1">Must carry a hidden gene</div>
              <p className="text-[12px] text-[var(--text-soft)] leading-relaxed mb-2">
                Ask a specialist breeder for a dog of this breed that carries one copy of a gene
                the breed does not usually show. That is how a Dudley Newfoundland or a merle
                Poodle begins: one carrier, then patience.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CARRIER_OPTIONS.map((o) => {
                  const on = carrying?.locus === o.locus && carrying?.allele === o.allele;
                  return (
                    <button
                      key={`${o.locus}:${o.allele}`}
                      onClick={() => setCarrying(on ? null : { locus: o.locus, allele: o.allele })}
                      className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
                        on
                          ? 'bg-[var(--brand)] text-white border-transparent'
                          : 'bg-[var(--bg-2)] border-[var(--line)] text-[var(--text-soft)]'
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </Card>
          </>
        )}

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

      {results.length > 0 && gaps.length > 0 && (
        <div className="card p-3 mb-3">
          <div className="text-[12px] font-semibold mb-1">What your population most needs</div>
          <div className="text-[12.5px] text-[var(--text-soft)] leading-relaxed">
            {gaps.map((g) => g.text).join(' · ')}
          </div>
          <div className="text-[11px] text-[var(--text-faint)] mt-1">
            Candidates are sorted by the best litter they could give you with the dogs you already have.
          </div>
        </div>
      )}

      {results.map((c, i) => (
        <OutsideCard
          key={c.dog.id}
          dog={c.dog}
          best={c.best}
          rank={i + 1}
          onAdopt={() => adopt(c.dog)}
          disabled={full}
        />
      ))}
    </Sheet>
  );
}

interface Candidate {
  dog: Dog;
  best: PairingPreview | null;
}

/**
 * The best litter an outside dog could give you right now, judged against
 * every eligible mate already in the kennel.
 */
function bestPairingFor(project: ReturnType<typeof useGame>['project'], dog: Dog): PairingPreview | null {
  const mates = activeDogs(project).filter(
    (d) => d.sex !== dog.sex && breedingEligibility(d, project.month, project.lastLitter[d.id]).eligible,
  );
  let best: PairingPreview | null = null;
  for (const mate of mates.slice(0, 8)) {
    const sire = dog.sex === 'M' ? dog : mate;
    const dam = dog.sex === 'F' ? dog : mate;
    const p = previewPairing(project, sire, dam);
    if (!best || p.meanScore > best.meanScore) best = p;
  }
  return best;
}

function OutsideCard({
  dog,
  best,
  rank,
  onAdopt,
  disabled,
}: {
  dog: Dog;
  best: PairingPreview | null;
  rank: number;
  onAdopt: () => void;
  disabled: boolean;
}) {
  const { project } = useGame();
  const f = describeDog(dog, project);
  const mateName = best ? (best.sire.id === dog.id ? best.dam.name : best.sire.name) : null;

  return (
    <Card className={`mb-3 ${rank === 1 ? 'border-[var(--brand)]' : ''}`}>
      <div className="flex gap-3 mb-2">
        <DogPortrait dog={dog} size={86} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <NameLine f={f} />
            {rank === 1 && <Chip tone="good" className="flex-none">best fit</Chip>}
          </div>
          <FactLine f={f} />
          <TemperamentLine f={f} />
          <LookLine f={f} />
          {f.carries.length > 0 && (
            <div className="text-[11.5px] text-clay truncate">Carries {f.carries.slice(0, 4).join(', ')}</div>
          )}
          <FactChips f={f} standardName={project.standard.name} />
        </div>
      </div>

      {best ? (
        <div className="card p-2.5 mb-2 bg-[var(--bg-2)]">
          <div className="text-[12px] mb-1.5">
            Best litter here: with <strong>{mateName}</strong> · average puppy{' '}
            <strong>{Math.round(best.meanScore)}</strong> · inbreeding {(best.coi * 100).toFixed(1)}% ·{' '}
            {best.standardLow}–{best.standardHigh}% meet standard
          </div>
          {best.improvements.length > 0 && (
            <div className="text-[12px] text-moss leading-snug">
              ↑ Would improve {best.improvements.map((i) => i.label.toLowerCase()).join(', ')}
            </div>
          )}
          {best.weaknesses.length > 0 && (
            <div className="text-[12px] text-rust leading-snug">
              ↓ Would cost {best.weaknesses.map((w) => w.label.toLowerCase()).join(', ')}
            </div>
          )}
          {best.diseases.some((d) => d.affected > 0) && (
            <div className="text-[12px] text-berry leading-snug">
              ⚠ Shares a disease gene with {mateName}: some puppies would be affected
            </div>
          )}
          {best.improvements.length === 0 && best.weaknesses.length === 0 && (
            <div className="text-[12px] text-[var(--text-faint)]">No big shifts either way — a neutral outcross.</div>
          )}
        </div>
      ) : (
        <div className="text-[12px] text-[var(--text-faint)] mb-2">
          Nothing in your kennel is available to pair with this dog right now.
        </div>
      )}

      <Button full small onClick={onAdopt} disabled={disabled}>
        Bring {dog.name} into the kennel
      </Button>
    </Card>
  );
}
