/**
 * THE LITTER REVEAL
 *
 * The moment the whole game builds toward. New puppies arrive asleep and
 * colourless; the player taps each one to look — the coat comes first, then
 * the colour floods in, then the name and sex. Thirty seconds of ritual.
 *
 * Nothing here changes the game state. It is pure theatre, shown once per
 * litter on the month it is born.
 */

import { useState } from 'react';
import { Button, Chip, Pips, Sheet } from '../components';
import { DogPortrait } from '../DogPortrait';
import { useGame } from '../GameContext';
import { type Dog } from '../../engine/dog';
import { resolveCoat, resolveColor } from '../../engine/phenotype';
import { scoreDog } from '../../engine/standard';
import { sizeToPounds } from '../../engine/traits';
import { puppiesOf } from '../../game/project';

export function LitterRevealSheet({
  litterIds,
  onDone,
  onGoPuppies,
}: {
  litterIds: string[];
  onDone: () => void;
  onGoPuppies?: () => void;
}) {
  const { project } = useGame();
  const [index, setIndex] = useState(0);
  const [awake, setAwake] = useState<Record<string, boolean>>({});

  const litters = litterIds.map((id) => project.litters.find((l) => l.id === id)).filter(Boolean);
  const litter = litters[index];
  if (!litter) {
    onDone();
    return null;
  }
  const sire = project.dogs[litter.sireId];
  const dam = project.dogs[litter.damId];
  const puppies = puppiesOf(project, litter.id).filter((p) => p.status !== 'deceased');
  const looked = puppies.filter((p) => awake[p.id]).length;
  const allAwake = looked === puppies.length;
  const last = index === litters.length - 1;

  const wake = (id: string) => setAwake((a) => (a[id] ? a : { ...a, [id]: true }));
  const wakeAll = () => setAwake((a) => ({ ...a, ...Object.fromEntries(puppies.map((p) => [p.id, true])) }));
  const next = () => {
    if (last) onDone();
    else setIndex(index + 1);
  };

  return (
    <Sheet
      open
      onClose={onDone}
      title={`${dam?.name ?? 'Unknown'} × ${sire?.name ?? 'Unknown'}`}
      subtitle={
        puppies.length === 0
          ? 'No puppies survived.'
          : allAwake
            ? `${puppies.length} ${puppies.length === 1 ? 'puppy' : 'puppies'}. Everyone has been looked at.`
            : `${puppies.length} ${puppies.length === 1 ? 'puppy' : 'puppies'} — tap each one to look. ${looked} of ${puppies.length} so far.`
      }
      footer={
        <div className="flex gap-2">
          {!allAwake && puppies.length > 0 && (
            <Button tone="secondary" onClick={wakeAll} className="flex-none">
              Wake them all
            </Button>
          )}
          {allAwake && onGoPuppies && last ? (
            <>
              <Button tone="secondary" onClick={next} className="flex-none">
                Later
              </Button>
              <Button full onClick={() => { onDone(); onGoPuppies(); }}>
                Sort the litter
              </Button>
            </>
          ) : (
            <Button full onClick={next} tone={allAwake ? 'primary' : 'secondary'}>
              {last ? 'Continue' : 'Next litter'}
            </Button>
          )}
        </div>
      }
    >
      {litter.lost.length > 0 && (
        <p className="text-[12px] text-[var(--text-faint)] mb-3 leading-relaxed">
          {litter.lost.length} lost before birth.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {puppies.map((p) => (
          <PuppyReveal key={p.id} puppy={p} awake={!!awake[p.id]} onLook={() => wake(p.id)} standardName={project.standard.name} />
        ))}
      </div>
      {litters.length > 1 && (
        <p className="text-[11.5px] text-[var(--text-faint)] mt-4 text-center">
          Litter {index + 1} of {litters.length}
        </p>
      )}
    </Sheet>
  );
}

function PuppyReveal({
  puppy,
  awake,
  onLook,
  standardName,
}: {
  puppy: Dog;
  awake: boolean;
  onLook: () => void;
  standardName: string;
}) {
  const { project } = useGame();
  const coat = resolveCoat(puppy.genotype, sizeToPounds(puppy.observed.size));
  const colour = resolveColor(puppy.genotype);
  const score = scoreDog(puppy, project.standard);
  const girl = puppy.sex === 'F';

  return (
    <button
      onClick={onLook}
      className={`card p-2 text-left min-w-0 transition-transform ${awake ? '' : 'active:scale-95'}`}
      aria-label={awake ? `${puppy.name}, ${colour.name}, ${coat.label}` : 'A sleeping puppy. Tap to look.'}
    >
      <div
        style={{
          filter: awake ? 'none' : 'grayscale(1) sepia(0.3) brightness(1.04) contrast(0.72)',
          transition: 'filter 1100ms ease 350ms',
        }}
      >
        <DogPortrait dog={puppy} fluid asleep={!awake} asAge={3} />
      </div>
      <div className="min-h-[58px] mt-1.5 px-0.5">
        {awake ? (
          <>
            <div className="reveal-in text-[11.5px] text-[var(--text-soft)] leading-snug" style={{ animationDelay: '0ms' }}>
              {coat.label}
            </div>
            <div className="reveal-in text-[12.5px] font-semibold leading-snug" style={{ animationDelay: '650ms' }}>
              {colour.name}
            </div>
            <div className="reveal-in flex items-center gap-1.5 mt-1" style={{ animationDelay: '1300ms' }}>
              <Chip tone={girl ? 'rare' : 'info'}>{girl ? '♀ a girl' : '♂ a boy'}</Chip>
              <span className="display text-[14px] font-semibold truncate">{puppy.name}</span>
            </div>
            <div className="reveal-in mt-1" style={{ animationDelay: '1700ms' }}>
              <Pips hit={score.goalsHit} total={score.goalsTotal} hits={score.breakdown.map((b) => b.score >= 0.7)} size={5} maxWidth={150} />
              <span className="text-[10.5px] text-[var(--text-faint)] ml-1.5">{standardName} {score.total}</span>
            </div>
          </>
        ) : (
          <div className="text-[12px] text-[var(--text-faint)] text-center pt-3">Tap to look…</div>
        )}
      </div>
    </button>
  );
}
