/**
 * The dog show screen: pick a dog, enter it, read the judge's critique.
 */

import { useState } from 'react';
import { Button, Card, Chip, Empty, Explain, Section, Sheet, StatRow } from '../components';
import { DogPortrait } from '../DogPortrait';
import { useGame } from '../GameContext';
import { type Dog, ageMonths, formatAge } from '../../engine/dog';
import { sizeToPounds } from '../../engine/traits';
import { activeDogs, reputationTier } from '../../game/project';
import { CLASS_LABEL, type ShowResult, canShow, runShow, titleFor } from '../../game/shows';

export function ShowSheet({ onClose }: { onClose: () => void }) {
  const { project, refresh, say } = useGame();
  const [result, setResult] = useState<ShowResult | null>(null);

  const standing = reputationTier(project.reputation ?? 0);

  const candidates = activeDogs(project)
    .map((dog) => ({ dog, eligibility: canShow(project, dog) }))
    .sort((a, b) => Number(b.eligibility.ok) - Number(a.eligibility.ok) || a.dog.name.localeCompare(b.dog.name));

  const enter = (dog: Dog) => {
    const outcome = runShow(project, dog.id);
    if (!outcome) {
      say('That dog cannot be shown right now.');
      return;
    }
    setResult(outcome);
    refresh();
  };

  if (result) {
    return <ResultView result={result} onClose={onClose} onAgain={() => setResult(null)} />;
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Dog shows"
      subtitle={`Your kennel: ${standing.label}${project.reputation ? ` · ${project.reputation} points` : ''}`}
    >
      <Explain title="How is my dog judged against other breeds?">
        <p>
          It is not. Real shows never compare breeds to each other — they compare each dog to its own
          breed's written standard and ask how good an example of that breed it is.
        </p>
        <p>
          So your dog is judged against <strong>your</strong> standard, and the dogs beside it are
          judged against theirs. Everyone is answering the same question about a different target.
        </p>
        <p>
          Three things decide it: <strong>type</strong> (how well the dog embodies what you said you
          were building), <strong>soundness</strong> (structure and constitution), and{' '}
          <strong>showmanship</strong> — whether the dog can stand still while a stranger goes over
          it in a noisy hall. That last one is almost pure temperament, and it is where a beautiful
          but highly-strung dog loses to a plainer, steadier one.
        </p>
        <p>
          Judges have preferences, so your best dog on paper will not always win. Winning earns
          points, points earn titles, and a kennel with a reputation gets better dogs offered to it
          when you go looking for an outcross.
        </p>
      </Explain>

      <Section title="Enter a dog">
        {candidates.length === 0 ? (
          <Empty>You have no dogs to show.</Empty>
        ) : (
          candidates.map(({ dog, eligibility }) => (
            <Card key={dog.id} className="mb-2">
              <div className="flex items-center gap-3">
                <DogPortrait dog={dog} size={64} />
                <div className="flex-1 min-w-0">
                  <div className="display font-semibold text-[14.5px] flex items-center gap-1.5">
                    {dog.titles && dog.titles.length > 0 && (
                      <span className="text-rust">{dog.titles[dog.titles.length - 1]}</span>
                    )}
                    {dog.name}
                    <span className="text-[var(--text-faint)]">{dog.sex === 'M' ? '♂' : '♀'}</span>
                  </div>
                  <div className="text-[11.5px] text-[var(--text-faint)]">
                    {formatAge(ageMonths(dog, project.month))} · {sizeToPounds(dog.observed.size).toFixed(1)} lb
                    {dog.showPoints ? ` · ${dog.showPoints} show points` : ''}
                  </div>
                  {!eligibility.ok && (
                    <div className="text-[11.5px] text-[var(--text-faint)] mt-0.5">{eligibility.reason}</div>
                  )}
                  {eligibility.ok && eligibility.showClass && (
                    <Chip className="mt-1">{CLASS_LABEL[eligibility.showClass]} class</Chip>
                  )}
                </div>
                <Button small onClick={() => enter(dog)} disabled={!eligibility.ok}>
                  Enter
                </Button>
              </div>
            </Card>
          ))
        )}
      </Section>
    </Sheet>
  );
}

function ResultView({
  result,
  onClose,
  onAgain,
}: {
  result: ShowResult;
  onClose: () => void;
  onAgain: () => void;
}) {
  const { project } = useGame();
  const dog = project.dogs[result.dogId];
  const nextTitle = dog ? titleFor((dog.showPoints ?? 0) + 15) : null;

  const headline =
    result.placement === 1
      ? result.bestInShow
        ? 'Best in Show'
        : 'First in class'
      : result.placement > 0
        ? `${['', 'First', 'Second', 'Third', 'Fourth'][result.placement]} place`
        : 'Unplaced';

  return (
    <Sheet
      open
      onClose={onClose}
      title={headline}
      subtitle={`${result.dogName} · ${CLASS_LABEL[result.showClass]} class`}
      footer={
        <div className="flex gap-2">
          <Button tone="secondary" onClick={onAgain}>
            Show another
          </Button>
          <Button full onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      {result.newTitle && (
        <Card className="mb-4 border-clay">
          <div className="flex items-center gap-2 mb-1">
            <Chip tone="rare">new title</Chip>
            <span className="text-[14px] font-semibold">{result.dogName} is now a {result.newTitle}</span>
          </div>
          <p className="text-[12.5px] text-[var(--text-soft)] leading-relaxed">
            The title sits in front of the name from now on, and on every pedigree{' '}
            {result.dogName} appears in.
          </p>
        </Card>
      )}

      {dog && (
        <div className="flex justify-center mb-3">
          <DogPortrait dog={dog} size={170} />
        </div>
      )}

      <Section title="The judge's critique">
        <Card>
          <p className="text-[13.5px] leading-relaxed italic">{result.critique}</p>
        </Card>
      </Section>

      <Section title="How it was scored">
        <Card>
          {(() => {
            const me = result.entrants.find((e) => e.isPlayer)!;
            return (
              <>
                <StatRow label="Breed type" value={Math.round(me.type)} />
                <StatRow label="Soundness" value={Math.round(me.soundness)} />
                <StatRow label="Showmanship" value={Math.round(me.showmanship)} />
                <StatRow label="Points won" value={result.points} tone={result.points > 0 ? 'good' : undefined} />
              </>
            );
          })()}
        </Card>
      </Section>

      <Section title="The line-up">
        <Card>
          {result.entrants.map((entrant, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 py-2 border-b border-[var(--line)] last:border-0 ${
                entrant.isPlayer ? 'font-semibold' : ''
              }`}
            >
              <span className="w-6 text-[13px] text-[var(--text-faint)] tabular-nums">{index + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] truncate">
                  {entrant.name}
                  {entrant.isPlayer && <span className="text-rust"> — your dog</span>}
                </div>
                <div className="text-[11px] text-[var(--text-faint)]">{entrant.breeder}</div>
              </div>
              <span className="text-[12px] tabular-nums text-[var(--text-soft)]">
                {Math.round(entrant.total)}
              </span>
            </div>
          ))}
        </Card>
      </Section>

      {dog && !result.newTitle && nextTitle && (
        <p className="text-[12px] text-[var(--text-faint)] leading-relaxed px-1">
          {dog.name} has {dog.showPoints ?? 0} points. Titles are awarded at 15 and 40.
        </p>
      )}
    </Sheet>
  );
}
