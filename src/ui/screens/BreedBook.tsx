/**
 * THE BREED BOOK
 *
 * The thing you made, as a thing you can show someone: the standard written
 * up like a real kennel-club standard, the founders, the champions, the best
 * of the current kennel, and the story so far. Plus the "where it started"
 * retrospective — generation one beside today — which is the single most
 * satisfying view a fifteen-generation project can offer.
 *
 * Also the milestone cards, because a moment that matters deserves better
 * than a line in a log.
 */

import { useMemo } from 'react';
import { Button, Card, Chip, Section, Sheet, StatRow } from '../components';
import { DogPortrait } from '../DogPortrait';
import { useGame } from '../GameContext';
import { copyText, describeDog } from '../DogFacts';
import { type Milestone, type Project, activeDogs } from '../../game/project';
import { retrospective } from '../../game/story';
import { scoreDog, type BreedStandard, PRIORITY_LABEL, DERIVED_LABEL } from '../../engine/standard';
import { TRAITS, type PolyTrait } from '../../engine/traits';
import { EAR_LABEL, TAIL_LABEL } from '../../engine/phenotype';

// ---------------------------------------------------------------------------
// The written standard
// ---------------------------------------------------------------------------

/**
 * Turn the goals into prose in the register of a real breed standard —
 * "General appearance", "Temperament", "Faults" — because reading your own
 * requirements back as a formal document is oddly moving.
 */
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function writtenStandard(project: Project): string[] {
  const s: BreedStandard = project.standard;
  const paras: string[] = [];

  const size = s.traitGoals.size;
  const build = s.traitGoals.substance;
  const muzzle = s.traitGoals.muzzle;

  const general: string[] = [];
  if (size) general.push(`The ${s.name} is a dog of ${size.preferredLow}–${size.preferredHigh} lb`);
  else general.push(`The ${s.name} is a dog of no fixed size`);
  if (build) general.push(`, of ${describeRange(build, 'fine, racy', 'moderate', 'heavy, substantial')} build`);
  if (muzzle) general.push(`, with a ${describeRange(muzzle, 'short', 'medium-length', 'long')} muzzle`);
  paras.push(`GENERAL APPEARANCE. ${general.join('')}. ${s.vision || ''}`.trim());

  const coatBits: string[] = [];
  if (s.coatGoal && s.coatGoal.kinds.length) {
    const names: Record<string, string> = {
      smooth: 'smooth and close',
      short: 'short',
      silky: 'long and silky',
      long: 'long and furnished',
      doubleThick: 'dense and double',
      wire: 'harsh and wiry, with beard and eyebrows',
      wavyFurnished: 'wavy and furnished',
      curly: 'tightly curled',
      hairless: 'absent, the skin bare and soft',
    };
    coatBits.push(`The coat is ${s.coatGoal.kinds.map((k) => names[k] ?? k).join(' or ')}`);
  }
  for (const [key, goal] of Object.entries(s.derivedGoals)) {
    if (!goal || goal.priority === 0) continue;
    const label = DERIVED_LABEL[key as keyof typeof DERIVED_LABEL].toLowerCase();
    coatBits.push(`${label.charAt(0).toUpperCase() + label.slice(1)} should be ${describeRange(goal, 'low', 'moderate', 'high')}`);
  }
  if (s.colorGoal?.text) coatBits.push(`Colour: ${s.colorGoal.text} preferred; all colours acceptable`);
  if (coatBits.length) paras.push(`COAT AND COLOUR. ${coatBits.join('. ')}.`);

  if (s.earGoal && s.earGoal.types.length) {
    paras.push(`HEAD. Ears ${s.earGoal.types.map((t) => EAR_LABEL[t].toLowerCase()).join(' or ')}.`);
  }
  if (s.tailGoal && s.tailGoal.types.length) {
    paras.push(`TAIL. ${s.tailGoal.types.map((t) => TAIL_LABEL[t]).join(' or ')}.`);
  }

  const temper: string[] = [];
  for (const trait of ['stability', 'sociability', 'biddability', 'energy', 'preyDrive', 'persistence', 'independence', 'alertness', 'vocality', 'handling'] as PolyTrait[]) {
    const goal = s.traitGoals[trait];
    if (!goal || goal.priority === 0) continue;
    temper.push(`${TRAITS[trait].label.toLowerCase()} ${describeRange(goal, 'low', 'moderate', 'high')}`);
  }
  if (temper.length) paras.push(`TEMPERAMENT. ${cap(temper.join('; '))}.`);

  const health: string[] = [];
  for (const trait of ['structure', 'longevity', 'fertility'] as PolyTrait[]) {
    const goal = s.traitGoals[trait];
    if (!goal || goal.priority === 0) continue;
    health.push(`${TRAITS[trait].label.toLowerCase()} is ${PRIORITY_LABEL[goal.priority].toLowerCase() === "don't care" ? 'unimportant' : 'a priority'}`);
  }
  paras.push(`HEALTH. ${health.length ? cap(health.join('; ')) + '. ' : ''}Inherited disease is a ${s.healthPriority >= 3 ? 'serious' : 'moderate'} fault. Affected dogs are not bred from.`);

  paras.push('FAULTS. Any departure from the foregoing points should be considered a fault, and the seriousness with which it is regarded should be in exact proportion to its degree.');
  return paras;
}

function describeRange(goal: { mode: string; preferredLow?: number; preferredHigh?: number }, low: string, mid: string, high: string): string {
  if (goal.mode === 'higher') return high;
  if (goal.mode === 'lower') return low;
  const centre = ((goal.preferredLow ?? 50) + (goal.preferredHigh ?? 50)) / 2;
  return centre >= 66 ? high : centre <= 36 ? low : mid;
}

// ---------------------------------------------------------------------------
// The book
// ---------------------------------------------------------------------------

export function BreedBookSheet({ onClose }: { onClose: () => void }) {
  const { project, say } = useGame();
  const retro = useMemo(() => retrospective(project), [project, project.month]);
  const standard = useMemo(() => writtenStandard(project), [project.standard]);
  const champions = Object.values(project.dogs).filter((d) => d.titles && d.titles.length > 0);
  const milestones = project.milestones ?? [];

  const exportBook = () => {
    const lines: string[] = [];
    lines.push(`THE ${project.standard.name.toUpperCase()}`);
    lines.push(`A breed developed over ${retro.years.toFixed(1)} years and ${retro.generations} generations.`);
    lines.push('');
    lines.push(...standard, '');
    lines.push('FOUNDERS');
    for (const d of retro.founders) lines.push(`- ${d.name} (${d.breedLabel})`);
    if (champions.length) {
      lines.push('', 'CHAMPIONS');
      for (const d of champions) lines.push(`- ${d.titles!.join(' ')} ${d.name}`);
    }
    lines.push('', 'MILESTONES');
    for (const m of milestones) lines.push(`- Year ${(m.month / 12).toFixed(1)}: ${m.title}. ${m.text}`);
    lines.push('', 'THE KENNEL TODAY');
    for (const d of retro.bestNow) {
      const f = describeDog(d, project);
      lines.push(`- ${f.name}: ${f.colour}, ${f.coat.toLowerCase()}, ${f.adultWeight}, score ${f.score}`);
    }
    void copyText(lines.join('\n')).then((ok) => say(ok ? 'Breed book copied.' : 'Could not copy.'));
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={project.sandbox ? project.name : `The ${project.standard.name}`}
      subtitle={`${retro.years.toFixed(1)} years · ${retro.generations} generation${retro.generations === 1 ? '' : 's'} · ${retro.everLived} dogs`}
      footer={
        <div className="flex gap-2">
          <Button tone="secondary" onClick={exportBook}>
            Copy as text
          </Button>
          <Button full onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <Section title="Where it started" subtitle="Generation one beside today.">
        <Card>
          <div className="text-[11px] font-semibold text-[var(--text-faint)] mb-1.5">THE FOUNDERS</div>
          <div className="flex gap-1.5 mb-3 overflow-x-auto">
            {retro.founders.map((d) => (
              <div key={d.id} className="flex-none w-[84px] text-center">
                <DogPortrait dog={d} size={84} />
                <div className="text-[10.5px] mt-0.5 truncate">{d.name}</div>
                <div className="text-[9.5px] text-[var(--text-faint)] truncate">{d.status === 'deceased' ? '†' : ''} {project.sandbox ? '' : scoreDog(d, project.standard).total}</div>
              </div>
            ))}
          </div>
          <div className="text-[11px] font-semibold text-[var(--text-faint)] mb-1.5">THE KENNEL TODAY</div>
          <div className="flex gap-1.5 mb-3 overflow-x-auto">
            {retro.bestNow.map((d) => (
              <div key={d.id} className="flex-none w-[84px] text-center">
                <DogPortrait dog={d} size={84} />
                <div className="text-[10.5px] mt-0.5 truncate">{d.name}</div>
                <div className="text-[9.5px] text-moss truncate">{project.sandbox ? '' : scoreDog(d, project.standard).total}</div>
              </div>
            ))}
          </div>
          {retro.then ? (
            <>
              {!project.sandbox && (
                <>
                  <StatRow label="Average score" value={`${Math.round(retro.then.score)} → ${Math.round(retro.now.score)}`} tone={retro.now.score >= retro.then.score ? 'good' : 'warn'} />
                  <StatRow label="Meeting the standard" value={`${Math.round(retro.then.meets)}% → ${Math.round(retro.now.meets)}%`} tone={retro.now.meets >= retro.then.meets ? 'good' : 'warn'} />
                </>
              )}
              <StatRow label="Average weight" value={`${retro.then.weight.toFixed(0)} lb → ${retro.now.weight.toFixed(0)} lb`} />
            </>
          ) : (
            <p className="text-[12px] text-[var(--text-faint)]">Close out your first generation to start the comparison.</p>
          )}
        </Card>
      </Section>

      {!project.sandbox && <Section title="The standard" subtitle="Your goals, written up the way a kennel club would.">
        <Card>
          {standard.map((p, i) => (
            <p key={i} className="text-[12.5px] leading-relaxed mb-2 last:mb-0 font-serif">
              <strong>{p.slice(0, p.indexOf('.') + 1)}</strong>
              {p.slice(p.indexOf('.') + 1)}
            </p>
          ))}
        </Card>
      </Section>}

      {champions.length > 0 && (
        <Section title="Champions">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {champions.map((d) => (
              <div key={d.id} className="flex-none w-[96px] text-center">
                <DogPortrait dog={d} size={96} />
                <div className="text-[11px] mt-0.5 truncate">
                  <span className="text-rust-deep font-semibold">{d.titles![d.titles!.length - 1]}</span> {d.name}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="The story so far">
        <Card>
          {milestones.length === 0 ? (
            <p className="text-[12.5px] text-[var(--text-faint)]">Nothing marked yet. The first litter is where it begins.</p>
          ) : (
            milestones.map((m) => (
              <div key={m.key} className="flex gap-3 py-2 border-b border-[var(--line)] last:border-0">
                <span className="flex-none w-14 text-[11px] text-[var(--text-faint)] pt-0.5">Year {(m.month / 12).toFixed(1)}</span>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold">{m.title}</div>
                  <p className="text-[12px] text-[var(--text-soft)] leading-relaxed">{m.text}</p>
                </div>
              </div>
            ))
          )}
        </Card>
      </Section>

      <Section title="In numbers">
        <Card>
          <StatRow label="Dogs that have lived here" value={retro.everLived} />
          <StatRow label="Living in the kennel" value={activeDogs(project).length} />
          <StatRow label="Champions" value={retro.champions} />
          <StatRow label="Rare finds" value={project.discoveries.length} />
        </Card>
      </Section>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Milestone cards
// ---------------------------------------------------------------------------

export function MilestoneSheet({ milestones, onClose }: { milestones: Milestone[]; onClose: () => void }) {
  const { project } = useGame();
  return (
    <Sheet
      open
      onClose={onClose}
      title={milestones.length === 1 ? milestones[0].title : 'Milestones'}
      subtitle="Worth stopping for"
      footer={
        <Button full onClick={onClose}>
          Carry on
        </Button>
      }
    >
      {milestones.map((m) => (
        <Card key={m.key} className="mb-3 border-[var(--brand)]">
          <div className="flex items-center gap-2 mb-1">
            <Chip tone="good">milestone</Chip>
            <span className="text-[11px] text-[var(--text-faint)]">Year {(m.month / 12).toFixed(1)}</span>
          </div>
          <div className="display text-[18px] font-semibold mb-1">{m.title}</div>
          <p className="text-[13.5px] leading-relaxed text-[var(--text-soft)] mb-2">{m.text}</p>
          {m.dogIds.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto">
              {m.dogIds.map((id) => {
                const d = project.dogs[id];
                return d ? (
                  <div key={id} className="flex-none text-center w-[72px]">
                    <DogPortrait dog={d} size={72} />
                    <div className="text-[10.5px] truncate">{d.name}</div>
                  </div>
                ) : null;
              })}
            </div>
          )}
        </Card>
      ))}
    </Sheet>
  );
}
