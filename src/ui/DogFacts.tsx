/**
 * ONE SOURCE OF TRUTH FOR WHAT A DOG IS
 *
 * Every screen that shows a dog — kennel card, mate card, puppy card, show
 * entry, pedigree box, outside-dog card — used to assemble its own subset of
 * facts in its own order. The result was that a dog's weight, breed or colour
 * could be phrased three different ways in three places, and sometimes one
 * place would simply leave a fact out.
 *
 * Now every screen calls `describeDog` and renders the same pieces. The export
 * text for image generation is built from the same object, so what you copy
 * can never disagree with what you see.
 */

import type { Dog } from '../engine/dog';
import { STAGE_LABEL, ageMonths, currentWeight, formatAge, lifeStage, weightEstimate } from '../engine/dog';
import {
  BEHAVIOR_TRAITS,
  TRAITS,
  calmnessFrom,
  describeScore,
  scoreToStars,
  sizeToPounds,
} from '../engine/traits';
import {
  EAR_LABEL,
  geneticHealthFlags,
  hiddenCarriers,
  legShortening,
  resolveCoat,
  resolveColor,
  resolveEars,
  resolveTail,
  TAIL_BLURB,
} from '../engine/phenotype';
import { LOCI, genopairSymbol } from '../engine/loci';
import { scoreDog } from '../engine/standard';
import type { Project } from '../game/project';
import { Chip } from './components';

export interface DogFacts {
  name: string;
  sexWord: 'male' | 'female';
  sexSymbol: '♂' | '♀';
  stage: string;
  age: string;
  ageMonths: number;
  grown: boolean;
  breed: string;
  /** Weight now, as a display string. */
  weight: string;
  /** Adult weight or estimate range, as a display string. */
  adultWeight: string;
  weightLbs: number;
  /** Extra small / Small / Medium / Large / Extra large. */
  sizeBand: string;
  colour: string;
  coat: string;
  ears: string;
  tail: string;
  eyes: string;
  nose: string;
  build: string;
  muzzle: string;
  score: number;
  producesScore: number;
  meetsStandard: boolean;
  calm: number;
  trainable: number;
  preyDrive: number;
  carries: string[];
  healthAffected: string[];
  healthCarrier: string[];
  titles: string[];
  rarities: string[];
}

/** The five size bands the interface talks about. */
export function sizeBandOf(lbs: number): string {
  if (lbs < 12) return 'Extra small';
  if (lbs < 25) return 'Small';
  if (lbs < 55) return 'Medium';
  if (lbs < 95) return 'Large';
  return 'Extra large';
}

export function describeDog(dog: Dog, project: Project): DogFacts {
  const month = project.month;
  const months = ageMonths(dog, month);
  const grown = months >= 18;
  const now = currentWeight(dog, month);
  const est = weightEstimate(dog, month);
  const lbs = sizeToPounds(dog.observed.size);
  const coat = resolveCoat(dog.genotype, lbs);
  const colour = resolveColor(dog.genotype);
  const score = scoreDog(dog, project.standard);
  const produces = scoreDog(dog, project.standard, true);
  const flags = geneticHealthFlags(dog.genotype);
  const fmt = (v: number) => v.toFixed(v < 20 ? 1 : 0);

  const substance = dog.observed.substance;
  const build =
    substance < 35 ? 'fine, racy build' : substance < 62 ? 'medium build' : 'heavy, thick-set build';
  const legs = legShortening(dog.genotype);
  const buildFull = legs === 2 ? `${build}, very short legs` : legs === 1 ? `${build}, short legs` : build;

  const muzzleScore = dog.observed.muzzle;
  const muzzle =
    muzzleScore < 25
      ? 'very short, flat face'
      : muzzleScore < 45
        ? 'short muzzle'
        : muzzleScore < 70
          ? 'medium muzzle'
          : 'long muzzle';

  return {
    name: dog.name,
    sexWord: dog.sex === 'M' ? 'male' : 'female',
    sexSymbol: dog.sex === 'M' ? '♂' : '♀',
    stage: STAGE_LABEL[lifeStage(dog, month)],
    age: formatAge(months),
    ageMonths: months,
    grown,
    breed: dog.breedLabel,
    weight: `${fmt(now)} lb`,
    adultWeight: est.known
      ? `${fmt(est.center)} lb`
      : `${est.low.toFixed(0)}–${est.high.toFixed(0)} lb (estimate)`,
    weightLbs: lbs,
    sizeBand: sizeBandOf(lbs),
    colour: colour.name,
    coat: coat.label,
    ears: EAR_LABEL[resolveEars(dog.observed.earSet)],
    tail: TAIL_BLURB[resolveTail(dog.genotype, dog.observed.tailSet, dog.observed.muzzle, coat.kind)],
    eyes: colour.eyeName,
    nose: colour.noseName,
    build: buildFull,
    muzzle,
    score: score.total,
    producesScore: produces.total,
    meetsStandard: score.meetsStandard,
    calm: calmnessFrom(dog.observed.energy, dog.observed.stability, dog.observed.vocality),
    trainable: Math.round(dog.observed.biddability),
    preyDrive: Math.round(dog.observed.preyDrive),
    carries: hiddenCarriers(dog.genotype).map((c) => c.label),
    healthAffected: flags.filter((f) => f.severity === 'affected').map((f) => f.name),
    healthCarrier: flags.filter((f) => f.severity === 'carrier').map((f) => f.name),
    titles: dog.titles ?? [],
    rarities: dog.rarities,
  };
}

// ---------------------------------------------------------------------------
// The shared pieces every card renders
// ---------------------------------------------------------------------------

/** "2 yr 4 mo · 17.6 lb · Rat Terrier type" */
export function FactLine({ f, className = '' }: { f: DogFacts; className?: string }) {
  return (
    <div className={`text-[11.5px] text-[var(--text-faint)] leading-snug ${className}`}>
      {f.age} · {f.grown ? f.adultWeight : `${f.weight} now, adult ${f.adultWeight}`} · {f.sizeBand.toLowerCase()} · {f.breed}
    </div>
  );
}

/** "Apricot · Wiry coat with beard and eyebrows · Erect ears" */
export function LookLine({ f, className = '' }: { f: DogFacts; className?: string }) {
  return (
    <div className={`text-[11.5px] text-[var(--text-soft)] leading-snug truncate ${className}`}>
      {f.colour} · {f.coat} · {f.ears}
    </div>
  );
}

/** "Calm 53 · Trainable 56 · Prey drive 87" — stars for young dogs. */
export function TemperamentLine({ f, className = '' }: { f: DogFacts; className?: string }) {
  const stars = (v: number) => '★'.repeat(scoreToStars(v)) + '☆'.repeat(5 - scoreToStars(v));
  return (
    <div className={`text-[11.5px] text-[var(--text-soft)] leading-snug ${className}`}>
      {f.grown ? (
        <>
          Calm {f.calm} · Trainable {f.trainable} · Prey drive {f.preyDrive}
        </>
      ) : (
        <>
          Calm {stars(f.calm)} · Trainable {stars(f.trainable)} · Prey {stars(f.preyDrive)}
        </>
      )}
    </div>
  );
}

/** Score chip plus the health chips. */
export function FactChips({
  f,
  standardName,
  extra,
}: {
  f: DogFacts;
  standardName: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      <Chip tone={f.score >= 70 ? 'good' : f.score >= 45 ? 'neutral' : 'bad'}>
        {standardName} {f.score}
      </Chip>
      {f.healthAffected.length > 0 && <Chip tone="bad">{f.healthAffected[0]}</Chip>}
      {f.healthAffected.length === 0 && f.healthCarrier.length > 0 && (
        <Chip tone="warn">
          {f.healthCarrier.length === 1
            ? `${f.healthCarrier[0]} carrier`
            : `${f.healthCarrier.length} carriers`}
        </Chip>
      )}
      {f.titles.length > 0 && <Chip tone="rare">{f.titles[f.titles.length - 1]}</Chip>}
      {extra}
    </div>
  );
}

/** Name with sex symbol, title, and rare badge — the header of every card. */
export function NameLine({ f }: { f: DogFacts }) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      {f.titles.length > 0 && (
        <span className="text-rust text-[12px] font-semibold">{f.titles[f.titles.length - 1]}</span>
      )}
      <span className="display font-semibold text-[15px] truncate">{f.name}</span>
      <span className="text-[13px] text-[var(--text-faint)]">{f.sexSymbol}</span>
      {f.rarities.length > 0 && <Chip tone="rare">rare</Chip>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * A plain-text description of the dog, written to be pasted straight into an
 * image generator or another assistant. The first paragraph is a ready-made
 * prompt; the rest is the full record; the genotype comes last for anyone who
 * wants it.
 */
export function dogDescription(dog: Dog, project: Project, includeGenotype: boolean): string {
  const f = describeDog(dog, project);
  const lines: string[] = [];

  const traitWords = BEHAVIOR_TRAITS.map(
    (t) =>
      `${TRAITS[t].label.toLowerCase()} ${Math.round(dog.observed[t])} (${describeScore(
        dog.observed[t],
      ).toLowerCase()})`,
  );

  lines.push('IMAGE PROMPT');
  lines.push(
    `A ${f.weightLbs.toFixed(0)} lb ${f.sexWord} dog of ${f.breed.toLowerCase()} appearance. ` +
      `${f.colour} coat colour, ${f.eyes} eyes, ${f.nose} nose. ${f.coat}. ${f.ears}, ${f.tail}. ${cap(f.build)}, ${f.muzzle}. ` +
      `${f.grown ? 'Adult' : 'Young'}, ${f.age} old. ` +
      'Standing in side profile, full body visible, natural daylight, realistic.',
  );
  lines.push('');
  lines.push(`FULL RECORD — ${f.name} ${f.sexSymbol}`);
  lines.push(`Project: ${project.name} (${project.standard.name} standard)`);
  lines.push(`Stage: ${f.stage}, ${f.age}`);
  lines.push(`Breed background: ${f.breed}`);
  lines.push(`Weight: ${f.weight}${f.grown ? '' : `, adult ${f.adultWeight}`} (${f.sizeBand.toLowerCase()})`);
  lines.push(`Colour: ${f.colour}`);
  lines.push(`Coat: ${f.coat}`);
  lines.push(`Ears: ${f.ears}. Tail: ${f.tail}`);
  lines.push(`Eyes: ${f.eyes}. Nose: ${f.nose}`);
  lines.push(`Build: ${f.build}. Face: ${f.muzzle}`);
  lines.push(
    `${project.standard.name} score: ${f.score}/100 (likely to produce ${f.producesScore}/100)${
      f.meetsStandard ? ' — meets the standard' : ''
    }`,
  );
  lines.push(`Temperament: ${traitWords.join(', ')}`);
  lines.push(
    `Constitution: soundness ${Math.round(dog.observed.structure)}, longevity ${Math.round(
      dog.observed.longevity,
    )}, fertility ${Math.round(dog.observed.fertility)}`,
  );
  if (f.carries.length) lines.push(`Carries (hidden, one copy): ${f.carries.join(', ')}`);
  if (f.healthAffected.length) lines.push(`Affected by: ${f.healthAffected.join(', ')}`);
  if (f.healthCarrier.length) lines.push(`Disease carrier: ${f.healthCarrier.join(', ')}`);
  if (f.titles.length) lines.push(`Titles: ${f.titles.join(', ')}`);
  if (dog.mutation) lines.push(`Born with a spontaneous mutation: ${dog.mutation}`);
  lines.push(`Inbreeding coefficient: ${(dog.coi * 100).toFixed(1)}%`);

  if (includeGenotype) {
    lines.push('');
    lines.push('GENOTYPE');
    for (const locus of LOCI) {
      const pair = dog.genotype[locus.key];
      if (!pair) continue;
      lines.push(`${locus.name} (${locus.gene}): ${genopairSymbol(locus.key, pair)}`);
    }
  }

  return lines.join('\n');
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Copy text to the clipboard, with a fallback for older iOS Safari. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the old-fashioned way
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
