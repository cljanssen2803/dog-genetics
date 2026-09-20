/**
 * BREED
 *
 * Choose one parent, compare every possible mate, look at the predicted litter,
 * and commit. This is where the game actually happens.
 */

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, Empty, Intro, Pips, Section, Sheet, StatRow } from '../components';
import { DogPortrait } from '../DogPortrait';
import { useGame } from '../GameContext';
import { type Dog, ageMonths, breedingEligibility } from '../../engine/dog';
import { scoreDog } from '../../engine/standard';
import { resolveColor } from '../../engine/phenotype';
import { loadIndex, loadProject } from '../../game/storage';
import {
  type OutsideSearch,
  activeDogs,
  adoptOutsideDog,
  breedPair,
  kennelCount,
  searchOutsideDogs,
  transferDog,
} from '../../game/project';
import { type MatchVerdict, type PairingPreview, previewPairing, rankMates } from '../../game/matchmaking';
import { goalGaps, populationWarnings } from '../../game/analytics';
import { type GenerationPlan, planGeneration } from '../../game/assist';
import { BreedPicker } from './NewProject';
import { BREED_BY_KEY } from '../../engine/breeds';
import { CARRIER_OPTIONS } from '../../engine/twists';
import { FactChips, FactLine, LookLine, NameLine, TemperamentLine, describeDog } from '../DogFacts';
import { quirkOdds, quirkText } from '../../engine/quirks';

const VERDICT_TONE: Record<MatchVerdict, 'good' | 'neutral' | 'info' | 'warn' | 'bad'> = {
  'Excellent match': 'good',
  'Good match': 'neutral',
  'Useful outcross': 'info',
  'Risky pairing': 'warn',
  'Do not breed': 'bad',
};

export type BreedIntent = 'plan' | 'outside' | { outside: { locus: string; allele: string } } | { parent: string } | null;

export function BreedTab({ intent, onIntentUsed }: { intent?: BreedIntent; onIntentUsed?: () => void }) {
  const { project, refresh, say } = useGame();
  const [parentId, setParentId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PairingPreview | null>(null);
  const [outsideOpen, setOutsideOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  // The Project tab can send the player here with a job in mind.
  const [outsideCarrying, setOutsideCarrying] = useState<{ locus: string; allele: string } | null>(null);
  useEffect(() => {
    if (intent === 'plan') setPlanOpen(true);
    if (intent === 'outside') setOutsideOpen(true);
    if (intent && typeof intent === 'object' && 'outside' in intent) {
      setOutsideCarrying(intent.outside);
      setOutsideOpen(true);
    }
    if (intent && typeof intent === 'object' && 'parent' in intent) setParentId(intent.parent);
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
          {eligible.length > 0 && !project.sandbox && (
            <div className="mb-4">
              <Intro id="breed-plan">
                <p>
                  <strong>Plan my pairings</strong> works out the best mate for every female, keeps the
                  sires spread out, and shows you why. You accept the ones you like — or pick by hand below.
                </p>
              </Intro>
              <Button full onClick={() => setPlanOpen(true)}>
                Plan my pairings
              </Button>
            </div>
          )}

          <Section
            title="Choose a parent"
            subtitle="Tap a dog to see its possible mates."
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
            subtitle={project.sandbox ? 'Least related first. Anyone goes with anyone.' : 'Ranked best first. Nothing is hidden — you can always overrule the ranking.'}
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

      <OutsideSheet open={outsideOpen} onClose={() => setOutsideOpen(false)} presetCarrying={outsideCarrying} />
      <PlanSheet open={planOpen && !preview} onClose={() => setPlanOpen(false)} onPreview={(p) => setPreview(p)} />
      {/* A preview opened from the plan replaces it; × brings the plan back. */}
      {preview && (
        <PairingSheet
          preview={preview}
          onClose={() => setPreview(null)}
          onBack={planOpen ? () => setPreview(null) : undefined}
          onBreed={() => doBreed(preview)}
        />
      )}
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
            {project.sandbox ? (
              <>
                Inbreeding {(preview.coi * 100).toFixed(1)}%
                {preview.coatOutcomes.length > 0 ? ` · ${preview.coatOutcomes.slice(0, 2).map((c) => `${Math.round(c.chance * 100)}% ${c.label.toLowerCase()}`).join(', ')}` : ''}
              </>
            ) : (
              <>
                Inbreeding {(preview.coi * 100).toFixed(1)}% · average puppy {Math.round(preview.meanScore)} ·{' '}
                {preview.standardLow}–{preview.standardHigh}% meet standard
              </>
            )}
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
  onBack,
}: {
  preview: PairingPreview;
  onClose: () => void;
  onBreed: () => void;
  /** Set when the preview was opened from the plan: closing goes back there. */
  onBack?: () => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const [more, setMore] = useState(false);
  const { project } = useGame();
  const sandbox = !!project.sandbox;
  const worstDisease = preview.diseases.reduce((w, d) => Math.max(w, d.affected), 0);

  return (
    <Sheet
      open
      onClose={onBack ?? onClose}
      title={`${preview.dam.name} × ${preview.sire.name}`}
      subtitle={onBack ? `${preview.verdict} · × goes back to the plan` : preview.verdict}
      footer={
        <div className="flex gap-2">
          {!sandbox && (
            <Button tone="secondary" onClick={() => setShowWhy((v) => !v)} className="flex-none">
              {showWhy ? 'Hide' : 'Why?'}
            </Button>
          )}
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

      <div className="card p-3 mb-3">
        <p className="text-[13px] leading-relaxed">{preview.verdictReason}</p>
      </div>

      {/* The three numbers the decision needs, as chips. Everything else is below the fold. */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Chip tone={preview.coiTone === 'bad' ? 'bad' : preview.coiTone === 'warn' ? 'warn' : 'good'}>inbreeding {(preview.coi * 100).toFixed(1)}%</Chip>
        <Chip tone={worstDisease > 0 ? 'bad' : preview.diseases.length ? 'warn' : 'good'}>
          {worstDisease > 0 ? `${Math.round(worstDisease * 100)}% affected` : preview.diseases.length ? 'carriers only' : 'no disease risk'}
        </Chip>
        <Chip tone="neutral">~{preview.expectedLitterSize.toFixed(0)} puppies</Chip>
        {!sandbox && <Chip tone="neutral">avg {Math.round(preview.meanScore)} · {preview.meanGoalsHit.toFixed(1)}/{preview.goalsTotal} goals</Chip>}
      </div>

      {preview.sample.length > 0 && (
        <Section title="A likely litter" subtitle="Six puppies from the simulation, drawn grown up. Every litter is a fresh roll of the dice; this is the shape of it.">
          <SampleLitter sample={preview.sample} size={104} cols={3} />
          {!sandbox && (
            <p className="text-[12px] text-[var(--text-faint)] mt-2 px-1">
              On average a puppy from this pairing hits {preview.meanGoalsHit.toFixed(1)} of {preview.goalsTotal} goals.
            </p>
          )}
        </Section>
      )}

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

      {!more && (
        <Button full tone="secondary" onClick={() => setMore(true)}>
          More details
        </Button>
      )}

      {more && (<>
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
          {!sandbox && (
            <>
              <StatRow
                label="Puppies meeting your standard"
                value={`${preview.standardLow}–${preview.standardHigh}%`}
              />
              <StatRow label="Average puppy score" value={Math.round(preview.meanScore)} />
              <StatRow label="Goals hit (average puppy)" value={`${preview.meanGoalsHit.toFixed(1)} of ${preview.goalsTotal}`} />
              <StatRow label="Best puppy seen in simulation" value={Math.round(preview.bestScore)} />
            </>
          )}
        </div>
      </Section>

      {!sandbox && preview.improvements.length > 0 && (
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

      {!sandbox && preview.weaknesses.length > 0 && (
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
      </>)}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The season plan
// ---------------------------------------------------------------------------

function PlanSheet({ open, onClose, onPreview }: { open: boolean; onClose: () => void; onPreview: (p: PairingPreview) => void }) {
  const { project, refresh, say } = useGame();
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  /** Which option the player picked for each dam: the best-for-score sire, or the alternative. */
  const [picked, setPicked] = useState<Record<string, 'score' | 'diversity'>>({});
  const plan: GenerationPlan | null = useMemo(
    () => (open ? planGeneration(project) : null),
    // Recomputed whenever the kennel changes underneath it.
    [open, project, project.month, project.rngCursor, project.pregnancies.length],
  );

  if (!open || !plan) return null;
  const pairings = plan.pairings.filter((p) => !skippedIds.includes(p.dam.id));
  /** The sire and preview the player has chosen for a dam. */
  const chosen = (p: (typeof pairings)[number]) =>
    picked[p.dam.id] === 'diversity' && p.alternative ? { sire: p.alternative.sire, preview: p.alternative.preview } : { sire: p.sire, preview: p.preview };

  const accept = (damId: string, sireId: string, name: string) => {
    const result = breedPair(project, sireId, damId);
    say(result.success ? `${name}: bred.` : result.message);
    refresh();
  };

  const acceptAll = () => {
    let n = 0;
    for (const p of pairings) {
      const r = breedPair(project, chosen(p).sire.id, p.dam.id);
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
      {pairings.map((p) => {
        const pick = picked[p.dam.id] ?? 'score';
        const current = chosen(p);
        const options: { key: 'score' | 'diversity'; sire: Dog; preview: PairingPreview; reason: string; label: string }[] = [
          { key: 'score', sire: p.sire, preview: p.preview, reason: p.reason, label: 'Best for score' },
        ];
        if (p.alternative) options.push({ key: 'diversity', sire: p.alternative.sire, preview: p.alternative.preview, reason: p.alternative.reason, label: 'Best for diversity' });
        return (
          <Card key={p.dam.id} className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <DogPortrait dog={p.dam} size={64} />
              <div className="flex-1 min-w-0">
                <div className="display text-[15px] leading-tight">{p.dam.name}</div>
                <div className="text-[11.5px] text-[var(--text-faint)]">
                  {options.length > 1 ? 'Two good sires. Your call.' : 'One clear choice.'}
                </div>
              </div>
            </div>
            {options.map((o) => {
              const on = pick === o.key;
              return (
                <button
                  key={o.key}
                  onClick={() => setPicked((s) => ({ ...s, [p.dam.id]: o.key }))}
                  className={`w-full text-left rounded-2xl border-2 p-2 mb-2 ${on ? 'border-[var(--brand)] bg-[var(--bg-2)]' : 'border-[var(--line)]'}`}
                >
                  <div className="flex items-center gap-2">
                    <DogPortrait dog={o.sire} size={56} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="display text-[14px] leading-tight">{o.sire.name}</span>
                        <Chip tone={o.key === 'score' ? 'good' : 'info'}>{o.label}</Chip>
                        {options.length > 1 && <Chip tone={VERDICT_TONE[o.preview.verdict]}>{o.preview.verdict}</Chip>}
                      </div>
                      <p className="text-[12px] text-[var(--text-soft)] leading-snug mt-0.5">{o.reason.replace(/^Best for (score|diversity): /, '')}</p>
                    </div>
                  </div>
                  {on && o.preview.sample.length > 0 && (
                    <div className="mt-2">
                      <SampleLitter sample={o.preview.sample.slice(0, 4)} size={64} cols={4} compact />
                    </div>
                  )}
                </button>
              );
            })}
            <div className="flex gap-2">
              <Button small tone="secondary" onClick={() => onPreview(current.preview)}>
                Details
              </Button>
              <Button small tone="secondary" onClick={() => setSkippedIds((s) => [...s, p.dam.id])}>
                Skip
              </Button>
              <Button small full onClick={() => accept(p.dam.id, current.sire.id, `${p.dam.name} × ${current.sire.name}`)}>
                Breed with {current.sire.name}
              </Button>
            </div>
          </Card>
        );
      })}
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

function OutsideSheet({
  open,
  onClose,
  presetCarrying,
}: {
  open: boolean;
  onClose: () => void;
  presetCarrying?: { locus: string; allele: string } | null;
}) {
  const { project, refresh, say } = useGame();
  // Step one asks one question — what do you need? — and step two shows dogs.
  type Mode = 'same' | 'choose' | 'random' | 'mine';
  const [mode, setMode] = useState<Mode | null>(null);
  const [breedKey, setBreedKey] = useState(project.founderBreeds?.[0] ?? 'labrador');
  const [carrying, setCarrying] = useState<{ locus: string; allele: string } | null>(presetCarrying ?? null);
  useEffect(() => {
    if (presetCarrying) {
      setCarrying(presetCarrying);
      setMode('same');
    }
  }, [presetCarrying]);
  const [results, setResults] = useState<Candidate[]>([]);
  const [mine, setMine] = useState<{ kennel: string; dog: Dog }[] | 'loading' | null>(null);
  const gaps = useMemo(() => goalGaps(project).slice(0, 3), [project, project.month]);
  const founders = (project.founderBreeds ?? []).filter((k) => BREED_BY_KEY[k]);

  // The player's other saved projects, read from the phone when asked for.
  const loadMine = () => {
    if (mine !== null) return;
    setMine('loading');
    void (async () => {
      const found: { kennel: string; dog: Dog }[] = [];
      for (const summary of await loadIndex()) {
        if (summary.id === project.id) continue;
        const other = await loadProject(summary.id);
        if (!other) continue;
        for (const d of Object.values(other.dogs)) {
          if (d.status !== 'kennel' || d.breedingRetired) continue;
          const age = ageMonths(d, other.month);
          if (age < 12 || age > 84) continue;
          // Put the dog on THIS project's calendar so it stays the same age.
          found.push({ kennel: other.name, dog: { ...d, birthMonth: project.month - age } });
        }
      }
      setMine(found);
    })();
  };

  if (!open) return null;

  const runSearch = (search: OutsideSearch) => {
    const found = searchOutsideDogs(project, search, 5);
    // Judge every candidate by the best litter it could give you with what you
    // already own, then put the most useful one first.
    const judged = found
      .map((dog) => ({ dog, best: bestPairingFor(project, dog) }))
      .sort((a, b) => (b.best?.meanScore ?? -1) - (a.best?.meanScore ?? -1));
    setResults(judged);
    refresh();
  };

  const choose = (m: Mode, key?: string) => {
    setMode(m);
    setResults([]);
    if (m === 'same') runSearch({ kind: 'breed', breedKey: key ?? breedKey, carrying: carrying ?? undefined });
    if (m === 'random') runSearch({ kind: 'random' });
    if (m === 'mine') loadMine();
  };

  const adopt = (dog: Dog) => {
    say(adoptOutsideDog(project, dog));
    setResults((r) => r.filter((c) => c.dog.id !== dog.id));
    refresh();
  };

  const full = kennelCount(project) >= project.kennelCapacity;
  const carryLabel = carrying ? CARRIER_OPTIONS.find((o) => o.locus === carrying.locus && o.allele === carrying.allele)?.label : null;

  const carrierPicker = (
    <label className="block card p-3 mb-3">
      <span className="text-[12px] font-semibold block mb-1">Must carry a hidden gene</span>
      <select
        value={carrying ? `${carrying.locus}:${carrying.allele}` : ''}
        onChange={(e) => {
          const v = e.target.value;
          const o = CARRIER_OPTIONS.find((x) => `${x.locus}:${x.allele}` === v);
          setCarrying(o ? { locus: o.locus, allele: o.allele } : null);
        }}
        className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-2 py-2 text-[13px]"
      >
        <option value="">No — any dog of the breed</option>
        {CARRIER_OPTIONS.map((o) => (
          <option key={`${o.locus}:${o.allele}`} value={`${o.locus}:${o.allele}`}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="block text-[11px] text-[var(--text-faint)] mt-1">How a Dudley Newfoundland or a merle Poodle starts: one carrier, then patience.</span>
    </label>
  );

  return (
    <Sheet
      open
      onClose={mode ? () => { setMode(null); setResults([]); } : onClose}
      title={mode === null ? 'Find an outside dog' : mode === 'mine' ? 'From my other kennels' : mode === 'random' ? 'A dog from anywhere' : `${BREED_BY_KEY[breedKey]?.name ?? 'Outside'} dogs`}
      subtitle={mode === null ? 'What does your kennel need?' : '‹ tap the × to choose differently'}
    >
      {mode === null && (
        <>
          <Intro id="outcross">
            <p>
              An outside dog resets relatedness — its puppies start at zero inbreeding — which buys
              back fertility, litter size and lifespan. The catch: it is not built to your standard.
              That trade is the decision.
            </p>
          </Intro>
          {founders.slice(0, 3).map((k) => (
            <BigChoice
              key={k}
              icon="🐕"
              label={`Another ${BREED_BY_KEY[k].name}`}
              hint="More of what you started with"
              onClick={() => { setBreedKey(k); choose('same', k); }}
            />
          ))}
          <BigChoice icon="📚" label="A breed I choose" hint="Any of the 124 breeds" onClick={() => setMode('choose')} />
          <BigChoice icon="🎲" label="Surprise me" hint="A village dog of no fixed breed — unrelated to everything you own" onClick={() => choose('random')} />
          <BigChoice icon="🏡" label="From my other kennels" hint="A grown dog from another of your projects" onClick={() => choose('mine')} />
          {carrierPicker}
        </>
      )}

      {mode === 'choose' && (
        <>
          <BreedPicker value={breedKey} onChange={setBreedKey} />
          <div className="mt-3">{carrierPicker}</div>
          <Button full onClick={() => choose('same', breedKey)}>
            Find {BREED_BY_KEY[breedKey]?.name ?? 'this breed'} dogs
          </Button>
        </>
      )}

      {(mode === 'same' || mode === 'random') && (
        <>
          {carryLabel && <Chip tone="info" className="mb-3">must carry {carryLabel}</Chip>}
          {full && (
            <div className="card p-3 mb-3 border-rust/40 text-[12.5px] text-[var(--text-soft)]">
              Your kennel is full ({project.kennelCapacity} dogs). Place a dog first.
            </div>
          )}
          {results.length > 0 && gaps.length > 0 && !project.sandbox && (
            <div className="text-[11.5px] text-[var(--text-faint)] mb-2 px-1">
              Your kennel most needs: {gaps.map((g) => g.text).join(' · ')}. Sorted by the best litter each could give you.
            </div>
          )}
          {results.map((c, i) => (
            <OutsideCard key={c.dog.id} dog={c.dog} best={c.best} rank={i + 1} onAdopt={() => adopt(c.dog)} disabled={full} />
          ))}
          <Button full tone="secondary" className="mt-2" onClick={() => choose(mode, breedKey)}>
            Show me different dogs
          </Button>
        </>
      )}

      {mode === 'mine' && (
        <div className="mb-4">
          {full && (
            <div className="card p-3 mb-3 border-rust/40 text-[12.5px] text-[var(--text-soft)]">
              Your kennel is full ({project.kennelCapacity} dogs). Place a dog first.
            </div>
          )}
          {mine === 'loading' || mine === null ? (
            <Empty>Looking through your other kennels…</Empty>
          ) : mine.length === 0 ? (
            <Empty>No grown dogs in your other projects yet.</Empty>
          ) : (
            mine
              .slice()
              .sort((a, b) => scoreDog(b.dog, project.standard, true).total - scoreDog(a.dog, project.standard, true).total)
              .map((m) => (
                <MineCard
                  key={`${m.kennel}:${m.dog.id}`}
                  kennel={m.kennel}
                  dog={m.dog}
                  disabled={full}
                  onBring={() => {
                    say(transferDog(project, m.dog, m.kennel));
                    setMine((list) => (Array.isArray(list) ? list.filter((x) => x.dog.id !== m.dog.id) : list));
                    refresh();
                  }}
                />
              ))
          )}
        </div>
      )}
    </Sheet>
  );
}

/** One big answer to "what does your kennel need?" */
function BigChoice({ icon, label, hint, onClick }: { icon: string; label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card p-3 w-full text-left flex items-center gap-3 mb-2">
      <span className="text-[24px] leading-none">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block display text-[15px]">{label}</span>
        <span className="block text-[11.5px] text-[var(--text-faint)] leading-snug">{hint}</span>
      </span>
      <span className="text-[var(--text-faint)]">›</span>
    </button>
  );
}

interface Candidate {
  dog: Dog;
  best: PairingPreview | null;
}

/** A row of simulated puppies, drawn grown, each with its goal pips. */
function SampleLitter({ sample, size, cols, compact = false }: { sample: Dog[]; size: number; cols: number; compact?: boolean }) {
  const { project } = useGame();
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {sample.map((pup) => {
        const s = scoreDog(pup, project.standard);
        return (
          <div key={pup.id} className="flex flex-col items-center min-w-0">
            <DogPortrait dog={pup} size={size} />
            {project.sandbox ? (
              <div className="text-[10.5px] text-[var(--text-faint)] mt-1 truncate max-w-full">{pup.sex === 'F' ? '♀' : '♂'} {resolveColor(pup.genotype).name}</div>
            ) : compact ? (
              <Pips hit={s.goalsHit} total={s.goalsTotal} hits={s.breakdown.map((b) => b.score >= 0.7)} size={5} maxWidth={size} className="mt-1" />
            ) : (
              <>
                <div className="text-[10.5px] text-[var(--text-faint)] mt-1 truncate max-w-full">{pup.sex === 'F' ? '♀' : '♂'} {s.total}</div>
                <Pips hit={s.goalsHit} total={s.goalsTotal} hits={s.breakdown.map((b) => b.score >= 0.7)} size={5} maxWidth={size} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A dog from one of the player's other projects, offered as an outcross. */
function MineCard({ kennel, dog, disabled, onBring }: { kennel: string; dog: Dog; disabled: boolean; onBring: () => void }) {
  const { project } = useGame();
  const f = describeDog(dog, project);
  return (
    <Card className="mb-2">
      <div className="flex gap-3">
        <DogPortrait dog={dog} size={84} />
        <div className="flex-1 min-w-0">
          <NameLine f={f} />
          <div className="text-[11.5px] text-clay font-semibold">From {kennel}</div>
          <FactLine f={f} />
          <LookLine f={f} />
          <FactChips f={f} standardName={project.standard.name} />
        </div>
      </div>
      <Button small full className="mt-2" onClick={onBring} disabled={disabled}>
        Bring {dog.name} over
      </Button>
    </Card>
  );
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
