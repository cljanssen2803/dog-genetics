/**
 * Dog cards and the full dog detail sheet.
 *
 * The card is deliberately compact — on a phone you need to compare six dogs
 * without scrolling forever. Everything else lives in the sheet that opens
 * when a card is tapped.
 */

import { useMemo, useState } from 'react';
import {
  type Dog,
  STAGE_LABEL,
  ageMonths,
  breedingEligibility,
  estimateTrait,
  formatAge,
  lifeStage,
  weightEstimate,
} from '../engine/dog';
import {
  BEHAVIOR_TRAITS,
  FORM_TRAITS,
  HEALTH_TRAITS,
  TRAITS,
  describeScore,
  sizeToPounds,
} from '../engine/traits';
import {
  EAR_LABEL,
  geneticHealthFlags,
  hiddenCarriers,
  resolveCoat,
  resolveColor,
  resolveEars,
  resolveTail,
  TAIL_LABEL,
} from '../engine/phenotype';
import { LOCI, LOCUS_BY_KEY, genopairSymbol } from '../engine/loci';
import { scoreDog } from '../engine/standard';
import { lifeStory, quirkLines } from '../game/story';
import { pendingQuirks } from '../engine/quirks';
import { describeCoi } from '../engine/pedigree';
import { DogPortrait } from './DogPortrait';
import { Button, Card, Chip, Explain, Section, Sheet, StatRow, TraitBar } from './components';
import { useGame } from './GameContext';
import { FactChips, FactLine, LookLine, NameLine, TemperamentLine, copyText, describeDog, dogDescription } from './DogFacts';
import { useUi } from './UiContext';
import { FoundBreedSheet } from './screens/BreedGallery';
import { Sparkles } from 'lucide-react';
import {
  PLACEMENT_LABEL,
  ancestorInfluenceFor,
  placeDog,
  placementFit,
  renameDog,
  setRetention,
} from '../game/project';
import type { PlacementType } from '../engine/dog';

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function DogCard({
  dog,
  onOpen,
  showScore = true,
  right,
}: {
  dog: Dog;
  onOpen?: (dog: Dog) => void;
  showScore?: boolean;
  right?: React.ReactNode;
}) {
  const { project } = useGame();
  const f = useMemo(() => describeDog(dog, project), [dog, project, project.month]);

  return (
    <Card onClick={onOpen ? () => onOpen(dog) : undefined} className="mb-2">
      <div className="flex gap-3">
        <div className="flex-none">
          <DogPortrait dog={dog} size={104} />
        </div>

        <div className="flex-1 min-w-0">
          <NameLine f={f} />
          <FactLine f={f} className="mb-1" />
          <TemperamentLine f={f} />
          <LookLine f={f} />

          {f.carries.length > 0 && (
            <div className="text-[11.5px] text-clay truncate">Carries {f.carries.slice(0, 4).join(', ')}</div>
          )}

          {showScore ? (
            <FactChips
              f={f}
              standardName={project.standard.name}
              extra={dog.breedingRetired ? <Chip tone="neutral">not breeding</Chip> : null}
            />
          ) : null}
        </div>

        {right && <div className="flex-none self-center">{right}</div>}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Detail sheet
// ---------------------------------------------------------------------------

export function DogDetailSheet({
  dog,
  onClose,
}: {
  dog: Dog | null;
  onClose: () => void;
}) {
  const { project, refresh, say, nerdMode } = useGame();
  const ui = useUi();
  const [tab, setTab] = useState<'overview' | 'story' | 'health' | 'genes' | 'decide'>('overview');
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [exportText, setExportText] = useState<string | null>(null);
  const [founding, setFounding] = useState(false);

  if (!dog) return null;

  const month = project.month;
  const age = ageMonths(dog, month);
  const stage = lifeStage(dog, month);
  const score = scoreDog(dog, project.standard);
  const bvScore = scoreDog(dog, project.standard, true);
  const coat = resolveCoat(dog.genotype, sizeToPounds(dog.observed.size));
  const color = resolveColor(dog.genotype);
  const flags = geneticHealthFlags(dog.genotype);
  const eligibility = breedingEligibility(dog, month, project.lastLitter[dog.id]);
  const influence = ancestorInfluenceFor(project, dog.id);
  const coi = describeCoi(dog.coi);

  const sire = dog.sireId ? project.dogs[dog.sireId] : undefined;
  const dam = dog.damId ? project.dogs[dog.damId] : undefined;

  const doPlace = (placement: PlacementType) => {
    say(placeDog(project, dog.id, placement));
    refresh();
    onClose();
  };

  const submitRename = () => {
    const error = renameDog(project, dog.id, newName);
    if (error) say(error);
    else {
      say(`Renamed to ${newName.trim()}.`);
      setRenaming(false);
      refresh();
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {dog.name} <span className="text-[var(--text-faint)]">{dog.sex === 'M' ? '♂' : '♀'}</span>
        </span>
      }
      subtitle={`${STAGE_LABEL[stage]} · ${formatAge(age)} · ${dog.breedLabel}`}
    >
      <div className="flex justify-center mb-2">
        <DogPortrait dog={dog} size={200} />
      </div>

      {/* What you can DO with this dog, before what you can read about it. */}
      {ui && dog.status === 'kennel' && (
        <div className="flex gap-2 mb-4">
          <Button
            small
            full
            disabled={!eligibility.eligible}
            onClick={() => {
              onClose();
              ui.breedFrom(dog.id);
            }}
          >
            Breed
          </Button>
          {!project.sandbox && (
            <Button small full tone="accent" onClick={() => { onClose(); ui.showDog(dog.id); }}>
              Show
            </Button>
          )}
          <Button small full tone="secondary" onClick={() => setTab('decide')}>
            Place
          </Button>
        </div>
      )}

      {/* A dog that came out right can found a breed of its own. In a
          sandbox there is no standard, so any grown dog can. */}
      {(score.meetsStandard || project.sandbox) && age >= 12 && (
        <Button full tone="secondary" small className="mb-3" onClick={() => setFounding(true)}>
          <Sparkles size={14} className="inline mr-1 -mt-0.5" />
          Found a breed on {dog.name}
        </Button>
      )}
      {founding && (
        <FoundBreedSheet
          dog={dog}
          projectName={project.name}
          generation={project.generation}
          onClose={() => setFounding(false)}
          onFounded={(breed) => {
            setFounding(false);
            say(`${breed.name} is in the breed bank. Find it in the breed gallery.`);
          }}
        />
      )}

      <div className="text-right -mt-2 mb-2">
        <button
          onClick={async () => {
            const text = dogDescription(dog, project, nerdMode);
            const ok = await copyText(text);
            if (ok) say(`${dog.name}'s description copied.`);
            else setExportText(text);
          }}
          className="text-[11.5px] text-[var(--text-faint)] underline"
        >
          Copy description{nerdMode ? ' + genotype' : ''}
        </button>
      </div>

      {exportText !== null && (
        <Sheet
          open
          onClose={() => setExportText(null)}
          title={`${dog.name} — description`}
          subtitle="Ready to paste into an image generator or another assistant"
          footer={
            <div className="flex gap-2">
              <Button
                tone="secondary"
                onClick={async () => {
                  const ok = await copyText(exportText);
                  say(ok ? 'Copied.' : 'Tap inside the text, then use Select All and Copy.');
                }}
              >
                Copy
              </Button>
              <Button full onClick={() => setExportText(null)}>
                Done
              </Button>
            </div>
          }
        >
          <textarea
            readOnly
            value={exportText}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full h-[60vh] rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 text-[12.5px] leading-relaxed font-mono"
          />
        </Sheet>
      )}

      <div className="flex gap-1 mb-4 p-1 rounded-xl bg-[var(--bg-2)] border border-[var(--line)]">
        {(
          [
            ['overview', 'Overview'],
            ['health', 'Health'],
            ['story', 'Story'],
            ['decide', 'Decide'],
            ...(nerdMode ? ([['genes', 'Genes']] as const) : []),
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex-1 rounded-lg py-2 text-[12px] font-semibold ${
              tab === key ? 'bg-[var(--card)] shadow-sm' : 'text-[var(--text-faint)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------- OVERVIEW -- */}
      {tab === 'overview' && (
        <>
          <div className="card p-3 mb-4">
            {!project.sandbox && (
              <>
                <StatRow
                  label={`${project.standard.name} score`}
                  value={`${score.total} / 100`}
                  tone={score.total >= 70 ? 'good' : score.total >= 45 ? undefined : 'bad'}
                />
                <StatRow
                  label="Likely to produce"
                  value={`${bvScore.total} / 100`}
                />
              </>
            )}
            <StatRow label="Coat" value={coat.label} />
            <StatRow label="Colour" value={color.name} />
            <StatRow label="Eyes and nose" value={`${color.eyeName} eyes, ${color.noseName} nose`} />
            {dog.tests.dna && (
              <StatRow
                label="Hidden genes carried"
                value={
                  hiddenCarriers(dog.genotype).length === 0
                    ? 'None — what you see is what it passes on'
                    : hiddenCarriers(dog.genotype)
                        .map((c) => c.label)
                        .join(', ')
                }
              />
            )}
            <StatRow label="Ears and tail" value={`${EAR_LABEL[resolveEars(dog.observed.earSet)]}, ${TAIL_LABEL[resolveTail(dog.genotype, dog.observed.tailSet, dog.observed.muzzle, coat.kind, sizeToPounds(dog.observed.size))].toLowerCase()}`} />
            <StatRow label="Own inbreeding" value={`${(dog.coi * 100).toFixed(1)}% — ${coi.label.toLowerCase()}`} tone={coi.tone === 'bad' ? 'bad' : coi.tone === 'warn' ? 'warn' : 'good'} />
            {dog.littersProduced > 0 && (
              <StatRow label="Litters produced" value={`${dog.littersProduced} (${dog.offspringIds.length} puppies)`} />
            )}
            {influence > 0.15 && (
              <StatRow
                label="Share of your population descended from this dog"
                value={`${Math.round(influence * 100)}%`}
                tone={influence > 0.35 ? 'bad' : 'warn'}
              />
            )}
          </div>

          {dog.rarities.length > 0 && (
            <div className="card p-3 mb-4 border-clay/50">
              <div className="text-[13px] font-semibold mb-1">Rare genetics</div>
              <div className="flex flex-wrap gap-1">
                {dog.rarities.map((key) => {
                  const found = project.discoveries.find((d) => d.key === key);
                  return <Chip key={key} tone="rare">{found?.title ?? key}</Chip>;
                })}
              </div>
            </div>
          )}

          <TraitGroup dog={dog} title="Temperament" traits={BEHAVIOR_TRAITS} />
          <TraitGroup dog={dog} title="Body" traits={FORM_TRAITS} />
          <TraitGroup dog={dog} title="Constitution" traits={HEALTH_TRAITS} />

          <Section title="Coat performance">
            <div className="card p-3">
              <TraitBar label="Shedding" value={coat.shedding} tone="rust" />
              <TraitBar label="Grooming needed" value={coat.grooming} tone="rust" />
              <TraitBar label="Cold tolerance" value={coat.coldTolerance} tone="moss" />
              <TraitBar label="Heat tolerance" value={coat.heatTolerance} tone="moss" />
              <TraitBar label="Water resistance" value={coat.waterResistance} tone="moss" />
            </div>
          </Section>

          {(sire || dam) && (
            <Section title="Parents">
              <div className="card p-3 text-[13px]">
                <StatRow label="Sire" value={sire?.name ?? 'Unknown'} />
                <StatRow label="Dam" value={dam?.name ?? 'Unknown'} />
              </div>
              {ui && (
                <Button tone="secondary" full small className="mt-2" onClick={() => { onClose(); ui.familyOf(dog.id); }}>
                  See the family tree
                </Button>
              )}
            </Section>
          )}
        </>
      )}

      {/* --------------------------------------------------------- HEALTH -- */}
      {tab === 'health' && (
        <>
          <Explain title="What am I looking at?">
            <p>
              A <strong>carrier</strong> is a completely healthy dog hiding one broken copy of a gene.
              It will never get sick. But if you breed it to another carrier of the same gene, a
              quarter of the puppies will be affected.
            </p>
            <p>
              Carriers are not a problem on their own — banning them from breeding would throw away
              too much of your gene pool. The rule is simply: never carrier to carrier.
            </p>
          </Explain>

          <div className="card p-3 mb-4">
            {flags.length === 0 ? (
              <p className="text-[13px] text-moss font-medium">
                Nothing flagged. Confirmed clear on every gene we screen for.
              </p>
            ) : (
              flags.map((flag) => (
                <div key={flag.locus} className="py-2 border-b border-[var(--line)] last:border-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Chip tone={flag.severity === 'affected' ? 'bad' : flag.severity === 'carrier' ? 'warn' : 'info'}>
                      {flag.severity === 'affected' ? 'Affected' : flag.severity === 'carrier' ? 'Carrier' : 'Raised risk'}
                    </Chip>
                    <span className="text-[13px] font-semibold">{flag.name}</span>
                  </div>
                  <p className="text-[12.5px] text-[var(--text-soft)] leading-relaxed">{flag.text}</p>
                </div>
              ))
            )}
          </div>

          <Section title="What this dog carries">
            <div className="card p-3">
              {hiddenCarriers(dog.genotype).length === 0 ? (
                <p className="text-[13px] text-[var(--text-soft)] leading-relaxed">
                  Nothing hidden. What you see on {dog.name} is what {dog.sex === 'M' ? 'he' : 'she'}{' '}
                  passes on.
                </p>
              ) : (
                <>
                  <p className="text-[12.5px] text-[var(--text-soft)] mb-2 leading-relaxed">
                    One copy of each of these, so they do not show — but half of{' '}
                    {dog.sex === 'M' ? 'his' : 'her'} puppies will inherit them.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {hiddenCarriers(dog.genotype).map((c) => (
                      <Chip key={c.locus} tone={c.prized ? 'rare' : 'neutral'}>
                        {c.label}
                      </Chip>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Section>
        </>
      )}

      {/* --------------------------------------------------------- DECIDE -- */}
      {tab === 'story' && (
        <>
          <div className="flex gap-2 mb-4">
            <Button
              small
              tone={dog.favourite ? 'accent' : 'secondary'}
              full
              onClick={() => {
                dog.favourite = !dog.favourite;
                say(dog.favourite ? `${dog.name} pinned to the top of the kennel.` : `${dog.name} unpinned.`);
                refresh();
              }}
            >
              {dog.favourite ? '★ Favourite' : '☆ Favourite'}
            </Button>
            <Button
              small
              tone={project.heartDogId === dog.id ? 'accent' : 'secondary'}
              full
              onClick={() => {
                project.heartDogId = project.heartDogId === dog.id ? undefined : dog.id;
                say(project.heartDogId ? `${dog.name} is your heart dog.` : 'Heart dog cleared.');
                refresh();
              }}
            >
              {project.heartDogId === dog.id ? '♥ Heart dog' : '♡ Heart dog'}
            </Button>
          </div>

          <Section title="Habits" subtitle="Inherited, like everything else. Watch for them in the puppies.">
            <div className="card p-3">
              {quirkLines(dog, project).length === 0 ? (
                <p className="text-[13px] text-[var(--text-faint)] leading-relaxed">
                  {ageMonths(dog, project.month) < 6
                    ? 'Too young to have shown any habits yet. They appear as the puppy grows.'
                    : `${dog.name} has no particular habits. Some dogs are simply easy.`}
                </p>
              ) : (
                quirkLines(dog, project).map((line, i) => (
                  <p key={i} className="text-[13px] leading-relaxed py-1.5 border-b border-[var(--line)] last:border-0">
                    {line}
                  </p>
                ))
              )}
              {nerdMode && pendingQuirks(dog.genotype, ageMonths(dog, project.month)).length > 0 && (
                <p className="text-[11.5px] text-[var(--text-faint)] mt-2">
                  Not yet shown (Nerd Mode):{' '}
                  {pendingQuirks(dog.genotype, ageMonths(dog, project.month))
                    .map((q) => q.gene)
                    .join(', ')}
                </p>
              )}
            </div>
          </Section>

          <Section title={`${dog.name}'s story`}>
            <div className="card p-3">
              {lifeStory(dog, project).map((p, i) => (
                <div key={i} className="flex gap-3 py-2 border-b border-[var(--line)] last:border-0">
                  <span className="flex-none w-14 text-[11px] text-[var(--text-faint)] pt-0.5">{p.year}</span>
                  <p className="text-[13px] leading-relaxed flex-1">{p.text}</p>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {tab === 'decide' && (
        <>
          <div className="card p-3 mb-4">
            <div className="text-[13px] font-semibold mb-1">Breeding status</div>
            <p className="text-[12.5px] text-[var(--text-soft)] leading-relaxed">
              {eligibility.eligible
                ? `${dog.name} is available for breeding now.`
                : `Not available: ${eligibility.reason}.`}
            </p>
          </div>

          {age < 12 && <Section title="Retention">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['keep', 'Keep for breeding'],
                  ['wait', 'Wait and evaluate'],
                  ['retainNoBreed', 'Keep, do not breed'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  small
                  tone={dog.retention === value ? 'primary' : 'secondary'}
                  onClick={() => {
                    setRetention(project, dog.id, value);
                    say(`${dog.name}: ${label.toLowerCase()}.`);
                    refresh();
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </Section>}

          <Section title="Place in a pet home" subtitle="This removes the dog from your kennel permanently.">
            <div className="card p-3">
              {placementFit(dog).map((fit, index) => (
                <div key={fit.type} className="flex items-center gap-3 py-2 border-b border-[var(--line)] last:border-0">
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold flex items-center gap-1.5">
                      {PLACEMENT_LABEL[fit.type]}
                      {index === 0 && <Chip tone="good">best fit</Chip>}
                    </div>
                    <p className="text-[12px] text-[var(--text-faint)]">{fit.note}</p>
                  </div>
                  <Button small tone="secondary" onClick={() => doPlace(fit.type)}>
                    Place
                  </Button>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Name">
            {renaming ? (
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New name"
                  className="flex-1 rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[14px]"
                />
                <Button small onClick={submitRename}>
                  Save
                </Button>
              </div>
            ) : (
              <Button
                tone="secondary"
                small
                onClick={() => {
                  setNewName(dog.name);
                  setRenaming(true);
                }}
              >
                Rename {dog.name}
              </Button>
            )}
          </Section>

          {!dog.breedingRetired && (
            <Section title="Retire">
              <Button
                tone="danger"
                small
                full
                onClick={() => {
                  dog.breedingRetired = true;
                  say(`${dog.name} has been retired from breeding.`);
                  refresh();
                }}
              >
                Retire {dog.name} from breeding
              </Button>
            </Section>
          )}
        </>
      )}

      {/* ---------------------------------------------------------- GENES -- */}
      {tab === 'genes' && nerdMode && <GenotypeTable dog={dog} />}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Trait groups with uncertainty
// ---------------------------------------------------------------------------

function TraitGroup({ dog, title, traits }: { dog: Dog; title: string; traits: string[] }) {
  const { project } = useGame();
  const month = project.month;

  return (
    <Section title={title}>
      <div className="card p-3">
        {traits.map((key) => {
          const trait = key as keyof typeof TRAITS;
          const def = TRAITS[trait];
          const estimate = estimateTrait(dog, trait, month);

          if (def.logScale) {
            const w = weightEstimate(dog, month);
            return (
              <div key={key} className="mb-2.5">
                <div className="flex justify-between items-baseline text-[12px] mb-1">
                  <span className="text-[var(--text-soft)]">{def.label}</span>
                  <span className="font-semibold tabular-nums">
                    {w.known
                      ? `${w.center.toFixed(w.center < 20 ? 1 : 0)} lb`
                      : `${w.low.toFixed(0)}–${w.high.toFixed(0)} lb`}
                    <span className="text-[var(--text-faint)] font-normal ml-1">{w.known ? '' : `${w.confidenceLabel.toLowerCase()} confidence`}</span>
                  </span>
                </div>
              </div>
            );
          }

          return (
            <TraitBar
              key={key}
              label={def.label}
              value={estimate.center}
              low={estimate.known ? undefined : estimate.low}
              high={estimate.known ? undefined : estimate.high}
              hint={estimate.known ? describeScore(estimate.center) : `estimate · ${estimate.confidenceLabel.toLowerCase()} confidence`}
            />
          );
        })}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Nerd mode
// ---------------------------------------------------------------------------

function GenotypeTable({ dog }: { dog: Dog }) {
  const { project } = useGame();

  if (!dog.tests.dna) {
    return (
      <div className="card p-4 text-[13px] text-[var(--text-soft)] leading-relaxed">
        No DNA panel has been run on {dog.name}, so the full genotype is unknown. Run the panel from
        the Health tab to see it.
      </div>
    );
  }

  const groups = [
    { label: 'Coat structure', category: 'coat' as const },
    { label: 'Colour', category: 'color' as const },
    { label: 'Body form', category: 'form' as const },
    { label: 'Disease', category: 'disease' as const },
    { label: 'Habits (personality genes)', category: 'quirk' as const },
  ];

  return (
    <>
      <Explain title="Reading genotype notation">
        <p>
          Each gene is written as two letters separated by a slash, one copy from each parent. A
          capital letter is dominant — it shows even when only one copy is present. A lower-case
          letter is recessive and only shows when both copies match.
        </p>
        <p>
          So <code>L/l</code> means a short-coated dog carrying long coat, and <code>l/l</code> means
          an actually long-coated dog.
        </p>
      </Explain>

      {groups.map((group) => {
        const loci = LOCI.filter((l) => l.category === group.category);
        return (
          <Section key={group.category} title={group.label}>
            <div className="card p-3">
              {loci.map((locus) => {
                const pair = dog.genotype[locus.key];
                if (!pair) return null;
                const notable =
                  group.category === 'disease'
                    ? pair[0] === 'm' || pair[1] === 'm'
                    : pair[0] !== pair[1] || locus.alleles[0].code !== pair[0];
                return (
                  <div
                    key={locus.key}
                    className="flex justify-between items-baseline gap-3 py-1.5 border-b border-[var(--line)] last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium truncate">{locus.name}</div>
                      <div className="text-[11px] text-[var(--text-faint)]">{locus.gene}</div>
                    </div>
                    <code
                      className={`text-[12.5px] font-mono ${notable ? 'text-rust-deep font-bold' : 'text-[var(--text-faint)]'}`}
                    >
                      {genopairSymbol(locus.key, pair)}
                    </code>
                  </div>
                );
              })}
            </div>
          </Section>
        );
      })}

      <Section title="Polygenic estimates" subtitle="Hidden breeding values, normally never shown.">
        <div className="card p-3">
          {(Object.keys(TRAITS) as (keyof typeof TRAITS)[]).map((trait) => {
            const def = TRAITS[trait];
            const bv = dog.bv[trait];
            const observed = dog.observed[trait];
            return (
              <div
                key={trait}
                className="flex justify-between items-baseline gap-3 py-1.5 border-b border-[var(--line)] last:border-0"
              >
                <span className="text-[12.5px]">{def.label}</span>
                <span className="text-[12px] font-mono text-[var(--text-soft)]">
                  BV {def.logScale ? Math.exp(bv).toFixed(1) : bv.toFixed(1)} · obs{' '}
                  {def.logScale ? Math.exp(observed).toFixed(1) : observed.toFixed(1)} · spread ±
                  {def.logScale ? (Math.exp(dog.het[trait]) - 1).toFixed(2) : dog.het[trait].toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Project seed">
        <div className="card p-3 text-[12px] font-mono text-[var(--text-soft)]">
          seed {project.seed} · cursor {project.rngCursor} · dog id {dog.id}
        </div>
      </Section>
    </>
  );
}

/** Small helper used by lists that need the locus name. */
export function locusName(key: string): string {
  return LOCUS_BY_KEY[key]?.name ?? key;
}
