/**
 * THE LAB
 *
 * A design studio. The player ticks the features they want in a dog — size,
 * coat, colour, ears, tail, temperament — and the Lab does three things:
 *
 *   1. Draws the dog: builds a genotype and trait set that shows every
 *      feature, so the sprite renderer can paint it.
 *   2. Finds the breeds: scores every breed in the founder bank on how likely
 *      one of its dogs is to bring each feature, and suggests the best single
 *      breed and the best pair of breeds (one bringing what the other lacks).
 *   3. Explains the genetics: which gene, dominant or recessive, and what it
 *      takes to get it into a litter.
 *
 * The odds are honest but simple: for a single gene they come straight from
 * the breed's allele frequencies (Hardy–Weinberg, if you want the name); for
 * a polygenic trait, from how far the breed's average sits from the wish.
 */

import { type BreedProfile, BREEDS, DEFAULT_ALLELES } from '../engine/breeds';
import type { Genotype } from '../engine/loci';
import { QUIRKS } from '../engine/quirks';
import { type EarType, type TailType } from '../engine/phenotype';
import { type PolyTrait, poundsToSize } from '../engine/traits';
import { type BreedStandard, type Goal, type Priority, blankStandard } from '../engine/standard';

export type LabGroup = 'size' | 'coat' | 'colour' | 'markings' | 'build' | 'ears' | 'tail' | 'temperament';

export const LAB_GROUP_LABEL: Record<LabGroup, string> = {
  size: 'Size',
  coat: 'Coat',
  colour: 'Colour',
  markings: 'Markings and extras',
  build: 'Build and head',
  ears: 'Ears',
  tail: 'Tail',
  temperament: 'Temperament',
};

/** What the design dog looks like before any feature is applied. */
export interface Draft {
  genotype: Genotype;
  traits: Record<PolyTrait, number>;
}

export interface LabFeature {
  key: string;
  group: LabGroup;
  label: string;
  /** Plain-language genetics, shown when the feature is picked. */
  gene: string;
  /** What a breeder has to do to get it. */
  recipe: string;
  /** Only one of these can be picked at once (same group, usually). */
  exclusive?: string;
  /** Features that cannot be true at the same time, with the reason. */
  conflicts?: { key: string; why: string }[];
  /** Features this one cannot exist without; picked automatically. */
  requires?: string[];
  /** Chance that a founder from this breed shows the feature (0-1). */
  odds: (breed: BreedProfile) => number;
  /** Chance a founder at least carries it, when that differs from showing it. */
  carrierOdds?: (breed: BreedProfile) => number;
  apply: (draft: Draft) => void;
  goal: (standard: BreedStandard) => void;
}

// ---------------------------------------------------------------------------
// Little helpers for the odds
// ---------------------------------------------------------------------------

function freq(breed: BreedProfile, locus: string, allele: string): number {
  const table = breed.alleles?.[locus] ?? DEFAULT_ALLELES[locus] ?? {};
  return table[allele] ?? 0;
}

/** Two copies. */
const homo = (b: BreedProfile, locus: string, allele: string) => freq(b, locus, allele) ** 2;
/** At least one copy. */
const atLeastOne = (b: BreedProfile, locus: string, allele: string) => 1 - (1 - freq(b, locus, allele)) ** 2;
/** Exactly one copy: a hidden carrier of a recessive. */
const carrier = (b: BreedProfile, locus: string, allele: string) => {
  const p = freq(b, locus, allele);
  return 2 * p * (1 - p);
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** How close a breed's average sits to a wished-for range on the 1-100 scale. */
function nearRange(value: number, low: number, high: number, softness = 18): number {
  if (value >= low && value <= high) return 1;
  const miss = value < low ? low - value : value - high;
  return clamp01(1 - miss / softness);
}

function trait(breed: BreedProfile, key: Exclude<PolyTrait, 'size'>): number {
  return breed.traits[key] ?? 50;
}

/** Eumelanin (black-family pigment) actually shows on the coat. */
function showsDarkPigment(b: BreedProfile): number {
  const notRed = 1 - homo(b, 'locusE', 'e');
  const dominantBlack = atLeastOne(b, 'locusK', 'KB');
  const aa = homo(b, 'locusA', 'a');
  return notRed * clamp01(dominantBlack + (1 - dominantBlack) * aa);
}

const g = (priority: Priority, low: number, high: number, aLow: number, aHigh: number): Goal => ({
  mode: 'range',
  priority,
  preferredLow: low,
  preferredHigh: high,
  acceptableLow: aLow,
  acceptableHigh: aHigh,
});

function setPair(draft: Draft, locus: string, a: string, b = a) {
  draft.genotype[locus] = [a, b];
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

const SIZE_BANDS: { key: string; label: string; low: number; high: number; lbs: number }[] = [
  { key: 'sizeXS', label: 'Extra small (under 12 lb)', low: 4, high: 12, lbs: 8 },
  { key: 'sizeS', label: 'Small (12–25 lb)', low: 12, high: 25, lbs: 18 },
  { key: 'sizeM', label: 'Medium (25–55 lb)', low: 25, high: 55, lbs: 40 },
  { key: 'sizeL', label: 'Large (55–95 lb)', low: 55, high: 95, lbs: 72 },
  { key: 'sizeXL', label: 'Extra large (95 lb and up)', low: 95, high: 180, lbs: 120 },
];

const sizeFeatures: LabFeature[] = SIZE_BANDS.map((band) => ({
  key: band.key,
  group: 'size',
  label: band.label,
  exclusive: 'size',
  gene:
    'Size is polygenic — dozens of genes, each nudging a little. The biggest single ones are IGF1 (small), GHR and HMGA2, but no one gene decides it.',
  recipe:
    'Start from breeds already near the size you want. Crossing a big breed with a small one gives puppies in the middle, and the spread narrows over three or four generations of picking the right ones.',
  odds: (b) => {
    const w = b.weight;
    if (w >= band.low && w <= band.high) return 1;
    // On a log scale, because 8 lb vs 16 lb is a bigger gap than 100 vs 108.
    const miss = w < band.low ? Math.log(band.low / w) : Math.log(w / band.high);
    return clamp01(1 - miss / 0.6);
  },
  apply: (d) => {
    d.traits.size = poundsToSize(band.lbs);
  },
  goal: (s) => {
    s.traitGoals.size = g(4, band.low, band.high, Math.round(band.low * 0.8), Math.round(band.high * 1.2));
  },
}));

const coatFeatures: LabFeature[] = [
  {
    key: 'coatSmooth',
    group: 'coat',
    label: 'Smooth short coat',
    exclusive: 'coat',
    conflicts: [{ key: 'tail_plume', why: 'a plume needs long hair' }],
    gene: 'Short coat is the dominant version of FGF5 (L). One copy is enough, so a short-coated dog can secretly carry the long-coat gene.',
    recipe: 'Easy: most breeds carry it. Watch for hidden long-coat carriers — two of them together give you a fluffy surprise.',
    odds: (b) => atLeastOne(b, 'coatLength', 'L') * homo(b, 'furnishings', 'f') * homo(b, 'curl', 'cu'),
    apply: (d) => {
      setPair(d, 'coatLength', 'L');
      setPair(d, 'furnishings', 'f');
      setPair(d, 'curl', 'cu');
    },
    goal: (s) => {
      s.coatGoal = { kinds: ['smooth', 'short'], priority: 3 };
    },
  },
  {
    key: 'coatSilky',
    group: 'coat',
    label: 'Long silky coat',
    exclusive: 'coat',
    gene: 'Long coat is recessive FGF5 (l). A dog needs two copies. No beard gene (RSPO2) and no curl (KRT71), or it turns into something else.',
    recipe: 'Both parents must carry long coat. Two long-coated parents give 100% long-coated puppies; two carriers give one in four.',
    odds: (b) => homo(b, 'coatLength', 'l') * homo(b, 'furnishings', 'f') * homo(b, 'curl', 'cu'),
    carrierOdds: (b) => carrier(b, 'coatLength', 'l'),
    apply: (d) => {
      setPair(d, 'coatLength', 'l');
      setPair(d, 'furnishings', 'f');
      setPair(d, 'curl', 'cu');
    },
    goal: (s) => {
      s.coatGoal = { kinds: ['silky', 'doubleThick'], priority: 3 };
    },
  },
  {
    key: 'coatFurnished',
    group: 'coat',
    label: 'Long coat with beard and eyebrows',
    exclusive: 'coat',
    gene: 'Two long-coat copies (FGF5) plus at least one copy of the furnishings gene RSPO2 (F), which is dominant and gives the beard, moustache and eyebrows.',
    recipe: 'Bring furnishings in from a terrier, Schnauzer or doodle — one parent is enough. Long coat needs both parents to carry it.',
    odds: (b) => homo(b, 'coatLength', 'l') * atLeastOne(b, 'furnishings', 'F') * homo(b, 'curl', 'cu'),
    apply: (d) => {
      setPair(d, 'coatLength', 'l');
      setPair(d, 'furnishings', 'F');
      setPair(d, 'curl', 'cu');
    },
    goal: (s) => {
      s.coatGoal = { kinds: ['long'], priority: 3 };
    },
  },
  {
    key: 'coatWire',
    group: 'coat',
    label: 'Wiry coat with a beard',
    exclusive: 'coat',
    conflicts: [{ key: 'tail_plume', why: 'a plume needs long hair' }],
    gene: 'Short coat (FGF5 L) plus the dominant furnishings gene (RSPO2 F). The combination is what reads as "wiry".',
    recipe: 'One furnished parent is enough for the beard; keep the coat short by avoiding two long-coat copies.',
    odds: (b) => atLeastOne(b, 'coatLength', 'L') * atLeastOne(b, 'furnishings', 'F') * homo(b, 'curl', 'cu'),
    apply: (d) => {
      setPair(d, 'coatLength', 'L');
      setPair(d, 'furnishings', 'F');
      setPair(d, 'curl', 'cu');
    },
    goal: (s) => {
      s.coatGoal = { kinds: ['wire'], priority: 3 };
    },
  },
  {
    key: 'coatCurly',
    group: 'coat',
    label: 'Tight curly coat',
    exclusive: 'coat',
    conflicts: [{ key: 'doubleCoat', why: 'a curly coat has no separate undercoat' }],
    gene: 'KRT71 (Cu) is incompletely dominant: one copy gives a wave, two give a full curl. It only curls properly on a long coat (two FGF5 l copies).',
    recipe: 'A Poodle brings both genes at once. Cross to anything else and the first generation is wavy, not curly — the curl comes back when you breed those together.',
    odds: (b) => homo(b, 'curl', 'Cu') * homo(b, 'coatLength', 'l'),
    carrierOdds: (b) => atLeastOne(b, 'curl', 'Cu'),
    apply: (d) => {
      setPair(d, 'coatLength', 'l');
      setPair(d, 'curl', 'Cu');
      setPair(d, 'furnishings', 'F');
    },
    goal: (s) => {
      s.coatGoal = { kinds: ['curly'], priority: 3 };
    },
  },
  {
    key: 'coatWavy',
    group: 'coat',
    label: 'Wavy doodle coat',
    exclusive: 'coat',
    conflicts: [{ key: 'doubleCoat', why: 'a curly coat has no separate undercoat' }],
    gene: 'One copy of curl (KRT71 Cu) plus furnishings (RSPO2 F): the classic doodle look. Two curl copies tip it into full curls.',
    recipe: 'Poodle × almost anything gets you here in one generation. Keeping it wavy rather than curly or flat is the hard part.',
    odds: (b) => carrier(b, 'curl', 'Cu') * atLeastOne(b, 'furnishings', 'F'),
    carrierOdds: (b) => atLeastOne(b, 'curl', 'Cu'),
    apply: (d) => {
      setPair(d, 'coatLength', 'l');
      setPair(d, 'curl', 'Cu', 'cu');
      setPair(d, 'furnishings', 'F');
    },
    goal: (s) => {
      s.coatGoal = { kinds: ['wavyFurnished'], priority: 3 };
    },
  },
  {
    key: 'coatCorded',
    group: 'coat',
    label: 'Corded (mop) coat',
    exclusive: 'coat',
    gene: 'Two curl copies (KRT71) on a long coat, plus the undercoat gene: the curls felt into cords. A gameplay reading — real cords are not mapped to one gene.',
    recipe: 'Komondor and Puli have it. Or build it: a Poodle for the curls and a plush-coated breed for the undercoat, then select for both.',
    conflicts: [{ key: 'lowShed', why: 'cords do not shed, but the low-shed gene has nothing to add' }],
    odds: (b) => homo(b, 'curl', 'Cu') * homo(b, 'coatLength', 'l') * atLeastOne(b, 'undercoat', 'U'),
    carrierOdds: (b) => atLeastOne(b, 'curl', 'Cu') * atLeastOne(b, 'undercoat', 'U'),
    apply: (d) => {
      setPair(d, 'coatLength', 'l');
      setPair(d, 'curl', 'Cu');
      setPair(d, 'undercoat', 'U');
      setPair(d, 'furnishings', 'f');
    },
    goal: (s) => {
      s.coatGoal = { kinds: ['corded'], priority: 4 };
    },
  },
  {
    key: 'coatHairless',
    group: 'coat',
    label: 'Hairless',
    exclusive: 'coat',
    conflicts: [
      { key: 'lowShed', why: 'a hairless dog has nothing to shed' },
      { key: 'doubleCoat', why: 'a hairless dog has no undercoat' },
      { key: 'tail_plume', why: 'a plume needs long hair' },
    ],
    gene: 'Two different genes do it. FOXI3 (Hd) is dominant but fatal with two copies, so hairless dogs of that type always carry one "coated" gene. SGK3 (hr) is recessive and completely bald.',
    recipe: 'Chinese Crested or Xolo for the dominant type — every litter has some coated puppies, and that is unavoidable. American Hairless for the recessive type.',
    odds: (b) => clamp01(2 * freq(b, 'hairlessDom', 'Hd') * (1 - freq(b, 'hairlessDom', 'Hd')) + homo(b, 'hairlessRec', 'hr')),
    apply: (d) => {
      setPair(d, 'hairlessDom', 'Hd', 'hd');
    },
    goal: (s) => {
      s.coatGoal = { kinds: ['hairless'], priority: 4 };
    },
  },
  {
    key: 'lowShed',
    group: 'coat',
    label: 'Low shedding',
    conflicts: [{ key: 'doubleCoat', why: 'the undercoat is what sheds' }, { key: 'coatHairless', why: 'a hairless dog has nothing to shed' }],
    gene: 'MC5R (sh) is recessive and helps, but the coat structure matters more: curls and furnishings trap hair, a plush double coat blows it everywhere.',
    recipe: 'Two copies of the low-shed gene on a curly or furnished coat. Poodles, Bichons and Schnauzers carry it nearly fixed.',
    odds: (b) => homo(b, 'shedding', 'sh'),
    carrierOdds: (b) => carrier(b, 'shedding', 'sh'),
    apply: (d) => {
      setPair(d, 'shedding', 'sh');
    },
    goal: (s) => {
      s.derivedGoals.shedding = g(3, 0, 25, 0, 40);
    },
  },
  {
    key: 'doubleCoat',
    group: 'coat',
    label: 'Thick winter undercoat',
    conflicts: [
      { key: 'lowShed', why: 'the undercoat is what sheds' },
      { key: 'coatCurly', why: 'a curly coat has no separate undercoat' },
      { key: 'coatWavy', why: 'a curly coat has no separate undercoat' },
      { key: 'coatHairless', why: 'a hairless dog has no undercoat' },
    ],
    gene: 'The undercoat gene (U) is dominant: one copy gives a plush, woolly underlayer that sheds water and cold — and sheds itself, twice a year, in clumps.',
    recipe: 'One parent with the undercoat is enough. Northern breeds, shepherds and retrievers all carry it fixed.',
    odds: (b) => atLeastOne(b, 'undercoat', 'U'),
    apply: (d) => {
      setPair(d, 'undercoat', 'U');
    },
    goal: (s) => {
      s.derivedGoals.coldTolerance = { mode: 'higher', priority: 3 };
    },
  },
];

const colourFeatures: LabFeature[] = [
  {
    key: 'colBlack',
    group: 'colour',
    label: 'Black',
    exclusive: 'colour',
    gene: 'Dominant black (CBD103 KB) over a working extension gene (MC1R E). One copy of KB paints the whole coat black, hiding whatever the A locus wanted to do.',
    recipe: 'One black parent usually gives black puppies. The catch is what black hides — a black dog can carry red, chocolate, dilute and tan points all at once.',
    odds: (b) => showsDarkPigment(b) * atLeastOne(b, 'locusB', 'B') * atLeastOne(b, 'locusD', 'D'),
    apply: (d) => {
      setPair(d, 'locusK', 'KB');
      setPair(d, 'locusE', 'E');
      setPair(d, 'locusB', 'B');
      setPair(d, 'locusD', 'D');
    },
    goal: (s) => {
      s.colorGoal = { text: 'black', priority: 2 };
    },
  },
  {
    key: 'colChocolate',
    group: 'colour',
    label: 'Chocolate',
    exclusive: 'colour',
    gene: 'TYRP1 (b) is recessive: two copies turn every bit of black pigment brown, nose and eye rims included. Chocolate dogs have amber eyes.',
    recipe: 'Both parents must carry brown. Labradors, Poodles and spaniels carry it often; a black dog from those lines may be hiding it.',
    odds: (b) => showsDarkPigment(b) * homo(b, 'locusB', 'b') * atLeastOne(b, 'locusD', 'D'),
    carrierOdds: (b) => carrier(b, 'locusB', 'b'),
    apply: (d) => {
      setPair(d, 'locusK', 'KB');
      setPair(d, 'locusE', 'E');
      setPair(d, 'locusB', 'b');
      setPair(d, 'locusD', 'D');
    },
    goal: (s) => {
      s.colorGoal = { text: 'chocolate', priority: 2 };
    },
  },
  {
    key: 'colBlue',
    group: 'colour',
    label: 'Blue (dilute black)',
    exclusive: 'colour',
    gene: 'MLPH (d) is recessive: two copies dilute black to a slate blue-grey, with a grey nose. Some blue dogs get a thin, patchy coat (colour dilution alopecia).',
    recipe: 'Both parents must carry dilute. Weimaraners are fixed for it; Great Danes, Dobermans and Frenchies carry it.',
    odds: (b) => showsDarkPigment(b) * homo(b, 'locusD', 'd') * atLeastOne(b, 'locusB', 'B'),
    carrierOdds: (b) => carrier(b, 'locusD', 'd'),
    apply: (d) => {
      setPair(d, 'locusK', 'KB');
      setPair(d, 'locusE', 'E');
      setPair(d, 'locusB', 'B');
      setPair(d, 'locusD', 'd');
    },
    goal: (s) => {
      s.colorGoal = { text: 'blue', priority: 2 };
    },
  },
  {
    key: 'colLilac',
    group: 'colour',
    label: 'Lilac (chocolate + dilute)',
    exclusive: 'colour',
    gene: 'Two recessives stacked: two copies of brown (TYRP1 b) AND two copies of dilute (MLPH d). Brown pigment washed to a pale silvery-lilac, with pale amber eyes.',
    recipe: 'The rarest ordinary colour. Both parents need to carry both genes; only one puppy in sixteen from double carriers gets it. Hunt for hidden carriers.',
    odds: (b) => showsDarkPigment(b) * homo(b, 'locusB', 'b') * homo(b, 'locusD', 'd'),
    carrierOdds: (b) => atLeastOne(b, 'locusB', 'b') * atLeastOne(b, 'locusD', 'd'),
    apply: (d) => {
      setPair(d, 'locusK', 'KB');
      setPair(d, 'locusE', 'E');
      setPair(d, 'locusB', 'b');
      setPair(d, 'locusD', 'd');
    },
    goal: (s) => {
      s.colorGoal = { text: 'lilac', priority: 2 };
    },
  },
  {
    key: 'colRed',
    group: 'colour',
    label: 'Red or golden',
    exclusive: 'colour',
    conflicts: [{ key: 'merle', why: 'merle only shows on dark pigment, so on a red dog it hides' }, { key: 'harlequin', why: 'harlequin needs dark pigment to tear up' }],
    gene: 'Two ways there. Recessive red (MC1R e/e) switches black pigment off entirely — Golden Retrievers, Irish Setters. Or fawn sable (ASIP ay) with no dominant black in the way.',
    recipe: 'Two recessive-red parents give 100% red. The shade, from cream to deep red, is set by the intensity gene and by polygenic tweaks.',
    odds: (b) => clamp01(homo(b, 'locusE', 'e') + (1 - homo(b, 'locusE', 'e')) * (1 - atLeastOne(b, 'locusK', 'KB')) * atLeastOne(b, 'locusA', 'ay')),
    apply: (d) => {
      setPair(d, 'locusE', 'e');
      setPair(d, 'locusK', 'ky');
      setPair(d, 'intensity', 'I');
    },
    goal: (s) => {
      s.colorGoal = { text: 'red', priority: 2 };
    },
  },
  {
    key: 'colDudley',
    group: 'colour',
    label: 'Yellow with a Dudley nose',
    exclusive: 'colour',
    gene: 'Recessive red (MC1R e/e) over chocolate pigment (TYRP1 b/b). The coat is yellow or red but the nose, eye rims and pads are liver-pink and the eyes amber. Two recessives at once.',
    recipe: 'Both parents must carry both genes. A yellow dog and a chocolate dog together are the classic route; one puppy in sixteen from double carriers.',
    odds: (b) => homo(b, 'locusE', 'e') * homo(b, 'locusB', 'b'),
    carrierOdds: (b) => atLeastOne(b, 'locusE', 'e') * atLeastOne(b, 'locusB', 'b'),
    conflicts: [{ key: 'merle', why: 'merle only shows on dark pigment' }],
    apply: (d) => {
      setPair(d, 'locusE', 'e');
      setPair(d, 'locusB', 'b');
      setPair(d, 'locusK', 'ky');
      setPair(d, 'intensity', 'I');
    },
    goal: (s) => {
      s.colorGoal = { text: 'dudley', priority: 3 };
    },
  },
  {
    key: 'colCream',
    group: 'colour',
    label: 'Cream or white',
    exclusive: 'colour',
    conflicts: [
      { key: 'merle', why: 'merle only shows on dark pigment, so on a cream dog it hides' },
      { key: 'harlequin', why: 'harlequin needs dark pigment to tear up' },
      { key: 'white', why: 'white markings on a white dog are invisible' },
      { key: 'ticking', why: 'ticking needs a colour to fleck with' },
    ],
    gene: 'Recessive red (MC1R e/e) plus two copies of the intensity gene (i) that fades red pigment almost to white. Samoyeds and Westies are white this way — the nose stays black.',
    recipe: 'Both genes are recessive, so both parents must carry both. Two cream parents breed true.',
    odds: (b) => homo(b, 'locusE', 'e') * homo(b, 'intensity', 'i'),
    carrierOdds: (b) => atLeastOne(b, 'locusE', 'e') * atLeastOne(b, 'intensity', 'i'),
    apply: (d) => {
      setPair(d, 'locusE', 'e');
      setPair(d, 'locusK', 'ky');
      setPair(d, 'intensity', 'i');
    },
    goal: (s) => {
      s.colorGoal = { text: 'cream', priority: 2 };
    },
  },
  {
    key: 'colBrindle',
    group: 'colour',
    label: 'Brindle stripes',
    exclusive: 'colour',
    gene: 'The brindle version of the K locus (kbr). Dominant over plain (ky) but hidden under dominant black (KB). Stripes only show where the coat would otherwise be fawn.',
    recipe: 'One brindle parent gives brindle to about half the litter, as long as the other parent is not dominant black. Boxers, Greyhounds and bull breeds carry it.',
    odds: (b) => (1 - atLeastOne(b, 'locusK', 'KB')) * atLeastOne(b, 'locusK', 'kbr') * (1 - homo(b, 'locusE', 'e')),
    apply: (d) => {
      setPair(d, 'locusK', 'kbr');
      setPair(d, 'locusE', 'E');
      setPair(d, 'locusA', 'ay');
    },
    goal: (s) => {
      s.colorGoal = { text: 'brindle', priority: 2 };
    },
  },
  {
    key: 'colTan',
    group: 'colour',
    label: 'Black and tan points',
    exclusive: 'colour',
    gene: 'The tan-point version of ASIP (at), recessive to fawn but dominant over solid (a). Needs no dominant black (KB) on top or the points are hidden.',
    recipe: 'Rottweilers, Dobermans and Dachshunds are fixed for it. Cross to a black breed and the black hides it for a generation.',
    odds: (b) =>
      (1 - atLeastOne(b, 'locusK', 'KB')) *
      (1 - homo(b, 'locusE', 'e')) *
      clamp01(homo(b, 'locusA', 'at') + 2 * freq(b, 'locusA', 'at') * freq(b, 'locusA', 'a')),
    carrierOdds: (b) => atLeastOne(b, 'locusA', 'at'),
    apply: (d) => {
      setPair(d, 'locusK', 'ky');
      setPair(d, 'locusE', 'E');
      setPair(d, 'locusA', 'at');
    },
    goal: (s) => {
      s.colorGoal = { text: 'tan points', priority: 2 };
    },
  },
  {
    key: 'colFawn',
    group: 'colour',
    label: 'Fawn or sable',
    exclusive: 'colour',
    gene: 'The sable version of ASIP (ay) is the top of the A series: fawn hair with dark tips. It shows only when nothing sits on top of it — no dominant black, and normal pigment (E) rather than recessive red.',
    recipe: 'The commonest colour in dogs. Pugs, Boxers, Great Danes and most Spitz types are fawn or sable; cross away from dominant-black breeds and it appears in a generation.',
    odds: (b) => (1 - atLeastOne(b, 'locusK', 'KB')) * (1 - homo(b, 'locusE', 'e')) * atLeastOne(b, 'locusA', 'ay'),
    carrierOdds: (b) => atLeastOne(b, 'locusA', 'ay'),
    apply: (d) => {
      setPair(d, 'locusK', 'ky');
      setPair(d, 'locusE', 'E');
      setPair(d, 'locusA', 'ay');
      setPair(d, 'locusD', 'D');
    },
    goal: (s) => {
      s.colorGoal = { text: 'fawn sable', priority: 2 };
    },
  },
  {
    key: 'colBlueFawn',
    group: 'colour',
    label: 'Blue fawn (dilute sable)',
    exclusive: 'colour',
    gene: 'Sable (ay) with two copies of dilute (d): the dark tipping goes slate and the nose goes grey, over a silvery fawn.',
    recipe: 'Both parents must carry dilute, and neither may be dominant black. Weimaraner and Great Dane lines carry dilute; Whippets and Greyhounds show blue fawn often.',
    odds: (b) => (1 - atLeastOne(b, 'locusK', 'KB')) * (1 - homo(b, 'locusE', 'e')) * atLeastOne(b, 'locusA', 'ay') * homo(b, 'locusD', 'd'),
    carrierOdds: (b) => carrier(b, 'locusD', 'd'),
    apply: (d) => {
      setPair(d, 'locusK', 'ky');
      setPair(d, 'locusE', 'E');
      setPair(d, 'locusA', 'ay');
      setPair(d, 'locusD', 'd');
    },
    goal: (s) => {
      s.colorGoal = { text: 'blue fawn', priority: 2 };
    },
  },
  {
    key: 'colWolfSable',
    group: 'colour',
    label: 'Wolf sable',
    exclusive: 'colour',
    gene: 'The wild-type ASIP (aw): each hair banded light and dark, giving the grey-brown of a wolf or a Keeshond, with pale undersides.',
    recipe: 'Keeshonds, Elkhounds and German Shepherd lines carry it. It sits below fawn in the A series, so both parents need to pass it on, and no dominant black on top.',
    odds: (b) => (1 - atLeastOne(b, 'locusK', 'KB')) * (1 - homo(b, 'locusE', 'e')) * clamp01(homo(b, 'locusA', 'aw') + 2 * freq(b, 'locusA', 'aw') * (freq(b, 'locusA', 'at') + freq(b, 'locusA', 'a'))),
    carrierOdds: (b) => atLeastOne(b, 'locusA', 'aw'),
    apply: (d) => {
      setPair(d, 'locusK', 'ky');
      setPair(d, 'locusE', 'E');
      setPair(d, 'locusA', 'aw');
    },
    goal: (s) => {
      s.colorGoal = { text: 'wolf sable', priority: 2 };
    },
  },
  {
    key: 'colCocoa',
    group: 'colour',
    label: 'Cocoa (French Bulldog brown)',
    exclusive: 'colour',
    gene: 'HPS3 (co) is a second, separate brown gene: two copies turn black pigment a deep cocoa even in a dog that is B/B at the ordinary brown locus.',
    recipe: 'Almost only in French Bulldog lines. Both parents must carry it; hunt for a carrier.',
    odds: (b) => showsDarkPigment(b) * homo(b, 'cocoa', 'co'),
    carrierOdds: (b) => carrier(b, 'cocoa', 'co'),
    apply: (d) => {
      setPair(d, 'locusK', 'KB');
      setPair(d, 'locusE', 'E');
      setPair(d, 'cocoa', 'co');
    },
    goal: (s) => {
      s.colorGoal = { text: 'cocoa', priority: 2 };
    },
  },
];

const markingFeatures: LabFeature[] = [
  {
    key: 'mask',
    group: 'markings',
    label: 'Dark mask',
    conflicts: [{ key: 'colRed', why: 'a mask needs dark pigment to show; recessive red switches it off' }, { key: 'colCream', why: 'a mask needs dark pigment to show' }, { key: 'colBlack', why: 'a mask on a black dog is invisible' }],
    gene: 'The melanistic-mask version of MC1R (Em) is dominant and sits at the top of the E series: one copy puts dark pigment over the muzzle and around the eyes, on any fawn, sable or brindle dog.',
    recipe: 'One masked parent gives a mask to about half the litter. Pugs, Boxers, Mastiffs, Great Danes and Belgian Shepherds are fixed for it.',
    odds: (b) => atLeastOne(b, 'locusE', 'Em') * (1 - atLeastOne(b, 'locusK', 'KB')),
    carrierOdds: (b) => atLeastOne(b, 'locusE', 'Em'),
    apply: (d) => {
      setPair(d, 'locusE', 'Em', 'E');
      if (d.genotype.locusK[0] === 'KB') setPair(d, 'locusK', 'ky');
      if (d.genotype.locusA[0] === 'a') setPair(d, 'locusA', 'ay');
    },
    goal: (s) => {
      s.colorGoal = { text: `${s.colorGoal?.text ? s.colorGoal.text + ' with a ' : ''}mask`, priority: 2 };
    },
  },
  {
    key: 'merle',
    group: 'markings',
    label: 'Merle',
    conflicts: [{ key: 'colRed', why: 'merle only shows on dark pigment' }, { key: 'colCream', why: 'merle only shows on dark pigment' }],
    gene: 'PMEL (M) is dominant — one copy tears the dark pigment into patches over a diluted base. Two copies (double merle) cause deafness and eye defects.',
    recipe: 'Breed merle to non-merle, always. Half the puppies come out merle. Never merle to merle.',
    odds: (b) => atLeastOne(b, 'merle', 'M'),
    apply: (d) => {
      setPair(d, 'merle', 'M', 'm');
      // Merle needs dark pigment to work on. If no colour was chosen, the
      // blank fawn dog becomes black so the merle shows as blue merle.
      if (d.genotype.locusE[0] === 'e') setPair(d, 'locusE', 'E');
      if (d.genotype.locusK[0] === 'ky' && d.genotype.locusA[0] === 'ay') setPair(d, 'locusK', 'KB');
    },
    goal: (s) => {
      s.colorGoal = { text: `${s.colorGoal?.text ? s.colorGoal.text + ' ' : ''}merle`, priority: 2 };
    },
  },
  {
    key: 'harlequin',
    group: 'markings',
    label: 'Harlequin (Great Dane patches)',
    requires: ['merle'],
    conflicts: [{ key: 'colRed', why: 'harlequin needs dark pigment' }, { key: 'colCream', why: 'harlequin needs dark pigment' }],
    gene: 'PSMB7 (H) is a modifier that only shows on a merle dog: it bleaches the merle base to white, leaving torn black patches. Two copies are fatal before birth.',
    recipe: 'A harlequin needs one merle copy and one harlequin copy. Great Danes are the only source in this bank.',
    odds: (b) => atLeastOne(b, 'harlequin', 'H') * atLeastOne(b, 'merle', 'M'),
    apply: (d) => {
      setPair(d, 'merle', 'M', 'm');
      setPair(d, 'harlequin', 'H', 'h');
      setPair(d, 'locusK', 'KB');
      setPair(d, 'locusE', 'E');
    },
    goal: (s) => {
      s.colorGoal = { text: 'harlequin', priority: 3 };
    },
  },
  {
    key: 'white',
    group: 'markings',
    label: 'White markings (piebald)',
    conflicts: [{ key: 'colCream', why: 'white markings on a white dog are invisible' }],
    gene: 'MITF (sp) is recessive-ish: two copies give large white patches, one copy often a white chest and toes.',
    recipe: 'Both parents carrying piebald gives you the full patchwork. Collies, Bulldogs and spaniels carry it.',
    odds: (b) => homo(b, 'locusS', 'sp'),
    carrierOdds: (b) => carrier(b, 'locusS', 'sp'),
    apply: (d) => {
      setPair(d, 'locusS', 'sp');
    },
    goal: (s) => {
      s.colorGoal = { text: `${s.colorGoal?.text ? s.colorGoal.text + ' and ' : ''}white`, priority: 2 };
    },
  },
  {
    key: 'blueEyes',
    group: 'markings',
    label: 'Blue eyes (Husky type)',
    gene: 'ALX4 duplication (Be), dominant. Blue eyes on any coat colour, with none of the health cost merle brings.',
    recipe: 'One blue-eyed Husky parent passes it to about half the litter.',
    odds: (b) => atLeastOne(b, 'blueEyes', 'Be'),
    apply: (d) => {
      setPair(d, 'blueEyes', 'Be', 'be');
    },
    goal: () => {},
  },
  {
    key: 'ticking',
    group: 'markings',
    label: 'Ticking or spots in the white',
    requires: ['white'],
    conflicts: [{ key: 'colCream', why: 'ticking needs a colour to fleck with' }],
    gene: 'The ticking gene (T) is dominant and only shows in white areas — it is what makes a Dalmatian a Dalmatian and a Bluetick a Bluetick.',
    recipe: 'One ticked parent plus enough white to show it on.',
    odds: (b) => atLeastOne(b, 'ticking', 'T') * atLeastOne(b, 'locusS', 'sp'),
    apply: (d) => {
      setPair(d, 'ticking', 'T');
      setPair(d, 'locusS', 'sp');
    },
    goal: () => {},
  },
];

const buildFeatures: LabFeature[] = [
  {
    key: 'shortLegs',
    group: 'build',
    label: 'Short legs (Dachshund / Corgi)',
    gene: 'An extra copy of FGF4 (Cd), dominant. One copy shortens the legs; it also raises the risk of spinal disc disease.',
    recipe: 'One short-legged parent gives it to about half the litter.',
    odds: (b) => atLeastOne(b, 'chondro', 'Cd'),
    apply: (d) => {
      setPair(d, 'chondro', 'Cd', 'cd');
    },
    goal: () => {},
  },
  {
    key: 'flatFace',
    group: 'build',
    label: 'Flat face',
    exclusive: 'muzzle',
    gene: 'Muzzle length is polygenic (SMOC2 and BMP3 are the big ones). Very flat faces come with breathing trouble — the game scores that in soundness.',
    recipe: 'Bulldogs, Pugs and Pekingese sit at the flat end. A flat × long cross lands in the middle, then select.',
    odds: (b) => nearRange(trait(b, 'muzzle'), 0, 28),
    apply: (d) => {
      d.traits.muzzle = 12;
    },
    goal: (s) => {
      s.traitGoals.muzzle = g(3, 0, 28, 0, 40);
    },
  },
  {
    key: 'longMuzzle',
    group: 'build',
    label: 'Long elegant muzzle',
    exclusive: 'muzzle',
    gene: 'Polygenic, the other end of the same genes. Sighthounds and Collies sit here.',
    recipe: 'Start from long-muzzled breeds and keep picking the longest.',
    odds: (b) => nearRange(trait(b, 'muzzle'), 72, 100),
    apply: (d) => {
      d.traits.muzzle = 86;
    },
    goal: (s) => {
      s.traitGoals.muzzle = g(3, 72, 100, 60, 100);
    },
  },
  {
    key: 'slight',
    group: 'build',
    label: 'Light, racy build',
    exclusive: 'build',
    gene: 'Bone and substance are polygenic. Sighthounds are the extreme.',
    recipe: 'Greyhounds, Whippets and Afghans bring it. Heavy breeds will pull the litter back toward the middle.',
    odds: (b) => nearRange(trait(b, 'substance'), 0, 34),
    apply: (d) => {
      d.traits.substance = 18;
    },
    goal: (s) => {
      s.traitGoals.substance = g(3, 0, 34, 0, 48);
    },
  },
  {
    key: 'heavy',
    group: 'build',
    label: 'Heavy, powerful build',
    exclusive: 'build',
    gene: 'Polygenic. Mastiffs, Rottweilers and bull breeds sit at the heavy end; it tends to travel with size.',
    recipe: 'Start heavy and stay heavy. Watch joints — heavy dogs pay for it in soundness.',
    odds: (b) => nearRange(trait(b, 'substance'), 78, 100),
    apply: (d) => {
      d.traits.substance = 90;
    },
    goal: (s) => {
      s.traitGoals.substance = g(3, 78, 100, 64, 100);
    },
  },
];

const EARS: { type: EarType; label: string; low: number; high: number; value: number }[] = [
  { type: 'drop', label: 'Dropped ears', low: 0, high: 39, value: 12 },
  { type: 'button', label: 'Button ears', low: 40, high: 57, value: 48 },
  { type: 'semiErect', label: 'Semi-erect ears', low: 58, high: 75, value: 66 },
  { type: 'erect', label: 'Erect ears', low: 76, high: 100, value: 92 },
];

const earFeatures: LabFeature[] = EARS.map((e) => ({
  key: `ear_${e.type}`,
  group: 'ears',
  label: e.label,
  exclusive: 'ears',
  gene: 'Ear carriage is polygenic (MSRB3 is the biggest single gene). Dropped is roughly recessive to erect: an erect × drop cross usually gives semi-erect or button ears.',
  recipe: 'Pick both parents from the ear type you want. Mixed pairs land in the middle for a generation or two.',
  odds: (b) => nearRange(trait(b, 'earSet'), e.low, e.high, 22),
  apply: (d) => {
    d.traits.earSet = e.value;
  },
  goal: (s) => {
    s.earGoal = { types: [e.type], priority: 2 };
  },
}));

const TAILS: { type: TailType; label: string; low: number; high: number; value: number; gene: string; recipe: string }[] = [
  {
    type: 'curled',
    label: 'Curled tight over the back',
    low: 82,
    high: 100,
    value: 92,
    gene: 'Tail carriage is polygenic. Spitz breeds sit at the curled extreme; two curled parents breed true for it.',
    recipe: 'Akita, Shiba, Pug, Pomeranian, Samoyed, Chow. A curled × hanging cross gives sickle tails.',
  },
  {
    type: 'sickle',
    label: 'Sickle curve up over the back',
    low: 68,
    high: 81,
    value: 74,
    gene: 'Polygenic tail carriage, just short of a full curl.',
    recipe: 'Huskies and Malamutes, or a curled × hanging cross.',
  },
  {
    type: 'plume',
    label: 'Long feathered plume',
    low: 30,
    high: 67,
    value: 50,
    gene: 'Ordinary carriage plus a long coat — the plume is the feathering, not a tail gene.',
    recipe: 'Any long-coated breed with an ordinary tail: Golden, Setter, Papillon, Sheltie.',
  },
  {
    type: 'whip',
    label: 'Low whip tail',
    low: 0,
    high: 26,
    value: 12,
    gene: 'Polygenic tail carriage at the low, tucked end.',
    recipe: 'Greyhound, Whippet, Italian Greyhound, Great Dane.',
  },
  {
    type: 'screw',
    label: 'Short screw tail',
    low: 27,
    high: 67,
    value: 40,
    gene: 'A short, kinked tail that goes with a flat face — the same body-plan genes shorten both.',
    recipe: 'Bulldogs, French Bulldogs and Bostons. Needs the flat face too.',
  },
  {
    type: 'bobtail',
    label: 'Natural bobtail',
    low: 0,
    high: 100,
    value: 48,
    gene: 'T-box (Bt) is dominant and fatal with two copies, so bobtails are always carriers of the full tail too.',
    recipe: 'One bobtail parent gives it to half the litter. Never bobtail × bobtail. Corgis, Aussies, Brittanys, Schipperkes.',
  },
];

const tailFeatures: LabFeature[] = TAILS.map((t) => ({
  key: `tail_${t.type}`,
  group: 'tail',
  label: t.label,
  exclusive: 'tail',
  requires: t.type === 'screw' ? ['flatFace'] : undefined,
  conflicts:
    t.type === 'plume'
      ? [
          { key: 'coatSmooth', why: 'a plume needs long hair' },
          { key: 'coatWire', why: 'a plume needs long hair' },
          { key: 'coatHairless', why: 'a plume needs long hair' },
        ]
      : t.type === 'screw'
        ? [{ key: 'longMuzzle', why: 'a screw tail goes with a flat face' }]
        : undefined,
  gene: t.gene,
  recipe: t.recipe,
  odds: (b) => {
    if (t.type === 'bobtail') return atLeastOne(b, 'bobtail', 'Bt');
    const base = nearRange(trait(b, 'tailSet'), t.low, t.high, 22);
    if (t.type === 'plume') return base * homo(b, 'coatLength', 'l');
    if (t.type === 'screw') return base * nearRange(trait(b, 'muzzle'), 0, 29);
    if (t.type === 'sickle' || t.type === 'curled') return base;
    return base * (1 - atLeastOne(b, 'bobtail', 'Bt'));
  },
  apply: (d) => {
    d.traits.tailSet = t.value;
    if (t.type === 'bobtail') setPair(d, 'bobtail', 'Bt', 'bt');
    if (t.type === 'plume' && d.genotype.coatLength[0] === 'L') setPair(d, 'coatLength', 'l');
    if (t.type === 'screw') d.traits.muzzle = Math.min(d.traits.muzzle, 20);
  },
  goal: (s) => {
    s.tailGoal = { types: [t.type], priority: 2 };
  },
}));

const TEMPERAMENTS: { key: string; label: string; trait: Exclude<PolyTrait, 'size'>; low: number; high: number; value: number; gene: string; recipe: string }[] = [
  {
    key: 'calm', label: 'Calm and steady', trait: 'stability', low: 68, high: 100, value: 82,
    gene: 'Emotional stability is polygenic and about half inherited. It tends to travel with lower energy.',
    recipe: 'Pick the calmest parents, every generation. Companion and mountain breeds start ahead.',
  },
  {
    key: 'energetic', label: 'High energy', trait: 'energy', low: 72, high: 100, value: 86,
    gene: 'Energy is polygenic, moderately heritable, and pulls prey drive and alertness up with it.',
    recipe: 'Herding, working and terrier breeds. Easy to get; hard to live with.',
  },
  {
    key: 'lowEnergy', label: 'Couch potato', trait: 'energy', low: 0, high: 32, value: 20,
    gene: 'The low end of the same polygenic trait.',
    recipe: 'Bulldogs, Bassets, Mastiffs, Pekingese.',
  },
  {
    key: 'trainable', label: 'Very trainable', trait: 'biddability', low: 72, high: 100, value: 86,
    gene: 'Biddability — the urge to work with a person — is polygenic and one of the more heritable temperament traits.',
    recipe: 'Retrievers, Poodles, Collies, Shepherds. Select on it and it responds fast.',
  },
  {
    key: 'independent', label: 'Independent thinker', trait: 'independence', low: 68, high: 100, value: 80,
    gene: 'Independence is polygenic and the mirror of biddability.',
    recipe: 'Hounds, livestock guardians, Chows, Shibas, Basenjis.',
  },
  {
    key: 'quiet', label: 'Quiet (rarely barks)', trait: 'vocality', low: 0, high: 32, value: 20,
    gene: 'Vocality is polygenic. Sighthounds and Basenjis are famously quiet; terriers are not.',
    recipe: 'Greyhounds, Whippets, Basenjis, Akitas, Newfoundlands.',
  },
  {
    key: 'social', label: 'Loves everyone', trait: 'sociability', low: 72, high: 100, value: 86,
    gene: 'Sociability is polygenic and moderately heritable; early handling matters too, but the game scores the genetic part.',
    recipe: 'Retrievers, Cavaliers, Bichons, Pugs.',
  },
  {
    key: 'preyDrive', label: 'Strong prey drive', trait: 'preyDrive', low: 72, high: 100, value: 86,
    gene: 'Prey drive is polygenic and travels with energy and alertness.',
    recipe: 'Terriers, sighthounds, Huskies, Malinois.',
  },
];

const temperamentFeatures: LabFeature[] = TEMPERAMENTS.map((t) => ({
  key: `temp_${t.key}`,
  group: 'temperament',
  label: t.label,
  exclusive: t.trait === 'energy' ? 'energy' : undefined,
  gene: t.gene,
  recipe: t.recipe,
  odds: (b) => nearRange(trait(b, t.trait), t.low, t.high, 24),
  apply: (d) => {
    d.traits[t.trait] = t.value;
  },
  goal: (s) => {
    s.traitGoals[t.trait] = t.low === 0 ? { mode: 'lower', priority: 3 } : { mode: 'higher', priority: 3 };
  },
}));

export const LAB_FEATURES: LabFeature[] = [
  ...sizeFeatures,
  ...coatFeatures,
  ...colourFeatures,
  ...markingFeatures,
  ...buildFeatures,
  ...earFeatures,
  ...tailFeatures,
  ...temperamentFeatures,
];

export const LAB_BY_KEY: Record<string, LabFeature> = Object.fromEntries(LAB_FEATURES.map((f) => [f.key, f]));

/**
 * Toggle a feature. Picking one drops anything it is exclusive with, drops
 * anything it conflicts with (and says why), and pulls in anything it
 * requires. Unpicking is plain.
 */
export function toggleFeature(selected: string[], key: string): { selected: string[]; notes: string[] } {
  if (selected.includes(key)) return { selected: selected.filter((k) => k !== key), notes: [] };
  const feature = LAB_BY_KEY[key];
  const notes: string[] = [];
  let kept = feature.exclusive ? selected.filter((k) => LAB_BY_KEY[k].exclusive !== feature.exclusive) : selected;
  for (const c of feature.conflicts ?? []) {
    if (kept.includes(c.key)) {
      kept = kept.filter((k) => k !== c.key);
      notes.push(`Dropped "${LAB_BY_KEY[c.key].label}": ${c.why}.`);
    }
  }
  let next = [...kept, key];
  for (const r of feature.requires ?? []) {
    if (!next.includes(r)) {
      next = toggleFeature(next, r).selected;
      notes.push(`Added "${LAB_BY_KEY[r].label}", because "${feature.label}" needs it.`);
    }
  }
  return { selected: next, notes };
}

// ---------------------------------------------------------------------------
// The design dog
// ---------------------------------------------------------------------------

/** A neutral fawn, smooth, medium dog: the blank the features paint onto. */
export function blankDraft(): Draft {
  const genotype: Genotype = {
    coatLength: ['L', 'L'],
    furnishings: ['f', 'f'],
    curl: ['cu', 'cu'],
    shedding: ['Sh', 'Sh'],
    undercoat: ['u', 'u'],
    hairlessDom: ['hd', 'hd'],
    hairlessRec: ['N', 'N'],
    chondro: ['cd', 'cd'],
    locusE: ['E', 'E'],
    locusK: ['ky', 'ky'],
    locusA: ['ay', 'ay'],
    locusB: ['B', 'B'],
    locusD: ['D', 'D'],
    cocoa: ['Co', 'Co'],
    locusS: ['S', 'S'],
    merle: ['m', 'm'],
    harlequin: ['h', 'h'],
    intensity: ['I', 'I'],
    albino: ['N', 'N'],
    ticking: ['t', 't'],
    blueEyes: ['be', 'be'],
    bobtail: ['bt', 'bt'],
  };
  for (const q of QUIRKS) genotype[q.key] = ['n', 'n'];
  const traits = {
    size: poundsToSize(40),
    substance: 50,
    muzzle: 55,
    earSet: 50,
    tailSet: 48,
    energy: 50,
    preyDrive: 50,
    vocality: 50,
    alertness: 50,
    sociability: 55,
    biddability: 55,
    stability: 55,
    independence: 45,
    persistence: 50,
    handling: 55,
    structure: 60,
    longevity: 60,
    fertility: 60,
  } as Record<PolyTrait, number>;
  return { genotype, traits };
}

export function buildDraft(selected: string[]): Draft {
  const draft = blankDraft();
  // Colour first, then markings, then the rest — so a marking can adjust a
  // colour choice (merle needs dark pigment) without being undone.
  const order: LabGroup[] = ['size', 'coat', 'colour', 'markings', 'build', 'ears', 'tail', 'temperament'];
  for (const group of order) {
    for (const key of selected) {
      const f = LAB_BY_KEY[key];
      if (f && f.group === group) f.apply(draft);
    }
  }
  return draft;
}

export function buildStandard(selected: string[], name: string): BreedStandard {
  const standard = blankStandard(name || 'Lab design');
  for (const key of selected) LAB_BY_KEY[key]?.goal(standard);
  standard.vision = selected.map((k) => LAB_BY_KEY[k]?.label.toLowerCase()).filter(Boolean).join(', ');
  return standard;
}

// ---------------------------------------------------------------------------
// Which breeds get you there
// ---------------------------------------------------------------------------

export interface BreedMatch {
  breed: BreedProfile;
  /** 0-1, the average of the feature odds. */
  fit: number;
  brings: string[];
  carries: string[];
  lacks: string[];
  perFeature: Record<string, number>;
}

export interface PairMatch {
  a: BreedProfile;
  b: BreedProfile;
  fit: number;
  aBrings: string[];
  bBrings: string[];
  neither: string[];
}

/**
 * A feature few breeds have (a curly coat) matters more in the ranking than
 * one most breeds have (a black coat), otherwise every list is topped by
 * breeds that happen to tick the easy boxes.
 */
function rarityWeights(features: LabFeature[]): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const f of features) {
    const avg = BREEDS.reduce((sum, b) => sum + clamp01(f.odds(b)), 0) / BREEDS.length;
    weights[f.key] = 1 / (0.15 + avg);
  }
  return weights;
}

export function matchBreeds(selected: string[]): BreedMatch[] {
  const features = selected.map((k) => LAB_BY_KEY[k]).filter(Boolean);
  if (features.length === 0) return [];
  const weights = rarityWeights(features);
  const weightTotal = features.reduce((sum, f) => sum + weights[f.key], 0);
  const matches = BREEDS.filter((b) => b.group !== 'Legendary').map((breed) => {
    const perFeature: Record<string, number> = {};
    const brings: string[] = [];
    const carries: string[] = [];
    const lacks: string[] = [];
    let total = 0;
    for (const f of features) {
      const shows = clamp01(f.odds(breed));
      const carry = f.carrierOdds ? clamp01(f.carrierOdds(breed)) : 0;
      perFeature[f.key] = shows;
      // A carrier is worth something — half a showing dog — because the gene
      // is in the building even if it is not on display.
      const value = Math.max(shows, carry * 0.5);
      total += value * weights[f.key];
      if (shows >= 0.5) brings.push(f.label);
      else if (carry >= 0.3) carries.push(f.label);
      else if (shows < 0.15) lacks.push(f.label);
    }
    return { breed, fit: total / weightTotal, brings, carries, lacks, perFeature };
  });
  return matches.sort((x, y) => y.fit - x.fit);
}

/**
 * The best pair: two breeds where each covers what the other cannot. For
 * every feature the pair scores the better of the two, which is roughly what
 * a cross gives you — the gene is in the building, and selection does the
 * rest.
 */
export function matchPairs(selected: string[], singles: BreedMatch[]): PairMatch[] {
  const features = selected.map((k) => LAB_BY_KEY[k]).filter(Boolean);
  if (features.length < 2) return [];
  // Only pairs drawn from the forty best singles: the rest cannot help.
  const pool = singles.slice(0, 40);
  const weights = rarityWeights(features);
  const weightTotal = features.reduce((sum, f) => sum + weights[f.key], 0);
  const pairs: PairMatch[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const A = pool[i];
      const B = pool[j];
      let total = 0;
      const aBrings: string[] = [];
      const bBrings: string[] = [];
      const neither: string[] = [];
      for (const f of features) {
        const a = A.perFeature[f.key];
        const b = B.perFeature[f.key];
        total += Math.max(a, b) * weights[f.key];
        if (a >= 0.5 && a >= b) aBrings.push(f.label);
        else if (b >= 0.5) bBrings.push(f.label);
        else if (Math.max(a, b) < 0.15) neither.push(f.label);
      }
      // A pair only earns its keep if both halves contribute.
      if (aBrings.length === 0 || bBrings.length === 0) continue;
      pairs.push({ a: A.breed, b: B.breed, fit: total / weightTotal, aBrings, bBrings, neither });
    }
  }
  return pairs.sort((x, y) => y.fit - x.fit);
}

/** Founder breeds to seed a project with, from the matches. */
export function founderPlan(singles: BreedMatch[], pairs: PairMatch[]): string[] {
  const best = singles[0];
  const pair = pairs[0];
  if (pair && (!best || pair.fit > best.fit + 0.08)) return [pair.a.key, pair.b.key];
  if (!best) return [];
  const second = singles[1];
  return second && second.fit > best.fit - 0.1 ? [best.breed.key, second.breed.key] : [best.breed.key];
}

/** Rough honesty about how long the whole thing will take. */
export function estimateGenerations(selected: string[], singles: BreedMatch[]): { generations: number; why: string } {
  const features = selected.map((k) => LAB_BY_KEY[k]).filter(Boolean);
  const best = singles[0];
  if (!best || features.length === 0) return { generations: 0, why: '' };
  const missing = features.filter((f) => best.perFeature[f.key] < 0.5);
  const recessives = missing.filter((f) => f.carrierOdds).length;
  const polygenic = missing.filter((f) => ['size', 'build', 'ears', 'tail', 'temperament'].includes(f.group)).length;
  const generations = Math.min(15, 1 + missing.length + recessives + Math.ceil(polygenic * 1.5));
  const why =
    missing.length === 0
      ? `${best.breed.name} already shows everything you asked for. This is a refinement project, not a construction.`
      : `${best.breed.name} brings most of it. ${missing.length} feature${missing.length === 1 ? '' : 's'} must come from a cross${
          recessives ? `, and ${recessives} of those ${recessives === 1 ? 'is' : 'are'} recessive — hidden for a generation, then bred back out` : ''
        }${polygenic ? `. ${polygenic} ${polygenic === 1 ? 'is' : 'are'} polygenic and only move a little per generation` : ''}.`;
  return { generations, why };
}
