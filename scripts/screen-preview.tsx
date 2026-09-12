/**
 * Renders the real screens to a static HTML page using the real compiled CSS,
 * so the layout can be checked without a live browser.
 *
 * Interactive behaviour obviously will not work in the output — this exists to
 * verify spacing, hierarchy, colour and whether anything overflows on a phone.
 *
 * Run `npm run build` first (it needs dist/assets/*.css), then:
 *   npx tsx --tsconfig tsconfig.app.json scripts/screen-preview.tsx
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GameProvider } from '../src/ui/GameContext';
import { Game } from '../src/ui/screens/Game';
import { BreedTab } from '../src/ui/screens/BreedTab';
import { PuppiesTab } from '../src/ui/screens/PuppiesTab';
import { AnalyticsTab, PedigreeTab } from '../src/ui/screens/PopulationTab';
import { NewProject } from '../src/ui/screens/NewProject';
import { DogCard } from '../src/ui/dogs';
import { Tutorial } from '../src/ui/Tutorial';

import { HEARTHDOG } from '../src/engine/standard';
import {
  activeDogs,
  advanceMonth,
  breedPair,
  createProject,
  recordGeneration,
} from '../src/game/project';
import { breedingEligibility } from '../src/engine/dog';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// --- Grab the compiled stylesheet ------------------------------------------
const assetsDir = join(root, 'dist', 'assets');
const cssFile = readdirSync(assetsDir).find((f) => f.endsWith('.css'));
if (!cssFile) {
  console.error('No compiled CSS found. Run `npm run build` first.');
  process.exit(1);
}
const css = readFileSync(join(assetsDir, cssFile), 'utf8');

// --- Build a project that has actually been played -------------------------
const project = createProject({ name: 'Hearthdog', standard: structuredClone(HEARTHDOG), seed: 1001 });
project.tutorialSeen = true;
project.nerdMode = true;

// Breed a few litters and let them grow, so every screen has real content.
for (let round = 0; round < 4; round++) {
  const females = activeDogs(project).filter(
    (d) => d.sex === 'F' && breedingEligibility(d, project.month, project.lastLitter[d.id]).eligible,
  );
  const males = activeDogs(project).filter(
    (d) => d.sex === 'M' && breedingEligibility(d, project.month, project.lastLitter[d.id]).eligible,
  );
  for (const dam of females.slice(0, 2)) {
    if (males[0]) breedPair(project, males[0].id, dam.id);
  }
  for (let m = 0; m < 9; m++) advanceMonth(project);
  recordGeneration(project);
}

const dogs = activeDogs(project);
console.log(`Built a project with ${Object.keys(project.dogs).length} dogs and ${project.litters.length} litters.`);

// --- Render each screen -----------------------------------------------------
const wrap = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <GameProvider project={project} onToast={() => {}}>
      {node}
    </GameProvider>,
  );

const screens: { title: string; note: string; html: string }[] = [];

screens.push({
  title: 'New project',
  note: 'The four ways to start a breeding project.',
  html: renderToStaticMarkup(<NewProject onCreated={() => {}} onCancel={() => {}} />),
});

screens.push({
  title: 'Project tab',
  note: 'Full game shell: header, time controls, the standard, and the difficulty read-out.',
  html: wrap(<Game onExit={() => {}} />),
});

screens.push({
  title: 'Kennel',
  note: 'Compact dog cards with procedural portraits.',
  html: wrap(
    <div className="paper px-4 pt-3 pb-6">
      {dogs.slice(0, 5).map((d) => (
        <DogCard key={d.id} dog={d} />
      ))}
    </div>,
  ),
});

screens.push({
  title: 'Breed',
  note: 'Parent selection and population warnings.',
  html: wrap(
    <div className="paper">
      <BreedTab />
    </div>,
  ),
});

screens.push({
  title: 'Puppies',
  note: 'Litters with uncertainty ranges and retention decisions.',
  html: wrap(
    <div className="paper">
      <PuppiesTab />
    </div>,
  ),
});

screens.push({
  title: 'Family',
  note: 'Pedigree tree and founder contribution bars.',
  html: wrap(
    <div className="paper">
      <PedigreeTab focusDog={dogs[0] ?? null} onFocus={() => {}} />
    </div>,
  ),
});

screens.push({
  title: 'Trends',
  note: 'Breed status, charts and carrier frequencies.',
  html: wrap(
    <div className="paper">
      <AnalyticsTab />
    </div>,
  ),
});

screens.push({
  title: 'Tutorial',
  note: 'The bottom sheet, which every detail view uses.',
  html: wrap(<Tutorial onClose={() => {}} onGoTo={() => {}} />),
});

// --- Assemble --------------------------------------------------------------
const frames = screens
  .map(
    (s) => `
    <section class="frame">
      <header><h2>${s.title}</h2><p>${s.note}</p></header>
      <div class="phone"><div class="phone-inner">${s.html}</div></div>
    </section>`,
  )
  .join('');

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Dog Genetics — screen preview</title>
<style>
${css}
</style>
<style>
  body { margin:0; padding:24px; background:#e7e1d4;
         font-family:-apple-system,'Segoe UI',system-ui,sans-serif; }
  .sheet { display:flex; flex-wrap:wrap; gap:28px; align-items:flex-start; }
  .frame header { margin-bottom:8px; max-width:390px; }
  .frame h2 { font-family:Georgia,serif; font-size:17px; margin:0 0 2px; color:#221f1a; }
  .frame header p { margin:0; font-size:12px; color:#5c554a; line-height:1.4; }
  .phone { width:390px; height:844px; border:10px solid #2a2723; border-radius:42px;
           overflow:hidden; background:#f4efe4; box-shadow:0 12px 30px rgb(0 0 0 / 18%); }
  .phone-inner { width:100%; height:100%; overflow:auto; position:relative; }
  h1.page { font-family:Georgia,serif; font-size:26px; margin:0 0 4px; color:#221f1a; }
  p.lede { margin:0 0 24px; font-size:14px; color:#5c554a; max-width:70ch; line-height:1.5; }
</style>
</head>
<body>
  <h1 class="page">Dog Genetics — every screen at iPhone size</h1>
  <p class="lede">Rendered from the real components with the real compiled stylesheet, inside a
  390&times;844 frame (iPhone 14/15). Buttons do not respond here — this is for checking layout,
  spacing and hierarchy.</p>
  <div class="sheet">${frames}</div>
</body></html>`;

const out = join(root, 'screen-preview.html');
writeFileSync(out, html);
console.log(`Wrote ${out}`);
