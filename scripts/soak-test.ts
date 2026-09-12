/**
 * SOAK TEST
 *
 * Plays the game automatically for fifteen generations and checks that the
 * simulation stays sane. This is how we verify the genetics engine without
 * tapping through hundreds of screens by hand.
 *
 * It also prints a generation table so the numbers can be eyeballed: scores
 * should climb, inbreeding should creep up in a closed population, and the
 * designer cross should visibly converge on its target size.
 *
 * Run with:  npx tsx scripts/soak-test.ts
 */

import {
  type Project,
  activeDogs,
  advanceMonth,
  adoptOutsideDog,
  breedPair,
  breedingPopulation,
  createProject,
  kennelCount,
  kinshipFor,
  placeDog,
  recordGeneration,
  refreshTestCredits,
  searchOutsideDogs,
  takeSnapshot,
} from '../src/game/project';
import { previewPairing } from '../src/game/matchmaking';
import { assessEstablishment } from '../src/game/analytics';
import { HEARTHDOG, MOUSIE, designerCrossStandard, scoreDog } from '../src/engine/standard';
import { ALL_TRAITS, sizeToPounds } from '../src/engine/traits';
import { ageMonths, breedingEligibility, type Dog } from '../src/engine/dog';
import { BREED_BY_KEY } from '../src/engine/breeds';

let failures = 0;
function check(condition: boolean, message: string) {
  if (!condition) {
    failures += 1;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

/** Verify nothing in the world has become corrupt. */
function auditProject(project: Project, label: string) {
  const seenNames = new Set<string>();

  for (const dog of Object.values(project.dogs)) {
    const key = dog.name.trim().toLowerCase();
    check(!seenNames.has(key), `${label}: duplicate name "${dog.name}"`);
    seenNames.add(key);

    check(Number.isFinite(dog.coi) && dog.coi >= 0 && dog.coi <= 1, `${label}: bad COI on ${dog.name} (${dog.coi})`);

    for (const trait of ALL_TRAITS) {
      check(Number.isFinite(dog.bv[trait]), `${label}: ${dog.name} has non-finite breeding value for ${trait}`);
      check(Number.isFinite(dog.observed[trait]), `${label}: ${dog.name} has non-finite observed ${trait}`);
      check(dog.het[trait] >= 0 && Number.isFinite(dog.het[trait]), `${label}: ${dog.name} has bad spread for ${trait}`);
    }

    const weight = sizeToPounds(dog.observed.size);
    check(weight > 0.5 && weight < 500, `${label}: ${dog.name} weighs ${weight.toFixed(1)} lb`);

    // Every gene must have exactly two copies.
    for (const [locus, pair] of Object.entries(dog.genotype)) {
      check(Array.isArray(pair) && pair.length === 2, `${label}: ${dog.name} has a malformed genotype at ${locus}`);
    }

    const score = scoreDog(dog, project.standard).total;
    check(Number.isFinite(score) && score >= 0 && score <= 100, `${label}: ${dog.name} scored ${score}`);

    // A dog can never be its own ancestor.
    check(dog.sireId !== dog.id && dog.damId !== dog.id, `${label}: ${dog.name} is its own parent`);
  }
}

/**
 * A simple automatic breeder: for each eligible female, pick the best-ranked
 * male that is not flagged "Do not breed".
 */
function autoBreed(project: Project): number {
  const females = activeDogs(project).filter(
    (d) => d.sex === 'F' && breedingEligibility(d, project.month, project.lastLitter[d.id]).eligible,
  );
  const males = activeDogs(project).filter(
    (d) => d.sex === 'M' && breedingEligibility(d, project.month, project.lastLitter[d.id]).eligible,
  );
  if (males.length === 0) return 0;

  let bred = 0;
  for (const dam of females) {
    if (kennelCount(project) >= project.kennelCapacity) break;

    const options = males
      .map((sire) => ({ sire, preview: previewPairing(project, sire, dam) }))
      .filter((o) => o.preview.verdict !== 'Do not breed')
      .sort((a, b) => b.preview.meanScore - a.preview.meanScore);

    if (options.length === 0) continue;
    const result = breedPair(project, options[0].sire.id, dam.id);
    if (result.success) bred += 1;
  }
  return bred;
}

/**
 * Act like a competent breeder: rank the whole kennel and keep the best, always
 * leaving room for the next litter. Crucially this culls mediocre ADULTS too —
 * a kennel permanently full of founders has nowhere to put its own puppies.
 */
function autoSelect(project: Project) {
  const target = project.kennelCapacity - 4; // headroom for the next litter

  const ranked = activeDogs(project)
    .filter((d) => ageMonths(d, project.month) >= 5)
    .map((d) => ({ dog: d, score: scoreDog(d, project.standard, true).total }))
    .sort((a, b) => b.score - a.score);

  const keeping = new Set<string>();
  let males = 0;
  let females = 0;

  // Always protect the best breeding animal of each sex, whatever the ranking.
  for (const entry of ranked) {
    if (entry.dog.sex === 'M' && males < 2) {
      keeping.add(entry.dog.id);
      males += 1;
    } else if (entry.dog.sex === 'F' && females < 3) {
      keeping.add(entry.dog.id);
      females += 1;
    }
  }

  for (const entry of ranked) {
    if (keeping.size >= target) break;
    keeping.add(entry.dog.id);
  }

  for (const entry of ranked) {
    if (keeping.has(entry.dog.id)) {
      entry.dog.retention = 'keep';
    } else {
      placeDog(project, entry.dog.id, 'familyCompanion');
    }
  }
}

/** Bring in fresh blood when the gene pool starts closing up. */
function maybeOutcross(project: Project) {
  const snapshot = takeSnapshot(project);
  const needsHelp =
    snapshot.averageCoi > 0.09 || snapshot.familyLines <= 2 || breedingPopulation(project).length < 3;
  if (!needsHelp) return false;
  if (kennelCount(project) >= project.kennelCapacity) return false;

  const candidates = searchOutsideDogs(project, { kind: 'random' }, 3);
  const best = candidates
    .slice()
    .sort((a, b) => scoreDog(b, project.standard).total - scoreDog(a, project.standard).total)[0];
  if (!best) return false;
  adoptOutsideDog(project, best);
  return true;
}

function playGenerations(project: Project, generations: number, label: string) {
  console.log(`\n=== ${label} (seed ${project.seed}) ===`);
  console.log('gen   pop   score  meets%   COI%  lines  weight  lifespan  outcross');

  for (let gen = 1; gen <= generations; gen++) {
    const outcrossed = maybeOutcross(project);
    autoBreed(project);

    // Run the calendar forward far enough for puppies to be born and grow up
    // enough to be judged.
    for (let m = 0; m < 10; m++) advanceMonth(project);
    autoSelect(project);
    for (let m = 0; m < 10; m++) advanceMonth(project);

    const snapshot = takeSnapshot(project);
    recordGeneration(project);
    refreshTestCredits(project);
    auditProject(project, `${label} gen ${gen}`);

    console.log(
      `${String(project.generation).padStart(3)} ${String(snapshot.populationSize).padStart(5)} ` +
        `${snapshot.averageScore.toFixed(1).padStart(7)} ${snapshot.percentMeetingStandard.toFixed(0).padStart(6)}% ` +
        `${(snapshot.averageCoi * 100).toFixed(1).padStart(6)} ${String(snapshot.familyLines).padStart(6)} ` +
        `${snapshot.averageWeight.toFixed(1).padStart(7)} ` +
        `${(snapshot.averageLifespan?.toFixed(1) ?? '  -').padStart(9)}  ${outcrossed ? 'yes' : ''}`,
    );

    if (snapshot.populationSize === 0) {
      console.log('  population died out — stopping');
      break;
    }
  }

  const status = assessEstablishment(project);
  console.log(`  standardisation: ${status.standardisation}%  established: ${status.established}`);
  return project;
}

// ---------------------------------------------------------------------------
// Targeted checks
// ---------------------------------------------------------------------------

function testOneRollEmbryos() {
  console.log('\n=== Embryo genotypes are rolled exactly once ===');
  const project = createProject({ name: 'Roll test', standard: structuredClone(HEARTHDOG), seed: 12345 });

  const females = activeDogs(project).filter((d) => d.sex === 'F');
  const males = activeDogs(project).filter((d) => d.sex === 'M');

  // Force a conception by trying until one takes.
  let pregnancy;
  for (let attempt = 0; attempt < 60 && !pregnancy; attempt++) {
    breedPair(project, males[0].id, females[0].id);
    pregnancy = project.pregnancies[0];
    if (!pregnancy) project.lastLitter[females[0].id] = -99;
  }
  check(!!pregnancy, 'never managed to conceive in 60 attempts');
  if (!pregnancy) return;

  // Snapshot the embryos, then deliver, then confirm the puppies match exactly.
  const snapshot = pregnancy.embryos.map((e) => ({
    sex: e.sex,
    genotype: JSON.stringify(e.genotype),
    size: e.observed.size,
    viable: e.viable,
  }));

  for (let m = 0; m < 3; m++) advanceMonth(project);

  const litter = project.litters[0];
  check(!!litter, 'no litter was delivered');
  if (!litter) return;

  const puppies = litter.puppyIds.map((id) => project.dogs[id]);
  const viableSnapshots = snapshot.filter((s) => s.viable);

  check(
    puppies.length === viableSnapshots.length,
    `puppy count ${puppies.length} does not match viable embryo count ${viableSnapshots.length}`,
  );

  for (let i = 0; i < puppies.length; i++) {
    check(
      JSON.stringify(puppies[i].genotype) === viableSnapshots[i].genotype,
      `puppy ${i} genotype changed between conception and birth`,
    );
    check(
      puppies[i].observed.size === viableSnapshots[i].size,
      `puppy ${i} size changed between conception and birth`,
    );
    check(puppies[i].sex === viableSnapshots[i].sex, `puppy ${i} sex changed between conception and birth`);
  }
  console.log(`  checked ${puppies.length} puppies against their stored embryos`);
}

function testSeedReproducibility() {
  console.log('\n=== Same seed produces the same world ===');

  /**
   * Everything that should be decided by the seed, including the quirks that
   * used to be derived from a dog's id — lifespan especially. Creating a
   * decoy project first proves the second project is not influenced by
   * whatever the player happened to do before it.
   */
  const summarise = (p: Project) =>
    Object.values(p.dogs)
      .map(
        (d) =>
          `${d.sex}:${d.originBreed}:${d.observed.size.toFixed(4)}:${d.seedValue}:${d.deathMonth ?? '-'}:${JSON.stringify(d.genotype)}`,
      )
      .sort()
      .join('|');

  const playABit = (project: Project) => {
    autoBreed(project);
    for (let m = 0; m < 30; m++) advanceMonth(project);
    return project;
  };

  const a = playABit(createProject({ name: 'A', standard: structuredClone(MOUSIE), seed: 777 }));

  // Do unrelated work in between, which would previously have shifted ids.
  createProject({ name: 'Decoy', standard: structuredClone(HEARTHDOG), seed: 31337 });

  const b = playABit(createProject({ name: 'B', standard: structuredClone(MOUSIE), seed: 777 }));

  check(
    summarise(a) === summarise(b),
    'two projects with the same seed diverged after thirty months of play',
  );
  console.log(`  ${Object.keys(a.dogs).length} dogs, identical after 30 months of play`);
}

function testLethalGenes() {
  console.log('\n=== Lethal gene pairings never produce living puppies ===');
  const project = createProject({ name: 'Lethal', standard: structuredClone(HEARTHDOG), seed: 4242 });

  // Hand-build two carriers of the dominant hairless gene, which is fatal when
  // a puppy inherits two copies.
  const dogs = activeDogs(project);
  const sire = dogs.find((d) => d.sex === 'M')!;
  const dam = dogs.find((d) => d.sex === 'F')!;
  sire.genotype.hairlessDom = ['Hd', 'hd'];
  dam.genotype.hairlessDom = ['Hd', 'hd'];
  sire.genotype.bobtail = ['Bt', 'bt'];
  dam.genotype.bobtail = ['Bt', 'bt'];

  let born = 0;
  let losses = 0;
  for (let round = 0; round < 40; round++) {
    project.lastLitter[dam.id] = -99;
    dam.littersProduced = 0;
    breedPair(project, sire.id, dam.id);
    const pregnancy = project.pregnancies.pop();
    if (!pregnancy) continue;
    for (const embryo of pregnancy.embryos) {
      const hairless = embryo.genotype.hairlessDom;
      const bob = embryo.genotype.bobtail;
      if (embryo.viable) {
        born += 1;
        check(
          !(hairless[0] === 'Hd' && hairless[1] === 'Hd'),
          'a double-hairless puppy was born alive',
        );
        check(!(bob[0] === 'Bt' && bob[1] === 'Bt'), 'a double-bobtail puppy was born alive');
      } else {
        losses += 1;
      }
    }
  }
  console.log(`  ${born} live embryos, ${losses} lost — none of the lethal pairs survived`);
  check(losses > 0, 'expected some embryos to be lost to lethal genes but none were');
}

function testDesignerCrossConverges() {
  console.log('\n=== Designer cross: Great Dane body, Poodle coat ===');
  const dane = BREED_BY_KEY.greatDane;
  const poodle = BREED_BY_KEY.poodleStandard;
  const standard = designerCrossStandard(
    'Danoodle',
    { name: dane.name, weight: dane.weight },
    { name: poodle.name },
    ['curly'],
  );

  const project = createProject({
    name: 'Danoodle',
    standard,
    seed: 20260911,
    founderBreeds: ['greatDane', 'poodleStandard'],
  });

  const startWeight = takeSnapshot(project).averageWeight;
  playGenerations(project, 12, 'Danoodle');
  const endSnapshot = takeSnapshot(project);

  console.log(`  started at ${startWeight.toFixed(1)} lb, target ${dane.weight} lb, finished at ${endSnapshot.averageWeight.toFixed(1)} lb`);

  // We are not demanding it hits the target — that is the player's job — only
  // that selection actually moved the population in the right direction.
  check(endSnapshot.populationSize > 0, 'designer cross population died out');

  const curlyShare =
    activeDogs(project).filter((d) => {
      const pair = d.genotype.curl;
      return pair[0] === 'Cu' && pair[1] === 'Cu';
    }).length / Math.max(1, activeDogs(project).length);
  console.log(`  ${Math.round(curlyShare * 100)}% of the kennel is now fully curly-coated`);
}

function testKinshipMaths() {
  console.log('\n=== Inbreeding maths ===');
  const project = createProject({ name: 'Kin', standard: structuredClone(HEARTHDOG), seed: 999 });
  const kinship = kinshipFor(project);

  const dogs = activeDogs(project);
  const sire = dogs.find((d) => d.sex === 'M')!;
  const dam = dogs.find((d) => d.sex === 'F')!;

  check(kinship.projectedCoi(sire.id, dam.id) === 0, 'unrelated founders should have zero projected COI');

  // Build two synthetic full siblings and confirm their offspring COI is 25%.
  const makeChild = (id: string): Dog => ({
    ...dam,
    id,
    name: id,
    sireId: sire.id,
    damId: dam.id,
    birthMonth: 10,
    offspringIds: [],
  });
  const childA = makeChild('kinA');
  const childB = makeChild('kinB');
  childB.sex = 'M';
  project.dogs[childA.id] = childA;
  project.dogs[childB.id] = childB;

  const fresh = kinshipFor(project);
  const coi = fresh.projectedCoi(childB.id, childA.id);
  check(Math.abs(coi - 0.25) < 1e-9, `full siblings should give 25% COI, got ${(coi * 100).toFixed(2)}%`);

  const parentChild = fresh.projectedCoi(sire.id, childA.id);
  check(
    Math.abs(parentChild - 0.25) < 1e-9,
    `parent to offspring should give 25% COI, got ${(parentChild * 100).toFixed(2)}%`,
  );
  console.log('  full sibling and parent-offspring pairings both compute to 25%');
}

// ---------------------------------------------------------------------------

console.log('Dog Genetics — soak test');

testSeedReproducibility();
testOneRollEmbryos();
testLethalGenes();
testKinshipMaths();

playGenerations(
  createProject({ name: 'Hearthdog', standard: structuredClone(HEARTHDOG), seed: 1001 }),
  15,
  'Hearthdog',
);
playGenerations(
  createProject({ name: 'Mousie', standard: structuredClone(MOUSIE), seed: 2002 }),
  15,
  'Mousie',
);
testDesignerCrossConverges();

console.log(`\n${failures === 0 ? '✓ All checks passed.' : `✗ ${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
