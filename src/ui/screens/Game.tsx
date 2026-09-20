/**
 * THE GAME SHELL
 *
 * Six tabs along the bottom, always visible so the player never has to scroll
 * to navigate. A persistent header shows the calendar, the generation and the
 * kennel count, because those three numbers drive every decision.
 */

import { useMemo, useState } from 'react';
import { Button, Card, Chip, Empty, Explain, Intro, Section, Segmented, Sheet, StatRow } from '../components';
import { UiContext, type UiActions } from '../UiContext';
import { Baby, BookOpen, ChevronLeft, Dna, ChevronRight, Dog as DogIcon, FastForward, GraduationCap, Heart, Home, type LucideIcon, Milk, MoreHorizontal, Network, PawPrint, Scroll, TrendingUp, Trophy } from 'lucide-react';
import { useGame } from '../GameContext';
import { DogCard, DogDetailSheet } from '../dogs';
import { type BreedIntent, BreedTab } from './BreedTab';
import { nextStep } from '../../game/assist';
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
  breedPair,
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
import { BREED_BY_KEY } from '../../engine/breeds';
import { LitterRevealSheet } from './LitterReveal';
import { ClubSheet } from './ClubSheet';
import { type ClubProposal, afterGenerationClosed, pendingProposal } from '../../game/club';

type Tab = 'today' | 'kennel' | 'breed' | 'puppies';

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'today', label: 'Today', icon: Home },
  { key: 'kennel', label: 'Kennel', icon: DogIcon },
  { key: 'breed', label: 'Breed', icon: Heart },
  { key: 'puppies', label: 'Puppies', icon: PawPrint },
];

export function Game({ onExit }: { onExit: () => void }) {
  const { project, refresh, say, nerdMode, setNerdMode } = useGame();
  const [tab, setTab] = useState<Tab>('today');
  const [timeReport, setTimeReport] = useState<MonthReport[] | null>(null);
  /** True when the litters in the time report were already shown in the reveal. */
  const [birthsRevealed, setBirthsRevealed] = useState(false);
  const [genReport, setGenReport] = useState<GenerationReport | null>(null);
  const [pedigreeFocus, setPedigreeFocus] = useState<Dog | null>(null);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(!project.tutorialSeen);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [showsFor, setShowsFor] = useState<string | null | undefined>(undefined);
  const [expertOpen, setExpertOpen] = useState(false);
  const [breedBookOpen, setBreedBookOpen] = useState(false);

  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [breedIntent, setBreedIntent] = useState<BreedIntent>(null);
  /** Litters born this turn, shown one at a time before anything else. */
  const [reveal, setReveal] = useState<string[] | null>(null);
  const [clubNotice, setClubNotice] = useState<ClubProposal | null>(null);
  /** A club notice that arrived with the generation report, shown after it. */
  const [clubQueued, setClubQueued] = useState<ClubProposal | null>(null);

  const afterTime = (reports: MonthReport[]) => {
    const born = reports.flatMap((r) => r.births.map((b) => b.litterId));
    const otherNews = reports.some((r) => r.deaths.length > 0 || r.mutations.length > 0) || (reports[reports.length - 1]?.warnings.length ?? 0) > 0;
    // New puppies get their reveal first; the month's other news waits behind it.
    if (born.length > 0) {
      setReveal(born);
      setTimeReport(otherNews ? reports : null);
      setBirthsRevealed(true);
    } else {
      setTimeReport(reports);
      setBirthsRevealed(false);
    }
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
      // A litter reaching eight weeks is an event too: they can be judged now.
      if (activeDogs(project).some((d) => d.litterId && !d.retention && ageMonths(d, project.month) === 2)) break;
    }
    afterTime(reports);
  };

  const closeGeneration = () => {
    const report = buildGenerationReport(project);
    recordGeneration(project);
    // Every few generations the breed club has something to say.
    const { proposal, vindication } = afterGenerationClosed(project);
    if (vindication) say(vindication);
    if (proposal) setClubQueued(proposal);
    setMoreOpen(false);
    setGenReport(report);
    refresh();
  };

  const goTab = (t: Tab, intent?: BreedIntent) => {
    if (intent) setBreedIntent(intent);
    setTab(t);
  };

  // What a dog's sheet can ask for. Closing the sheet is the caller's job;
  // these just move the shell.
  const ui: UiActions = useMemo(
    () => ({
      breedFrom: (dogId) => {
        setBreedIntent({ parent: dogId });
        setTab('breed');
      },
      showDog: (dogId) => setShowsFor(dogId),
      familyOf: (dogId) => {
        setPedigreeFocus(project.dogs[dogId] ?? null);
        setFamilyOpen(true);
      },
      openMore: () => setMoreOpen(true),
    }),
    [project],
  );

  return (
    <UiContext.Provider value={ui}>
    <div className="paper min-h-full flex flex-col" data-world={tab}>
      {/* ---------------------------------------------------------- header */}
      <header className="flex-none safe-top border-b-[3px] border-[var(--ink)]" style={{ background: 'var(--world)' }}>
        <div className="max-w-lg mx-auto px-4 pt-3 pb-2.5 flex items-center gap-3">
          <button onClick={onExit} className="h-9 w-9 -ml-1 rounded-full border-2 border-[var(--ink)] bg-[var(--card)] text-[var(--text)] flex items-center justify-center btn-3d" aria-label="All projects">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="display text-[22px] truncate leading-tight text-white" style={{ textShadow: '2px 2px 0 var(--ink)' }}>{project.name}</div>
            <div className="inline-block mt-1 rounded-md border-2 border-[var(--ink)] bg-[var(--card)] px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide tabular text-[var(--text)]">
              Year {(project.month / 12).toFixed(1)} · Gen {project.generation} · Kennel{' '}
              {kennelCount(project)}{project.sandbox ? '' : `/${project.kennelCapacity}`}
              {activeDogs(project).length > kennelCount(project)
                ? ` · ${activeDogs(project).length - kennelCount(project)} retired`
                : ''}
            </div>
          </div>
          <button
            onClick={() => setMoreOpen(true)}
            className="h-9 w-9 rounded-full border-2 border-[var(--ink)] bg-[var(--card)] flex items-center justify-center text-[var(--text)] btn-3d"
            aria-label="More"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>
      <div className="bunting flex-none" aria-hidden="true" />

      {/* --------------------------------------------------------- content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto">
          {tab === 'today' && (
            <TodayTab
              onGoTab={goTab}
              onCloseGeneration={closeGeneration}
              onAdvance={advance}
              onAdvanceToEvent={advanceToEvent}
              onClub={(p) => setClubNotice(p)}
              onMore={() => setMoreOpen(true)}
            />
          )}
          {tab === 'kennel' && <KennelTab />}
          {tab === 'breed' && <BreedTab intent={breedIntent} onIntentUsed={() => setBreedIntent(null)} />}
          {tab === 'puppies' && <PuppiesTab />}
        </div>
      </main>

      {/* ------------------------------------------------------------ tabs */}
      <nav className="flex-none border-t-[3px] border-[var(--ink)] bg-[var(--card)] safe-bottom">
        <div className="max-w-lg mx-auto flex px-2 py-2 gap-1.5">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-1.5 flex flex-col items-center gap-1 rounded-xl border-2 ${on ? 'border-[var(--ink)] text-white btn-3d' : 'border-transparent text-[var(--text-faint)]'}`}
                style={on ? { background: 'var(--world)', textShadow: '1px 1px 0 var(--ink)' } : undefined}
              >
                <t.icon size={22} strokeWidth={on ? 2.6 : 1.8} />
                <span className="text-[10px] font-bold">{t.label}</span>
              </button>
            );
          })}
          {/* Time: the one control that moves the calendar. */}
          <button
            onClick={advanceToEvent}
            className="flex-1 py-1.5 flex flex-col items-center gap-1 rounded-xl bg-rust text-white btn-3d border-2 border-[var(--ink)]"
            aria-label="Advance time"
          >
            <FastForward size={22} strokeWidth={2.2} />
            <span className="text-[10px] font-semibold">Time</span>
          </button>
        </div>
      </nav>

      {/* ---------------------------------------------------------- sheets */}
      {moreOpen && (
        <MoreSheet
          onClose={() => setMoreOpen(false)}
          onBreedBook={() => { setMoreOpen(false); setBreedBookOpen(true); }}
          onFamily={() => { setMoreOpen(false); setPedigreeFocus(null); setFamilyOpen(true); }}
          onTrends={() => { setMoreOpen(false); setTrendsOpen(true); }}
          onShows={() => { setMoreOpen(false); setShowsFor(null); }}
          onExpert={() => { setMoreOpen(false); setExpertOpen(true); }}
          onCloseGeneration={closeGeneration}
          onEditStandard={() => { setMoreOpen(false); setEditorState(editorStateFrom(project.standard)); }}
          onClub={(p) => { setMoreOpen(false); setClubNotice(p); }}
          onTutorial={() => { setMoreOpen(false); setTutorialOpen(true); }}
          onAdvance={(m) => { setMoreOpen(false); advance(m); }}
          nerdMode={nerdMode}
          setNerdMode={setNerdMode}
        />
      )}

      {familyOpen && (
        <Sheet open onClose={() => setFamilyOpen(false)} title="Family tree" subtitle="Where your gene pool actually comes from">
          <PedigreeTab focusDog={pedigreeFocus} onFocus={setPedigreeFocus} />
        </Sheet>
      )}
      {trendsOpen && (
        <Sheet open onClose={() => setTrendsOpen(false)} title="Trends" subtitle="How the kennel is changing, generation by generation">
          <AnalyticsTab />
        </Sheet>
      )}

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
          <Intro id="revise-standard">
            Changing your standard rescores every dog you own — a dog that looked mediocre may
            suddenly be exactly right, and vice versa. Goals you do not touch keep their settings.
          </Intro>

          <StandardFields
            state={editorState}
            setState={(updater) => setEditorState((s) => (s ? updater(s) : s))}
          />

          <DifficultyPanel difficulty={assessDifficulty(standardFrom(editorState))} />
        </Sheet>
      )}

      {showsFor !== undefined && <ShowSheet onClose={() => setShowsFor(undefined)} focusDogId={showsFor ?? undefined} />}
      {expertOpen && <ExpertSheet onClose={() => setExpertOpen(false)} />}

      {reveal && (
        <LitterRevealSheet
          litterIds={reveal}
          onDone={() => setReveal(null)}
          onGoPuppies={() => setTab('puppies')}
          moreToCome={!!timeReport || !!milestones}
        />
      )}
      {!reveal && timeReport && <TimeSheet reports={timeReport} birthsRevealed={birthsRevealed} onClose={() => setTimeReport(null)} />}
      {!reveal && !timeReport && milestones && <MilestoneSheet milestones={milestones} onClose={() => setMilestones(null)} />}
      {breedBookOpen && <BreedBookSheet onClose={() => setBreedBookOpen(false)} />}
      {genReport && (
        <GenerationReportSheet
          report={genReport}
          onClose={() => {
            setGenReport(null);
            if (clubQueued) {
              setClubNotice(clubQueued);
              setClubQueued(null);
            }
          }}
        />
      )}
      {clubNotice && <ClubSheet proposal={clubNotice} onClose={() => setClubNotice(null)} />}

      {tutorialOpen && (
        <Tutorial
          onClose={() => {
            project.tutorialSeen = true;
            setTutorialOpen(false);
            refresh();
          }}
          onGoTo={(t) => setTab(t as Tab)}
        />
      )}
    </div>
    </UiContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

function TodayTab({
  onGoTab,
  onCloseGeneration,
  onAdvance,
  onAdvanceToEvent,
  onClub,
  onMore,
}: {
  onGoTab: (tab: Tab, intent?: BreedIntent) => void;
  onCloseGeneration: () => void;
  onAdvance: (months: number) => void;
  onAdvanceToEvent: () => void;
  onClub: (proposal: ClubProposal) => void;
  onMore: () => void;
}) {
  const { project, refresh, say } = useGame();
  const sandbox = !!project.sandbox;
  const step = useMemo(() => nextStep(project), [project, project.month, project.rngCursor, project.pregnancies.length]);
  const doStep = () => {
    const a = step.action;
    if (a.kind === 'evaluate') onGoTab('puppies');
    else if (a.kind === 'makeRoom') onGoTab('kennel');
    else if (a.kind === 'advance') {
      if (a.months) onAdvance(a.months);
      else onAdvanceToEvent();
    } else if (a.kind === 'wait') onAdvanceToEvent();
    else if (a.kind === 'closeGeneration') onCloseGeneration();
    else if (a.kind === 'club') onClub(a.proposal);
    else if (a.kind === 'outcross') onGoTab('breed', a.carrying ? { outside: a.carrying } : 'outside');
    else if (a.kind === 'breed') {
      if (a.plan.pairings.length === 1 && !a.plan.pairings[0].alternative) {
        const p = a.plan.pairings[0];
        const r = breedPair(project, p.sire.id, p.dam.id);
        say(r.message);
        refresh();
      } else onGoTab('breed', 'plan');
    }
  };
  const heart = project.heartDogId ? project.dogs[project.heartDogId] : undefined;

  // What is going on right now, as a few short lines.
  const dogs = activeDogs(project);
  const babies = dogs.filter((d) => d.litterId && !d.retention && ageMonths(d, project.month) < 2);
  const undecided = dogs.filter((d) => d.litterId && ((!d.retention && ageMonths(d, project.month) >= 2) || (d.retention === 'wait' && ageMonths(d, project.month) >= 4)));
  const due = project.pregnancies.length ? Math.max(1, Math.min(...project.pregnancies.map((p) => p.dueMonth - project.month))) : 0;
  const over = kennelCount(project) - project.kennelCapacity;
  const happening: { icon: LucideIcon; text: string; tab?: Tab }[] = [];
  if (project.pregnancies.length > 0) happening.push({ icon: Baby, text: `${project.pregnancies.length} litter${project.pregnancies.length === 1 ? '' : 's'} on the way — due in ${due} month${due === 1 ? '' : 's'}`, tab: 'breed' });
  if (babies.length > 0) happening.push({ icon: Milk, text: `${babies.length} newborn${babies.length === 1 ? '' : 's'} growing — worth judging at eight weeks`, tab: 'puppies' });
  if (undecided.length > 0) happening.push({ icon: PawPrint, text: `${undecided.length} ${undecided.length === 1 ? 'puppy' : 'puppies'} waiting on a decision`, tab: 'puppies' });
  if (over > 0 && !sandbox) happening.push({ icon: Home, text: `${over} over capacity — place someone before breeding`, tab: 'kennel' });
  const notice = pendingProposal(project);
  if (notice) happening.push({ icon: Scroll, text: `The breed club is waiting on an answer: ${notice.title.toLowerCase()}` });

  return (
    <div className="px-4 pb-28 pt-3">
      {!sandbox && (
        <div className="card tilt-l mb-6 p-4 relative overflow-visible" style={{ background: 'var(--world-soft)' }}>
          <span className="absolute -top-3 -left-2 ribbon !text-[12px] !py-0.5 !px-2 !rotate-[-4deg]" style={{ background: 'var(--color-rust)' }}>Do this next</span>
          <div className="display text-[24px] leading-[1.05] mt-2 mb-2" style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 100" }}>{step.title}</div>
          <p className="text-[13px] text-[var(--text-soft)] leading-relaxed mb-3">{step.detail}</p>
          <Button full onClick={doStep}>
            {step.buttonLabel}
          </Button>
        </div>
      )}

      {sandbox && (
        <Card className="mb-4">
          <div className="display text-[16px] leading-tight mb-1">{project.name}</div>
          <p className="text-[12.5px] text-[var(--text-soft)] leading-relaxed">
            Free play: nothing is scored and nobody tells you what to do. Breed whoever you like, bring
            in any breed, and see what turns up.
            {project.founderBreeds && project.founderBreeds.length > 0
              ? ` Started from ${project.founderBreeds.map((k) => BREED_BY_KEY[k]?.name ?? k).join(', ')}.`
              : ''}
          </p>
        </Card>
      )}

      <Section title="Happening now">
        <Card>
          {happening.length === 0 ? (
            <p className="text-[12.5px] text-[var(--text-soft)]">A quiet moment. Breed a pair, or press Time to move on.</p>
          ) : (
            happening.map((h, i) => (
              <button
                key={i}
                onClick={() => h.tab && onGoTab(h.tab)}
                className="w-full text-left flex items-start gap-2 py-1.5 border-b border-[var(--line)] last:border-0"
              >
                <h.icon size={16} className="flex-none mt-0.5 text-[var(--text-faint)]" />
                <span className="text-[12.5px] leading-snug flex-1">{h.text}</span>
                {h.tab && <ChevronRight size={16} className="text-[var(--text-faint)]" />}
              </button>
            ))
          )}
        </Card>
      </Section>

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

      {!sandbox && (
        <Card className="mb-4">
          <div className="text-[13px] font-semibold">{project.standard.name}</div>
          {project.standard.vision && (
            <p className="text-[12px] text-[var(--text-soft)] leading-relaxed mt-0.5">{project.standard.vision}</p>
          )}
        </Card>
      )}

      <button onClick={onMore} className="w-full flex items-center justify-between px-1 py-2 text-[13px] text-[var(--text-soft)]">
        <span>Breed book, shows, expert, standard, trends</span>
        <ChevronRight size={16} className="text-[var(--text-faint)]" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// More: everything that is not part of the turn
// ---------------------------------------------------------------------------

/** One line in the More sheet. */
function Row({ icon: Icon, label, hint, onClick }: { icon: LucideIcon; label: string; hint?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3 py-2.5 border-b border-[var(--line)] last:border-0">
      <Icon size={20} strokeWidth={1.9} className="flex-none text-[var(--brand)]" />
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-semibold">{label}</span>
        {hint && <span className="block text-[11.5px] text-[var(--text-faint)] truncate">{hint}</span>}
      </span>
      <ChevronRight size={16} className="text-[var(--text-faint)]" />
    </button>
  );
}

function MoreSheet({
  onClose,
  onBreedBook,
  onFamily,
  onTrends,
  onShows,
  onExpert,
  onCloseGeneration,
  onEditStandard,
  onClub,
  onTutorial,
  onAdvance,
  nerdMode,
  setNerdMode,
}: {
  onClose: () => void;
  onBreedBook: () => void;
  onFamily: () => void;
  onTrends: () => void;
  onShows: () => void;
  onExpert: () => void;
  onCloseGeneration: () => void;
  onEditStandard: () => void;
  onClub: (p: ClubProposal) => void;
  onTutorial: () => void;
  onAdvance: (months: number) => void;
  nerdMode: boolean;
  setNerdMode: (on: boolean) => void;
}) {
  const { project, refresh } = useGame();
  const sandbox = !!project.sandbox;
  const standing = reputationTier(project.reputation ?? 0);
  const difficulty = useMemo(() => assessDifficulty(project.standard), [project.standard]);
  const titled = activeDogs(project).filter((d) => d.titles && d.titles.length > 0);
  const traitGoals = Object.entries(project.standard.traitGoals).filter(([, g]) => g && g.priority > 0);
  const derivedGoals = Object.entries(project.standard.derivedGoals).filter(([, g]) => g && g.priority > 0);

  return (
    <Sheet open onClose={onClose} title="More" subtitle={project.name}>
      <Card className="mb-4">
        <Row icon={BookOpen} label="Breed book" hint="Everything you have made so far" onClick={onBreedBook} />
        <Row icon={Network} label="Family tree" hint="Pedigrees and who the gene pool comes from" onClick={onFamily} />
        <Row icon={TrendingUp} label="Trends" hint="Generation by generation" onClick={onTrends} />
        {!sandbox && <Row icon={Trophy} label="Dog shows" hint={`${standing.label}${project.reputation ? ` · ${project.reputation} points` : ''}${titled.length ? ` · ${titled.length} titled` : ''}`} onClick={onShows} />}
        {!sandbox && <Row icon={GraduationCap} label="Ask the expert" hint="A read on what the kennel needs" onClick={onExpert} />}
      </Card>

      <Section title="Generation" subtitle={sandbox ? 'Close out a generation to see how the kennel has changed.' : 'Close a chapter to see what changed and what to aim at next.'}>
        <Button full onClick={onCloseGeneration}>
          Close out generation {project.generation}
        </Button>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Button small tone="secondary" onClick={() => onAdvance(1)}>+1 month</Button>
          <Button small tone="secondary" onClick={() => onAdvance(6)}>+6 months</Button>
          <Button small tone="secondary" onClick={() => onAdvance(12)}>+1 year</Button>
        </div>
      </Section>

      {(project.club?.proposals.length ?? 0) > 0 && (
        <Section title="Breed club" subtitle="Fashions come and go. What you did about them.">
          <Card>
            {project.club!.proposals.slice().reverse().slice(0, 4).map((p) => (
              <button key={p.id} onClick={() => onClub(p)} className="w-full text-left flex items-center gap-2 py-1.5 border-b border-[var(--line)] last:border-0">
                <span className="flex-1 text-[13px] leading-snug">{p.title}</span>
                <Chip tone={p.status === 'pending' ? 'warn' : p.status === 'followed' ? 'info' : p.vindicated ? 'good' : 'neutral'}>
                  {p.status === 'pending' ? 'waiting' : p.status === 'followed' ? 'followed' : p.vindicated ? 'proved right' : 'held out'}
                </Chip>
              </button>
            ))}
          </Card>
        </Section>
      )}

      {!sandbox && (
        <Section
          title="Your standard"
          subtitle="Anything not listed is on Don't care."
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
                  goal!.mode === 'higher' ? 'as high as possible' : goal!.mode === 'lower' ? 'as low as possible' : `${goal!.preferredLow}–${goal!.preferredHigh}`
                } · ${PRIORITY_LABEL[goal!.priority]}`}
              />
            ))}
            {project.standard.coatGoal && (
              <StatRow label="Coat type" value={`${project.standard.coatGoal.kinds.join(', ')} · ${PRIORITY_LABEL[project.standard.coatGoal.priority]}`} />
            )}
            {project.standard.colorGoal && project.standard.colorGoal.priority > 0 && (
              <StatRow label="Colour" value={`${project.standard.colorGoal.text} · ${PRIORITY_LABEL[project.standard.colorGoal.priority]}`} />
            )}
          </Card>
          <div className="mt-3">
            <DifficultyPanel difficulty={difficulty} />
          </div>
        </Section>
      )}

      <Section title="Settings">
        <Card className="mb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="text-[13px] font-semibold">Genetics Nerd Mode</div>
              <p className="text-[12px] text-[var(--text-faint)] leading-snug">Adds a Genes tab to every dog with the raw genotype.</p>
            </div>
            <button
              onClick={() => setNerdMode(!nerdMode)}
              className={`flex-none w-12 h-7 rounded-full transition-colors ${nerdMode ? 'bg-[var(--brand)]' : 'bg-[var(--line)]'}`}
              aria-label="Toggle nerd mode"
            >
              <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${nerdMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </Card>
        {!sandbox && (
          <Card className="mb-3">
            <div className="text-[13px] font-semibold mb-1">Kennel capacity</div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={6}
                max={28}
                value={project.kennelCapacity}
                onChange={(e) => {
                  project.kennelCapacity = Number(e.target.value);
                  refresh();
                }}
                className="flex-1"
              />
              <span className="text-[14px] font-semibold tabular-nums w-8 text-right">{project.kennelCapacity}</span>
            </div>
          </Card>
        )}
        <Button full tone="secondary" onClick={onTutorial}>
          Replay the tutorial
        </Button>
      </Section>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Kennel tab
// ---------------------------------------------------------------------------

function KennelTab() {
  const { project } = useGame();
  const [open, setOpen] = useState<Dog | null>(null);
  const [filter, setFilter] = useState<'all' | 'F' | 'M' | 'young'>('all');
  const [sort, setSort] = useState<'score' | 'age' | 'name'>(project.sandbox ? 'age' : 'score');
  const [gene, setGene] = useState<string | null>(null);
  const [geneOpen, setGeneOpen] = useState(false);

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
      <div className="mb-3 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'F', label: '♀' },
              { value: 'M', label: '♂' },
              { value: 'young', label: 'Young' },
            ]}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="flex-none rounded-xl border border-[var(--line)] bg-[var(--card)] px-2 py-2 text-[12px] font-semibold"
          aria-label="Sort"
        >
          {!project.sandbox && <option value="score">Score</option>}
          <option value="age">Age</option>
          <option value="name">Name</option>
        </select>
        {geneOptions.length > 0 && (
          <button
            onClick={() => setGeneOpen((v) => !v)}
            className={`flex-none rounded-xl border px-2.5 py-2 text-[12px] font-semibold ${gene ? 'bg-[var(--brand)] text-white border-transparent' : 'bg-[var(--card)] border-[var(--line)]'}`}
            aria-label="Filter by gene"
          >
            <span className="inline-flex items-center gap-1"><Dna size={14} />{gene ? '1' : ''}</span>
          </button>
        )}
      </div>

      {geneOptions.length > 0 && geneOpen && (
        <div className="mb-4">
          <div className="text-[12px] text-[var(--text-faint)] mb-1.5 px-1">
            Show dogs carrying…
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

      <DogDetailSheet dog={open} onClose={() => setOpen(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

function TimeSheet({ reports, birthsRevealed = false, onClose }: { reports: MonthReport[]; birthsRevealed?: boolean; onClose: () => void }) {
  const { project } = useGame();
  // Litters already met in the reveal are not news any more.
  const births = birthsRevealed ? [] : reports.flatMap((r) => r.births);
  const deaths = reports.flatMap((r) => r.deaths);
  const warnings = reports[reports.length - 1]?.warnings ?? [];
  const mutations = reports.flatMap((r) => r.mutations);
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
          {report.snapshot.goalsTotal ? (
            <>
              <StatRow label="Goals hit (average dog)" value={`${(report.snapshot.averageGoalsHit ?? 0).toFixed(1)} of ${report.snapshot.goalsTotal}`} />
              <StatRow label="Meeting standard" value={`${Math.round(report.snapshot.percentMeetingStandard)}%`} />
            </>
          ) : null}
          <StatRow label="Average inbreeding" value={`${(report.snapshot.averageCoi * 100).toFixed(1)}%`} />
          <StatRow label="Family lines" value={report.snapshot.familyLines} />
          <StatRow label="Average weight" value={`${report.snapshot.averageWeight.toFixed(1)} lb`} />
        </Card>
      </Section>
    </Sheet>
  );
}

export { sizeToPounds };
