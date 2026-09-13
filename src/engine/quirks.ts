/**
 * QUIRKS
 *
 * Small, harmless personality habits — sleeps upside down, steals socks, has
 * declared war on the vacuum cleaner. They have no effect on scores or
 * breeding. They exist because a dog with habits is a dog you can picture,
 * and a stat block is not.
 *
 * The twist: every quirk is INHERITED. Each one sits on its own hidden gene,
 * passed down through exactly the same machinery as coat colour. Some quirks
 * need only one copy to show ("dominant"), so they run visibly through a
 * family. Others need two copies ("recessive"), so they vanish for a
 * generation and reappear in a grandchild from nowhere — which is the fun.
 *
 * Quirks also reveal themselves at different ages. A puppy's sleeping habit is
 * obvious at eight weeks; whether it turns out to be a natural swimmer takes a
 * year to find out. So a dog keeps surprising you as it grows.
 *
 * Nerd Mode shows the genes. Normal play just shows the habit.
 */

import type { Genotype } from './loci';

export interface QuirkDef {
  key: string;
  /** Gene name shown in Nerd Mode. Deliberately mock-scientific. */
  gene: string;
  /** How the habit reads on a dog. {name}, {he}, {she}, {his}, {her} are filled in. */
  text: string;
  /** One copy shows, or two needed. */
  mode: 'dominant' | 'recessive';
  /** Age in months at which the habit becomes obvious. */
  revealAt: number;
  /** How common the gene is in the general population. */
  frequency: number;
}

export const QUIRKS: QuirkDef[] = [
  // --- visible early: sleep and play ----------------------------------
  { key: 'q_upsideDown', gene: 'SNZ-1', text: 'Sleeps flat on {his} back with all four legs in the air.', mode: 'recessive', revealAt: 2, frequency: 0.32 },
  { key: 'q_nester', gene: 'NST-2', text: 'Rearranges every blanket into a nest before lying down.', mode: 'recessive', revealAt: 3, frequency: 0.3 },
  { key: 'q_dreamer', gene: 'REM-4', text: 'Dreams loudly — twitching, yipping, running in {his} sleep.', mode: 'recessive', revealAt: 2, frequency: 0.34 },
  { key: 'q_sockThief', gene: 'SOK-1', text: 'Steals socks and hides them under the bed. Never chews them.', mode: 'dominant', revealAt: 4, frequency: 0.09 },
  { key: 'q_headTilt', gene: 'TLT-3', text: 'Tilts {his} head at every new word.', mode: 'dominant', revealAt: 3, frequency: 0.1 },
  { key: 'q_sneezer', gene: 'ACH-1', text: 'Sneezes when excited.', mode: 'dominant', revealAt: 3, frequency: 0.08 },
  { key: 'q_zoomies', gene: 'ZMS-9', text: 'Runs flat-out laps of the garden at nine o’clock every evening.', mode: 'dominant', revealAt: 4, frequency: 0.11 },
  { key: 'q_tailChaser', gene: 'SPN-2', text: 'Still chases {his} own tail well into adulthood.', mode: 'recessive', revealAt: 6, frequency: 0.28 },
  { key: 'q_toyHoarder', gene: 'HRD-1', text: 'Keeps every toy in one pile and guards it, politely.', mode: 'recessive', revealAt: 5, frequency: 0.26 },
  { key: 'q_shoeCarrier', gene: 'SHU-1', text: 'Carries one shoe around the house. Only ever one.', mode: 'dominant', revealAt: 5, frequency: 0.07 },

  // --- the world outside ------------------------------------------------
  { key: 'q_hooverWar', gene: 'VAC-1', text: 'Has declared personal war on the vacuum cleaner.', mode: 'dominant', revealAt: 5, frequency: 0.12 },
  { key: 'q_postman', gene: 'PST-1', text: 'Regards the postman as a lifelong enemy, and the postman only.', mode: 'dominant', revealAt: 7, frequency: 0.1 },
  { key: 'q_wetGrass', gene: 'DRY-2', text: 'Refuses to walk on wet grass.', mode: 'recessive', revealAt: 8, frequency: 0.3 },
  { key: 'q_rainHater', gene: 'DRY-1', text: 'Will not go out in the rain under any circumstances.', mode: 'dominant', revealAt: 6, frequency: 0.09 },
  { key: 'q_puddleLover', gene: 'MUD-1', text: 'Lies down in every puddle {he} passes.', mode: 'recessive', revealAt: 6, frequency: 0.27 },
  { key: 'q_stickCollector', gene: 'STK-1', text: 'Brings a stick home from every single walk.', mode: 'recessive', revealAt: 8, frequency: 0.3 },
  { key: 'q_squirrels', gene: 'SQL-1', text: 'Sits at the window for hours, watching squirrels.', mode: 'dominant', revealAt: 6, frequency: 0.1 },
  { key: 'q_sirenSinger', gene: 'HWL-2', text: 'Howls along with sirens, in tune.', mode: 'dominant', revealAt: 9, frequency: 0.08 },
  { key: 'q_digger', gene: 'DIG-1', text: 'Digs one fresh hole every day. Always in a new place.', mode: 'dominant', revealAt: 7, frequency: 0.1 },
  { key: 'q_swimmer', gene: 'SWM-1', text: 'A natural swimmer. Went straight in the first time and never looked back.', mode: 'recessive', revealAt: 12, frequency: 0.28 },
  { key: 'q_bathLover', gene: 'TUB-1', text: 'Loves baths. Climbs into the tub uninvited.', mode: 'recessive', revealAt: 10, frequency: 0.2 },
  { key: 'q_snowDog', gene: 'SNW-1', text: 'Goes completely wild at the first snow of the year.', mode: 'dominant', revealAt: 12, frequency: 0.09 },

  // --- with people ------------------------------------------------------
  { key: 'q_leaner', gene: 'LNR-1', text: 'Leans {his} whole weight against your legs when standing next to you.', mode: 'dominant', revealAt: 8, frequency: 0.11 },
  { key: 'q_lapDog', gene: 'LAP-1', text: 'Believes {he} is a lap dog, regardless of size.', mode: 'dominant', revealAt: 10, frequency: 0.1 },
  { key: 'q_grinner', gene: 'GRN-1', text: 'Greets people with a full-toothed grin that alarms strangers.', mode: 'recessive', revealAt: 9, frequency: 0.18 },
  { key: 'q_talker', gene: 'GRM-3', text: 'Grumbles and mutters when asked to do anything.', mode: 'dominant', revealAt: 10, frequency: 0.09 },
  { key: 'q_doorWatcher', gene: 'WCH-1', text: 'Sits facing the front door until everyone is home.', mode: 'recessive', revealAt: 12, frequency: 0.26 },
  { key: 'q_earlyRiser', gene: 'DWN-1', text: 'Wakes the whole house at dawn. Every day. Cheerfully.', mode: 'dominant', revealAt: 6, frequency: 0.1 },
  { key: 'q_catFriend', gene: 'CAT-1', text: 'Adores cats, to the cats’ lasting confusion.', mode: 'recessive', revealAt: 9, frequency: 0.22 },
  { key: 'q_sunbather', gene: 'SOL-1', text: 'Follows the sunny patch around the room all day.', mode: 'dominant', revealAt: 4, frequency: 0.12 },
  { key: 'q_bedHog', gene: 'BED-1', text: 'Sleeps diagonally across the entire bed.', mode: 'recessive', revealAt: 12, frequency: 0.3 },
  { key: 'q_snorer', gene: 'SNR-1', text: 'Snores like a small engine.', mode: 'recessive', revealAt: 14, frequency: 0.28 },
  { key: 'q_gentleMouth', gene: 'GNT-1', text: 'Carries eggs in {his} mouth without breaking them. Nobody taught {him}.', mode: 'recessive', revealAt: 14, frequency: 0.15 },
  { key: 'q_counterSurfer', gene: 'CTR-1', text: 'Can reach any kitchen counter, and knows it.', mode: 'dominant', revealAt: 11, frequency: 0.08 },
];

export const QUIRK_BY_KEY: Record<string, QuirkDef> = Object.fromEntries(QUIRKS.map((q) => [q.key, q]));

/** Whether this dog carries enough copies of the quirk gene to show it. */
export function hasQuirk(genotype: Genotype, quirk: QuirkDef): boolean {
  const pair = genotype[quirk.key];
  if (!pair) return false;
  const copies = (pair[0] === 'Q' ? 1 : 0) + (pair[1] === 'Q' ? 1 : 0);
  return quirk.mode === 'dominant' ? copies >= 1 : copies === 2;
}

/** Carries one copy of a recessive quirk without showing it. */
export function carriesQuirk(genotype: Genotype, quirk: QuirkDef): boolean {
  const pair = genotype[quirk.key];
  if (!pair) return false;
  const copies = (pair[0] === 'Q' ? 1 : 0) + (pair[1] === 'Q' ? 1 : 0);
  return quirk.mode === 'recessive' && copies === 1;
}

/** Fill the pronouns into a quirk's text. */
export function quirkText(quirk: QuirkDef, name: string, sex: 'M' | 'F'): string {
  const he = sex === 'M' ? 'he' : 'she';
  const his = sex === 'M' ? 'his' : 'her';
  const him = sex === 'M' ? 'him' : 'her';
  return quirk.text
    .replace(/\{name\}/g, name)
    .replace(/\{he\}/g, he)
    .replace(/\{his\}/g, his)
    .replace(/\{him\}/g, him)
    .replace(/\{her\}/g, sex === 'M' ? 'his' : 'her')
    .replace(/\{she\}/g, he);
}

/**
 * The quirks a dog is showing at its current age. Quirks it carries but has
 * not yet grown into are deliberately left out — that is the surprise.
 */
export function visibleQuirks(genotype: Genotype, ageMonths: number): QuirkDef[] {
  return QUIRKS.filter((q) => ageMonths >= q.revealAt && hasQuirk(genotype, q));
}

/** Quirks the dog has but is too young to have shown yet. Nerd Mode only. */
export function pendingQuirks(genotype: Genotype, ageMonths: number): QuirkDef[] {
  return QUIRKS.filter((q) => ageMonths < q.revealAt && hasQuirk(genotype, q));
}

/**
 * For a planned litter: which quirks could appear, and roughly how likely.
 * Same Mendelian sums as the disease calculator, because it is the same
 * biology.
 */
export function quirkOdds(sire: Genotype, dam: Genotype): { quirk: QuirkDef; chance: number }[] {
  const out: { quirk: QuirkDef; chance: number }[] = [];
  for (const q of QUIRKS) {
    const s = sire[q.key];
    const d = dam[q.key];
    if (!s || !d) continue;
    const ps = ((s[0] === 'Q' ? 1 : 0) + (s[1] === 'Q' ? 1 : 0)) / 2;
    const pd = ((d[0] === 'Q' ? 1 : 0) + (d[1] === 'Q' ? 1 : 0)) / 2;
    const chance = q.mode === 'dominant' ? ps + pd - ps * pd : ps * pd;
    if (chance > 0) out.push({ quirk: q, chance });
  }
  return out.sort((a, b) => b.chance - a.chance);
}
