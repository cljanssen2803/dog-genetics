/**
 * Plays the game the way a player following the "Do this next" card would,
 * and prints what happens generation by generation. Used to judge pacing and
 * whether the hand-holding actually gets anywhere.
 *
 * Run with:  npx tsx --tsconfig tsconfig.app.json scripts/autoplay.ts
 */

import {
  type Project,
  activeDogs,
  advanceMonth,
  adoptOutsideDog,
  breedPair,
  createProject,
  kennelCount,
  placeDog,
  recordGeneration,
  searchOutsideDogs,
  setRetention,
  takeSnapshot,
} from '../src/game/project';
import { nextStep, planGeneration, triageLitter } from '../src/game/assist';
import { afterGenerationClosed, answerClub } from '../src/game/club';
import { HEARTHDOG, MOUSIE, designerCrossStandard, purebredStandard, scoreDog } from '../src/engine/standard';
import { BREED_BY_KEY } from '../src/engine/breeds';
import { ageMonths } from '../src/engine/dog';

function play(project: Project, years = 20) {
  console.log(`\n=== ${project.name} ===`);
  console.log('yr   gen  pop  avg  best meets%  COI%  lines  taps   note');
  let taps = 0;
  let lastGen = -1;
  const startMonth = project.month;
  const notes: string[] = [];
  const report = (note = '') => {
    if (quiet) return;
    const s = takeSnapshot(project);
    const best = Math.max(0, ...activeDogs(project).map((d) => scoreDog(d, project.standard).total));
    console.log(
      `${(project.month / 12).toFixed(1).padStart(4)} ${String(project.generation).padStart(4)} ${String(s.populationSize).padStart(4)} ${s.averageScore.toFixed(0).padStart(4)} ${String(best).padStart(5)} ${s.percentMeetingStandard.toFixed(0).padStart(6)}% ${(s.averageCoi * 100).toFixed(1).padStart(5)} ${String(s.familyLines).padStart(6)} ${String(taps).padStart(5)}   ${note}`,
    );
  };
  report('start');

  while (project.month - startMonth < years * 12) {
    const step = nextStep(project);
    taps += 1;
    const a = step.action;
    if (a.kind === 'evaluate') {
      // Sort every litter with undecided puppies, apply the advice.
      for (const litter of project.litters) {
        const advice = triageLitter(project, litter);
        for (const x of advice) {
          if (x.choice === 'pet') placeDog(project, x.dog.id, x.placement ?? 'familyCompanion');
          else setRetention(project, x.dog.id, x.choice);
        }
      }
    } else if (a.kind === 'makeRoom') {
      // Place the least useful adults until we fit.
      const adults = activeDogs(project)
        .filter((d) => ageMonths(d, project.month) >= 12)
        .sort((x, y) => scoreDog(x, project.standard, true).total - scoreDog(y, project.standard, true).total);
      let over = kennelCount(project) - project.kennelCapacity;
      for (const d of adults) {
        if (over <= 0) break;
        placeDog(project, d.id, 'familyCompanion');
        over -= 1;
      }
    } else if (a.kind === 'breed') {
      for (const p of a.plan.pairings) breedPair(project, p.sire.id, p.dam.id);
      notes.push(`${a.plan.pairings.length} pairings`);
    } else if (a.kind === 'advance' || a.kind === 'wait') {
      const months = a.kind === 'advance' && a.months ? a.months : 1;
      for (let i = 0; i < months; i++) {
        const r = advanceMonth(project);
        if (r.births.length || r.deaths.length) break;
      }
    } else if (a.kind === 'outcross') {
      const plan = project.founderBreeds ?? [];
      const search = plan.length
        ? ({ kind: 'breed', breedKey: plan[project.generation % plan.length], carrying: a.carrying } as const)
        : ({ kind: 'random' } as const);
      const found = searchOutsideDogs(project, search, 4);
      const best = found.sort((x, y) => scoreDog(y, project.standard).total - scoreDog(x, project.standard).total)[0];
      if (best && kennelCount(project) < project.kennelCapacity) adoptOutsideDog(project, best);
      else if (best) {
        // Make room first.
        const worst = activeDogs(project).sort((x, y) => scoreDog(x, project.standard, true).total - scoreDog(y, project.standard, true).total)[0];
        if (worst) placeDog(project, worst.id, 'familyCompanion');
        adoptOutsideDog(project, best);
      }
    } else if (a.kind === 'closeGeneration') {
      recordGeneration(project);
      const { proposal } = afterGenerationClosed(project);
      if (proposal) notes.push(`club: ${proposal.title}`);
    } else if (a.kind === 'club') {
      // The bot follows a fault-made-virtue (it is free) and resists real
      // fashions, so its scores stay comparable across a run.
      const follow = a.proposal.flavour === 'virtue';
      answerClub(project, a.proposal, follow);
      notes.push(follow ? 'followed club' : 'held the line');
    }

    if (project.generation !== lastGen) {
      lastGen = project.generation;
      report(notes.splice(0).join(', '));
    }
    if (activeDogs(project).length === 0) {
      report('everyone gone');
      break;
    }
    if (taps > 2000) break;
  }
  report('end');
  const s = takeSnapshot(project);
  if (!quiet) console.log(`  finished: ${s.averageScore.toFixed(0)} average, ${s.percentMeetingStandard.toFixed(0)}% meet, generation ${project.generation}, ${taps} taps over ${((project.month - startMonth) / 12).toFixed(0)} years`);
  return { avg: s.averageScore, meet: s.percentMeetingStandard };
}

// `npx tsx scripts/autoplay.ts 5` plays five seeds of each and prints averages.
const runs = Number(process.argv[2] ?? 1);
const quiet = runs > 1;
const totals: Record<string, { avg: number; meet: number; n: number }> = {};
for (let r = 0; r < runs; r++) {
  const seed = 11 + r * 7;
  const projects = [
    createProject({ name: 'Hearthdog', standard: structuredClone(HEARTHDOG), seed }),
    createProject({ name: 'Mousie', standard: structuredClone(MOUSIE), seed: seed + 1 }),
    createProject({
      name: 'Danoodle',
      standard: designerCrossStandard('Danoodle', BREED_BY_KEY.greatDane, BREED_BY_KEY.poodleStandard, ['curly']),
      founderBreeds: ['greatDane', 'poodleStandard'],
      seed: seed + 2,
    }),
    createProject({
      name: 'Dudley Newfoundland',
      standard: purebredStandard(BREED_BY_KEY.newfoundland, { label: 'Dudley', colourText: 'dudley' }),
      founderBreeds: ['newfoundland'],
      seed: seed + 3,
    }),
  ];
  for (const project of projects) {
    const result = play(project, 20, quiet);
    const t = (totals[project.name] ??= { avg: 0, meet: 0, n: 0 });
    t.avg += result.avg;
    t.meet += result.meet;
    t.n += 1;
  }
}
if (quiet) {
  console.log(`
Averages over ${runs} seeds (20 years each):`);
  for (const [name, t] of Object.entries(totals)) console.log(`  ${name.padEnd(22)} score ${(t.avg / t.n).toFixed(0)}   meeting ${(t.meet / t.n).toFixed(0)}%`);
}
