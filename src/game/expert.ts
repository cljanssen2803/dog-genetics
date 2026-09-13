/**
 * ASK THE EXPERT
 *
 * What an experienced breeder would say after looking at your kennel for ten
 * minutes. Everything here is computed from the real population and the real
 * pairing simulations, so the advice is specific: it names dogs, it names
 * pairings, and it says which goal you are stuck on and why.
 *
 * The recurring situation this exists for: the score has stopped climbing and
 * the player cannot see why. There are only a handful of reasons that ever
 * happens, and each has a different fix.
 */

import { type Dog, ageMonths, breedingEligibility } from '../engine/dog';
import { scoreDog } from '../engine/standard';
import { TRAITS, type PolyTrait, sizeToPounds } from '../engine/traits';
import { LOCUS_BY_KEY } from '../engine/loci';
import { resolveCoat } from '../engine/phenotype';
import {
  type Project,
  activeDogs,
  breedingPopulation,
  kennelCount,
  kinshipFor,
  takeSnapshot,
} from './project';
import { type PairingPreview, previewPairing } from './matchmaking';
import { goalGaps, type GoalGap } from './analytics';

export interface Advice {
  /** What the section is about. */
  title: string;
  /** The verdict in one line. */
  headline: string;
  /** Plain-language reasoning and concrete actions. */
  lines: string[];
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  /** A dog or pairing the advice refers to, so the interface can link to it. */
  dogIds?: string[];
}

export interface ExpertReport {
  summary: string;
  sections: Advice[];
}

export function askExpert(project: Project): ExpertReport {
  const sections: Advice[] = [];
  const population = breedingPopulation(project);
  const adults = activeDogs(project).filter((d) => ageMonths(d, project.month) >= 12);
  const snapshot = takeSnapshot(project);
  const gaps = goalGaps(project);

  if (population.length === 0) {
    return {
      summary: 'You have no breeding-age dogs. Advance time until some mature, or bring in outside dogs.',
      sections: [],
    };
  }

  // -------------------------------------------------------------- momentum --
  const history = project.history;
  let stuck = false;
  if (history.length >= 2) {
    const last = history[history.length - 1];
    const prior = history[history.length - 2];
    if (last.averageScore - prior.averageScore < 1.5 && last.percentMeetingStandard <= prior.percentMeetingStandard + 3) {
      stuck = true;
    }
  }

  // ------------------------------------------------------ the biggest gap --
  if (gaps.length > 0) {
    const gap = gaps[0];
    const lines: string[] = [];
    lines.push(`Your population most needs ${gap.text}.`);

    const spread = variationFor(project, gap);
    if (spread !== null && spread.exhausted) {
      lines.push(
        `Here is the problem: your dogs barely differ from each other on ${gap.label.toLowerCase()} any more. ` +
          `You cannot select for a difference that does not exist. Breeding your best to your best will not move it — ` +
          `you need an outside dog that actually brings ${gap.direction === 'up' ? 'more' : 'less'} of it.`,
      );
      lines.push(`Go to Find an outside dog → By traits, and ask for ${gap.direction === 'up' ? 'more' : 'less'} ${gap.label.toLowerCase()}.`);
    } else if (spread !== null && spread.bestDog) {
      lines.push(
        `You still have variation to work with. ${spread.bestDog.name} is your strongest dog for this — ` +
          `${spread.bestDog.sex === 'M' ? 'his' : 'her'} ${gap.label.toLowerCase()} is ${spread.bestValue}. ` +
          `Build the next litter around ${spread.bestDog.sex === 'M' ? 'him' : 'her'} and keep the puppies that inherit it, even if they score lower overall.`,
      );
    }

    if (gaps.length > 1) {
      lines.push(`After that: ${gaps.slice(1, 3).map((g) => g.text).join('; ')}.`);
    }

    sections.push({
      title: 'Where you are stuck',
      headline: `${gap.label} is the goal you are furthest from`,
      lines,
      tone: 'warn',
      dogIds: spread?.bestDog ? [spread.bestDog.id] : undefined,
    });
  } else {
    sections.push({
      title: 'Where you are',
      headline: 'Every goal you care about is in range on average',
      lines: [
        `The population averages meet your standard. What is left is consistency: ${Math.round(
          snapshot.percentMeetingStandard,
        )}% of individual adults qualify. That number climbs by keeping only puppies that meet the standard and placing the rest, generation after generation.`,
      ],
      tone: 'good',
    });
  }

  // ------------------------------------------------------- best pairing --
  const best = bestPairingAvailable(project);
  if (best) {
    const lines: string[] = [];
    lines.push(
      `Of every pairing you could make right now, ${best.dam.name} × ${best.sire.name} simulates best: average puppy ${Math.round(
        best.meanScore,
      )}, ${best.standardLow}–${best.standardHigh}% meeting the standard, inbreeding ${(best.coi * 100).toFixed(1)}%.`,
    );
    if (best.improvements.length) {
      lines.push(`It should improve ${best.improvements.map((i) => i.label.toLowerCase()).join(', ')}.`);
    }
    if (best.weaknesses.length) {
      lines.push(`It would cost you ${best.weaknesses.map((w) => w.label.toLowerCase()).join(', ')}, so watch those in the puppies.`);
    }
    if (best.verdict === 'Risky pairing' || best.verdict === 'Do not breed') {
      lines.push(`But it is flagged "${best.verdict}" — ${best.verdictReason}`);
    }
    sections.push({
      title: 'Best move available',
      headline: `Breed ${best.dam.name} to ${best.sire.name}`,
      lines,
      tone: best.verdict === 'Do not breed' ? 'bad' : 'good',
      dogIds: [best.dam.id, best.sire.id],
    });
  } else {
    sections.push({
      title: 'Best move available',
      headline: 'Nothing can be bred right now',
      lines: ['No eligible male-and-female pair exists in the kennel. Advance time, or bring in an outside dog of the missing sex.'],
      tone: 'warn',
    });
  }

  // ------------------------------------------------------ hidden assets --
  const undervalued = adults
    .map((d) => ({
      dog: d,
      shows: scoreDog(d, project.standard).total,
      produces: scoreDog(d, project.standard, true).total,
    }))
    .filter((e) => e.produces - e.shows >= 8)
    .sort((a, b) => b.produces - b.shows - (a.produces - a.shows))[0];

  if (undervalued) {
    sections.push({
      title: 'A dog you may be underrating',
      headline: `${undervalued.dog.name} is worth more than ${undervalued.dog.sex === 'M' ? 'he' : 'she'} looks`,
      lines: [
        `${undervalued.dog.name} scores ${undervalued.shows} as an individual but ${undervalued.produces} for what ${
          undervalued.dog.sex === 'M' ? 'he' : 'she'
        } passes on. That gap means ${undervalued.dog.sex === 'M' ? 'he' : 'she'} carries genes for your standard that ${
          undervalued.dog.sex === 'M' ? 'he' : 'she'
        } does not show — usually a coat or colour gene that needs two copies. Do not place this dog.`,
      ],
      tone: 'neutral',
      dogIds: [undervalued.dog.id],
    });
  }

  // --------------------------------------------------------- dead weight --
  const capacity = project.kennelCapacity;
  const used = kennelCount(project);
  if (used >= capacity - 1) {
    const worst = adults
      .filter((d) => !d.breedingRetired)
      .map((d) => ({ dog: d, produces: scoreDog(d, project.standard, true).total }))
      .sort((a, b) => a.produces - b.produces)[0];
    if (worst) {
      sections.push({
        title: 'Making room',
        headline: `Your kennel is ${used === capacity ? 'full' : 'nearly full'}`,
        lines: [
          `${worst.dog.name} is your least useful breeding dog (likely to produce ${worst.produces}). If you need a space for a promising puppy, ${
            worst.dog.sex === 'M' ? 'he' : 'she'
          } is the one to place. A kennel with no room forces you to sell good puppies, and that is the slowest way to lose a breeding programme.`,
        ],
        tone: 'warn',
        dogIds: [worst.dog.id],
      });
    }
  }

  // ------------------------------------------------------------ diversity --
  const kinship = kinshipFor(project);
  let popKinship = 0;
  let pairs = 0;
  for (let i = 0; i < population.length; i++) {
    for (let j = i + 1; j < population.length; j++) {
      popKinship += kinship.between(population[i].id, population[j].id);
      pairs++;
    }
  }
  const averageKinship = pairs ? popKinship / pairs : 0;

  if (averageKinship > 0.1 || snapshot.familyLines <= 1) {
    sections.push({
      title: 'Genetic diversity',
      headline: 'Your gene pool is closing up',
      lines: [
        `The average pair of breeding dogs in your kennel is ${(averageKinship * 100).toFixed(0)}% related, and you have ${
          snapshot.familyLines
        } separate family line${snapshot.familyLines === 1 ? '' : 's'}. Every litter from here will be more inbred than the last, which costs fertility, litter size and lifespan — and it is where a stuck score often really comes from.`,
        'Bring in an outside dog now. It will drop your average score for a generation; that is the price, and it is worth paying. Pick the candidate whose best pairing improves your biggest gap.',
      ],
      tone: 'bad',
    });
  } else if (averageKinship > 0.05) {
    sections.push({
      title: 'Genetic diversity',
      headline: 'Getting closer than is comfortable',
      lines: [
        `Breeding dogs average ${(averageKinship * 100).toFixed(0)}% related. Not a crisis, but plan an outcross within the next generation or two rather than waiting until it is one.`,
      ],
      tone: 'warn',
    });
  } else {
    sections.push({
      title: 'Genetic diversity',
      headline: 'Healthy',
      lines: [`Breeding dogs average ${(averageKinship * 100).toFixed(0)}% related, with ${snapshot.familyLines} family lines. You can afford to breed tightly for a while.`],
      tone: 'good',
    });
  }

  // --------------------------------------------------------------- health --
  const carriers = Object.entries(snapshot.carrierFrequency)
    .filter(([k]) => LOCUS_BY_KEY[k]?.category === 'disease')
    .sort((a, b) => b[1] - a[1]);
  if (carriers.length && carriers[0][1] >= 0.35) {
    const [locus, freq] = carriers[0];
    const clear = population.filter((d) => {
      const pair = d.genotype[locus];
      return pair && pair[0] !== 'm' && pair[1] !== 'm';
    });
    sections.push({
      title: 'Health',
      headline: `${LOCUS_BY_KEY[locus].name} is spreading`,
      lines: [
        `${Math.round(freq * 100)}% of your breeding dogs carry it. Carriers are healthy — the rule is simply never carrier to carrier. ${
          clear.length
            ? `You have ${clear.length} confirmed-clear breeding dog${clear.length === 1 ? '' : 's'}: ${clear
                .slice(0, 3)
                .map((d) => d.name)
                .join(', ')}. Pair carriers only to those and keep the clear puppies.`
            : 'You have no clear breeding dogs left, so every pairing risks affected puppies. Find a clear outside dog before the next litter.'
        }`,
      ],
      tone: clear.length ? 'warn' : 'bad',
      dogIds: clear.slice(0, 3).map((d) => d.id),
    });
  }

  // ------------------------------------------------------------- summary --
  let summary: string;
  if (stuck && gaps.length > 0) {
    const spread = variationFor(project, gaps[0]);
    summary = spread?.exhausted
      ? `Your score has stalled because you have run out of variation on ${gaps[0].label.toLowerCase()}. Selection cannot create what is not there — this needs an outcross.`
      : `Your score has stalled. The fix is to stop breeding "best to best" on overall score and instead build litters specifically around ${gaps[0].label.toLowerCase()}, accepting a little ground lost elsewhere.`;
  } else if (gaps.length === 0) {
    summary = `The averages are there. Now it is a consistency game: ${Math.round(snapshot.percentMeetingStandard)}% of adults qualify, and that climbs only by ruthless keeping and placing.`;
  } else {
    summary = `Focus this generation on ${gaps[0].label.toLowerCase()}. Everything else can wait a litter.`;
  }

  return { summary, sections };
}

// ---------------------------------------------------------------------------

/**
 * Is there still anything to select for? If every breeding dog has nearly the
 * same genes for a trait, the answer is no, and no amount of careful pairing
 * will change it.
 */
function variationFor(
  project: Project,
  gap: GoalGap,
): { exhausted: boolean; bestDog: Dog | null; bestValue: string } | null {
  const population = breedingPopulation(project);
  if (population.length < 2) return null;

  if (gap.key === 'coatKind') {
    // Anyone carrying the right coat genes counts as variation.
    const kinds = project.standard.coatGoal?.kinds ?? [];
    const holder = population.find((d) => kinds.includes(resolveCoat(d.genotype, sizeToPounds(d.observed.size)).kind));
    return { exhausted: !holder, bestDog: holder ?? null, bestValue: holder ? 'the right coat' : '' };
  }

  const isTrait = (TRAITS as Record<string, unknown>)[gap.key] !== undefined;
  if (!isTrait) return null;
  const trait = gap.key as PolyTrait;
  const def = TRAITS[trait];

  const values = population.map((d) => d.bv[trait]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
  const geneticSd = def.sd * Math.sqrt(def.h2);

  // Less than a third of the natural spread left means selection has nothing to grip.
  const exhausted = sd < geneticSd * 0.32;

  const wantHigh = gap.direction === 'up';
  const sorted = population.slice().sort((a, b) => (wantHigh ? b.bv[trait] - a.bv[trait] : a.bv[trait] - b.bv[trait]));
  const bestDog = sorted[0] ?? null;
  const bestValue = bestDog
    ? def.logScale
      ? `${sizeToPounds(bestDog.observed[trait]).toFixed(0)} lb`
      : `${Math.round(bestDog.observed[trait])}`
    : '';

  return { exhausted, bestDog, bestValue };
}

/** The single best pairing across every eligible female and male. */
function bestPairingAvailable(project: Project): PairingPreview | null {
  const eligible = activeDogs(project).filter(
    (d) => breedingEligibility(d, project.month, project.lastLitter[d.id]).eligible,
  );
  const females = eligible.filter((d) => d.sex === 'F').slice(0, 6);
  const males = eligible.filter((d) => d.sex === 'M').slice(0, 6);

  let best: PairingPreview | null = null;
  for (const dam of females) {
    for (const sire of males) {
      const p = previewPairing(project, sire, dam);
      if (p.verdict === 'Do not breed') continue;
      if (!best || p.meanScore > best.meanScore) best = p;
    }
  }
  return best;
}
