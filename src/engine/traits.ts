/**
 * POLYGENIC TRAITS
 *
 * "Polygenic" means a trait controlled by hundreds of small genes rather than
 * one on/off switch. Size, temperament and longevity all work this way in real
 * dogs, which is why you cannot get a "calm gene" test.
 *
 * How we model them (plain language):
 *  - Every dog has a hidden BREEDING VALUE for each trait: the genetic hand it
 *    was dealt, and the only part it can pass on.
 *  - Every dog also has an OBSERVED value: its breeding value plus luck from
 *    upbringing, nutrition, injury, and so on.
 *  - A puppy's breeding value is the average of its parents, plus a random
 *    shuffle. That shuffle is why littermates differ.
 *  - Each dog also carries a SPREAD number: how much genetic variety it still
 *    has left to shuffle. Crossing two very different breeds creates puppies
 *    with an enormous spread, which is why first crosses look uniform but
 *    their children are wildly variable. Inbreeding shrinks the spread, which
 *    is how a population eventually "breeds true".
 *
 * Most trait values are shown on a friendly 1-100 scale where 50 is average.
 * Size is the exception: it is stored as the natural logarithm of body weight
 * in pounds, because that is what makes dog size behave correctly when you
 * cross a 5 lb dog with a 140 lb dog.
 */

export type BehaviorTrait =
  | 'sociability'
  | 'biddability'
  | 'energy'
  | 'stability'
  | 'preyDrive'
  | 'persistence'
  | 'independence'
  | 'alertness'
  | 'vocality'
  | 'handling';

export type HealthTrait = 'structure' | 'longevity' | 'fertility';

export type FormTrait = 'size' | 'substance' | 'muzzle' | 'earSet' | 'tailSet';

export type PolyTrait = BehaviorTrait | HealthTrait | FormTrait;

export interface TraitDef {
  key: PolyTrait;
  /** Plain-language name shown everywhere in normal mode. */
  label: string;
  /** What a very low score means. */
  low: string;
  /** What a very high score means. */
  high: string;
  /** Short sentence explaining the trait to a new player. */
  blurb: string;
  category: 'behavior' | 'health' | 'form';
  /**
   * Heritability: the share of the differences between dogs that is genetic
   * rather than environmental. 0.7 = strongly inherited, 0.15 = mostly luck.
   */
  h2: number;
  /** How spread out the trait is across all dogs (on the 1-100 scale). */
  sd: number;
  /**
   * Inbreeding depression: how many points this trait loses at 100% inbreeding.
   * Fitness traits (fertility, longevity, soundness) suffer; behaviour barely
   * does. This is the hidden cost of a shrinking gene pool.
   */
  depression: number;
  /** True when this trait is stored on the log-weight scale instead of 1-100. */
  logScale?: boolean;
}

export const TRAITS: Record<PolyTrait, TraitDef> = {
  // ---------------------------------------------------------------- form ---
  size: {
    key: 'size',
    label: 'Adult size',
    low: 'Tiny',
    high: 'Giant',
    blurb: 'Mature body weight. Strongly inherited and the fastest trait to shift.',
    category: 'form',
    h2: 0.72,
    sd: 0.13, // in log-pounds: roughly a 13% spread within a settled breed
    depression: 0,
    logScale: true,
  },
  substance: {
    key: 'substance',
    label: 'Build',
    low: 'Fine and racy',
    high: 'Heavy and thick',
    blurb: 'Bone thickness and overall heaviness for a given height.',
    category: 'form',
    h2: 0.5,
    sd: 12,
    depression: 0,
  },
  muzzle: {
    key: 'muzzle',
    label: 'Muzzle length',
    low: 'Very short faced',
    high: 'Long muzzle',
    blurb: 'Short faces bring breathing and dental problems; long muzzles avoid them.',
    category: 'form',
    h2: 0.6,
    sd: 12,
    depression: 0,
  },
  earSet: {
    key: 'earSet',
    label: 'Ear carriage',
    low: 'Fully dropped',
    high: 'Fully erect',
    blurb: 'Where the ear sits. Drop ears trap moisture; erect ears hear better.',
    category: 'form',
    h2: 0.55,
    sd: 12,
    depression: 0,
  },
  tailSet: {
    key: 'tailSet',
    label: 'Tail carriage',
    low: 'Low, whip-like',
    high: 'Curled over the back',
    blurb: 'How the tail is carried. A sighthound trails it low; a Spitz curls it tight over the back.',
    category: 'form',
    h2: 0.55,
    sd: 12,
    depression: 0,
  },

  // ------------------------------------------------------------ behaviour ---
  sociability: {
    key: 'sociability',
    label: 'Sociability',
    low: 'Reserved with strangers',
    high: 'Loves everybody',
    blurb: 'How warmly the dog greets unfamiliar people.',
    category: 'behavior',
    h2: 0.34,
    sd: 12,
    depression: 2,
  },
  biddability: {
    key: 'biddability',
    label: 'Biddability',
    low: 'Independent minded',
    high: 'Eager to cooperate',
    blurb: 'How much the dog wants to work with you. Drives trainability.',
    category: 'behavior',
    h2: 0.36,
    sd: 12,
    depression: 2,
  },
  energy: {
    key: 'energy',
    label: 'Energy',
    low: 'Very sedentary',
    high: 'Never stops',
    blurb: 'Daily exercise requirement and general activity level.',
    category: 'behavior',
    h2: 0.38,
    sd: 12,
    depression: 0,
  },
  stability: {
    key: 'stability',
    label: 'Emotional stability',
    low: 'Easily unsettled',
    high: 'Unshakeable',
    blurb: 'How well the dog recovers from noise, surprise and stress.',
    category: 'behavior',
    h2: 0.32,
    sd: 12,
    depression: 4,
  },
  preyDrive: {
    key: 'preyDrive',
    label: 'Prey drive',
    low: 'Ignores small animals',
    high: 'Powerful hunting urge',
    blurb: 'Motivation to chase and catch. Essential for vermin work.',
    category: 'behavior',
    h2: 0.42,
    sd: 12,
    depression: 0,
  },
  persistence: {
    key: 'persistence',
    label: 'Persistence',
    low: 'Gives up quickly',
    high: 'Will not quit',
    blurb: 'Staying power once the dog has committed to a task.',
    category: 'behavior',
    h2: 0.35,
    sd: 12,
    depression: 1,
  },
  independence: {
    key: 'independence',
    label: 'Independence',
    low: 'Velcro dog',
    high: 'Very self directed',
    blurb: 'How happily the dog operates away from its person.',
    category: 'behavior',
    h2: 0.33,
    sd: 12,
    depression: 0,
  },
  alertness: {
    key: 'alertness',
    label: 'Alertness',
    low: 'Oblivious',
    high: 'Notices everything',
    blurb: 'Watchfulness. Useful in a guardian, tiring in an apartment.',
    category: 'behavior',
    h2: 0.36,
    sd: 12,
    depression: 0,
  },
  vocality: {
    key: 'vocality',
    label: 'Vocality',
    low: 'Almost silent',
    high: 'Very barky',
    blurb: 'How readily the dog uses its voice.',
    category: 'behavior',
    h2: 0.4,
    sd: 12,
    depression: 0,
  },
  handling: {
    key: 'handling',
    label: 'Handling tolerance',
    low: 'Sensitive to touch',
    high: 'Tolerates anything',
    blurb: 'Patience with grooming, vet exams, children and restraint.',
    category: 'behavior',
    h2: 0.3,
    sd: 12,
    depression: 3,
  },

  // --------------------------------------------------------------- health ---
  structure: {
    key: 'structure',
    label: 'Structural soundness',
    low: 'Poor joints',
    high: 'Excellent joints',
    blurb: 'Hips, elbows and overall skeletal quality.',
    category: 'health',
    h2: 0.3,
    sd: 12,
    depression: 10,
  },
  longevity: {
    key: 'longevity',
    label: 'Longevity',
    low: 'Short lived',
    high: 'Very long lived',
    blurb: 'Genetic tendency toward a long healthy life.',
    category: 'health',
    h2: 0.26,
    sd: 12,
    depression: 12,
  },
  fertility: {
    key: 'fertility',
    label: 'Fertility',
    low: 'Difficult to breed',
    high: 'Highly fertile',
    blurb: 'Conception rate, litter size and ease of whelping.',
    category: 'health',
    h2: 0.16,
    sd: 12,
    depression: 14,
  },
};

export const ALL_TRAITS = Object.keys(TRAITS) as PolyTrait[];
export const BEHAVIOR_TRAITS = ALL_TRAITS.filter((t) => TRAITS[t].category === 'behavior');
export const HEALTH_TRAITS = ALL_TRAITS.filter((t) => TRAITS[t].category === 'health');
export const FORM_TRAITS = ALL_TRAITS.filter((t) => TRAITS[t].category === 'form');

/**
 * TRAIT CORRELATIONS
 *
 * Traits are not independent sliders. Selecting hard for one thing drags others
 * along with it, because the same underlying genes influence several traits.
 *
 * We model this with a handful of hidden "factors". Each puppy draws a random
 * value for every factor, and those values push on all the traits listed in
 * that factor at once. A positive loading means the trait rises with the
 * factor, a negative loading means it falls.
 *
 * Example: breed hard for prey drive and you will tend to pull alertness and
 * barking up with it, and emotional stability down — exactly the trade-off the
 * design document describes. You can breed back against it, but it costs you
 * generations.
 */
export interface CorrelationFactor {
  key: string;
  /** Plain-language description, shown in the goal-conflict warnings. */
  label: string;
  loadings: Partial<Record<PolyTrait, number>>;
}

/**
 * A note on strength. These loadings are deliberately milder than the real
 * genetic correlations in dogs. At full strength the trade-offs become walls:
 * a player who wants a quiet, driven terrier simply never gets one, however
 * carefully they breed. At this strength the pull is clearly visible in the
 * first few generations and can be broken by a determined player over five or
 * six — which is the interesting version.
 */
export const CORRELATION_FACTORS: CorrelationFactor[] = [
  {
    key: 'arousal',
    label: 'switched-on intensity',
    loadings: {
      energy: 0.3,
      preyDrive: 0.34,
      alertness: 0.34,
      vocality: 0.3,
      persistence: 0.22,
      independence: 0.12,
      stability: -0.22,
      handling: -0.12,
    },
  },
  {
    key: 'bulk',
    label: 'sheer body mass',
    loadings: {
      size: 0.26,
      substance: 0.34,
      longevity: -0.22,
      structure: -0.15,
      energy: -0.08,
    },
  },
  {
    key: 'affability',
    label: 'people focus',
    loadings: {
      sociability: 0.34,
      biddability: 0.3,
      handling: 0.3,
      stability: 0.19,
      independence: -0.3,
    },
  },
  {
    key: 'vigour',
    label: 'general hardiness',
    loadings: {
      longevity: 0.26,
      structure: 0.26,
      fertility: 0.26,
      stability: 0.12,
    },
  },
];

/**
 * For each trait, how much of its random shuffle is explained by the shared
 * factors versus its own private genes. Precomputed once at start-up.
 */
export const TRAIT_FACTOR_MAP: Record<PolyTrait, { factor: number; loading: number }[]> =
  (() => {
    const map = {} as Record<PolyTrait, { factor: number; loading: number }[]>;
    for (const trait of ALL_TRAITS) map[trait] = [];
    CORRELATION_FACTORS.forEach((f, index) => {
      for (const [trait, loading] of Object.entries(f.loadings)) {
        map[trait as PolyTrait].push({ factor: index, loading: loading as number });
      }
    });
    return map;
  })();

/** The share of variation left over once the shared factors have taken theirs. */
export const TRAIT_PRIVATE_SHARE: Record<PolyTrait, number> = (() => {
  const out = {} as Record<PolyTrait, number>;
  for (const trait of ALL_TRAITS) {
    const explained = TRAIT_FACTOR_MAP[trait].reduce((sum, f) => sum + f.loading * f.loading, 0);
    out[trait] = Math.sqrt(Math.max(0, 1 - explained));
  }
  return out;
})();

// ---------------------------------------------------------------------------
// Conversions and display helpers
// ---------------------------------------------------------------------------

/** Turn the internal log-weight number into actual pounds. */
export function sizeToPounds(logWeight: number): number {
  return Math.exp(logWeight);
}

/** Turn pounds into the internal log-weight number. */
export function poundsToSize(pounds: number): number {
  return Math.log(Math.max(1, pounds));
}

/** Keep a 1-100 trait inside sensible bounds. */
export function clampScore(value: number): number {
  return Math.max(1, Math.min(99, value));
}

/** Words for a 1-100 score, so players never have to read raw numbers. */
export function describeScore(value: number): string {
  if (value >= 88) return 'Very high';
  if (value >= 72) return 'High';
  if (value >= 58) return 'Above average';
  if (value >= 43) return 'Average';
  if (value >= 29) return 'Below average';
  if (value >= 13) return 'Low';
  return 'Very low';
}

/** A 0-5 star rating, used for young puppies where precision would be a lie. */
export function scoreToStars(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value / 20 + 0.25)));
}

/**
 * Composite shown on dog cards as "Calm". Real calmness indoors is a blend of
 * low energy and high emotional stability, not a gene of its own.
 */
export function calmnessFrom(energy: number, stability: number, vocality: number): number {
  return clampScore(Math.round((100 - energy) * 0.45 + stability * 0.4 + (100 - vocality) * 0.15));
}
