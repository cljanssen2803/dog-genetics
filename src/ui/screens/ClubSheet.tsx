/**
 * A notice from the breed club: a fashion the player can follow or resist.
 * See game/club.ts for how fashions are made up and what answering does.
 */

import { useMemo } from 'react';
import { Button, Card, Chip, Section, Sheet, StatRow } from '../components';
import { useGame } from '../GameContext';
import { type ClubProposal, answerClub, applyFashion } from '../../game/club';
import { breedingPopulation } from '../../game/project';
import { scoreDog } from '../../engine/standard';

export function ClubSheet({ proposal, onClose }: { proposal: ClubProposal; onClose: () => void }) {
  const { project, refresh, say } = useGame();
  const pending = proposal.status === 'pending';

  // What following would do to the kennel's numbers, so the choice is not blind.
  const before = useMemo(() => {
    const pop = breedingPopulation(project);
    if (pop.length === 0) return null;
    const now = pop.reduce((s, d) => s + scoreDog(d, project.standard).total, 0) / pop.length;
    const changed = applyFashion(project.standard, proposal.change);
    const after = pop.reduce((s, d) => s + scoreDog(d, changed).total, 0) / pop.length;
    return { now: Math.round(now), after: Math.round(after) };
  }, [project, proposal]);

  const answer = (follow: boolean) => {
    say(answerClub(project, proposal, follow));
    refresh();
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={proposal.title}
      subtitle="A notice from the breed club"
      footer={
        pending ? (
          <div className="flex gap-2">
            <Button tone="secondary" onClick={() => answer(false)} className="flex-1">
              Hold my line
            </Button>
            <Button onClick={() => answer(true)} className="flex-1" tone={proposal.flavour === 'virtue' ? 'primary' : 'accent'}>
              Follow the fashion
            </Button>
          </div>
        ) : (
          <Button full tone="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Chip tone={proposal.flavour === 'virtue' ? 'good' : 'warn'}>
            {proposal.flavour === 'virtue' ? 'A fault made a virtue' : 'A new fashion'}
          </Chip>
          {!pending && (
            <Chip tone={proposal.status === 'followed' ? 'info' : 'neutral'}>
              {proposal.status === 'followed' ? 'You followed it' : proposal.vindicated ? 'You held out — and were proved right' : 'You held your line'}
            </Chip>
          )}
        </div>
        <p className="text-[13.5px] leading-relaxed">{proposal.text}</p>
      </Card>

      <Section title="If you follow">
        <Card>
          <p className="text-[13px] leading-relaxed mb-2">{proposal.effect}</p>
          {before && (
            <>
              <StatRow label="Your breeding adults score now" value={before.now} />
              <StatRow
                label="They would score"
                value={before.after}
                tone={before.after > before.now + 2 ? 'good' : before.after < before.now - 2 ? 'bad' : undefined}
              />
            </>
          )}
          <p className="text-[12px] text-[var(--text-faint)] leading-relaxed mt-2">
            The standard changes and every dog is re-scored. The club is pleased: your reputation
            rises a little, and judges will be looking for the new type.
          </p>
        </Card>
      </Section>

      <Section title="If you hold your line">
        <Card>
          <p className="text-[13px] leading-relaxed">
            Nothing about your standard changes. The club sulks — a small dip in reputation — but
            fashions blow over. Keep breeding good dogs and, a few generations on, the club tends to
            decide that what you were doing was the type all along.
          </p>
        </Card>
      </Section>

      <p className="text-[11.5px] text-[var(--text-faint)] leading-relaxed px-1">
        This is how real breeds drift. Most standards were rewritten around the dogs people already
        had, and most of the colours a breed "always" had were once a fashion somebody fought.
      </p>
    </Sheet>
  );
}
