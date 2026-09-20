/**
 * THE ONE LIST OF LOOKS
 *
 * Every screen that lets the player pick a colour, marking or coat — the Lab,
 * "purebred with a twist", the Playground's "make it wear…", the outside-dog
 * "must carry" chips — reads from here, so the same things are on offer
 * everywhere and under the same names.
 *
 * Each twist knows three things about itself:
 *   show      the genes that make a dog actually wear it (Playground)
 *   carry     the one hidden gene a carrier hunt asks for (outside dogs)
 *   colourText the words a breed standard uses for it (purebred twist)
 */

export interface Twist {
  key: string;
  label: string;
  blurb: string;
  group: 'colour' | 'marking' | 'coat' | 'build';
  /** Genes set on a dog so it shows this. Two codes = both copies; one code = a single (dominant) copy. */
  show: { locus: string; alleles: [string] | [string, string] }[];
  /** The gene a specialist breeder is asked for, as a hidden single copy. */
  carry?: { locus: string; allele: string; label: string };
  /** What a standard's colour wish says. Colours and markings only. */
  colourText?: string;
  /** The matching feature in the Lab, where one exists. */
  labKey?: string;
}

const E_ON = { locus: 'locusE', alleles: ['E', 'E'] as [string, string] };
const K_OFF = { locus: 'locusK', alleles: ['ky', 'ky'] as [string, string] };

export const TWISTS: Twist[] = [
  // --- colours ------------------------------------------------------------
  { key: 'black', label: 'Solid black', group: 'colour', blurb: 'Dominant black (K^B) over normal pigment.', show: [{ locus: 'locusK', alleles: ['KB', 'KB'] }, E_ON], carry: { locus: 'locusK', allele: 'KB', label: 'dominant black' }, colourText: 'black', labKey: 'colBlack' },
  { key: 'chocolate', label: 'Chocolate', group: 'colour', blurb: 'Brown pigment everywhere (b/b). Recessive: both parents must carry it.', show: [{ locus: 'locusB', alleles: ['b', 'b'] }], carry: { locus: 'locusB', allele: 'b', label: 'chocolate' }, colourText: 'chocolate', labKey: 'colChocolate' },
  { key: 'blue', label: 'Blue', group: 'colour', blurb: 'Dilute black (d/d). Recessive.', show: [{ locus: 'locusD', alleles: ['d', 'd'] }], carry: { locus: 'locusD', allele: 'd', label: 'dilute (blue)' }, colourText: 'blue', labKey: 'colBlue' },
  { key: 'lilac', label: 'Lilac', group: 'colour', blurb: 'Chocolate and dilute together. Two recessives, one in sixteen from double carriers.', show: [{ locus: 'locusB', alleles: ['b', 'b'] }, { locus: 'locusD', alleles: ['d', 'd'] }], colourText: 'lilac', labKey: 'colLilac' },
  { key: 'cocoa', label: 'Cocoa', group: 'colour', blurb: 'The French Bulldog brown (co/co): a darker, richer chocolate. Rare and recessive.', show: [{ locus: 'cocoa', alleles: ['co', 'co'] }], carry: { locus: 'cocoa', allele: 'co', label: 'cocoa' }, colourText: 'cocoa', labKey: 'colCocoa' },
  { key: 'red', label: 'Red / yellow', group: 'colour', blurb: 'Recessive red (e/e): all dark pigment switched off in the coat.', show: [{ locus: 'locusE', alleles: ['e', 'e'] }], carry: { locus: 'locusE', allele: 'e', label: 'recessive red / yellow' }, colourText: 'red', labKey: 'colRed' },
  { key: 'cream', label: 'Cream', group: 'colour', blurb: 'Recessive red faded to cream by the intensity gene. Two recessives.', show: [{ locus: 'locusE', alleles: ['e', 'e'] }, { locus: 'intensity', alleles: ['i', 'i'] }], carry: { locus: 'intensity', allele: 'i', label: 'cream' }, colourText: 'cream', labKey: 'colCream' },
  { key: 'dudley', label: 'Dudley', group: 'colour', blurb: 'Yellow or red over chocolate pigment: liver-pink nose, amber eyes (e/e and b/b).', show: [{ locus: 'locusE', alleles: ['e', 'e'] }, { locus: 'locusB', alleles: ['b', 'b'] }], colourText: 'dudley', labKey: 'colDudley' },
  { key: 'sable', label: 'Sable / fawn', group: 'colour', blurb: 'Fawn with dark tipping (a^y), nothing covering it.', show: [{ locus: 'locusA', alleles: ['ay', 'ay'] }, K_OFF, E_ON], carry: { locus: 'locusA', allele: 'ay', label: 'sable / fawn' }, colourText: 'fawn sable', labKey: 'colFawn' },
  { key: 'blueFawn', label: 'Blue fawn', group: 'colour', blurb: 'Fawn with dilute: a silvery fawn with a grey nose (a^y plus d/d).', show: [{ locus: 'locusA', alleles: ['ay', 'ay'] }, K_OFF, E_ON, { locus: 'locusD', alleles: ['d', 'd'] }], carry: { locus: 'locusD', allele: 'd', label: 'dilute (blue)' }, colourText: 'blue fawn', labKey: 'colBlueFawn' },
  { key: 'wolfSable', label: 'Wolf sable', group: 'colour', blurb: 'The wild banded coat (a^w): grey-brown with light undersides.', show: [{ locus: 'locusA', alleles: ['aw', 'aw'] }, K_OFF, E_ON], carry: { locus: 'locusA', allele: 'aw', label: 'wolf sable' }, colourText: 'wolf sable', labKey: 'colWolfSable' },
  { key: 'tan', label: 'Black and tan', group: 'colour', blurb: 'Tan points (a^t/a^t) with nothing covering them.', show: [{ locus: 'locusA', alleles: ['at', 'at'] }, K_OFF, E_ON], carry: { locus: 'locusA', allele: 'at', label: 'tan points' }, colourText: 'tan points', labKey: 'colTan' },
  { key: 'brindle', label: 'Brindle', group: 'colour', blurb: 'Stripes over fawn (k^br). Dominant over plain, hidden under dominant black.', show: [{ locus: 'locusK', alleles: ['kbr', 'kbr'] }, { locus: 'locusA', alleles: ['ay', 'ay'] }, E_ON], carry: { locus: 'locusK', allele: 'kbr', label: 'brindle' }, colourText: 'brindle', labKey: 'colBrindle' },
  // --- markings -----------------------------------------------------------
  { key: 'mask', label: 'Dark mask', group: 'marking', blurb: 'A black mask (E^m) on whatever colour the dog is. Dominant.', show: [{ locus: 'locusE', alleles: ['Em'] }], carry: { locus: 'locusE', allele: 'Em', label: 'dark mask' }, colourText: 'mask', labKey: 'mask' },
  { key: 'merle', label: 'Merle', group: 'marking', blurb: 'Dominant. One copy only, ever — never breed merle to merle.', show: [{ locus: 'merle', alleles: ['M'] }], carry: { locus: 'merle', allele: 'M', label: 'merle' }, colourText: 'merle', labKey: 'merle' },
  { key: 'harlequin', label: 'Harlequin', group: 'marking', blurb: 'Merle plus the harlequin modifier. Needs both, and never two harlequin copies.', show: [{ locus: 'merle', alleles: ['M'] }, { locus: 'harlequin', alleles: ['H'] }], carry: { locus: 'harlequin', allele: 'H', label: 'harlequin' }, colourText: 'harlequin', labKey: 'harlequin' },
  { key: 'piebald', label: 'Piebald', group: 'marking', blurb: 'Big white patches (s^p/s^p). Two copies for the full patchwork.', show: [{ locus: 'locusS', alleles: ['sp', 'sp'] }], carry: { locus: 'locusS', allele: 'sp', label: 'piebald' }, colourText: 'piebald', labKey: 'white' },
  { key: 'ticked', label: 'Ticked / roan', group: 'marking', blurb: 'Flecks of colour in the white (T). Needs white to show on.', show: [{ locus: 'ticking', alleles: ['T'] }, { locus: 'locusS', alleles: ['sp', 'sp'] }], carry: { locus: 'ticking', allele: 'T', label: 'ticking' }, colourText: 'ticked', labKey: 'ticking' },
  { key: 'blueEyes', label: 'Blue eyes', group: 'marking', blurb: 'The Husky blue-eye gene, one copy.', show: [{ locus: 'blueEyes', alleles: ['Be'] }], carry: { locus: 'blueEyes', allele: 'Be', label: 'blue eyes' }, colourText: 'blue eyes', labKey: 'blueEyes' },
  // --- coats --------------------------------------------------------------
  { key: 'longCoat', label: 'Long coat', group: 'coat', blurb: 'Two copies of long hair (l/l).', show: [{ locus: 'coatLength', alleles: ['l', 'l'] }], carry: { locus: 'coatLength', allele: 'l', label: 'long coat' }, labKey: 'coatSilky' },
  { key: 'curly', label: 'Curly', group: 'coat', blurb: 'Two copies of curl on a long coat.', show: [{ locus: 'curl', alleles: ['Cu', 'Cu'] }, { locus: 'coatLength', alleles: ['l', 'l'] }], carry: { locus: 'curl', allele: 'Cu', label: 'curl' }, labKey: 'coatCurly' },
  { key: 'wire', label: 'Wiry with beard', group: 'coat', blurb: 'Furnishings on a short coat.', show: [{ locus: 'furnishings', alleles: ['F', 'F'] }, { locus: 'coatLength', alleles: ['L', 'L'] }, { locus: 'curl', alleles: ['cu', 'cu'] }], carry: { locus: 'furnishings', allele: 'F', label: 'furnishings (beard)' }, labKey: 'coatWire' },
  { key: 'doubleCoat', label: 'Thick undercoat', group: 'coat', blurb: 'The weatherproof double coat (U).', show: [{ locus: 'undercoat', alleles: ['U', 'U'] }], carry: { locus: 'undercoat', allele: 'U', label: 'undercoat' }, labKey: 'doubleCoat' },
  { key: 'lowShed', label: 'Low shedding', group: 'coat', blurb: 'Two copies of the low-shedding gene (sh/sh).', show: [{ locus: 'shedding', alleles: ['sh', 'sh'] }], carry: { locus: 'shedding', allele: 'sh', label: 'low shedding' }, labKey: 'lowShed' },
  { key: 'hairless', label: 'Hairless', group: 'coat', blurb: 'One copy of dominant hairless (Hd).', show: [{ locus: 'hairlessDom', alleles: ['Hd'] }], carry: { locus: 'hairlessRec', allele: 'hr', label: 'hairless (recessive)' }, labKey: 'coatHairless' },
  // --- build --------------------------------------------------------------
  { key: 'shortLegs', label: 'Short legs', group: 'build', blurb: 'The Dachshund gene (Cd), two copies.', show: [{ locus: 'chondro', alleles: ['Cd', 'Cd'] }], carry: { locus: 'chondro', allele: 'Cd', label: 'short legs' }, labKey: 'shortLegs' },
  { key: 'bobtail', label: 'Bobtail', group: 'build', blurb: 'Natural bobtail (Bt), one copy.', show: [{ locus: 'bobtail', alleles: ['Bt'] }], carry: { locus: 'bobtail', allele: 'Bt', label: 'bobtail' }, labKey: 'tail_bob' },
];

export const TWIST_BY_KEY: Record<string, Twist> = Object.fromEntries(TWISTS.map((t) => [t.key, t]));

/** Colours and markings: the ones a "purebred with a twist" can ask for. */
export const COLOUR_TWISTS = TWISTS.filter((t) => t.group === 'colour' || t.group === 'marking');

/** Every hidden gene a specialist breeder can be asked for, one entry per gene. */
export const CARRIER_OPTIONS: { locus: string; allele: string; label: string }[] = (() => {
  const seen = new Set<string>();
  const out: { locus: string; allele: string; label: string }[] = [];
  for (const t of TWISTS) {
    if (!t.carry) continue;
    const id = `${t.carry.locus}:${t.carry.allele}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(t.carry);
  }
  return out;
})();
