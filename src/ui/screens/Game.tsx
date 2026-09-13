/**
 * THE GAME SHELL
 *
 * Six tabs along the bottom, always visible so the player never has to scroll
 * to navigate. A persistent header shows the calendar, the generation and the
 * kennel count, because those three numbers drive every decision.
 */

import { useMemo, useState } from 'react';
import { Button, Card, Chip, Empty, Explain, Section, Segmented, Sheet, StatRow } from '../components';
import { useGame } from '../GameContext';
import { DogCard, DogDetailSheet } from '../dogs';
import { BreedTab } from './BreedTab';
import { PuppiesTab } from './PuppiesTab';
import { AnalyticsTab, PedigreeTab } from './PopulationTab';
import { DifficultyPanel, StandardFields, editorStateFrom, standardFrom, type EditorState } from '../StandardEditor';
import { type Dog, ageMonths, lifeStage } from '../../engine/dog';
import { geneticTraits } from '../../engine/phenotype';

/** Every notable gene a dog holds, shown or hidden. Used by the kennel search. */
const carriedAndShown = (dog: Dog) => geneticTraits(dog.genotype);
import { sizeToPounds } from '../../engine/traits';
import { assessDifficulty, scoreDog, PRIORITY_LABEL, DERIVED_LABEL } from '../../engine/standard';
import { TRAITS, type PolyTrait } from '../../engine/traits';
import {
  type MonthReport,
  activeDogs,
  addLog,
  advanceMonth,
  kennelCount,
  recordGeneration,
} from '../../game/project';
import { buildGenerationReport, type GenerationReport } from '../../game/analytics';
import { Tutorial } from '../Tutorial';
import { ShowSheet } from './ShowSheet';
import { ExpertSheet } from './ExpertSheet';
import { BreedBookSheet, MilestoneSheet } from './BreedBook';
import { DogPortrait } from '../DogPortrait';
import { checkMilestones } from '../../game/story';
import type { Milestone } from '../../game/project';
import { reputationTier } from '../../game/project';

type Tab = 'project' | 'kennel' | 'breed' | 'puppies' | 'pedigree' | 'analytics';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'project', label: 'Project', icon: '🏡' },
  { key: 'kennel', label: 'Kennel', icon: '🐕' },
  { key: 'breed', label: 'Breed', icon: '💞' },
  { key: 'puppies', label: 'Puppies', icon: '🐾' },
  { key: 'pedigree', label: 'Family', icon: '🌳' },
  { key: 'analytics', label: 'Trends', icon: '📈' },
];

export function Game({ onExit }: { onExit: () => void }) {
  const { project, refresh, say, nerdMode, setNerdMode } = useGame();
  const [tab, setTab] = useState<Tab>('project');
  const [timeReport, setTimeReport] = useState<MonthReport[] | null>(null);
  const [genReport, setGenReport] = useState<GenerationReport | null>(null);
  const [pedigreeFocus, setPedigreeFocus] = useState<Dog | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(!project.tutorialSeen);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [showsOpen, setShowsOpen] = useState(false);
  const [expertOpen, setExpertOpen] = useState(false);
  const [breedBookOpen, setBreedBookOpen] = useState(false);

  const [milestones, setMilestones] = useState<Milestone[] | null>(null);

  const afterTime = (reports: MonthReport[]) => {
    setTimeReport(reports);
    const fresh = checkMilestones(project);
    if (fresh.length > 0) setMilestones(fresh);
    refresh();
  };

  const advance = (months: number) => {
    const reports: MonthReport[] = [];
    for (let i = 0; i < months; i++) reports.push(advanceMonth(project));
    afterTime(reports);
  };

  /** Jump forward until something worth looking at happens. */
  const advanceToEvent = () => {
    const reports: MonthReport[] = [];
    for (let i = 0; i < 12; i++) {
      const report = advanceMonth(project);
      reports.push(report);
      if (report.births.length > 0 || report.deaths.length > 0) break;
    }
    afterTime(reports);
  };

  const closeGeneration = () => {
    const report = buildGenerationReport(project);
    recordGeneration(project);
    setGenReport(report);
    refresh();
  };

  const showPedigree = (dog: Dog) => {
    setPedigreeFocus(dog);
    setTab('pedigree');
  };

  return (
    <div className="paper min-h-full flex flex-col">
      {/* ---------------------------------------------------------- header */}
      <header className="flex-none safe-top text-white" style={{ background: 'linear-gradient(160deg, #5cc3ff 0%, #2f9be6 60%, #2589cf 100%)' }}>
        <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={onExit} className="text-[20px] leading-none opacity-80" aria-label="All projects">
            ‹
          </button>
          <div className="flex-1 min-w-0">
            <div className="display text-[16px] font-semibold truncate leading-tight">{project.name}</div>
            <div className="text-[11px] opacity-75">
              Year {(project.month / 12).toFixed(1)} · Generation {project.generation} · Kennel{' '}
              {kennelCount(project)}/{project.kennelCapacity}
              {activeDogs(project).length > kennelCount(project)
                ? ` · ${activeDogs(project).length - kennelCount(project)} retired`
                : ''}
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-full bg-white/25 text-[15px] leading-none"
            aria-label="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* --------------------------------------------------------- content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto">
          {tab === 'project' && (
            <ProjectTab
              onCloseGeneration={closeGeneration}
              onAdvance={advance}
              onAdvanceToEvent={advanceToEvent}
              onEditStandard={() => setEditorState(editorStateFrom(project.standard))}
              onShows={() => setShowsOpen(true)}
              onExpert={() => setExpertOpen(true)}
              onBreedBook={() => setBreedBookOpen(true)}
            />
          )}
          {tab === 'kennel' && <KennelTab onShowPedigree={showPedigree} />}
          {tab === 'breed' && <BreedTab />}
          {tab === 'puppies' && <PuppiesTab onShowPedigree={showPedigree} />}
          {tab === 'pedigree' && <PedigreeTab focusDog={pedigreeFocus} onFocus={setPedigreeFocus} />}
          {tab === 'analytics' && <AnalyticsTab />}
        </div>
      </main>

      {/* ------------------------------------------------------- time bar */}
      <div className="flex-none fixed bottom-[62px] left-0 right-0 pointer-events-none safe-bottom">
        <div className="max-w-lg mx-auto px-4 pb-1 flex justify-end gap-2">
          <button
            onClick={advanceToEvent}
            className="pointer-events-auto btn-3d rounded-full bg-rust text-white px-4 py-2.5 text-[13px] font-bold shadow-lg [--btn-shadow:#d5651c]"
          >
            Advance time ▸
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------ tabs */}
      <nav className="flex-none border-t-2 border-[var(--line)] bg-[var(--card)] safe-bottom">
        <div className="max-w-lg mx-auto flex px-1 py-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 rounded-2xl ${
                tab === t.key ? 'bg-[var(--bg-2)] text-[var(--brand)]' : 'text-[var(--text-faint)]'
              }`}
            >
              <span className={`text-[18px] leading-none ${tab === t.key ? '' : 'grayscale opacity-70'}`}>{t.icon}</span>
              <span className="text-[10px] font-bold">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ---------------------------------------------------------- sheets */}
      {editorState && (
        <Sheet
          open
          onClose={() => setEditorState(null)}
          title="Revise your standard"
          subtitle="Every dog is re-scored immediately"
          footer={
            <div className="flex gap-2">
              <Button tone="secondary" onClick={() => setEditorState(null)}>
                Cancel
              </Button>
              <Button
                full
                onClick={() => {
                  const previous = project.standard.name;
                  project.standard = standardFrom(editorState);
                  addLog(
                    project,
                    'decision',
                    `Breed standard revised${previous !== project.standard.name ? ` and renamed to ${project.standard.name}` : ''}.`,
                  );
                  setEditorState(null);
                  say('Standard revised. Every dog has been re-scored.');
                  refresh();
                }}
              >
                Save changes
              </Button>
            </div>
          }
        >
          <div className="card p-3 mb-4">
            <p className="text-[13px] text-[var(--text-soft)] leading-relaxed">
              Real breeders refine what they are aiming at as they learn what is achievable. Changing
              your standard rescores every dog you own — a dog that looked mediocre may suddenly be
              exactly right, and vice versa. Nothing else about your project is affected.
            </p>
            <p className="text-[12px] text-[var(--text-faint)] leading-relaxed mt-2">
              Goals you do not touch keep their exact original settings, so opening this and closing
              it again changes nothing.
            </p>
          </div>

          <StandardFields
            state={editorState}
            setState={(updater) => setEditorState((s) => (s ? updater(s) : s))}
          />

          <DifficultyPanel difficulty={assessDifficulty(standardFrom(editorState))} />
        </Sheet>
      )}

      {showsOpen && <ShowSheet onClose={() => setShowsOpen(false)} />}
      {expertOpen && <ExpertSheet onClose={() => setExpertOpen(false)} />}

      {timeReport && <TimeSheet reports={timeReport} onClose={() => setTimeReport(null)} />}
      {!timeReport && milestones && <MilestoneSheet milestones={milestones} onClose={() => setMilestones(null)} />}
      {breedBookOpen && <BreedBookSheet onClose={() => setBreedBookOpen(false)} />}
      {genReport && <GenerationReportSheet report={genReport} onClose={() => setGenReport(null)} />}

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        <Card className="mb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="text-[13px] font-semibold">Genetics Nerd Mode</div>
              <p className="text-[12px] text-[var(--text-faint)] leading-snug">
                Adds a Genes tab to every dog showing raw genotype notation, hidden breeding values
                and the project's random seed. The game is completely playable without it.
              </p>
            </div>
            <button
              onClick={() => setNerdMode(!nerdMode)}
              className={`flex-none w-12 h-7 rounded-full transition-colors ${nerdMode ? 'bg-[var(--brand)]' : 'bg-[var(--line)]'}`}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full transition-transform ${nerdMode ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </Card>

        <Card className="mb-3">
          <div className="text-[13px] font-semibold mb-1">Kennel capacity</div>
          <p className="text-[12px] text-[var(--text-faint)] mb-2 leading-snug">
            Limited space is what forces real choices. Raising this makes the game easier.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={6}
              max={24}
              value={project.kennelCapacity}
              onChange={(e) => {
                project.kennelCapacity = Number(e.target.value);
                refresh();
              }}
              className="flex-1"
            />
            <span className="text-[14px] font-semibold tabular-nums w-8 text-right">
              {project.kennelCapacity}
            </span>
          </div>
        </Card>

        <Button
          full
          tone="secondary"
          onClick={() => {
            setSettingsOpen(false);
            setTutorialOpen(true);
          }}
        >
          Replay the tutorial
        </Button>
      </Sheet>

      {tutorialOpen && (
        <Tutorial
          onClose={() => {
            project.tutorialSeen = true;
            setTutorialOpen(false);
            say('You can replay this any time from the settings menu.');
            refresh();
          }}
          onGoTo={(t) => setTab(t as Tab)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project tab
// ---------------------------------------------------------------------------

function ProjectTab({
  onCloseGeneration,
  onAdvance,
  onAdvanceToEvent,
  onEditStandard,
  onShows,
  onExpert,
  onBreedBook,
}: {
  onCloseGeneration: () => void;
  onAdvance: (months: number) => void;
  onAdvanceToEvent: () => void;
  onEditStandard: () => void;
  onShows: () => void;
  onExpert: () => void;
  onBreedBook: () => void;
}) {
  const { project } = useGame();
  const difficulty = useMemo(() => assessDifficulty(project.standard), [project.standard]);
  const standing = reputationTier(project.reputation ?? 0);
  const titled = activeDogs(project).filter((d) => d.titles && d.titles.length > 0);
  const heart = project.heartDogId ? project.dogs[project.heartDogId] : undefined;

  const traitGoals = Object.entries(project.standard.traitGoals).filter(
    ([, g]) => g && g.priority > 0,
  );
  const derivedGoals = Object.entries(project.standard.derivedGoals).filter(
    ([, g]) => g && g.priority > 0,
  );

  return (
    <div className="px-4 pb-40 pt-3">
      <Card className="mb-4">
        <div className="display text-[19px] font-semibold mb-1">{project.standard.name}</div>
        {project.standard.vision && (
          <p className="text-[13px] text-[var(--text-soft)] leading-relaxed">{project.standard.vision}</p>
        )}
      </Card>

      {heart && (
        <Card className="mb-4 border-rust/50">
          <div className="flex items-center gap-3">
            <DogPortrait dog={heart} size={64} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-rust">♥ Heart dog</div>
              <div className="display text-[15px] font-semibold truncate">{heart.name}</div>
              <div className="text-[12px] text-[var(--text-faint)]">
                {heart.status === 'kennel' ? 'The one this is all about.' : heart.status === 'deceased' ? 'Remembered.' : 'In a new home.'}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Section title="Your breed" subtitle="The book of everything you have made so far.">
        <Button full tone="secondary" onClick={onBreedBook}>
          Open the breed book
        </Button>
      </Section>

      <Section title="Time">
        <Card>
          <p className="text-[12.5px] text-[var(--text-soft)] leading-relaxed mb-3">
            Nothing happens until time moves. Pregnancies take two months, puppies are worth
            evaluating from eight weeks, and a dog is not fully grown until two years old.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button small tone="secondary" onClick={() => onAdvance(1)}>
              +1 month
            </Button>
            <Button small tone="secondary" onClick={() => onAdvance(6)}>
              +6 months
            </Button>
            <Button small tone="accent" onClick={onAdvanceToEvent}>
              Next event
            </Button>
          </div>
        </Card>
      </Section>

      <Section title="Stuck? Ask the expert" subtitle="A specific read on what your population needs and which pairing to make.">
        <Button full tone="accent" onClick={onExpert}>
          Ask the expert
        </Button>
      </Section>

      <Section
        title="Generation report"
        subtitle="Close out a generation to see what genuinely changed, and what to aim at next."
      >
        <Button full tone="primary" onClick={onCloseGeneration}>
          Close out generation {project.generation}
        </Button>
      </Section>

      <Section
        title="Dog shows"
        subtitle="Outside judgement of how well your breed is coming together."
      >
        <Card>
          <StatRow label="Kennel standing" value={standing.label} />
          {(project.reputation ?? 0) > 0 && (
            <StatRow label="Show points won" value={project.reputation} />
          )}
          {titled.length > 0 && (
            <StatRow label="Titled dogs" value={titled.map((d) => d.name).join(', ')} />
          )}
          <p className="text-[12px] text-[var(--text-faint)] leading-relaxed mt-2 mb-2">
            {standing.bonus > 0
              ? 'Your reputation means better dogs are being offered to you when you look for an outcross.'
              : 'Win at shows to build a reputation. A respected kennel gets better dogs offered to it.'}
          </p>
          <Button full small tone="accent" onClick={onShows}>
            Enter a show
          </Button>
        </Card>
      </Section>

      <Section
        title="Your standard"
        subtitle="Anything not listed here is on Don't care and is ignored."
        right={
          <Button small tone="secondary" onClick={onEditStandard}>
            Revise
          </Button>
        }
      >
        <Card>
          {traitGoals.map(([key, goal]) => {
            const trait = key as PolyTrait;
            const def = TRAITS[trait];
            const target =
              goal!.mode === 'higher'
                ? 'as high as possible'
                : goal!.mode === 'lower'
                  ? 'as low as possible'
                  : def.logScale
                    ? `${goal!.preferredLow}–${goal!.preferredHigh} lb`
                    : `${goal!.preferredLow}–${goal!.preferredHigh}`;
            return <StatRow key={key} label={def.label} value={`${target} · ${PRIORITY_LABEL[goal!.priority]}`} />;
          })}
          {derivedGoals.map(([key, goal]) => (
            <StatRow
              key={key}
              label={DERIVED_LABEL[key as keyof typeof DERIVED_LABEL]}
              value={`${
                goal!.mode === 'higher'
                  ? 'as high as possible'
                  : goal!.mode === 'lower'
                    ? 'as low as possible'
                    : `${goal!.preferredLow}–${goal!.preferredHigh}`
              } · ${PRIORITY_LABEL[goal!.priority]}`}
            />
          ))}
          {project.standard.coatGoal && (
            <StatRow
              label="Coat type"
              value={`${project.standard.coatGoal.kinds.join(', ')} · ${PRIORITY_LABEL[project.standard.coatGoal.priority]}`}
            />
          )}
        </Card>
      </Section>

      <DifficultyPanel difficulty={difficulty} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kennel tab
// ---------------------------------------------------------------------------

function KennelTab({ onShowPedigree }: { onShowPedigree: (dog: Dog) => void }) {
  const { project } = useGame();
  const [open, setOpen] = useState<Dog | null>(null);
  const [filter, setFilter] = useState<'all' | 'F' | 'M' | 'young'>('all');
  const [sort, setSort] = useState<'score' | 'age' | 'name'>('score');
  const [gene, setGene] = useState<string | null>(null);

  /**
   * Which interesting genes actually exist in this kennel, so the filter only
   * ever offers something that will return a result.
   */
  const geneOptions = useMemo(() => {
    const found = new Map<string, { label: string; count: number; prized: boolean }>();
    for (const dog of activeDogs(project)) {
      for (const trait of carriedAndShown(dog)) {
        const existing = found.get(trait.label);
        if (existing) existing.count += 1;
        else found.set(trait.label, { label: trait.label, count: 1, prized: trait.prized });
      }
    }
    return Array.from(found.values()).sort(
      (a, b) => Number(b.prized) - Number(a.prized) || a.label.localeCompare(b.label),
    );
  }, [project, project.month]);

  const dogs = useMemo(() => {
    let list = activeDogs(project);
    if (filter === 'F') list = list.filter((d) => d.sex === 'F');
    if (filter === 'M') list = list.filter((d) => d.sex === 'M');
    if (filter === 'young') list = list.filter((d) => ageMonths(d, project.month) < 18);
    if (gene) list = list.filter((d) => carriedAndShown(d).some((t) => t.label === gene));

    if (sort === 'score') {
      list = list
        .slice()
        .sort((a, b) => scoreDog(b, project.standard).total - scoreDog(a, project.standard).total);
    } else if (sort === 'age') {
      list = list.slice().sort((a, b) => a.birthMonth - b.birthMonth);
    } else {
      list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    // Favourites always float to the top, whatever the sort.
    return list.slice().sort((a, b) => Number(!!b.favourite) - Number(!!a.favourite));
  }, [project, project.month, filter, sort, gene]);

  const retired = Object.values(project.dogs).filter(
    (d) => d.status === 'kennel' && lifeStage(d, project.month) === 'retired',
  );

  return (
    <div className="px-4 pb-28 pt-3">
      <div className="mb-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'F', label: 'Females' },
            { value: 'M', label: 'Males' },
            { value: 'young', label: 'Young' },
          ]}
        />
      </div>
      <div className="mb-4">
        <Segmented
          value={sort}
          onChange={setSort}
          options={[
            { value: 'score', label: 'By score' },
            { value: 'age', label: 'By age' },
            { value: 'name', label: 'By name' },
          ]}
        />
      </div>

      {geneOptions.length > 0 && (
        <div className="mb-4">
          <div className="text-[12px] text-[var(--text-faint)] mb-1.5 px-1">
            Find dogs carrying a gene
          </div>
          <div className="scroll-x flex gap-1.5 pb-1">
            <button
              onClick={() => setGene(null)}
              className={`flex-none rounded-full border px-3 py-1.5 text-[11.5px] font-semibold whitespace-nowrap ${
                gene === null
                  ? 'bg-[var(--brand)] text-white border-transparent'
                  : 'bg-[var(--bg-2)] border-[var(--line)] text-[var(--text-soft)]'
              }`}
            >
              Any
            </button>
            {geneOptions.map((option) => (
              <button
                key={option.label}
                onClick={() => setGene(gene === option.label ? null : option.label)}
                className={`flex-none rounded-full border px-3 py-1.5 text-[11.5px] font-semibold whitespace-nowrap ${
                  gene === option.label
                    ? 'bg-[var(--brand)] text-white border-transparent'
                    : option.prized
                      ? 'bg-clay/20 border-clay/40 text-clay'
                      : 'bg-[var(--bg-2)] border-[var(--line)] text-[var(--text-soft)]'
                }`}
              >
                {option.label} · {option.count}
              </button>
            ))}
          </div>
        </div>
      )}

      {dogs.length === 0 ? (
        <Empty>No dogs match that filter.</Empty>
      ) : (
        dogs.map((dog) => <DogCard key={dog.id} dog={dog} onOpen={setOpen} />)
      )}

      {retired.length > 0 && (
        <Explain title={`${retired.length} retired dog${retired.length === 1 ? '' : 's'}`}>
          <p>
            {retired.map((d) => d.name).join(', ')} {retired.length === 1 ? 'is' : 'are'} still with
            you but no longer breeding. They do not count against your kennel capacity.
          </p>
        </Explain>
      )}

      <DogDetailSheet dog={open} onClose={() => setOpen(null)} onShowPedigree={onShowPedigree} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function TimeSheet({ reports, onClose }: { reports: MonthReport[]; onClose: () => void }) {
  const { project } = useGame();
  const births = reports.flatMap((r) => r.births);
  const deaths = reports.flatMap((r) => r.deaths);
  const warnings = reports[reports.length - 1]?.warnings ?? [];
  const mutations = reports.flatMap((r) => r.mutations);
  const postcards = reports.flatMap((r) => r.postcards ?? []);
  const months = reports.length;

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${months} month${months === 1 ? '' : 's'} passed`}
      subtitle={`Now year ${(project.month / 12).toFixed(1)}`}
      footer={
        <Button full onClick={onClose}>
          Continue
        </Button>
      }
    >
      {mutations.length > 0 && (
        <Section title="Something new">
          {mutations.map((m, i) => (
            <Card key={i} className="mb-2 border-clay">
              <div className="flex items-center gap-2 mb-1">
                <Chip tone="rare">mutation</Chip>
                <span className="text-[13px] font-semibold">A gene from nowhere</span>
              </div>
              <p className="text-[13px] text-[var(--text-soft)] leading-relaxed">{m}</p>
              <p className="text-[12px] text-[var(--text-faint)] mt-1 leading-relaxed">
                Neither parent carried this. It has simply appeared, the way chocolate once appeared
                in Labradors. Whether it becomes part of your breed is now up to you.
              </p>
            </Card>
          ))}
        </Section>
      )}

      {births.length === 0 && deaths.length === 0 && warnings.length === 0 && mutations.length === 0 && (
        <Empty>A quiet stretch. Nothing of note happened.</Empty>
      )}

      {births.length > 0 && (
        <Section title="Litters born">
          {births.map((b, i) => (
            <Card key={i} className="mb-2">
              <div className="text-[14px] font-semibold">
                {b.damName} × {b.sireName}
              </div>
              <div className="text-[12.5px] text-[var(--text-soft)]">
                {b.count} live {b.count === 1 ? 'puppy' : 'puppies'}
                {b.lost > 0 ? `, ${b.lost} lost before birth` : ''}
              </div>
              {b.count === 1 && (
                <p className="text-[12px] text-[var(--text-faint)] mt-1">
                  A singleton. Rare, and it gives you very little to choose from.
                </p>
              )}
            </Card>
          ))}
          <p className="text-[12px] text-[var(--text-faint)] px-1">
            Open the Puppies tab to evaluate them.
          </p>
        </Section>
      )}

      {deaths.length > 0 && (
        <Section title="Deaths">
          {deaths.map((d, i) => (
            <Card key={i} className="mb-2">
              <div className="text-[14px] font-semibold">{d.name}</div>
              <div className="text-[12.5px] text-[var(--text-soft)]">{d.cause}</div>
            </Card>
          ))}
        </Section>
      )}

      {postcards.length > 0 && (
        <Section title="Post" subtitle="News from dogs in their new homes. Nothing to do — just nice to hear.">
          {postcards.map((p, i) => (
            <Card key={i} className="mb-2 border-clay/40">
              <div className="text-[11px] font-semibold text-clay mb-0.5">A postcard from {p.name}</div>
              <p className="text-[13px] leading-relaxed italic">{p.text}</p>
            </Card>
          ))}
        </Section>
      )}

      {warnings.length > 0 && (
        <Section title="Attention">
          {warnings.map((w, i) => (
            <Card key={i} className="mb-2 border-rust/40">
              <p className="text-[13px] text-[var(--text-soft)] leading-relaxed">{w}</p>
            </Card>
          ))}
        </Section>
      )}
    </Sheet>
  );
}

function GenerationReportSheet({
  report,
  onClose,
}: {
  report: GenerationReport;
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Generation ${report.generation} report`}
      subtitle={report.headline}
      footer={
        <Button full onClick={onClose}>
          Begin the next generation
        </Button>
      }
    >
      <Section title="What changed">
        <Card>
          {report.lines.length === 0 ? (
            <p className="text-[13px] text-[var(--text-faint)]">
              Not enough has happened yet to compare against.
            </p>
          ) : (
            report.lines.map((line, i) => (
              <div key={i} className="flex gap-2 py-1.5 border-b border-[var(--line)] last:border-0">
                <Chip tone={line.tone === 'good' ? 'good' : line.tone === 'bad' ? 'warn' : 'neutral'}>
                  {line.tone === 'good' ? '↑' : line.tone === 'bad' ? '↓' : '·'}
                </Chip>
                <span className="text-[13px] leading-snug flex-1">{line.text}</span>
              </div>
            ))
          )}
        </Card>
      </Section>

      <Section title={`Suggested focus for generation ${report.generation + 1}`}>
        <Card>
          {report.suggestions.map((s, i) => (
            <p key={i} className="text-[13px] text-[var(--text-soft)] leading-relaxed mb-2 last:mb-0">
              · {s}
            </p>
          ))}
          <p className="text-[11.5px] text-[var(--text-faint)] mt-2">
            These are suggestions, not instructions. It is your programme.
          </p>
        </Card>
      </Section>

      <Section title="Snapshot">
        <Card>
          <StatRow label="Breeding adults" value={report.snapshot.populationSize} />
          <StatRow label="Meeting standard" value={`${Math.round(report.snapshot.percentMeetingStandard)}%`} />
          <StatRow label="Average inbreeding" value={`${(report.snapshot.averageCoi * 100).toFixed(1)}%`} />
          <StatRow label="Family lines" value={report.snapshot.familyLines} />
          <StatRow label="Average weight" value={`${report.snapshot.averageWeight.toFixed(1)} lb`} />
        </Card>
      </Section>
    </Sheet>
  );
}

export { sizeToPounds };
