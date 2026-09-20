/**
 * PUPPIES
 *
 * Litters, newest first. The current litter is open; older ones collapse so the
 * page stays short.
 *
 * The important idea on this screen is uncertainty. A newborn puppy does not
 * have a temperament score — it has a range and a confidence level, and both
 * tighten as it grows. Deciding who to keep before you really know is the
 * central tension of the whole game.
 */

import { useState } from 'react';
import { Button, Card, Chip, Empty, Explain } from '../components';
import { DogPortrait } from '../DogPortrait';
import { useGame } from '../GameContext';
import { DogCard, DogDetailSheet } from '../dogs';
import { FactChips, FactLine, LookLine, NameLine, TemperamentLine, describeDog } from '../DogFacts';
import { type Dog, formatAge } from '../../engine/dog';
import { scoreDog } from '../../engine/standard';
import { type Litter, kennelCount, placeDog, puppiesOf, setRetention } from '../../game/project';
import { type PuppyAdvice, triageLitter } from '../../game/assist';

export function PuppiesTab({ onShowPedigree }: { onShowPedigree?: (dog: Dog) => void }) {
  const { project } = useGame();
  const [open, setOpen] = useState<Dog | null>(null);
  const [expanded, setExpanded] = useState<string | null>(project.litters[0]?.id ?? null);

  if (project.litters.length === 0) {
    return (
      <div className="px-4 pb-28 pt-3">
        <Empty>
          No litters yet. Go to the Breed tab, pick a parent, choose a mate and commit — puppies
          arrive two months later.
        </Empty>
      </div>
    );
  }

  return (
    <div className="px-4 pb-28 pt-3">
      <Explain title="Why are the puppy numbers so vague?">
        <p>
          Because they genuinely are. A DNA test can tell you a puppy's coat and its disease genes
          exactly, on the day it is born. It cannot tell you how calm it will be at three years old,
          how big it will finish, or how long it will live.
        </p>
        <p>
          So young puppies show a <strong>range</strong> and a confidence level. As they grow the
          range narrows. Keeping a puppy on a wide range is a gamble; waiting costs you kennel space.
        </p>
      </Explain>

      <div className="card p-3 mb-4">
        <div className="text-[13px]">
          Kennel: <strong>{kennelCount(project)}</strong> of {project.kennelCapacity} spaces used.
        </div>
        {kennelCount(project) >= project.kennelCapacity && (
          <p className="text-[12px] text-rust mt-1">
            You are at capacity. Place some puppies in pet homes to make room.
          </p>
        )}
      </div>

      {project.litters.map((litter) => (
        <LitterBlock
          key={litter.id}
          litter={litter}
          expanded={expanded === litter.id}
          onToggle={() => setExpanded(expanded === litter.id ? null : litter.id)}
          onOpenDog={setOpen}
        />
      ))}

      <DogDetailSheet dog={open} onClose={() => setOpen(null)} onShowPedigree={onShowPedigree} />
    </div>
  );
}

function LitterBlock({
  litter,
  expanded,
  onToggle,
  onOpenDog,
}: {
  litter: Litter;
  expanded: boolean;
  onToggle: () => void;
  onOpenDog: (dog: Dog) => void;
}) {
  const { project, refresh, say } = useGame();
  const sire = project.dogs[litter.sireId];
  const dam = project.dogs[litter.damId];
  const puppies = puppiesOf(project, litter.id);
  const age = project.month - litter.bornMonth;
  const [advice, setAdvice] = useState<PuppyAdvice[] | null>(null);

  const alive = puppies.filter((p) => p.status !== 'deceased');
  const undecided = alive.filter((p) => p.status === 'kennel' && !p.retention).length;

  const applyAdvice = () => {
    if (!advice) return;
    let placed = 0;
    for (const a of advice) {
      if (a.dog.status !== 'kennel') continue;
      if (a.choice === 'pet') {
        placeDog(project, a.dog.id, a.placement ?? 'familyCompanion');
        placed += 1;
      } else {
        setRetention(project, a.dog.id, a.choice);
      }
    }
    say(`Litter sorted. ${placed} placed in pet homes.`);
    setAdvice(null);
    refresh();
  };

  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="w-full card p-3 text-left flex items-center gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="display text-[15px] font-semibold truncate">
            {dam?.name ?? 'Unknown'} × {sire?.name ?? 'Unknown'}
          </div>
          <div className="text-[12px] text-[var(--text-faint)]">
            Generation {litter.generation} · {formatAge(age)} old · {alive.length} puppies
            {litter.lost.length > 0 ? `, ${litter.lost.length} lost` : ''} · inbreeding{' '}
            {(litter.coi * 100).toFixed(1)}%
          </div>
          {undecided > 0 && (
            <Chip tone="warn" className="mt-1">
              {undecided} still to decide
            </Chip>
          )}
        </div>
        <span className="text-[var(--text-faint)] text-[18px]">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="mt-2">
          {litter.lost.length > 0 && (
            <div className="card p-3 mb-2 text-[12.5px] text-[var(--text-soft)]">
              <div className="font-semibold mb-1 text-[var(--text)]">Puppies lost</div>
              {litter.lost.map((reason, i) => (
                <div key={i}>· {reason}</div>
              ))}
            </div>
          )}

          {undecided > 0 && !advice && !project.sandbox && (
            <Button full tone="secondary" className="mb-2" onClick={() => setAdvice(triageLitter(project, litter))}>
              Sort this litter for me
            </Button>
          )}
          {advice && (
            <Card className="mb-3 border-[var(--brand)]">
              <div className="display text-[15px] mb-1">Suggested</div>
              <p className="text-[12px] text-[var(--text-soft)] leading-relaxed mb-2">
                Ranked by what each puppy would pass on, with the space you have. Apply the lot, or use
                it as a guide and decide by hand.
              </p>
              {advice.map((a) => (
                <div key={a.dog.id} className="flex gap-2 py-1.5 border-t border-[var(--line)] text-[12.5px]">
                  <span className="font-semibold w-20 flex-none">{a.dog.name}</span>
                  <span className="flex-none">
                    <Chip tone={a.choice === 'keep' ? 'good' : a.choice === 'wait' ? 'info' : a.choice === 'pet' ? 'neutral' : 'warn'}>
                      {a.choice === 'keep' ? 'Keep' : a.choice === 'wait' ? 'Wait' : a.choice === 'pet' ? 'Pet home' : 'Keep, no breeding'}
                    </Chip>
                  </span>
                  <span className="text-[var(--text-soft)] leading-snug">{a.reason}</span>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <Button small tone="secondary" onClick={() => setAdvice(null)}>
                  Never mind
                </Button>
                <Button small full onClick={applyAdvice}>
                  Apply all
                </Button>
              </div>
            </Card>
          )}
          {alive.length === 0 ? (
            <Empty>No puppies from this litter survived.</Empty>
          ) : (
            alive.map((puppy) => <PuppyCard key={puppy.id} puppy={puppy} onOpen={onOpenDog} />)
          )}
        </div>
      )}
    </div>
  );
}

function PuppyCard({ puppy, onOpen }: { puppy: Dog; onOpen: (dog: Dog) => void }) {
  const { project, refresh, say } = useGame();
  const f = describeDog(puppy, project);
  const score = scoreDog(puppy, project.standard);

  if (puppy.status === 'placed') {
    return (
      <Card className="mb-2 opacity-60">
        <div className="flex items-center gap-3">
          <DogPortrait dog={puppy} size={54} />
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold">{puppy.name}</div>
            <div className="text-[11.5px] text-[var(--text-faint)]">Placed in a pet home</div>
          </div>
        </div>
      </Card>
    );
  }

  const choose = (choice: Dog['retention'], label: string) => {
    setRetention(project, puppy.id, choice);
    say(`${puppy.name}: ${label}.`);
    refresh();
  };

  return (
    <Card className="mb-2">
      <button onClick={() => onOpen(puppy)} className="w-full text-left flex gap-3 mb-2">
        <DogPortrait dog={puppy} size={84} />
        <div className="flex-1 min-w-0">
          <NameLine f={f} />
          <FactLine f={f} className="mb-1" />
          <TemperamentLine f={f} />
          <LookLine f={f} />
          {f.carries.length > 0 && (
            <div className="text-[11.5px] text-clay truncate">Carries {f.carries.slice(0, 4).join(', ')}</div>
          )}
          <FactChips
            f={f}
            standardName={project.standard.name}
            extra={
              <>
                {score.healthNotes.length > 0 && <Chip tone="bad">health</Chip>}
                {puppy.retention && (
                  <Chip tone="info">
                    {puppy.retention === 'keep'
                      ? 'keeping'
                      : puppy.retention === 'wait'
                        ? 'waiting'
                        : puppy.retention === 'retainNoBreed'
                          ? 'kept, not bred'
                          : 'pet home'}
                  </Chip>
                )}
              </>
            }
          />
        </div>
      </button>

      <div className="grid grid-cols-2 gap-1.5">
        <Button
          small
          tone={puppy.retention === 'keep' ? 'primary' : 'secondary'}
          onClick={() => choose('keep', 'kept for breeding')}
        >
          Keep for breeding
        </Button>
        <Button
          small
          tone={puppy.retention === 'wait' ? 'primary' : 'secondary'}
          onClick={() => choose('wait', 'wait and evaluate')}
        >
          Wait and evaluate
        </Button>
        <Button
          small
          tone={puppy.retention === 'retainNoBreed' ? 'primary' : 'secondary'}
          onClick={() => choose('retainNoBreed', 'kept but not bred')}
        >
          Keep, do not breed
        </Button>
        <Button small tone="secondary" onClick={() => onOpen(puppy)}>
          Place in pet home
        </Button>
      </div>
    </Card>
  );
}

/** Re-exported so the kennel screen can reuse the same card shape. */
export { DogCard };
