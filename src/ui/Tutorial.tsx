/**
 * FIRST-RUN TUTORIAL
 *
 * A short walkthrough that explains the loop in plain language. It does not
 * lock the interface or force a sequence — the player can close it at any
 * point and poke around instead.
 */

import { useState } from 'react';
import { Button, Sheet } from './components';

interface Step {
  title: string;
  body: string[];
  goTo?: string;
  goToLabel?: string;
}

const STEPS: Step[] = [
  {
    title: 'The card tells you what to do',
    body: [
      'The Today screen has one card: Do this next. It reads your kennel and says what the sensible move is — breed, wait, sort a litter, bring in a dog. You can always ignore it.',
      'You are building a breed, not a dog: a whole population that reliably produces what you described. That takes ten or so generations, a handful of decisions each.',
    ],
  },
  {
    title: 'Breed, wait, sort — that is the loop',
    body: [
      'Breed: pick a parent and a mate (or let the plan pick). Wait: press ⏩ and the puppies arrive. Sort: keep the ones that move you forward, place the rest in good homes.',
      'Every dog shows how many of your goals it hits (the little dots). Watch those climb.',
    ],
    goTo: 'breed',
    goToLabel: 'Show me the Breed tab',
  },
  {
    title: 'Two things can go wrong',
    body: [
      'Space: the kennel is small on purpose, so keeping a puppy means letting someone go.',
      'Inbreeding: every dog bred inside the kennel makes the next generation more related. When the number creeps up, bring in an outside dog. Everything else is detail.',
    ],
  },
];

export function Tutorial({
  onClose,
  onGoTo,
}: {
  onClose: () => void;
  onGoTo: (tab: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  return (
    <Sheet
      open
      onClose={onClose}
      title={step.title}
      subtitle={`${index + 1} of ${STEPS.length}`}
      footer={
        <div className="flex gap-2">
          {index > 0 && (
            <Button tone="secondary" onClick={() => setIndex((i) => i - 1)}>
              Back
            </Button>
          )}
          <Button
            full
            onClick={() => {
              if (last) onClose();
              else setIndex((i) => i + 1);
            }}
          >
            {last ? 'Start breeding' : 'Next'}
          </Button>
        </div>
      }
    >
      {step.body.map((paragraph, i) => (
        <p key={i} className="text-[14px] leading-relaxed mb-3 text-[var(--text-soft)]">
          {paragraph}
        </p>
      ))}

      {step.goTo && (
        <Button
          tone="secondary"
          full
          small
          className="mt-2"
          onClick={() => {
            onGoTo(step.goTo!);
          }}
        >
          {step.goToLabel}
        </Button>
      )}

      <button onClick={onClose} className="w-full text-center text-[12px] text-[var(--text-faint)] mt-4">
        Skip the tutorial
      </button>
    </Sheet>
  );
}
