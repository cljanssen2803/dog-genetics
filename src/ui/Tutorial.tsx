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
    title: 'You are building a breed, not a dog',
    body: [
      'One brilliant individual proves nothing. The goal is a whole population that reliably produces the kind of dog you defined — healthy, consistent, and with enough genetic variety left to keep going.',
      'That usually takes eight to fifteen generations. Each generation is a handful of decisions, not a grind.',
    ],
  },
  {
    title: 'Your foundation dogs are deliberately imperfect',
    body: [
      'Look at the Kennel tab. These dogs get you partway to your goal and each brings problems with them — that is the point. If they were already perfect there would be nothing to do.',
      'Every dog has a score against your standard. A score of 40 is not a bad dog; it is a starting point.',
    ],
    goTo: 'kennel',
    goToLabel: 'Show me the kennel',
  },
  {
    title: 'Pick a parent, then compare mates',
    body: [
      'On the Breed tab you choose one dog, and the game ranks every possible partner for it.',
      'Before you commit, the pairing preview quietly simulates thirty litters from that pair and tells you what actually came out: how many puppies would meet your standard, what would improve, what would get worse, and whether any puppies would be born with an inherited disease.',
      'Tap "Why this match?" for the full reasoning in plain English.',
    ],
    goTo: 'breed',
    goToLabel: 'Show me the breeding screen',
  },
  {
    title: 'Watch the inbreeding number',
    body: [
      'COI — the inbreeding coefficient — is the most useful number on the screen. 0% means the parents share no ancestors. 25% means they are effectively full siblings.',
      'A little inbreeding makes a population consistent. Too much quietly destroys fertility, litter size and lifespan, and brings hidden diseases to the surface. Keep an eye on the average across your whole kennel, not just on individual pairings.',
    ],
  },
  {
    title: 'Puppies are a gamble on purpose',
    body: [
      'A DNA test tells you a puppy\'s coat and disease genes exactly, on day one. Nothing can tell you its adult temperament, its final size, or how long it will live.',
      'So young puppies show ranges rather than numbers, and those ranges narrow as they grow. Keeping a puppy on a wide range is a bet. Waiting to find out costs you kennel space you may need.',
    ],
  },
  {
    title: 'Space forces the real choices',
    body: [
      'You have twelve kennel spaces. A good litter will contain the best temperament puppy, the best coat puppy, and the puppy that brings the most genetic diversity — and they will not be the same puppy.',
      'Everyone you do not keep goes to a pet home. Match them to the right kind of home and they will do well.',
    ],
  },
  {
    title: 'Then move time forward',
    body: [
      'Nothing happens until you advance the calendar. Pregnancies take two months. Dogs mature at two years, and they age, retire and eventually die.',
      'At the end of each generation, close it out for a report on what genuinely changed — and a suggestion for what your population needs next.',
      'That question is the whole game: what does my population need now, and which pairing gets me there without creating a different problem?',
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
