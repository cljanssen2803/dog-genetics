/**
 * SAVING
 *
 * Projects are stored in the phone's own database (IndexedDB), not in the
 * simpler localStorage, because a fifteen-generation project with a thousand
 * dogs in its history is far too big for localStorage and iOS will quietly
 * throw it away when space runs short.
 *
 * Even IndexedDB is not permanent on iOS. Safari can clear it if the app goes
 * unused for a long stretch, or if the phone runs out of room. That is why the
 * backup file matters: EXPORT writes everything to a file the player can email
 * to themselves, and IMPORT reads it back.
 */

import { del, get, set } from 'idb-keyval';
import type { Project } from './project';
import { ensureIds } from './project';
import { Rng, hashString } from '../engine/rng';
import { QUIRKS } from '../engine/quirks';
import { LOCI } from '../engine/loci';
import { BREED_BY_KEY, DEFAULT_ALLELES } from '../engine/breeds';

const INDEX_KEY = 'dogGenetics.projectIndex';
const PROJECT_KEY = (id: string) => `dogGenetics.project.${id}`;
const SETTINGS_KEY = 'dogGenetics.settings';

export const SAVE_FORMAT_VERSION = 1;

export interface ProjectSummary {
  id: string;
  name: string;
  standardName: string;
  generation: number;
  month: number;
  dogCount: number;
  standardisation: number;
  updatedAt: number;
}

export interface AppSettings {
  nerdMode: boolean;
  tutorialCompleted: boolean;
  lastProjectId?: string;
}

const DEFAULT_SETTINGS: AppSettings = { nerdMode: false, tutorialCompleted: false };

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function loadSettings(): Promise<AppSettings> {
  try {
    const stored = await get<AppSettings>(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await set(SETTINGS_KEY, settings);
  } catch {
    // A failed settings write is not worth interrupting the game for.
  }
}

// ---------------------------------------------------------------------------
// Project list
// ---------------------------------------------------------------------------

export async function loadIndex(): Promise<ProjectSummary[]> {
  try {
    return (await get<ProjectSummary[]>(INDEX_KEY)) ?? [];
  } catch {
    return [];
  }
}

async function writeIndex(list: ProjectSummary[]): Promise<void> {
  await set(INDEX_KEY, list);
}

export function summarise(project: Project, standardisation: number): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    standardName: project.standard.name,
    generation: project.generation,
    month: project.month,
    dogCount: Object.keys(project.dogs).length,
    standardisation,
    updatedAt: project.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Reading and writing one project
// ---------------------------------------------------------------------------

export async function saveProject(project: Project, standardisation = 0): Promise<void> {
  project.updatedAt = Date.now();
  await set(PROJECT_KEY(project.id), project);

  const index = await loadIndex();
  const summary = summarise(project, standardisation);
  const existing = index.findIndex((p) => p.id === project.id);
  if (existing >= 0) index[existing] = summary;
  else index.unshift(summary);

  index.sort((a, b) => b.updatedAt - a.updatedAt);
  await writeIndex(index);
}

export async function loadProject(id: string): Promise<Project | null> {
  try {
    const project = await get<Project>(PROJECT_KEY(id));
    if (!project) return null;
    ensureIds(project);
    return migrate(project);
  } catch {
    return null;
  }
}

export async function deleteProject(id: string): Promise<void> {
  await del(PROJECT_KEY(id));
  const index = await loadIndex();
  await writeIndex(index.filter((p) => p.id !== id));
}

/**
 * Fill in anything a save from an older version is missing, so an update can
 * never break an existing game.
 */
function migrate(project: Project): Project {
  project.candidates ??= [];
  project.discoveries ??= [];
  project.log ??= [];
  project.history ??= [];
  project.pregnancies ??= [];
  project.litters ??= [];
  project.lastLitter ??= {};
  project.testCredits ??= 6;
  project.kennelCapacity ??= 12;
  project.nerdMode ??= false;
  project.tutorialSeen ??= false;
  // Saves written before dogs carried their own quirk number.
  for (const dog of Object.values(project.dogs)) {
    if (typeof dog.seedValue !== 'number') {
      dog.seedValue = hashString(dog.id) % 2147483646;
    }
    // Saves written before tail carriage was a trait. Give the dog an
    // ordinary tail, seeded from the dog itself so it is the same every load,
    // and it inherits normally from here on.
    if (dog.bv.tailSet === undefined) {
      const r = new Rng(dog.seedValue ^ 0x7a11);
      dog.bv.tailSet = r.clampedNormal(48, 8);
      dog.het.tailSet = 12 * Math.sqrt(0.55) * 0.85;
      dog.observed.tailSet = Math.max(0, Math.min(100, dog.bv.tailSet + r.normal(0, 8)));
      dog.guessNoise.tailSet = r.clampedNormal(0, 1, 2.2);
    }
    // Genes added to the game after this save was written (the undercoat
    // gene, for one). Draw them from the dog's own breed table so a saved
    // Husky gets its undercoat and a saved Greyhound does not.
    for (const locus of LOCI) {
      if (locus.category === 'quirk' || dog.genotype[locus.key]) continue;
      const breed = dog.originBreed ? BREED_BY_KEY[dog.originBreed] : undefined;
      const table =
        locus.category === 'disease'
          ? { N: 1, m: 0 }
          : (breed?.alleles?.[locus.key] ?? DEFAULT_ALLELES[locus.key] ?? { [locus.alleles[0].code]: 1 });
      const r = new Rng((dog.seedValue ^ hashString(locus.key)) % 2147483646);
      dog.genotype[locus.key] = [r.weightedKey(table), r.weightedKey(table)];
    }
    // Saves written before personality genes existed. Draw them now from the
    // dog's own seed, so the same dog always gets the same habits — and so
    // the inheritance code never sees a missing gene and hands out every
    // habit at once.
    const missing = QUIRKS.filter((q) => !dog.genotype[q.key]);
    if (missing.length > 0) {
      const rng = new Rng(dog.seedValue ^ 0x51ab);
      for (const q of missing) {
        const a = rng.chance(q.frequency) ? 'Q' : 'n';
        const b = rng.chance(q.frequency) ? 'Q' : 'n';
        dog.genotype[q.key] = a === 'Q' || b === 'Q' ? ['Q', a === 'Q' && b === 'Q' ? 'Q' : 'n'] : ['n', 'n'];
      }
    }
  }
  return project;
}

// ---------------------------------------------------------------------------
// Backup files
// ---------------------------------------------------------------------------

export interface BackupFile {
  format: 'dog-genetics-backup';
  version: number;
  exportedAt: string;
  projects: Project[];
}

/** Bundle every project into one downloadable file. */
export async function exportAll(): Promise<BackupFile> {
  const index = await loadIndex();
  const projects: Project[] = [];
  for (const entry of index) {
    const project = await loadProject(entry.id);
    if (project) projects.push(project);
  }
  return {
    format: 'dog-genetics-backup',
    version: SAVE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    projects,
  };
}

export async function exportOne(id: string): Promise<BackupFile | null> {
  const project = await loadProject(id);
  if (!project) return null;
  return {
    format: 'dog-genetics-backup',
    version: SAVE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    projects: [project],
  };
}

/** Trigger a file download in the browser. */
export function downloadBackup(backup: BackupFile, filename?: string): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  link.download = filename ?? `dog-genetics-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportResult {
  added: number;
  replaced: number;
  errors: string[];
}

/**
 * Read a backup file back in. Existing projects with the same id are replaced,
 * so restoring the same file twice does not create duplicates.
 */
export async function importBackup(raw: string): Promise<ImportResult> {
  const result: ImportResult = { added: 0, replaced: 0, errors: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    result.errors.push('That file is not readable. It may have been altered or only partly downloaded.');
    return result;
  }

  const backup = parsed as Partial<BackupFile>;
  if (backup.format !== 'dog-genetics-backup' || !Array.isArray(backup.projects)) {
    result.errors.push('That does not look like a Dog Genetics backup file.');
    return result;
  }

  const index = await loadIndex();

  for (const project of backup.projects) {
    if (!project?.id || !project.dogs || !project.standard) {
      result.errors.push('Skipped one damaged project in the file.');
      continue;
    }
    const existed = index.some((p) => p.id === project.id);
    await saveProject(migrate(project));
    if (existed) result.replaced += 1;
    else result.added += 1;
  }

  return result;
}

/** Roughly how much space the saves are using, for the backup screen. */
export async function estimateStorage(): Promise<{ usedMb: number; quotaMb: number } | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usedMb: usage / 1048576, quotaMb: quota / 1048576 };
  } catch {
    return null;
  }
}

/**
 * Ask iOS to treat this app's data as important. Does not always succeed, but
 * when it does it makes the saves much less likely to be cleared.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
