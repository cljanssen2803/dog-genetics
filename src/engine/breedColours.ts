/**
 * BREED-STANDARD COLOUR GENETICS
 *
 * What colours each breed actually comes in, written as gene frequencies so
 * that founders drawn from a breed look like that breed. An English Mastiff
 * is fawn, apricot or brindle, always with a black mask, never with white;
 * a Samoyed is white; a Dalmatian is white with spots. Before this table the
 * breeds shared loose defaults and a Poodle could turn up piebald.
 *
 * These tables override the colour genes in the main breed table (breeds.ts)
 * for the loci they list. Anything not listed keeps whatever the breed had.
 *
 * Shorthand: see the constants at the top. Frequencies are per gene copy, so
 * { KB: 0.5, ky: 0.5 } means a quarter of dogs are ky/ky, not half.
 */

type Table = Record<string, Record<string, number>>;

// Extension (MC1R): mask / normal / recessive red
const E_SOLID = { Em: 0, E: 1, e: 0 };
const E_MASK = { Em: 0.92, E: 0.08, e: 0 };
const E_RED = { Em: 0, E: 0, e: 1 };
const E = (Em: number, e: number) => ({ Em, E: Math.max(0, 1 - Em - e), e });

// K locus: dominant black / brindle / none
const K_BLACK = { KB: 1, kbr: 0, ky: 0 };
const K_NONE = { KB: 0, kbr: 0, ky: 1 };
const K = (KB: number, kbr: number) => ({ KB, kbr, ky: Math.max(0, 1 - KB - kbr) });

// A locus: fawn sable / wolf sable / tan points / recessive black
const A_FAWN = { ay: 1, aw: 0, at: 0, a: 0 };
const A_TAN = { ay: 0, aw: 0, at: 1, a: 0 };
const A_WOLF = { ay: 0, aw: 1, at: 0, a: 0 };
const A = (ay: number, aw: number, at: number) => ({ ay, aw, at, a: Math.max(0, 1 - ay - aw - at) });

// White spotting, ticking, brown, dilute, intensity, merle, harlequin
const S_NONE = { S: 1, sp: 0 };
const S_PIED = { S: 0, sp: 1 };
const S = (sp: number) => ({ S: 1 - sp, sp });
const T_NONE = { T: 0, t: 1 };
const T_ALL = { T: 1, t: 0 };
const T = (t: number) => ({ T: t, t: 1 - t });
const B_BLACK = { B: 1, b: 0 };
const B_BROWN = { B: 0, b: 1 };
const B = (b: number) => ({ B: 1 - b, b });
const D_FULL = { D: 1, d: 0 };
const D_DILUTE = { D: 0, d: 1 };
const D = (d: number) => ({ D: 1 - d, d });
const I_DEEP = { I: 1, i: 0 };
const I_PALE = { I: 0, i: 1 };
const I_MIX = { I: 0.55, i: 0.45 };
const M_NONE = { M: 0, m: 1 };
const M = (m: number) => ({ M: m, m: 1 - m });
const NO_WHITE = { locusS: S_NONE, ticking: T_NONE };
const WHITE_DOG = { locusE: E_RED, intensity: I_PALE, locusS: S_NONE, ticking: T_NONE, locusK: K_BLACK, locusB: B_BLACK, locusD: D_FULL };

const SIGHTHOUND_ANY = { locusE: E(0.1, 0.25), locusK: K(0.25, 0.15), locusA: A_FAWN, locusS: S(0.5), ticking: T_NONE, locusB: B(0.05), locusD: D(0.2), intensity: I_MIX };
const BULL_ANY = { locusE: E(0.1, 0.2), locusK: K(0.25, 0.15), locusA: A_FAWN, locusS: S(0.5), ticking: T_NONE, locusB: B(0.1), locusD: D(0.15), intensity: I_MIX };
const TERRIER_PIED = { locusE: E(0, 0.15), locusK: K(0.5, 0), locusA: A(0.4, 0, 0.6), locusS: S_PIED, ticking: T(0.3), locusB: B(0.15), locusD: D(0.2), intensity: I_DEEP };

export const BREED_COLOURS: Record<string, Table> = {
  // Solid colours only: black, white, apricot, red, cream, brown, silver.
  poodleStandard: { locusE: E(0, 0.45), locusK: K(0.6, 0), locusA: A_FAWN, ...NO_WHITE, locusB: B(0.2), locusD: D(0.15), intensity: I_MIX },
  poodleMini: { locusE: E(0, 0.45), locusK: K(0.6, 0), locusA: A_FAWN, ...NO_WHITE, locusB: B(0.2), locusD: D(0.15), intensity: I_MIX },
  bichon: WHITE_DOG,
  // Blenheim, tricolour, ruby, black and tan.
  cavalier: { locusE: E(0, 0.5), locusK: K_NONE, locusA: A_TAN, locusS: S(0.6), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  pug: { locusE: E(0.85, 0), locusK: K(0.25, 0), locusA: A_FAWN, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_MIX },
  frenchie: { locusE: E(0.5, 0.2), locusK: K(0.05, 0.3), locusA: A_FAWN, locusS: S(0.4), ticking: T_NONE, locusB: B(0.1), locusD: D(0.15), intensity: I_MIX },
  boston: { locusE: E_SOLID, locusK: K(0.7, 0.15), locusA: A_FAWN, locusS: S(0.7), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL },
  shihTzu: { locusE: E(0.3, 0.2), locusK: K(0.35, 0.05), locusA: A_FAWN, locusS: S(0.6), ticking: T_NONE, locusB: B(0.15), locusD: D_FULL, intensity: I_MIX },
  maltese: WHITE_DOG,
  // Black and tan, going steel-blue as an adult (written here as dilute).
  yorkie: { locusE: E_SOLID, locusK: K_NONE, locusA: A_TAN, ...NO_WHITE, locusB: B_BLACK, locusD: D(0.6), intensity: I_DEEP },
  pomeranian: { locusE: E(0, 0.4), locusK: K(0.25, 0), locusA: A(0.8, 0, 0.2), locusS: S(0.15), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I(0.3) },
  papillon: { locusE: E(0, 0.3), locusK: K(0.4, 0), locusA: A(0.4, 0, 0.6), locusS: S_PIED, ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  chihuahua: { locusE: E(0.15, 0.3), locusK: K(0.15, 0.05), locusA: A(0.5, 0, 0.3), locusS: S(0.4), ticking: T(0.05), locusB: B(0.15), locusD: D(0.15), intensity: I_MIX, merle: M_NONE },
  italianGreyhound: { locusE: E(0, 0.5), locusK: K(0.6, 0), locusA: A_FAWN, locusS: S(0.5), ticking: T_NONE, locusB: B_BLACK, locusD: D(0.4), intensity: I_MIX },
  // Salt and pepper, black and silver, black.
  miniSchnauzer: { locusE: E_SOLID, locusK: K(0.3, 0), locusA: A(0, 0.65, 0.25), ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_PALE },
  jackRussell: { locusE: E(0, 0.3), locusK: K(0.4, 0), locusA: A(0.6, 0, 0.4), locusS: S_PIED, ticking: T(0.2), locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  ratTerrier: TERRIER_PIED,
  norwich: { locusE: E(0, 0.3), locusK: K_NONE, locusA: A(0.6, 0.1, 0.3), ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  staffie: BULL_ANY,
  schipperke: { locusE: E_SOLID, locusK: K_BLACK, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL },
  // Black, yellow, chocolate. Never white.
  labrador: { locusE: E(0, 0.35), locusK: K_BLACK, ...NO_WHITE, locusB: B(0.25), locusD: D(0.03), intensity: I_MIX },
  golden: { locusE: E_RED, locusK: K_BLACK, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I(0.4), curl: { Cu: 0.08, cu: 0.92 } },
  cocker: { locusE: E(0, 0.4), locusK: K(0.7, 0), locusA: A(0.4, 0, 0.6), locusS: S(0.5), ticking: T(0.5), locusB: B(0.2), locusD: D_FULL, intensity: I_MIX },
  // Orange and white, liver and white.
  brittany: { locusE: E(0, 0.85), locusK: K(0.7, 0), locusA: A_FAWN, locusS: S_PIED, ticking: T(0.5), locusB: B(0.5), locusD: D_FULL, intensity: I_DEEP },
  portugueseWater: { locusE: E(0, 0.1), locusK: K_BLACK, locusS: S(0.4), ticking: T_NONE, locusB: B(0.25), locusD: D_FULL },
  borderCollie: { locusE: E_SOLID, locusK: K(0.75, 0), locusA: A(0.1, 0, 0.3), locusS: S(0.6), ticking: T_NONE, locusB: B(0.15), locusD: D_FULL, merle: M(0.1) },
  ausShepherd: { locusE: E_SOLID, locusK: K(0.6, 0), locusA: A(0, 0, 0.8), locusS: S(0.6), ticking: T_NONE, locusB: B(0.3), locusD: D_FULL, merle: M(0.3) },
  // Black and tan saddle, sable, black. No white.
  gsd: { locusE: E(0.4, 0), locusK: K(0.08, 0), locusA: A(0, 0.35, 0.6), ...NO_WHITE, locusB: B_BLACK, locusD: D(0.03), intensity: I_DEEP },
  malinois: { locusE: E(0.95, 0), locusK: K_NONE, locusA: A_FAWN, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  corgi: { locusE: E_SOLID, locusK: K_NONE, locusA: A(0.75, 0, 0.25), locusS: S(0.6), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  dachshund: { locusE: E(0, 0.2), locusK: K(0.05, 0.08), locusA: A(0.4, 0.1, 0.5), ...NO_WHITE, locusB: B(0.2), locusD: D(0.1), merle: M(0.1), intensity: I_DEEP },
  beagle: { locusE: E(0, 0.1), locusK: K_NONE, locusA: A(0.15, 0, 0.85), locusS: S_PIED, ticking: T(0.3), locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  greyhound: SIGHTHOUND_ANY,
  whippet: SIGHTHOUND_ANY,
  basenji: { locusE: E_SOLID, locusK: K(0.3, 0.12), locusA: A(0.7, 0, 0.3), locusS: S(0.5), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  // Red, sesame, black and tan, cream. Urajiro is not the white gene.
  shiba: { locusE: E(0, 0.1), locusK: K_NONE, locusA: A(0.7, 0.1, 0.2), ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I(0.2) },
  husky: { locusE: E(0, 0.1), locusK: K(0.2, 0), locusA: A(0.1, 0.6, 0.3), locusS: S_PIED, ticking: T_NONE, locusB: B(0.15), locusD: D_FULL, intensity: I(0.5) },
  malamute: { locusE: E_SOLID, locusK: K(0.15, 0), locusA: A(0.1, 0.7, 0.2), locusS: S_PIED, ticking: T_NONE, locusB: B(0.1), locusD: D_FULL, intensity: I(0.7) },
  samoyed: WHITE_DOG,
  // Fawn, brindle, black, blue, harlequin, merle, mantle.
  greatDane: { locusE: E(0.6, 0), locusK: K(0.25, 0.12), locusA: A_FAWN, locusS: S(0.3), ticking: T_NONE, locusB: B_BLACK, locusD: D(0.15), merle: M(0.2), harlequin: { H: 0.15, h: 0.85 }, intensity: I_MIX },
  newfoundland: { locusE: E_SOLID, locusK: K_BLACK, locusS: S(0.25), ticking: T_NONE, locusB: B(0.15), locusD: D(0.05) },
  stBernard: { locusE: E(0.7, 0), locusK: K_NONE, locusA: A_FAWN, locusS: S_PIED, ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  bernese: { locusE: E_SOLID, locusK: K_NONE, locusA: A_TAN, locusS: S(0.5), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  irishWolfhound: { locusE: E(0, 0.2), locusK: K(0.15, 0.3), locusA: A(0.5, 0.5, 0), ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_MIX },
  doberman: { locusE: E_SOLID, locusK: K_NONE, locusA: A_TAN, ...NO_WHITE, locusB: B(0.15), locusD: D(0.1), intensity: I_DEEP },
  rottweiler: { locusE: E_SOLID, locusK: K_NONE, locusA: A_TAN, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  chineseCrested: { locusE: E(0, 0.3), locusK: K(0.4, 0), locusA: A(0.5, 0, 0.3), locusS: S(0.6), ticking: T_NONE, locusB: B(0.15), locusD: D(0.2), intensity: I_MIX },
  xolo: { locusE: E(0, 0.15), locusK: K(0.7, 0), locusA: A(0.6, 0, 0), ...NO_WHITE, locusB: B(0.2), locusD: D(0.4) },
  americanHairless: TERRIER_PIED,
  // Fawn or brindle with a black mask, flashy white. Never black.
  boxer: { locusE: E_MASK, locusK: K(0, 0.3), locusA: A_FAWN, locusS: S(0.45), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  bulldog: { locusE: E(0.4, 0.2), locusK: K(0.02, 0.3), locusA: A_FAWN, locusS: S(0.6), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_MIX },
  amstaff: BULL_ANY,
  caneCorso: { locusE: E(0.6, 0), locusK: K(0.45, 0.15), locusA: A_FAWN, ...NO_WHITE, locusB: B_BLACK, locusD: D(0.3), intensity: I_MIX },
  greatPyrenees: WHITE_DOG,
  akita: { locusE: E(0.5, 0.1), locusK: K(0.15, 0.15), locusA: A(0.7, 0.2, 0.1), locusS: S(0.5), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_MIX },
  chow: { locusE: E(0, 0.5), locusK: K(0.5, 0), locusA: A_FAWN, ...NO_WHITE, locusB: B(0.15), locusD: D(0.2), intensity: I_MIX },
  dalmatian: { locusE: E_SOLID, locusK: K_BLACK, locusS: S_PIED, ticking: T_ALL, locusB: B(0.2), locusD: D_FULL },
  vizsla: { locusE: E_RED, locusK: K_BLACK, ...NO_WHITE, locusB: B_BROWN, locusD: D_FULL, intensity: I_DEEP },
  weimaraner: { locusE: E_SOLID, locusK: K_BLACK, ...NO_WHITE, locusB: B_BROWN, locusD: D_DILUTE },
  springer: { locusE: E_SOLID, locusK: K_BLACK, locusS: S_PIED, ticking: T(0.4), locusB: B(0.5), locusD: D_FULL },
  // Blue (black ticked through white) or red speckle.
  cattleDog: { locusE: E_SOLID, locusK: K(0.5, 0), locusA: A(0.5, 0, 0.5), locusS: S_PIED, ticking: T(0.5), locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  sheltie: { locusE: E_SOLID, locusK: K(0.2, 0), locusA: A(0.55, 0, 0.45), locusS: S(0.55), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, merle: M(0.2), intensity: I_DEEP },
  roughCollie: { locusE: E_SOLID, locusK: K(0.2, 0), locusA: A(0.55, 0, 0.45), locusS: S(0.55), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, merle: M(0.2), intensity: I_DEEP },
  oes: { locusE: E_SOLID, locusK: K_BLACK, locusS: S_PIED, ticking: T_NONE, locusB: B_BLACK, locusD: D(0.6) },
  havanese: { locusE: E(0, 0.4), locusK: K(0.4, 0.1), locusA: A(0.5, 0, 0.3), locusS: S(0.5), ticking: T_NONE, locusB: B(0.15), locusD: D_FULL, intensity: I_MIX },
  pekingese: { locusE: E(0.7, 0), locusK: K(0.25, 0), locusA: A_FAWN, locusS: S(0.2), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_MIX },
  minPin: { locusE: E(0, 0.2), locusK: K_NONE, locusA: A(0.55, 0, 0.45), ...NO_WHITE, locusB: B(0.15), locusD: D_FULL, intensity: I_DEEP },
  scottie: { locusE: E(0, 0.15), locusK: K(0.6, 0.2), locusA: A_FAWN, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_MIX },
  westie: WHITE_DOG,
  cairn: { locusE: E(0, 0.2), locusK: K(0, 0.25), locusA: A(0.7, 0.3, 0), ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_MIX },
  borderTerrier: { locusE: E(0.3, 0), locusK: K_NONE, locusA: A(0.5, 0.4, 0.1), ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  airedale: { locusE: E_SOLID, locusK: K_NONE, locusA: A_TAN, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  bullTerrier: { locusE: E(0, 0.2), locusK: K(0.15, 0.2), locusA: A(0.7, 0, 0.3), locusS: S(0.7), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_MIX },
  sharPei: { locusE: E(0, 0.5), locusK: K(0.4, 0), locusA: A_FAWN, ...NO_WHITE, locusB: B(0.2), locusD: D(0.2), intensity: I_MIX },
  basset: { locusE: E(0, 0.3), locusK: K_NONE, locusA: A(0.3, 0, 0.7), locusS: S_PIED, ticking: T(0.25), locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  bloodhound: { locusE: E(0, 0.2), locusK: K_NONE, locusA: A(0.25, 0, 0.75), ...NO_WHITE, locusB: B(0.2), locusD: D_FULL, intensity: I_DEEP },
  afghan: { locusE: E(0.5, 0.1), locusK: K(0.3, 0.1), locusA: A(0.7, 0.1, 0.2), ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_MIX },
  ridgeback: { locusE: E(0.5, 0), locusK: K_NONE, locusA: A_FAWN, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  // Fawn, apricot or brindle, always masked, never white, never black.
  mastiff: { locusE: E(0.98, 0), locusK: K(0, 0.18), locusA: A_FAWN, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_MIX },
  leonberger: { locusE: E(0.95, 0), locusK: K_NONE, locusA: A_FAWN, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I(0.15) },
  keeshond: { locusE: E_SOLID, locusK: K_NONE, locusA: A_WOLF, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_PALE },
  lhasa: { locusE: E(0, 0.5), locusK: K(0.35, 0), locusA: A(0.7, 0, 0.3), locusS: S(0.4), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_MIX },
  coton: WHITE_DOG,
  griffon: { locusE: E(0.4, 0), locusK: K(0.35, 0), locusA: A(0.6, 0, 0.4), ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  japaneseChin: { locusE: E(0, 0.25), locusK: K_BLACK, locusS: S_PIED, ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  giantSchnauzer: { locusE: E_SOLID, locusK: K(0.75, 0), locusA: A(0, 0.9, 0), ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_PALE },
  lagotto: { locusE: E(0, 0.5), locusK: K_BLACK, locusS: S(0.6), ticking: T(0.4), locusB: B(0.6), locusD: D_FULL, intensity: I(0.5) },
  chessie: { locusE: E(0, 0.5), locusK: K_BLACK, ...NO_WHITE, locusB: B_BROWN, locusD: D_FULL, intensity: I_MIX },
  toller: { locusE: E_RED, locusK: K_BLACK, locusS: S(0.5), ticking: T_NONE, locusB: B(0.4), locusD: D_FULL, intensity: I_DEEP },
  // --- added 2026-09-13 ---
  irishSetter: { locusE: E_RED, locusK: K_BLACK, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  englishSetter: { locusE: E(0, 0.3), locusK: K(0.7, 0), locusA: A(0.3, 0, 0.7), locusS: S_PIED, ticking: T(0.5), locusB: B(0.2), locusD: D_FULL, intensity: I_DEEP },
  gsp: { locusE: E_SOLID, locusK: K_BLACK, locusS: S_PIED, ticking: T(0.6), locusB: B(0.85), locusD: D_FULL },
  pointer: { locusE: E(0, 0.4), locusK: K_BLACK, locusS: S_PIED, ticking: T(0.4), locusB: B(0.5), locusD: D_FULL, intensity: I_DEEP },
  flatCoat: { locusE: E_SOLID, locusK: K_BLACK, ...NO_WHITE, locusB: B(0.15), locusD: D_FULL },
  clumber: WHITE_DOG,
  irishWaterSpaniel: { locusE: E_SOLID, locusK: K_BLACK, ...NO_WHITE, locusB: B_BROWN, locusD: D_FULL },
  borzoi: { locusE: E(0.1, 0.3), locusK: K(0.3, 0.1), locusA: A(0.6, 0, 0.2), locusS: S(0.6), ticking: T_NONE, locusB: B(0.05), locusD: D(0.05), intensity: I_MIX },
  saluki: { locusE: E(0.2, 0.3), locusK: K(0.15, 0), locusA: A(0.6, 0, 0.3), locusS: S(0.4), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_MIX },
  pharaoh: { locusE: E_SOLID, locusK: K_NONE, locusA: A_FAWN, locusS: S(0.3), ticking: T_NONE, locusB: B_BROWN, locusD: D_FULL, intensity: I_DEEP },
  redbone: { locusE: E_RED, locusK: K_BLACK, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  bluetick: { locusE: E_SOLID, locusK: K_NONE, locusA: A_TAN, locusS: S_PIED, ticking: T(0.6), locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  bullmastiff: { locusE: E_MASK, locusK: K(0, 0.3), locusA: A_FAWN, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  tibetanMastiff: { locusE: E_SOLID, locusK: K(0.4, 0), locusA: A(0.1, 0, 0.7), ...NO_WHITE, locusB: B(0.1), locusD: D_FULL, intensity: I_DEEP },
  dogo: WHITE_DOG,
  swissMountain: { locusE: E_SOLID, locusK: K_NONE, locusA: A_TAN, locusS: S(0.5), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  beardedCollie: { locusE: E_SOLID, locusK: K(0.6, 0), locusA: A(0.3, 0, 0.3), locusS: S(0.5), ticking: T_NONE, locusB: B(0.4), locusD: D(0.4), intensity: I_MIX },
  cardigan: { locusE: E_SOLID, locusK: K(0.3, 0.15), locusA: A(0.4, 0, 0.6), locusS: S(0.5), ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, merle: M(0.25), intensity: I_DEEP },
  bouvier: { locusE: E_SOLID, locusK: K(0.6, 0.3), locusA: A(0.2, 0.6, 0.2), ...NO_WHITE, locusB: B_BLACK, locusD: D(0.2), intensity: I_PALE },
  kelpie: { locusE: E_SOLID, locusK: K(0.5, 0), locusA: A(0.2, 0, 0.6), ...NO_WHITE, locusB: B(0.4), locusD: D(0.2), intensity: I_DEEP },
  dutchShepherd: { locusE: E(0.2, 0), locusK: K(0, 0.9), locusA: A_FAWN, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_MIX },
  tervuren: { locusE: E(0.9, 0), locusK: K_NONE, locusA: A_FAWN, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  elkhound: { locusE: E_SOLID, locusK: K_NONE, locusA: A_WOLF, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_PALE },
  americanEskimo: WHITE_DOG,
  finnishSpitz: { locusE: E_RED, locusK: K_BLACK, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  wireFox: { locusE: E(0, 0.3), locusK: K(0.5, 0), locusA: A(0.3, 0, 0.7), locusS: S_PIED, ticking: T_NONE, locusB: B_BLACK, locusD: D_FULL, intensity: I_DEEP },
  kerryBlue: { locusE: E_SOLID, locusK: K_BLACK, ...NO_WHITE, locusB: B_BLACK, locusD: D_DILUTE },
  wheaten: { locusE: E_RED, locusK: K_BLACK, ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I(0.6) },
  bedlington: { locusE: E_SOLID, locusK: K_BLACK, ...NO_WHITE, locusB: B(0.3), locusD: D(0.7) },
  standardSchnauzer: { locusE: E_SOLID, locusK: K(0.6, 0), locusA: A(0, 0.9, 0), ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL, intensity: I_PALE },
  affenpinscher: { locusE: E_SOLID, locusK: K(0.8, 0), locusA: A(0.5, 0, 0.5), ...NO_WHITE, locusB: B_BLACK, locusD: D_FULL },
  silky: { locusE: E_SOLID, locusK: K_NONE, locusA: A_TAN, ...NO_WHITE, locusB: B_BLACK, locusD: D(0.6), intensity: I_DEEP },
  toyPoodle: { locusE: E(0, 0.45), locusK: K(0.6, 0), locusA: A_FAWN, ...NO_WHITE, locusB: B(0.2), locusD: D(0.15), intensity: I_MIX },
};

function I(i: number) {
  return { I: 1 - i, i };
}

/** Breeds whose long coats are silky rather than plush, whatever the default says. */
export const SINGLE_COATED = [
  'cavalier', 'papillon', 'cocker', 'springer', 'brittany', 'lhasa', 'pekingese', 'japaneseChin', 'griffon',
  'shihTzu', 'basenji', 'miniSchnauzer', 'giantSchnauzer', 'jackRussell', 'ratTerrier', 'minPin', 'airedale', 'borderTerrier',
];
