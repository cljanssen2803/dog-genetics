/**
 * THE PLAYGROUND
 *
 * Make any dog, cross any two, see the puppies. No kennel, no calendar, no
 * score. The bench is the set of grown dogs you can cross; every litter is
 * shown with the same reveal as the real game, and any puppy can be kept on
 * the bench and crossed again.
 *
 * Runs outside a project, so nothing here uses the game context.
 */

import { useEffect, useRef, useState } from 'react';
import { Button, Card, Chip, Empty, Section, Segmented, Sheet, StatRow } from '../components';
import { DogPortrait } from '../DogPortrait';
import { BreedPicker } from './NewProject';
import { type Dog } from '../../engine/dog';
import { type Sex } from '../../engine/names';
import { BREEDS } from '../../engine/breeds';
import { EAR_LABEL, TAIL_BLURB, hiddenCarriers, resolveCoat, resolveColor, resolveEars, resolveTail } from '../../engine/phenotype';
import { sizeToPounds } from '../../engine/traits';
import { LOCUS_BY_KEY, expressed, genopairSymbol } from '../../engine/loci';
import {
  BENCH_AGE,
  PLAY_TWISTS,
  type PlayLitter,
  type Playground as PlaygroundState,
  benchPuppy,
  clearPlayground,
  crossDogs,
  loadPlayground,
  makeDog,
  newPlayground,
  playKinship,
  savePlayground,
  unbench,
} from '../../game/playground';
import { createProject } from '../../game/project';
import { blankStandard } from '../../engine/standard';
import { saveProject } from '../../game/storage';

/** The genes worth explaining when a puppy surprises you, in a sensible order. */
const EXPLAINED_LOCI = [
  'locusE', 'locusK', 'locusA', 'locusB', 'locusD', 'intensity', 'locusS', 'ticking', 'merle', 'harlequin',
  'coatLength', 'curl', 'furnishings', 'undercoat', 'shedding', 'chondro', 'bobtail', 'blueEyes', 'hairlessDom',
];

export function Playground({
  onBack,
  onCreated,
  onToast,
}: {
  onBack: () => void;
  onCreated: (projectId: string) => void;
  onToast: (message: string) => void;
}) {
  const [pg, setPg] = useState<PlaygroundState | null>(null);
  const [version, setVersion] = useState(0);
  const [sireId, setSireId] = useState<string | null>(null);
  const [damId, setDamId] = useState<string | null>(null);
  const [makerOpen, setMakerOpen] = useState(false);
  const [explain, setExplain] = useState<Dog | null>(null);
  /** Puppies of the newest litter that have been looked at. */
  const [awake, setAwake] = useState<Record<string, boolean>>({});
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    void loadPlayground().then((loaded) => {
      setPg(loaded);
      // A litter from last time has already been looked at.
      const last = loaded.litters[0];
      if (last) setAwake(Object.fromEntries(last.puppyIds.map((id) => [id, true])));
    });
  }, []);

  /** After any change: re-render and save shortly after. */
  const changed = () => {
    setVersion((v) => v + 1);
    if (!pg) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void savePlayground(pg), 400);
  };

  // A fresh kinship each render: the playground is small, and the cache
  // would go stale the moment a litter is born.
  const kinship = pg ? playKinship(pg) : null;
  void version;

  if (!pg) {
    return (
      <div className="paper min-h-full flex items-center justify-center">
        <div className="text-[14px] text-[var(--text-faint)]">Opening the playground…</div>
      </div>
    );
  }

  const bench = pg.bench.map((id) => pg.dogs[id]).filter(Boolean);
  const sire = sireId ? pg.dogs[sireId] : null;
  const dam = damId ? pg.dogs[damId] : null;
  const latest: PlayLitter | undefined = pg.litters[0];
  const projectedCoi = sire && dam && kinship ? kinship.projectedCoi(sire.id, dam.id) : 0;
  const bothMerle = !!(sire && dam && sire.genotype.merle?.includes('M') && dam.genotype.merle?.includes('M'));

  const pick = (dog: Dog) => {
    if (dog.sex === 'M') setSireId(sireId === dog.id ? null : dog.id);
    else setDamId(damId === dog.id ? null : dog.id);
  };

  const cross = () => {
    if (!sire || !dam) return;
    const litter = crossDogs(pg, sire.id, dam.id);
    if (!litter) return;
    setAwake({});
    changed();
    onToast(`${litter.puppyIds.length} ${litter.puppyIds.length === 1 ? 'puppy' : 'puppies'}${litter.lost.length ? `, ${litter.lost.length} lost` : ''}. Tap each one to look.`);
    window.setTimeout(() => document.getElementById('play-litter')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const keep = (id: string) => {
    const d = benchPuppy(pg, id);
    if (d) onToast(`${d.name} is on the bench, all grown up.`);
    changed();
  };

  const startKennel = async () => {
    if (bench.length === 0) return;
    const name = 'Playground kennel';
    const project = createProject({ name, standard: blankStandard(name), sandbox: true, founderDogs: bench });
    await saveProject(project, 0);
    onCreated(project.id);
  };

  const reset = async () => {
    await clearPlayground();
    const fresh = newPlayground();
    setPg(fresh);
    setSireId(null);
    setDamId(null);
    setAwake({});
    onToast('The playground is empty again.');
  };

  return (
    <div className="paper min-h-full">
      <div className="safe-top" />
      <div className="max-w-lg mx-auto px-4 pt-4 pb-36">
        <button onClick={onBack} className="text-[13px] text-[var(--text-faint)] mb-4">
          ‹ Home
        </button>
        <h1 className="display text-[26px] font-semibold leading-tight mb-1">The Playground</h1>
        <p className="text-[13px] text-[var(--text-soft)] mb-5 leading-relaxed">
          Make any dog. Cross any two. See the puppies. Keep the ones you like and cross them again.
          Nothing is scored and nothing takes time.
        </p>

        <Section
          title={`The bench (${bench.length})`}
          subtitle="Tap a male and a female to choose the parents. ✕ takes a dog off the bench."
          right={
            <Button small onClick={() => setMakerOpen(true)}>
              + Make a dog
            </Button>
          }
        >
          {bench.length === 0 ? (
            <Empty>Nobody here yet. Make a dog — any breed, any colour you fancy — and then another.</Empty>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {bench.map((d) => {
                const chosen = d.id === sireId || d.id === damId;
                return (
                  <BenchCard
                    key={d.id}
                    dog={d}
                    chosen={chosen}
                    onPick={() => pick(d)}
                    onRemove={() => {
                      unbench(pg, d.id);
                      if (sireId === d.id) setSireId(null);
                      if (damId === d.id) setDamId(null);
                      changed();
                    }}
                    onExplain={() => setExplain(d)}
                  />
                );
              })}
            </div>
          )}
        </Section>

        {latest && (
          <div id="play-litter">
            <LitterView
              pg={pg}
              litter={latest}
              awake={awake}
              onLook={(id) => setAwake((a) => ({ ...a, [id]: true }))}
              onWakeAll={() => setAwake((a) => ({ ...a, ...Object.fromEntries(latest.puppyIds.map((id) => [id, true])) }))}
              onKeep={keep}
              onExplain={setExplain}
            />
          </div>
        )}

        {pg.litters.length > 1 && (
          <Section title="Earlier litters" subtitle="Any of these puppies can still be kept.">
            {pg.litters.slice(1, 6).map((l) => (
              <EarlierLitter key={l.id} pg={pg} litter={l} onKeep={keep} onExplain={setExplain} />
            ))}
          </Section>
        )}

        {bench.length > 0 && (
          <Section title="Take it further" subtitle="Turn the bench into a real free-play kennel: time passes, puppies grow, generations stack up.">
            <Button full tone="secondary" onClick={() => void startKennel()}>
              Start a kennel with these {bench.length} dogs
            </Button>
          </Section>
        )}

        <button onClick={() => void reset()} className="text-[12px] text-[var(--text-faint)] underline mt-6">
          Clear the playground
        </button>
      </div>

      {/* ------------------------------------------------------ cross bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t-2 border-[var(--line)] bg-[var(--card)] safe-bottom">
        <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0 text-[12.5px] leading-snug">
            <div className="truncate">
              <span className="text-[var(--text-faint)]">♂</span> {sire ? sire.name : <span className="text-[var(--text-faint)]">pick a male</span>}
              <span className="text-[var(--text-faint)]"> × ♀</span> {dam ? dam.name : <span className="text-[var(--text-faint)]">pick a female</span>}
            </div>
            {sire && dam && (
              <div className={`text-[11px] ${bothMerle ? 'text-[#c8375c] font-semibold' : 'text-[var(--text-faint)]'}`}>
                {bothMerle ? 'Both merle — some puppies would be double merle.' : `Inbreeding ${(projectedCoi * 100).toFixed(1)}%`}
              </div>
            )}
          </div>
          <Button onClick={cross} disabled={!sire || !dam} tone={bothMerle ? 'danger' : 'primary'}>
            Cross them
          </Button>
        </div>
      </div>

      {makerOpen && (
        <MakerSheet
          onClose={() => setMakerOpen(false)}
          onMake={(breedKey, sex, twists) => {
            const d = makeDog(pg, { breedKey, sex, twists });
            changed();
            onToast(`${d.name} the ${d.breedLabel.toLowerCase()} is on the bench.`);
          }}
        />
      )}

      {explain && <ExplainSheet pg={pg} dog={explain} onClose={() => setExplain(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** "Chocolate merle · Long furnished coat · Dropped ears · 58 lb" */
function lookOf(dog: Dog) {
  const lbs = sizeToPounds(dog.observed.size);
  const coat = resolveCoat(dog.genotype, lbs);
  const colour = resolveColor(dog.genotype);
  const ears = resolveEars(dog.observed.earSet);
  const tail = resolveTail(dog.genotype, dog.observed.tailSet, dog.observed.muzzle, coat.kind, lbs);
  return { lbs, coat, colour, ears: EAR_LABEL[ears], tail: TAIL_BLURB[tail], carries: hiddenCarriers(dog.genotype).map((c) => c.label) };
}

function BenchCard({
  dog,
  chosen,
  onPick,
  onRemove,
  onExplain,
}: {
  dog: Dog;
  chosen: boolean;
  onPick: () => void;
  onRemove: () => void;
  onExplain: () => void;
}) {
  const look = lookOf(dog);
  return (
    <div className={`card p-2 relative border-2 min-w-0 ${chosen ? 'border-[var(--brand)]' : 'border-transparent'}`}>
      <button onClick={onRemove} aria-label={`Remove ${dog.name}`} className="absolute top-1.5 right-2 text-[14px] text-[var(--text-faint)] z-10">
        ✕
      </button>
      <button onClick={onPick} className="w-full text-left">
        <DogPortrait dog={dog} fluid asAge={BENCH_AGE} />
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="display text-[14px] font-semibold truncate">{dog.name}</span>
          <span className="text-[12px] text-[var(--text-faint)]">{dog.sex === 'M' ? '♂' : '♀'}</span>
          {chosen && <Chip tone="info">{dog.sex === 'M' ? 'sire' : 'dam'}</Chip>}
        </div>
        <div className="text-[11px] text-[var(--text-faint)] truncate">{dog.breedLabel} · {look.lbs.toFixed(0)} lb</div>
        <div className="text-[11.5px] font-semibold truncate">{look.colour.name}</div>
        <div className="text-[11px] text-[var(--text-soft)] truncate">{look.coat.label}</div>
        {look.carries.length > 0 && <div className="text-[10.5px] text-clay truncate">Carries {look.carries.slice(0, 3).join(', ')}</div>}
      </button>
      <button onClick={onExplain} className="text-[11px] text-[var(--brand)] font-semibold mt-1">
        Genes ›
      </button>
    </div>
  );
}

function LitterView({
  pg,
  litter,
  awake,
  onLook,
  onWakeAll,
  onKeep,
  onExplain,
}: {
  pg: PlaygroundState;
  litter: PlayLitter;
  awake: Record<string, boolean>;
  onLook: (id: string) => void;
  onWakeAll: () => void;
  onKeep: (id: string) => void;
  onExplain: (dog: Dog) => void;
}) {
  const sire = pg.dogs[litter.sireId];
  const dam = pg.dogs[litter.damId];
  const pups = litter.puppyIds.map((id) => pg.dogs[id]).filter(Boolean);
  const looked = pups.filter((p) => awake[p.id]).length;
  return (
    <Section
      title="The litter"
      subtitle={`${dam?.name ?? '?'} × ${sire?.name ?? '?'} · ${pups.length} ${pups.length === 1 ? 'puppy' : 'puppies'}${litter.lost.length ? `, ${litter.lost.length} lost` : ''} · inbreeding ${(litter.coi * 100).toFixed(1)}%`}
      right={
        looked < pups.length ? (
          <Button small tone="secondary" onClick={onWakeAll}>
            Wake all
          </Button>
        ) : undefined
      }
    >
      {litter.lost.length > 0 && (
        <div className="text-[11.5px] text-[var(--text-faint)] mb-2">{litter.lost.join(' · ')}</div>
      )}
      {pups.length === 0 ? (
        <Empty>No puppies survived this one.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {pups.map((p) => (
            <PupCard key={p.id} pg={pg} dog={p} awake={!!awake[p.id]} onLook={() => onLook(p.id)} onKeep={() => onKeep(p.id)} onExplain={() => onExplain(p)} />
          ))}
        </div>
      )}
    </Section>
  );
}

function PupCard({
  pg,
  dog,
  awake,
  onLook,
  onKeep,
  onExplain,
}: {
  pg: PlaygroundState;
  dog: Dog;
  awake: boolean;
  onLook: () => void;
  onKeep: () => void;
  onExplain: () => void;
}) {
  const look = lookOf(dog);
  const benched = pg.bench.includes(dog.id);
  return (
    <div className="card p-2 min-w-0">
      <button onClick={onLook} className="w-full text-left" aria-label={awake ? `${dog.name}, ${look.colour.name}` : 'A sleeping puppy. Tap to look.'}>
        <div
          style={{
            filter: awake ? 'none' : 'grayscale(1) sepia(0.3) brightness(1.04) contrast(0.72)',
            transition: 'filter 1100ms ease 350ms',
          }}
        >
          <DogPortrait dog={dog} fluid asleep={!awake} asAge={3} />
        </div>
        <div className="min-h-[74px] mt-1.5 px-0.5">
          {awake ? (
            <>
              <div className="reveal-in text-[11px] text-[var(--text-soft)] leading-snug" style={{ animationDelay: '0ms' }}>
                {look.coat.label}
              </div>
              <div className="reveal-in text-[12.5px] font-semibold leading-snug" style={{ animationDelay: '650ms' }}>
                {look.colour.name}
              </div>
              <div className="reveal-in flex items-center gap-1.5 mt-1" style={{ animationDelay: '1300ms' }}>
                <Chip tone={dog.sex === 'F' ? 'rare' : 'info'}>{dog.sex === 'F' ? '♀ a girl' : '♂ a boy'}</Chip>
                <span className="display text-[14px] font-semibold truncate">{dog.name}</span>
              </div>
              <div className="reveal-in text-[10.5px] text-[var(--text-faint)] mt-0.5" style={{ animationDelay: '1700ms' }}>
                grows to about {look.lbs.toFixed(0)} lb · {look.ears.toLowerCase()}
                {look.carries.length > 0 ? ` · carries ${look.carries.slice(0, 2).join(', ')}` : ''}
              </div>
            </>
          ) : (
            <div className="text-[12px] text-[var(--text-faint)] text-center pt-3">Tap to look…</div>
          )}
        </div>
      </button>
      {awake && (
        <div className="flex gap-1.5 mt-1">
          <Button small tone="secondary" onClick={onExplain}>
            Why?
          </Button>
          <Button small full onClick={onKeep} disabled={benched} tone={benched ? 'secondary' : 'primary'}>
            {benched ? 'On the bench' : 'Keep'}
          </Button>
        </div>
      )}
    </div>
  );
}

function EarlierLitter({ pg, litter, onKeep, onExplain }: { pg: PlaygroundState; litter: PlayLitter; onKeep: (id: string) => void; onExplain: (dog: Dog) => void }) {
  const pups = litter.puppyIds.map((id) => pg.dogs[id]).filter(Boolean);
  const sire = pg.dogs[litter.sireId];
  const dam = pg.dogs[litter.damId];
  return (
    <Card className="mb-2">
      <div className="text-[12.5px] font-semibold mb-1.5">
        {dam?.name ?? '?'} × {sire?.name ?? '?'} <span className="text-[var(--text-faint)] font-normal">· {pups.length} puppies</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {pups.map((p) => (
          <div key={p.id} className="flex-none w-[92px] text-center">
            <button onClick={() => onExplain(p)}>
              <DogPortrait dog={p} size={92} asAge={BENCH_AGE} />
            </button>
            <div className="text-[10.5px] truncate mt-0.5">{p.sex === 'F' ? '♀' : '♂'} {p.name}</div>
            <div className="text-[10px] text-[var(--text-faint)] truncate">{resolveColor(p.genotype).name}</div>
            <button
              onClick={() => onKeep(p.id)}
              disabled={pg.bench.includes(p.id)}
              className="text-[10.5px] font-semibold text-[var(--brand)] disabled:text-[var(--text-faint)]"
            >
              {pg.bench.includes(p.id) ? 'on bench' : 'Keep'}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Making a dog
// ---------------------------------------------------------------------------

function MakerSheet({ onClose, onMake }: { onClose: () => void; onMake: (breedKey: string, sex: Sex, twists: string[]) => void }) {
  const [breedKey, setBreedKey] = useState('labrador');
  const [sex, setSex] = useState<Sex>('F');
  const [twists, setTwists] = useState<string[]>([]);
  const [mixed, setMixed] = useState(false);
  const breed = BREEDS.find((b) => b.key === breedKey);
  const toggle = (k: string) => setTwists((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));

  return (
    <Sheet
      open
      onClose={onClose}
      title="Make a dog"
      subtitle="Any breed, any colour. It arrives grown up and ready to cross."
      footer={
        <div className="flex gap-2">
          <Button tone="secondary" onClick={onClose} className="flex-none">
            Done
          </Button>
          <Button full onClick={() => onMake(mixed ? 'mixed' : breedKey, sex, twists)}>
            Make {sex === 'M' ? 'a male' : 'a female'} {mixed ? 'village dog' : breed?.name ?? ''}
          </Button>
        </div>
      }
    >
      <Segmented value={sex} onChange={setSex} options={[{ value: 'F', label: '♀ Female' }, { value: 'M', label: '♂ Male' }]} />

      <Section title="Breed">
        <button
          onClick={() => setMixed((m) => !m)}
          className={`w-full text-left rounded-xl border px-3 py-2 mb-2 text-[13px] ${mixed ? 'bg-[var(--brand)] text-white border-transparent' : 'bg-[var(--card)] border-[var(--line)]'}`}
        >
          Village dog — no particular breed, a bit of everything
        </button>
        {!mixed && <BreedPicker value={breedKey} onChange={setBreedKey} />}
      </Section>

      <Section title="Make it wear…" subtitle="Optional. The genes are set so the dog actually shows this, whatever the breed usually looks like.">
        <div className="flex flex-wrap gap-1.5">
          {PLAY_TWISTS.map((t) => {
            const on = twists.includes(t.key);
            return (
              <button
                key={t.key}
                onClick={() => toggle(t.key)}
                title={t.blurb}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${on ? 'bg-[var(--brand)] text-white border-transparent' : 'bg-[var(--bg-2)] border-[var(--line)] text-[var(--text-soft)]'}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {twists.length > 0 && (
          <div className="text-[11.5px] text-[var(--text-faint)] mt-2 leading-relaxed">
            {twists.map((k) => PLAY_TWISTS.find((t) => t.key === k)?.blurb).join(' ')}
          </div>
        )}
      </Section>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Why does it look like that?
// ---------------------------------------------------------------------------

function ExplainSheet({ pg, dog, onClose }: { pg: PlaygroundState; dog: Dog; onClose: () => void }) {
  const look = lookOf(dog);
  const sire = dog.sireId ? pg.dogs[dog.sireId] : undefined;
  const dam = dog.damId ? pg.dogs[dog.damId] : undefined;
  const labelOf = (locus: string, code: string) => LOCUS_BY_KEY[locus]?.alleles.find((a) => a.code === code)?.label ?? code;

  return (
    <Sheet open onClose={onClose} title={dog.name} subtitle={`${look.colour.name} · ${look.coat.label}`}>
      <div className="flex justify-center mb-3">
        <DogPortrait dog={dog} size={170} asAge={BENCH_AGE} />
      </div>
      <Card className="mb-4">
        <StatRow label="Colour" value={look.colour.name} />
        <StatRow label="Eyes and nose" value={`${look.colour.eyeName} eyes, ${look.colour.noseName} nose`} />
        <StatRow label="Coat" value={look.coat.label} />
        <StatRow label="Ears and tail" value={`${look.ears}, ${look.tail}`} />
        <StatRow label="Grown weight" value={`about ${look.lbs.toFixed(0)} lb`} />
        {look.carries.length > 0 && <StatRow label="Carries (hidden)" value={look.carries.join(', ')} />}
      </Card>

      <Section
        title="The genes, one by one"
        subtitle={sire && dam ? `Each gene comes in two copies: one from ${dam.name}, one from ${sire.name}. The stronger copy is what shows.` : 'Each gene comes in two copies. The stronger copy is what shows.'}
      >
        <Card>
          {EXPLAINED_LOCI.filter((k) => dog.genotype[k]).map((k) => {
            const locus = LOCUS_BY_KEY[k];
            const shown = expressed(dog.genotype, k);
            return (
              <div key={k} className="py-2 border-b border-[var(--line)] last:border-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-semibold">{locus.name}</span>
                  <span className="text-[12px] tabular-nums text-[var(--text-soft)]">{genopairSymbol(k, dog.genotype[k])}</span>
                </div>
                <div className="text-[11.5px] text-[var(--text-soft)]">Shows: {labelOf(k, shown).toLowerCase()}</div>
                {sire && dam && (
                  <div className="text-[11px] text-[var(--text-faint)] tabular-nums">
                    {dam.name} {dam.genotype[k] ? genopairSymbol(k, dam.genotype[k]) : '?'} · {sire.name} {sire.genotype[k] ? genopairSymbol(k, sire.genotype[k]) : '?'}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </Section>
    </Sheet>
  );
}
