/**
 * SINGLE-GENE TRAITS (the "Mendelian" ones)
 *
 * These are the genes that behave like the pea plants from school biology:
 * every dog carries two copies, passes one at random to each puppy, and some
 * versions hide others. Coat length, curl, colour and most disease mutations
 * work this way, which is why a DNA test can predict them exactly.
 *
 * Vocabulary, once:
 *   ALLELE    - one version of a gene (for example "long coat")
 *   GENOTYPE  - the pair a dog actually carries, one from each parent
 *   DOMINANT  - an allele that hides its partner
 *   RECESSIVE - an allele that only shows when both copies match
 *   CARRIER   - a healthy dog hiding one recessive copy
 *
 * In this file the allele list for each gene is written STRONGEST FIRST.
 * Whichever allele appears earlier in the list is the one that shows.
 */

import { QUIRKS } from './quirks';

export type AlleleCode = string;
/** The two copies a dog carries at one gene. Always stored dominant-first. */
export type Genopair = [AlleleCode, AlleleCode];
/** Every gene a dog carries. */
export type Genotype = Record<string, Genopair>;

export interface AlleleDef {
  code: AlleleCode;
  /** Scientific notation, shown only in Genetics Nerd Mode. */
  symbol: string;
  /** Plain-language name. */
  label: string;
}

export interface LocusDef {
  key: string;
  /** Plain-language name of what this gene controls. */
  name: string;
  /** Real gene symbol, shown in Nerd Mode. */
  gene: string;
  category: 'coat' | 'color' | 'form' | 'disease' | 'quirk';
  /** Strongest allele first. */
  alleles: AlleleDef[];
  /**
   * When true, one copy gives a visibly in-between result rather than being
   * fully hidden (curl and merle both behave this way in real dogs).
   */
  incomplete?: boolean;
  /**
   * Some alleles kill the embryo when a puppy inherits two copies. Those
   * puppies are simply never born, which quietly shifts the ratios in a litter.
   */
  lethalHomozygous?: AlleleCode;
  /** One-line explanation for the player. */
  note?: string;
}

export const LOCI: LocusDef[] = [
  // ======================================================= COAT STRUCTURE ===
  {
    key: 'coatLength',
    name: 'Coat length',
    gene: 'FGF5',
    category: 'coat',
    alleles: [
      { code: 'L', symbol: 'L', label: 'Short coat' },
      { code: 'l', symbol: 'l', label: 'Long coat' },
    ],
    note: 'Two long-coat copies give a long coat. In smooth breeds this hidden copy is the famous "fluffy".',
  },
  {
    key: 'furnishings',
    name: 'Furnishings',
    gene: 'RSPO2',
    category: 'coat',
    alleles: [
      { code: 'F', symbol: 'F', label: 'Furnished (beard and eyebrows)' },
      { code: 'f', symbol: 'f', label: 'Unfurnished (smooth face)' },
    ],
    note: 'Furnishings give the wiry beard, moustache and eyebrows of terriers and doodles.',
  },
  {
    key: 'curl',
    name: 'Curl',
    gene: 'KRT71',
    category: 'coat',
    incomplete: true,
    alleles: [
      { code: 'Cu', symbol: 'Cu', label: 'Curly' },
      { code: 'cu', symbol: 'cu', label: 'Straight' },
    ],
    note: 'One copy gives a wave, two copies give a full curl.',
  },
  {
    key: 'shedding',
    name: 'Shedding',
    gene: 'MC5R',
    category: 'coat',
    alleles: [
      { code: 'Sh', symbol: 'Sh', label: 'Normal shedding' },
      { code: 'sh', symbol: 'sh', label: 'Reduced shedding' },
    ],
    note: 'Reduced shedding needs two copies, and only helps if the coat structure cooperates.',
  },
  {
    key: 'undercoat',
    name: 'Undercoat',
    gene: 'UND-1',
    category: 'coat',
    alleles: [
      { code: 'U', symbol: 'U', label: 'Dense undercoat' },
      { code: 'u', symbol: 'u', label: 'Single coat' },
    ],
    note: 'One copy gives the plush, woolly undercoat of a Husky or Labrador — warm, water-shedding, and blown out in great clumps twice a year. (A gameplay gene: real dogs manage this with several.)',
  },
  {
    key: 'hairlessDom',
    name: 'Hairlessness (dominant)',
    gene: 'FOXI3',
    category: 'coat',
    lethalHomozygous: 'Hd',
    alleles: [
      { code: 'Hd', symbol: 'Hd', label: 'Hairless' },
      { code: 'hd', symbol: 'hd', label: 'Coated' },
    ],
    note: 'The Chinese Crested gene. One copy makes a hairless dog. Two copies are fatal before birth, so hairless bred to hairless always loses part of the litter and still produces coated puppies.',
  },
  {
    key: 'hairlessRec',
    name: 'Hairlessness (recessive)',
    gene: 'SGK3',
    category: 'coat',
    alleles: [
      { code: 'N', symbol: 'N', label: 'Coated' },
      { code: 'hr', symbol: 'h', label: 'Hairless' },
    ],
    note: 'The American Hairless Terrier gene. Needs two copies, carries no lethality, and produces a completely bald dog born with a coat that falls out.',
  },
  {
    key: 'chondro',
    name: 'Leg length',
    gene: 'FGF4 / CDDY',
    category: 'form',
    incomplete: true,
    alleles: [
      { code: 'Cd', symbol: 'CDDY', label: 'Short legs' },
      { code: 'cd', symbol: 'N', label: 'Normal legs' },
    ],
    note: 'Shortens the legs like a Dachshund or Corgi, and also raises the risk of disc disease in the back.',
  },

  // =============================================================== COLOUR ===
  {
    key: 'locusE',
    name: 'Red and masking',
    gene: 'MC1R (E locus)',
    category: 'color',
    alleles: [
      { code: 'Em', symbol: 'E^m', label: 'Black mask' },
      { code: 'E', symbol: 'E', label: 'Normal pigment' },
      { code: 'e', symbol: 'e', label: 'Clear red or cream' },
    ],
    note: 'Two copies of the red allele wipe out all black pigment in the coat, whatever the other genes say.',
  },
  {
    key: 'locusK',
    name: 'Solid colour and brindle',
    gene: 'CBD103 (K locus)',
    category: 'color',
    alleles: [
      { code: 'KB', symbol: 'K^B', label: 'Solid dark' },
      { code: 'kbr', symbol: 'k^br', label: 'Brindle' },
      { code: 'ky', symbol: 'k^y', label: 'Allows pattern to show' },
    ],
  },
  {
    key: 'locusA',
    name: 'Pattern',
    gene: 'ASIP (A locus)',
    category: 'color',
    alleles: [
      { code: 'ay', symbol: 'a^y', label: 'Sable / fawn' },
      { code: 'aw', symbol: 'a^w', label: 'Wolf sable' },
      { code: 'at', symbol: 'a^t', label: 'Tan points' },
      { code: 'a', symbol: 'a', label: 'Recessive black' },
    ],
  },
  {
    key: 'locusB',
    name: 'Chocolate',
    gene: 'TYRP1 (B locus)',
    category: 'color',
    alleles: [
      { code: 'B', symbol: 'B', label: 'Black pigment' },
      { code: 'b', symbol: 'b', label: 'Chocolate / liver' },
    ],
    note: 'Two copies turn every black hair — and the nose — chocolate brown.',
  },
  {
    key: 'locusD',
    name: 'Dilution',
    gene: 'MLPH (D locus)',
    category: 'color',
    alleles: [
      { code: 'D', symbol: 'D', label: 'Full strength colour' },
      { code: 'd', symbol: 'd', label: 'Diluted' },
    ],
    note: 'Two copies fade black to blue-grey. Stacked on top of chocolate it gives the sought-after lilac.',
  },
  {
    key: 'cocoa',
    name: 'Cocoa',
    gene: 'HPS3',
    category: 'color',
    alleles: [
      { code: 'Co', symbol: 'Co', label: 'Normal' },
      { code: 'co', symbol: 'co', label: 'Cocoa brown' },
    ],
    note: 'A second, much rarer route to a brown dog. Hidden almost exclusively in French Bulldog lines.',
  },
  {
    key: 'locusS',
    name: 'White spotting',
    gene: 'MITF (S locus)',
    category: 'color',
    incomplete: true,
    alleles: [
      { code: 'S', symbol: 'S', label: 'Solid' },
      { code: 'sp', symbol: 's^p', label: 'Piebald' },
    ],
  },
  {
    key: 'rainbow',
    name: 'Rainbow',
    gene: '✨',
    category: 'color',
    alleles: [
      { code: 'Rb', symbol: 'Rb', label: 'Rainbow' },
      { code: 'rb', symbol: 'rb', label: 'Ordinary' },
    ],
    note: 'Two copies and the coat shimmers through every colour at once. Nobody has found it in the wild. Nobody is looking very hard.',
  },
  {
    key: 'merle',
    name: 'Merle',
    gene: 'PMEL17',
    category: 'color',
    incomplete: true,
    alleles: [
      { code: 'M', symbol: 'M', label: 'Merle' },
      { code: 'm', symbol: 'm', label: 'Not merle' },
    ],
    note: 'Marbles the coat. Two copies produce a mostly white "double merle" with a serious risk of deafness and blindness — never breed merle to merle.',
  },
  {
    key: 'harlequin',
    name: 'Harlequin',
    gene: 'PSMB7',
    category: 'color',
    lethalHomozygous: 'H',
    alleles: [
      { code: 'H', symbol: 'H', label: 'Harlequin modifier' },
      { code: 'h', symbol: 'h', label: 'None' },
    ],
    note: 'Does nothing on its own. On a merle dog it bleaches the grey to pure white, giving the Great Dane harlequin pattern. Two copies are fatal before birth.',
  },
  {
    key: 'intensity',
    name: 'Red intensity',
    gene: 'Intensity locus',
    category: 'color',
    incomplete: true,
    alleles: [
      { code: 'I', symbol: 'I', label: 'Deep red' },
      { code: 'i', symbol: 'i', label: 'Pale cream' },
    ],
  },
  {
    key: 'albino',
    name: 'Albinism',
    gene: 'SLC45A2',
    category: 'color',
    alleles: [
      { code: 'N', symbol: 'N', label: 'Normal' },
      { code: 'al', symbol: 'al', label: 'Albino' },
    ],
    note: 'Extremely rare. Two copies give a white dog with pink skin, pale eyes and lifelong light sensitivity.',
  },
  {
    key: 'ticking',
    name: 'Ticking and roan',
    gene: 'USH2A',
    category: 'color',
    incomplete: true,
    alleles: [
      { code: 'T', symbol: 'T', label: 'Ticked' },
      { code: 't', symbol: 't', label: 'Clear white' },
    ],
  },
  {
    key: 'blueEyes',
    name: 'Blue eyes',
    gene: 'ALX4',
    category: 'color',
    alleles: [
      { code: 'Be', symbol: 'BE', label: 'Blue eyes' },
      { code: 'be', symbol: 'N', label: 'Normal eyes' },
    ],
    note: 'The Husky version of blue eyes. Needs only one copy and carries no health risk, unlike blue eyes caused by merle.',
  },

  // ================================================================= FORM ===
  {
    key: 'bobtail',
    name: 'Natural bobtail',
    gene: 'T-box (C189G)',
    category: 'form',
    lethalHomozygous: 'Bt',
    alleles: [
      { code: 'Bt', symbol: 'T', label: 'Natural bobtail' },
      { code: 'bt', symbol: 't', label: 'Full tail' },
    ],
    note: 'One copy gives a naturally short tail. Two copies are fatal before birth.',
  },

  // ============================================================= DISEASES ===
  ...diseaseLocus('prcdPRA', 'Progressive retinal atrophy', 'PRCD', 'Gradual blindness in middle age.'),
  ...diseaseLocus('dm', 'Degenerative myelopathy', 'SOD1', 'Late-onset weakness and paralysis of the hind end.'),
  ...diseaseLocus('vwd', 'Von Willebrand disease', 'VWF', 'A bleeding disorder; minor injuries and surgery become dangerous.'),
  ...diseaseLocus('mdr1', 'Drug sensitivity', 'MDR1', 'Severe, sometimes fatal reactions to several common veterinary drugs.'),
  ...diseaseLocus('cea', 'Collie eye anomaly', 'NHEJ1', 'Malformed eye tissue, ranging from harmless to blinding.'),
  ...diseaseLocus('huu', 'Hyperuricosuria', 'SLC2A9', 'Painful urinary stones that often need surgery.'),
  ...diseaseLocus('cystinuria', 'Cystinuria', 'SLC3A1', 'Bladder stones, mainly affecting males.'),
  ...diseaseLocus('ichthyosis', 'Ichthyosis', 'PNPLA1', 'Thick, greasy, flaking skin needing lifelong management.'),
  ...diseaseLocus('eic', 'Exercise-induced collapse', 'DNM1', 'Collapse after intense exercise.'),
  ...diseaseLocus('pll', 'Primary lens luxation', 'ADAMTS17', 'The lens slips out of place, a painful emergency.'),
  ...diseaseLocus('dcm', 'Dilated cardiomyopathy', 'PDK4', 'The heart enlarges and weakens, often without warning.'),

  // ============================================================== QUIRKS ===
  // Personality habits, each on its own made-up gene. They ride the same
  // inheritance machinery as everything else, which is the whole point: a
  // recessive habit can skip a generation and turn up in a grandchild.
  ...QUIRKS.map(
    (q): LocusDef => ({
      key: q.key,
      name: q.text.replace(/\{[a-z]+\}/g, '…').replace(/\s+/g, ' ').slice(0, 48),
      gene: q.gene,
      category: 'quirk',
      alleles: [
        { code: 'Q', symbol: q.mode === 'dominant' ? 'Q' : 'Q', label: 'Has the habit' },
        { code: 'n', symbol: 'n', label: 'Does not' },
      ],
      incomplete: q.mode === 'recessive',
    }),
  ),
];

/**
 * Every disease gene in this game follows the same shape: a healthy version
 * that hides a broken one. This helper stamps them out so the list above stays
 * readable.
 */
function diseaseLocus(key: string, name: string, gene: string, note: string): LocusDef[] {
  return [
    {
      key,
      name,
      gene,
      category: 'disease',
      alleles: [
        { code: 'N', symbol: 'N', label: 'Clear' },
        { code: 'm', symbol: key, label: 'Affected copy' },
      ],
      note,
    },
  ];
}

export const LOCUS_BY_KEY: Record<string, LocusDef> = Object.fromEntries(
  LOCI.map((l) => [l.key, l]),
);

export const DISEASE_LOCI = LOCI.filter((l) => l.category === 'disease');
export const COAT_LOCI = LOCI.filter((l) => l.category === 'coat');
export const COLOR_LOCI = LOCI.filter((l) => l.category === 'color');

// ---------------------------------------------------------------------------
// Working with genotypes
// ---------------------------------------------------------------------------

/** How strong an allele is: 0 is the most dominant. */
export function rank(locusKey: string, allele: AlleleCode): number {
  const locus = LOCUS_BY_KEY[locusKey];
  const index = locus.alleles.findIndex((a) => a.code === allele);
  return index === -1 ? locus.alleles.length : index;
}

/** Put a pair in dominant-first order so genotypes are always comparable. */
export function orderPair(locusKey: string, a: AlleleCode, b: AlleleCode): Genopair {
  return rank(locusKey, a) <= rank(locusKey, b) ? [a, b] : [b, a];
}

/** The allele that actually shows (ignoring incomplete-dominance blending). */
export function expressed(genotype: Genotype, locusKey: string): AlleleCode {
  const pair = genotype[locusKey];
  if (!pair) return LOCUS_BY_KEY[locusKey].alleles[0].code;
  return rank(locusKey, pair[0]) <= rank(locusKey, pair[1]) ? pair[0] : pair[1];
}

/** How many copies of a particular allele the dog carries: 0, 1 or 2. */
export function copies(genotype: Genotype, locusKey: string, allele: AlleleCode): number {
  const pair = genotype[locusKey];
  if (!pair) return 0;
  return (pair[0] === allele ? 1 : 0) + (pair[1] === allele ? 1 : 0);
}

/** True when the dog has two identical copies at this gene. */
export function isHomozygous(genotype: Genotype, locusKey: string): boolean {
  const pair = genotype[locusKey];
  return !!pair && pair[0] === pair[1];
}

/** True when the dog is a healthy carrier of a recessive disease. */
export function isCarrier(genotype: Genotype, locusKey: string): boolean {
  return copies(genotype, locusKey, 'm') === 1;
}

/** True when the dog will actually develop the disease. */
export function isAffected(genotype: Genotype, locusKey: string): boolean {
  return copies(genotype, locusKey, 'm') === 2;
}

/** Nerd-mode notation, for example "L/l" or "B/b". */
export function genopairSymbol(locusKey: string, pair: Genopair): string {
  const locus = LOCUS_BY_KEY[locusKey];
  const symbolOf = (code: AlleleCode) =>
    locus.alleles.find((a) => a.code === code)?.symbol ?? code;
  return `${symbolOf(pair[0])}/${symbolOf(pair[1])}`;
}
