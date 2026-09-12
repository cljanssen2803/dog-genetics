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
import { type Dog, ageMonths, estimateTrait, formatAge, weightEstimate } from '../../engine/dog';
import { calmnessFrom, scoreToStars, sizeToPounds } from '../../engine/traits';
import { scoreDog } from '../../engine/standard';
import { type Litter, kennelCount, puppiesOf, setRetention } from '../../game/project';
import { resolveCoat, resolveColor } from '../../engine/phenotype';

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
  const { project } = useGame();
  const sire = project.dogs[litter.sireId];
  const dam = project.dogs[litter.damId];
  const puppies = puppiesOf(project, litter.id);
  const age = project.month - litter.bornMonth;

  const alive = puppies.filter((p) => p.status !== 'deceased');
  const undecided = alive.filter((p) => p.status === 'kennel' && !p.retention).length;

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
  const month = project.month;
  const age = ageMonths(puppy, month);
  const grown = age >= 18;

  const weight = weightEstimate(puppy, month);
  const calm = estimateTrait(puppy, 'energy', month);
  const stability = estimateTrait(puppy, 'stability', month);
  const prey = estimateTrait(puppy, 'preyDrive', month);
  const biddability = estimateTrait(puppy, 'biddability', month);

  const calmScore = calmnessFrom(calm.center, stability.center, puppy.observed.vocality);
  const coat = resolveCoat(puppy.genotype, sizeToPounds(puppy.observed.size));
  const color = resolveColor(puppy.genotype);
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
          <div className="flex items-center gap-1.5">
            <span className="display font-semibold text-[14.5px]">{puppy.name}</span>
            <span className="text-[12px] text-[var(--text-faint)]">{puppy.sex === 'M' ? '♂' : '♀'}</span>
            {puppy.rarities.length > 0 && <Chip tone="rare">rare</Chip>}
          </div>

          <div className="text-[11.5px] text-[var(--text-faint)] mb-1">
            {grown
              ? `${weight.center.toFixed(1)} lb`
              : `Adult size estimate ${weight.low.toFixed(0)}–${weight.high.toFixed(0)} lb`}
            {' · '}
            {weight.confidenceLabel} confidence
          </div>

          <div className="text-[11.5px] text-[var(--text-soft)] leading-snug">
            {grown ? (
              <>
                Calm {Math.round(calmScore)} · Prey drive {Math.round(prey.center)} · Trainable{' '}
                {Math.round(biddability.center)}
              </>
            ) : (
              <>
                Calm {'★'.repeat(scoreToStars(calmScore))}
                {'☆'.repeat(5 - scoreToStars(calmScore))} · Prey{' '}
                {'★'.repeat(scoreToStars(prey.center))}
                {'☆'.repeat(5 - scoreToStars(prey.center))} · Trainable{' '}
                {'★'.repeat(scoreToStars(biddability.center))}
                {'☆'.repeat(5 - scoreToStars(biddability.center))}
              </>
            )}
          </div>

          <div className="text-[11.5px] text-[var(--text-soft)] truncate">
            {color.name} · {coat.label}
          </div>

          <div className="flex flex-wrap gap-1 mt-1">
            <Chip tone={score.total >= 70 ? 'good' : score.total >= 45 ? 'neutral' : 'bad'}>
              score {score.total}
            </Chip>
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
          </div>
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
