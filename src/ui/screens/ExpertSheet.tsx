/**
 * "Ask the expert" — the advisor's read on your kennel, as a sheet.
 */

import { useMemo, useState } from 'react';
import { Button, Card, Chip, Sheet } from '../components';
import { DogPortrait } from '../DogPortrait';
import { useGame } from '../GameContext';
import { DogDetailSheet } from '../dogs';
import { askExpert } from '../../game/expert';
import type { Dog } from '../../engine/dog';

const TONE: Record<string, 'good' | 'warn' | 'bad' | 'neutral'> = {
  good: 'good',
  warn: 'warn',
  bad: 'bad',
  neutral: 'neutral',
};

export function ExpertSheet({ onClose }: { onClose: () => void }) {
  const { project } = useGame();
  const [open, setOpen] = useState<Dog | null>(null);
  const report = useMemo(() => askExpert(project), [project, project.month, project.rngCursor]);

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title="Ask the expert"
        subtitle="An experienced breeder's read on your kennel, right now"
        footer={
          <Button full onClick={onClose}>
            Got it
          </Button>
        }
      >
        <Card className="mb-4 border-[var(--brand)]">
          <div className="text-[12px] font-semibold text-[var(--text-faint)] mb-1">In one sentence</div>
          <p className="text-[14px] leading-relaxed">{report.summary}</p>
        </Card>

        {report.sections.map((section, i) => (
          <Card key={i} className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <Chip tone={TONE[section.tone]}>{section.title}</Chip>
            </div>
            <div className="display text-[15px] font-semibold mb-1.5">{section.headline}</div>
            {section.lines.map((line, j) => (
              <p key={j} className="text-[13px] text-[var(--text-soft)] leading-relaxed mb-2 last:mb-0">
                {line}
              </p>
            ))}
            {section.dogIds && section.dogIds.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {section.dogIds.map((id) => {
                  const dog = project.dogs[id];
                  if (!dog) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => setOpen(dog)}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg-2)] pr-2.5 active:bg-[var(--card)]"
                    >
                      <DogPortrait dog={dog} size={44} />
                      <span className="text-[12px] font-semibold">{dog.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        ))}

        <p className="text-[11.5px] text-[var(--text-faint)] leading-relaxed px-1">
          This is worked out from your actual dogs and the same litter simulations the pairing screen
          uses. It is advice, not instruction — the expert has never been wrong about genetics and has
          been wrong about plenty of dogs.
        </p>
      </Sheet>

      <DogDetailSheet dog={open} onClose={() => setOpen(null)} />
    </>
  );
}
