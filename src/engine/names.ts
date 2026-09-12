/**
 * NAMING
 *
 * Every dog that has ever existed in a project — kennel dogs, puppies, dogs
 * placed in pet homes, retired dogs, dead dogs and outside dogs — goes into a
 * permanent registry. A name is never reused inside one project, so when you
 * read a ten-generation pedigree there is never any doubt who "Walter" was.
 */

const MALE_NAMES = [
  'Walter', 'Otis', 'Gus', 'Barnaby', 'Hugo', 'Finn', 'Rupert', 'Dexter', 'Milo', 'Arthur',
  'Ozzy', 'Cedric', 'Jasper', 'Bruno', 'Stanley', 'Percy', 'Alfie', 'Duncan', 'Wilbur', 'Monty',
  'Fergus', 'Harvey', 'Ridley', 'Oscar', 'Angus', 'Teddy', 'Rufus', 'Baxter', 'Casper', 'Lachlan',
  'Murphy', 'Bertie', 'Sullivan', 'Tobias', 'Winston', 'Gilbert', 'Rowan', 'Ellis', 'Malcolm', 'Griffin',
  'Desmond', 'Ambrose', 'Horace', 'Cormac', 'Fletcher', 'Emmett', 'Silas', 'Abel', 'Jonah', 'Linus',
  'Roscoe', 'Hollis', 'Tiberius', 'Ignatius', 'Lorcan', 'Padraig', 'Seamus', 'Callum', 'Torin', 'Bram',
  'Osgood', 'Merrick', 'Thatcher', 'Quill', 'Bartholomew', 'Lucian', 'Ignacio', 'Dmitri', 'Soren', 'Anders',
  'Magnus', 'Leopold', 'Florian', 'Cassius', 'Remus', 'Atticus', 'Orson', 'Barnes', 'Crawford', 'Hamish',
  'Alastair', 'Ewan', 'Niall', 'Declan', 'Ruaridh', 'Tavish', 'Kester', 'Errol', 'Wendell', 'Garrick',
  'Barrett', 'Chester', 'Dudley', 'Everett', 'Fenwick', 'Godfrey', 'Harlan', 'Isidore', 'Jethro', 'Kipling',
  'Ludo', 'Mortimer', 'Nigel', 'Oberon', 'Pascoe', 'Quentin', 'Reuben', 'Sterling', 'Thaddeus', 'Ulric',
  'Vernon', 'Wesley', 'Xavier', 'Yorick', 'Zachariah', 'Ambrose', 'Bellamy', 'Cassian', 'Darrow', 'Edmund',
];

const FEMALE_NAMES = [
  'Mabel', 'Juniper', 'Clover', 'Wren', 'Hazel', 'Maisie', 'Poppy', 'Bramble', 'Nell', 'Etta',
  'Winnie', 'Olive', 'Marigold', 'Fern', 'Cordelia', 'Tabitha', 'Rosalind', 'Delphine', 'Bridget', 'Agnes',
  'Ottoline', 'Sybil', 'Harriet', 'Primrose', 'Constance', 'Verity', 'Flora', 'Maeve', 'Saoirse', 'Niamh',
  'Bryony', 'Perpetua', 'Clementine', 'Beatrix', 'Dorothea', 'Edith', 'Freya', 'Greta', 'Ingrid', 'Linnea',
  'Sigrid', 'Thora', 'Astrid', 'Birgit', 'Elke', 'Romilly', 'Seraphina', 'Theodora', 'Ursula', 'Wilhelmina',
  'Xanthe', 'Yolanda', 'Zinnia', 'Araminta', 'Blythe', 'Cressida', 'Dilys', 'Eulalia', 'Fenella', 'Gwendolyn',
  'Honoria', 'Isolde', 'Jemima', 'Kitty', 'Lavinia', 'Millicent', 'Nerys', 'Ophelia', 'Petronella', 'Quilla',
  'Rhiannon', 'Susannah', 'Tamsin', 'Ulla', 'Violetta', 'Wilma', 'Yseult', 'Zelda', 'Annis', 'Bess',
  'Cicely', 'Daphne', 'Elspeth', 'Fionnuala', 'Georgiana', 'Hermione', 'Imogen', 'Josephine', 'Keziah', 'Lettice',
  'Morwenna', 'Nesta', 'Orla', 'Philippa', 'Rowena', 'Sorcha', 'Tilly', 'Una', 'Vesper', 'Willa',
  'Bluebell', 'Cherry', 'Damson', 'Elderflower', 'Foxglove', 'Gorse', 'Heather', 'Ivy', 'Jessamine', 'Kestrel',
  'Larkspur', 'Mallow', 'Nettle', 'Orchid', 'Plum', 'Quince', 'Rosehip', 'Sorrel', 'Thistle', 'Vetch',
];

const NEUTRAL_NAMES = [
  'Ash', 'Birch', 'Cove', 'Dune', 'Ember', 'Flint', 'Gale', 'Haven', 'Indigo', 'Juno',
  'Kite', 'Lark', 'Moss', 'North', 'Onyx', 'Pepper', 'Quarry', 'Rain', 'Slate', 'Tansy',
  'Umber', 'Vale', 'Willow', 'Yarrow', 'Zephyr', 'Aspen', 'Brook', 'Cinder', 'Delta', 'Echo',
  'Fable', 'Glimmer', 'Harbour', 'Isle', 'Juniper Grey', 'Kelp', 'Lumen', 'Marlow', 'Nimbus', 'Ode',
  'Pike', 'Quill Grey', 'Rye', 'Sable', 'Tide', 'Vesper Grey', 'Wick', 'Yonder', 'Zenith', 'Auburn',
  'Bracken', 'Cairn', 'Drift', 'Elm', 'Frost', 'Garnet', 'Hollow', 'Ink', 'Jetty', 'Kindling',
];

/** Used only if every single name in a pool has already been taken. */
const FALLBACK_PREFIXES = [
  'Little', 'Old', 'Young', 'Wild', 'Quiet', 'Bright', 'Storm', 'Copper', 'Winter', 'Summer',
  'Autumn', 'Spring', 'Morning', 'Evening', 'Silver', 'Golden', 'Rowan', 'Thistle', 'Harbour', 'Meadow',
];

export type Sex = 'M' | 'F';

export interface NameRegistry {
  /** Every name ever used in this project, lower-cased for comparison. */
  used: string[];
}

export function createNameRegistry(): NameRegistry {
  return { used: [] };
}

function taken(registry: NameRegistry, name: string): boolean {
  return registry.used.includes(name.trim().toLowerCase());
}

function claim(registry: NameRegistry, name: string): string {
  registry.used.push(name.trim().toLowerCase());
  return name;
}

interface NamePicker {
  /** Returns a random number from 0 up to (not including) 1. */
  next(): number;
}

/**
 * Pick a fresh name that fits the dog's sex. Sex-appropriate names are tried
 * first; neutral names are used as a backup; and if the project has run for so
 * long that everything is taken, names get a distinguishing prefix.
 */
export function pickName(registry: NameRegistry, sex: Sex, rng: NamePicker): string {
  const primary = sex === 'M' ? MALE_NAMES : FEMALE_NAMES;

  for (const pool of [primary, NEUTRAL_NAMES]) {
    const free = pool.filter((n) => !taken(registry, n));
    if (free.length > 0) {
      return claim(registry, free[Math.floor(rng.next() * free.length)]);
    }
  }

  // Everything is used. Combine a prefix with a base name until something new
  // turns up. The loop is bounded so it can never hang.
  for (let attempt = 0; attempt < 4000; attempt++) {
    const prefix = FALLBACK_PREFIXES[Math.floor(rng.next() * FALLBACK_PREFIXES.length)];
    const base = primary[Math.floor(rng.next() * primary.length)];
    const candidate = `${prefix} ${base}`;
    if (!taken(registry, candidate)) return claim(registry, candidate);
  }

  // Absolute last resort, guaranteed unique.
  return claim(registry, `Dog ${registry.used.length + 1}`);
}

/**
 * Validate a name the player typed in. Returns an error message, or null when
 * the name is acceptable.
 */
export function validateName(
  registry: NameRegistry,
  name: string,
  currentName?: string,
): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Please enter a name.';
  if (trimmed.length > 24) return 'Names must be 24 characters or fewer.';
  if (currentName && trimmed.toLowerCase() === currentName.trim().toLowerCase()) return null;
  if (taken(registry, trimmed)) return 'That name has already been used in this breeding project.';
  return null;
}

/** Apply a manual rename, releasing the old name is deliberately NOT done. */
export function registerName(registry: NameRegistry, name: string): void {
  const key = name.trim().toLowerCase();
  if (!registry.used.includes(key)) registry.used.push(key);
}

export const NAME_POOL_SIZE = MALE_NAMES.length + FEMALE_NAMES.length + NEUTRAL_NAMES.length;
