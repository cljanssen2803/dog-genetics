/**
 * HOME
 *
 * The list of breeding projects. Starting a new project never disturbs an
 * existing one, so several can run side by side.
 */

import { useEffect, useRef, useState } from 'react';
import { BookImage, FlaskConical, Palette } from 'lucide-react';
import { Wordmark } from '../Wordmark';
import { Button, Card, Chip, Empty, Section, Sheet } from '../components';
import { BreedGallerySheet } from './BreedGallery';
import {
  type ProjectSummary,
  deleteProject,
  downloadBackup,
  estimateStorage,
  exportAll,
  importBackup,
  loadIndex,
  requestPersistence,
} from '../../game/storage';

export function Home({
  onOpen,
  onNew,
  onLab,
  onPlayground,
}: {
  onPlayground: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onLab: () => void;
}) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const reload = () => {
    void loadIndex().then(setProjects);
  };

  useEffect(reload, []);

  return (
    <div className="paper min-h-full" data-world="kennel">
      <div className="safe-top" style={{ background: 'var(--world)' }} />
      <header className="border-b-[3px] border-[var(--ink)] text-[var(--on-world)]" style={{ background: 'var(--world)' }}>
        <div className="max-w-lg mx-auto px-4 pt-5 pb-6">
          <Wordmark />
          <p className="text-[13px] leading-relaxed mt-3 max-w-[32ch] text-[var(--on-world)] opacity-90">
            Design the dog you want. Then spend fifteen generations actually creating it, without
            wrecking the gene pool on the way.
          </p>
        </div>
      </header>
      <div className="bunting" aria-hidden="true" />
      <div className="max-w-lg mx-auto px-4 pt-6 pb-24">

        <Section title="My breeding projects">
          {projects === null ? (
            <Empty>Loading…</Empty>
          ) : projects.length === 0 ? (
            <Empty>
              Nothing here yet. Start your first project below — the Hearthdog preset is the gentlest
              introduction.
            </Empty>
          ) : (
            projects.map((p) => (
              <Card key={p.id} onClick={() => onOpen(p.id)} className="mb-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="display font-semibold text-[16px] truncate">{p.name}</div>
                    <div className="text-[12px] text-[var(--text-faint)]">
                      Generation {p.generation} · {p.dogCount} dogs recorded · year{' '}
                      {(p.month / 12).toFixed(1)}
                    </div>
                    {p.sandbox ? (
                      <div className="mt-1.5"><Chip tone="info">free play</Chip></div>
                    ) : (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-[var(--bg-2)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--brand)] rounded-full"
                          style={{ width: `${p.standardisation}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-[var(--text-faint)] tabular-nums">
                        {p.standardisation}%
                      </span>
                    </div>
                    )}
                  </div>
                  <span className="text-[var(--text-faint)] text-[20px]">›</span>
                </div>
              </Card>
            ))
          )}
        </Section>

        <Button full onClick={onNew} className="mb-3">
          + New breeding project
        </Button>

        <Card onClick={onPlayground} className="mb-3">
          <div className="flex items-center gap-3">
            <Palette size={26} strokeWidth={1.8} className="text-[var(--brand)]" />
            <div className="flex-1">
              <div className="display font-semibold text-[16px]">The Playground</div>
              <div className="text-[12px] text-[var(--text-faint)] leading-snug">
                Make any dog, cross any two, see the puppies instantly. No kennel, no clock, no score.
              </div>
            </div>
            <span className="text-[var(--text-faint)] text-[20px]">›</span>
          </div>
        </Card>

        <Card onClick={onLab} className="mb-3">
          <div className="flex items-center gap-3">
            <FlaskConical size={26} strokeWidth={1.8} className="text-[var(--brand)]" />
            <div className="flex-1">
              <div className="display font-semibold text-[16px]">The Lab</div>
              <div className="text-[12px] text-[var(--text-faint)] leading-snug">
                Tick the features you want, see the dog, and find out which breeds carry the genes.
              </div>
            </div>
            <span className="text-[var(--text-faint)] text-[20px]">›</span>
          </div>
        </Card>

        <Card onClick={() => setGalleryOpen(true)} className="mb-3">
          <div className="flex items-center gap-3">
            <BookImage size={26} strokeWidth={1.8} className="text-[var(--brand)]" />
            <div className="flex-1">
              <div className="display font-semibold text-[16px]">Breed gallery</div>
              <div className="text-[12px] text-[var(--text-faint)] leading-snug">
                Every breed in the bank, drawn as it comes. Just to look through.
              </div>
            </div>
            <span className="text-[var(--text-faint)] text-[20px]">›</span>
          </div>
        </Card>

        <Button full tone="secondary" onClick={() => setBackupOpen(true)}>
          Backup and restore
        </Button>

        <p className="text-[11.5px] text-[var(--text-faint)] mt-6 leading-relaxed text-center">
          Everything is stored on this device only. Nothing is uploaded anywhere.
        </p>
      </div>

      {galleryOpen && <BreedGallerySheet onClose={() => setGalleryOpen(false)} />}
      <BackupSheet
        open={backupOpen}
        onClose={() => {
          setBackupOpen(false);
          reload();
        }}
        projects={projects ?? []}
        onDeleted={reload}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------

function BackupSheet({
  open,
  onClose,
  projects,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  projects: ProjectSummary[];
  onDeleted: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [storage, setStorage] = useState<{ usedMb: number; quotaMb: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    void estimateStorage().then(setStorage);
  }, [open]);

  const doExport = async () => {
    const backup = await exportAll();
    if (backup.projects.length === 0) {
      setStatus('There is nothing to back up yet.');
      return;
    }
    downloadBackup(backup);
    setStatus(`Saved a backup of ${backup.projects.length} project${backup.projects.length === 1 ? '' : 's'}.`);
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    const result = await importBackup(text);
    if (result.errors.length > 0) {
      setStatus(result.errors[0]);
      return;
    }
    setStatus(`Restored ${result.added} new and ${result.replaced} updated project${result.replaced === 1 ? '' : 's'}.`);
    onDeleted();
  };

  if (!open) return null;

  return (
    <Sheet open onClose={onClose} title="Backup and restore">
      <div className="card p-3 mb-4">
        <p className="text-[13px] leading-relaxed text-[var(--text-soft)]">
          Your games live in this phone's browser storage. That is usually reliable, but iPhones can
          clear it if storage runs low or the app goes unused for a long stretch. A backup file
          protects against that — save it, then email it to yourself.
        </p>
      </div>

      {storage && (
        <div className="card p-3 mb-4">
          <div className="text-[12.5px] text-[var(--text-soft)]">
            Using {storage.usedMb.toFixed(1)} MB of roughly {storage.quotaMb.toFixed(0)} MB available.
          </div>
          {persisted === null ? (
            <Button
              small
              tone="secondary"
              className="mt-2"
              onClick={async () => setPersisted(await requestPersistence())}
            >
              Ask iOS to protect this data
            </Button>
          ) : (
            <Chip tone={persisted ? 'good' : 'warn'}>
              {persisted ? 'Protected storage granted' : 'iOS declined — keep backups'}
            </Chip>
          )}
        </div>
      )}

      <Button full onClick={doExport} className="mb-2">
        Save a backup file
      </Button>

      <Button full tone="secondary" onClick={() => fileInput.current?.click()} className="mb-4">
        Restore from a backup file
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void doImport(file);
          e.target.value = '';
        }}
      />

      {status && (
        <div className="card p-3 mb-4 text-[13px] text-[var(--text-soft)]">{status}</div>
      )}

      {projects.length > 0 && (
        <Section title="Delete a project" subtitle="This cannot be undone.">
          <div className="card p-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)] last:border-0"
              >
                <span className="text-[13px] truncate">{p.name}</span>
                <Button
                  small
                  tone="danger"
                  onClick={async () => {
                    if (!confirm(`Delete "${p.name}" permanently? This cannot be undone.`)) return;
                    await deleteProject(p.id);
                    setStatus(`Deleted ${p.name}.`);
                    onDeleted();
                  }}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </Section>
      )}
    </Sheet>
  );
}
