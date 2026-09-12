/**
 * PEDIGREES AND ANALYTICS
 *
 * Two views of the same thing: who is related to whom, and what all those
 * decisions have added up to over the generations.
 */

import { useMemo } from 'react';
import { Button, Card, Chip, Empty, Explain, Section, StatRow } from '../components';
import { DogPortrait } from '../DogPortrait';
import { useGame } from '../GameContext';
import { type Dog, ageMonths } from '../../engine/dog';
import { sizeToPounds } from '../../engine/traits';
import { LOCUS_BY_KEY } from '../../engine/loci';
import {
  type PedigreeNode,
  buildPedigree,
  describeCoi,
  genomeContribution,
} from '../../engine/pedigree';
import {
  activeDogs,
  breedingPopulation,
  lookupDog,
  takeSnapshot,
} from '../../game/project';
import { assessEstablishment } from '../../game/analytics';

// ---------------------------------------------------------------------------
// Pedigree
// ---------------------------------------------------------------------------

export function PedigreeTab({
  focusDog,
  onFocus,
}: {
  focusDog: Dog | null;
  onFocus: (dog: Dog | null) => void;
}) {
  const { project } = useGame();
  const dogs = activeDogs(project).sort((a, b) => b.generation - a.generation);
  const dog = focusDog ?? dogs[0] ?? null;

  const tree = useMemo(
    () => (dog ? buildPedigree(dog.id, lookupDog(project), 4) : null),
    [dog, project, project.month],
  );

  const contributions = useMemo(() => {
    const population = breedingPopulation(project);
    const map = genomeContribution(population, lookupDog(project));
    return Array.from(map.entries())
      .map(([id, share]) => ({ dog: project.dogs[id], share }))
      .filter((e) => e.dog)
      .sort((a, b) => b.share - a.share)
      .slice(0, 8);
  }, [project, project.month]);

  if (!dog || !tree) {
    return (
      <div className="px-4 pb-28 pt-3">
        <Empty>No dogs in the kennel yet.</Empty>
      </div>
    );
  }

  return (
    <div className="px-4 pb-28 pt-3">
      <Explain title="How to read a pedigree">
        <p>
          The dog you are looking at is on the left. Its father (the sire) is the top box in the next
          column, its mother (the dam) the bottom one, and so on backwards through the generations.
        </p>
        <p>
          What matters is <strong>repeats</strong>. If the same name shows up in more than one place,
          the dog is inbred on that ancestor — and the closer the repeats, the stronger the effect.
        </p>
      </Explain>

      <Section title="Whose pedigree?">
        <div className="scroll-x flex gap-2 pb-2">
          {dogs.map((d) => (
            <button
              key={d.id}
              onClick={() => onFocus(d)}
              className={`flex-none rounded-xl border px-3 py-2 text-[12px] font-medium whitespace-nowrap ${
                d.id === dog.id
                  ? 'bg-[var(--brand)] text-white border-transparent'
                  : 'bg-[var(--card)] border-[var(--line)]'
              }`}
            >
              {d.name} {d.sex === 'M' ? '♂' : '♀'}
            </button>
          ))}
        </div>
      </Section>

      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <DogPortrait dog={dog} size={80} />
          <div>
            <div className="display text-[16px] font-semibold">{dog.name}</div>
            <div className="text-[12px] text-[var(--text-faint)]">
              Generation {dog.generation} · {dog.breedLabel}
            </div>
            <Chip
              tone={
                describeCoi(dog.coi).tone === 'bad'
                  ? 'bad'
                  : describeCoi(dog.coi).tone === 'warn'
                    ? 'warn'
                    : 'good'
              }
              className="mt-1"
            >
              Inbreeding {(dog.coi * 100).toFixed(1)}% — {describeCoi(dog.coi).label.toLowerCase()}
            </Chip>
          </div>
        </div>
      </Card>

      <Section title="Family tree" subtitle="Scroll sideways for older generations.">
        <div className="card p-2 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {[0, 1, 2, 3].map((generation) => (
              <div key={generation} className="flex flex-col justify-around gap-1.5" style={{ width: 116 }}>
                {collectGeneration(tree, generation).map((node, index) => (
                  <PedigreeBox key={index} node={node} onFocus={onFocus} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section
        title="Who your gene pool actually comes from"
        subtitle="Share of your breeding population's ancestry traced back to each founder."
      >
        <div className="card p-3">
          {contributions.length === 0 ? (
            <p className="text-[13px] text-[var(--text-faint)]">Not enough pedigree depth yet.</p>
          ) : (
            contributions.map((entry) => (
              <div key={entry.dog.id} className="py-1.5 border-b border-[var(--line)] last:border-0">
                <div className="flex justify-between items-baseline text-[12.5px] mb-1">
                  <span className="font-medium">{entry.dog.name}</span>
                  <span className="tabular-nums font-semibold">{Math.round(entry.share * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-2)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${entry.share > 0.3 ? 'bg-berry' : entry.share > 0.2 ? 'bg-rust' : 'bg-[var(--brand)]'}`}
                    style={{ width: `${Math.min(100, entry.share * 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}

/** Flatten one column of the tree, keeping empty slots so the layout lines up. */
function collectGeneration(node: PedigreeNode, target: number): (PedigreeNode | null)[] {
  if (target === 0) return [node];
  const walk = (n: PedigreeNode | null, level: number): (PedigreeNode | null)[] => {
    if (level === target) return [n];
    if (!n) return [...walk(null, level + 1), ...walk(null, level + 1)];
    return [...walk(n.sire, level + 1), ...walk(n.dam, level + 1)];
  };
  return walk(node, 0);
}

function PedigreeBox({
  node,
  onFocus,
}: {
  node: PedigreeNode | null;
  onFocus: (dog: Dog) => void;
}) {
  if (!node?.dog) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] px-2 py-2 text-[10.5px] text-[var(--text-faint)] text-center">
        unknown
      </div>
    );
  }
  const dog = node.dog;
  return (
    <button
      onClick={() => onFocus(dog)}
      className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] px-2 py-1.5 text-left active:bg-[var(--card)]"
    >
      <div className="text-[11.5px] font-semibold truncate">
        {dog.name} {dog.sex === 'M' ? '♂' : '♀'}
      </div>
      <div className="text-[10px] text-[var(--text-faint)] truncate">
        {sizeToPounds(dog.observed.size).toFixed(0)} lb
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export function AnalyticsTab() {
  const { project } = useGame();
  const snapshot = useMemo(() => takeSnapshot(project), [project, project.month]);
  const establishment = useMemo(() => assessEstablishment(project), [project, project.month]);
  const history = project.history;

  const carriers = Object.entries(snapshot.carrierFrequency)
    .filter(([k]) => LOCUS_BY_KEY[k]?.category === 'disease')
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="px-4 pb-28 pt-3">
      <Section title="Breed status">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="display text-[17px] font-semibold">
              {establishment.established ? 'ESTABLISHED' : 'In development'}
            </span>
            <Chip tone={establishment.established ? 'good' : 'neutral'}>
              {establishment.standardisation}% standardised
            </Chip>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-2)] overflow-hidden mb-3">
            <div
              className="h-full bg-[var(--brand)] rounded-full transition-all"
              style={{ width: `${establishment.standardisation}%` }}
            />
          </div>
          {establishment.criteria.map((c) => (
            <div key={c.label} className="flex items-start gap-2 py-1.5 border-b border-[var(--line)] last:border-0">
              <span className={`text-[13px] ${c.met ? 'text-moss' : 'text-[var(--text-faint)]'}`}>
                {c.met ? '✓' : '○'}
              </span>
              <div className="flex-1">
                <div className="text-[12.5px] font-medium">{c.label}</div>
                <div className="text-[11.5px] text-[var(--text-faint)]">{c.detail}</div>
              </div>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Right now">
        <Card>
          <StatRow label="Breeding adults" value={snapshot.populationSize} />
          <StatRow label="Average project score" value={Math.round(snapshot.averageScore)} />
          <StatRow
            label="Meeting your standard"
            value={`${Math.round(snapshot.percentMeetingStandard)}%`}
          />
          <StatRow
            label="Average inbreeding"
            value={`${(snapshot.averageCoi * 100).toFixed(1)}%`}
            tone={snapshot.averageCoi > 0.1 ? 'bad' : snapshot.averageCoi > 0.06 ? 'warn' : 'good'}
          />
          <StatRow label="Separate family lines" value={snapshot.familyLines} tone={snapshot.familyLines <= 2 ? 'warn' : 'good'} />
          <StatRow label="Effective founders" value={snapshot.effectiveFounders.toFixed(1)} />
          <StatRow label="Average adult weight" value={`${snapshot.averageWeight.toFixed(1)} lb`} />
          {snapshot.averageLifespan !== null && (
            <StatRow label="Average lifespan so far" value={`${snapshot.averageLifespan.toFixed(1)} years`} />
          )}
        </Card>
      </Section>

      {history.length >= 2 && (
        <Section title="Progress by generation">
          <Card className="mb-2">
            <Chart
              title="Meeting your standard"
              suffix="%"
              values={history.map((h) => h.percentMeetingStandard)}
              labels={history.map((h) => `G${h.generation}`)}
              color="var(--brand)"
              max={100}
            />
          </Card>
          <Card className="mb-2">
            <Chart
              title="Average inbreeding"
              suffix="%"
              values={history.map((h) => h.averageCoi * 100)}
              labels={history.map((h) => `G${h.generation}`)}
              color="var(--color-berry)"
              invertGood
            />
          </Card>
          <Card className="mb-2">
            <Chart
              title="Average project score"
              values={history.map((h) => h.averageScore)}
              labels={history.map((h) => `G${h.generation}`)}
              color="var(--color-moss)"
              max={100}
            />
          </Card>
          <Card>
            <Chart
              title="Average adult weight"
              suffix=" lb"
              values={history.map((h) => h.averageWeight)}
              labels={history.map((h) => `G${h.generation}`)}
              color="var(--color-clay)"
            />
          </Card>
        </Section>
      )}

      <Section title="Disease carriers in your breeding population">
        <Card>
          {carriers.length === 0 ? (
            <p className="text-[13px] text-moss font-medium">
              No disease genes detected in your breeding dogs.
            </p>
          ) : (
            carriers.map(([key, freq]) => (
              <div key={key} className="py-1.5 border-b border-[var(--line)] last:border-0">
                <div className="flex justify-between items-baseline text-[12.5px] mb-1">
                  <span className="font-medium">{LOCUS_BY_KEY[key].name}</span>
                  <span className="tabular-nums font-semibold">{Math.round(freq * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-2)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${freq > 0.4 ? 'bg-berry' : freq > 0.2 ? 'bg-rust' : 'bg-moss'}`}
                    style={{ width: `${Math.min(100, freq * 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
          <p className="text-[11.5px] text-[var(--text-faint)] mt-2 leading-relaxed">
            Carriers are healthy. The aim is not to reach zero — that would throw away too many good
            dogs — but to keep the frequency low enough that you always have clear mates available.
          </p>
        </Card>
      </Section>

      {project.discoveries.length > 0 && (
        <Section title="Discoveries" subtitle="Rare genetics you have uncovered in this project.">
          <Card>
            {project.discoveries.map((d) => (
              <div key={d.key} className="py-2 border-b border-[var(--line)] last:border-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Chip tone="rare">{d.rarity}</Chip>
                  <span className="text-[13px] font-semibold">{d.title}</span>
                </div>
                <p className="text-[12px] text-[var(--text-soft)] leading-relaxed">{d.blurb}</p>
                <p className="text-[11.5px] text-[var(--text-faint)] mt-0.5">
                  First seen in {d.dogName}, year {(d.month / 12).toFixed(1)}.
                </p>
              </div>
            ))}
          </Card>
        </Section>
      )}

      <Section title="History">
        <Card>
          {project.log.slice(0, 40).map((entry, i) => (
            <div key={i} className="flex gap-2 py-1.5 border-b border-[var(--line)] last:border-0">
              <span className="text-[11px] text-[var(--text-faint)] tabular-nums flex-none w-12">
                yr {(entry.month / 12).toFixed(1)}
              </span>
              <span className="text-[12.5px] text-[var(--text-soft)] leading-snug">{entry.text}</span>
            </div>
          ))}
        </Card>
      </Section>
    </div>
  );
}

/** A small line chart, drawn directly as SVG. */
function Chart({
  title,
  values,
  labels,
  color,
  suffix = '',
  max,
  invertGood,
}: {
  title: string;
  values: number[];
  labels: string[];
  color: string;
  suffix?: string;
  max?: number;
  invertGood?: boolean;
}) {
  if (values.length < 2) return null;

  const width = 300;
  const height = 90;
  const pad = 6;

  const hi = max ?? Math.max(...values) * 1.15;
  const lo = Math.min(0, Math.min(...values));
  const span = Math.max(0.001, hi - lo);

  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - lo) / span) * (height - pad * 2);

  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${path} L ${x(values.length - 1).toFixed(1)} ${height - pad} L ${x(0).toFixed(1)} ${height - pad} Z`;

  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;
  const good = invertGood ? change < 0 : change > 0;

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[13px] font-semibold">{title}</span>
        <span className={`text-[12px] font-semibold tabular-nums ${good ? 'text-moss' : 'text-rust'}`}>
          {last.toFixed(1)}
          {suffix}{' '}
          <span className="text-[11px] font-normal">
            ({change >= 0 ? '+' : ''}
            {change.toFixed(1)})
          </span>
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 90 }}>
        <path d={area} fill={color} opacity="0.13" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="2.4" fill={color} />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-[var(--text-faint)]">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

/** Shown on the project tab; kept here because it reads the same data. */
export function KennelSummary() {
  const { project } = useGame();
  const dogs = activeDogs(project);
  const adults = dogs.filter((d) => ageMonths(d, project.month) >= 18);
  return (
    <Card>
      <StatRow label="Dogs in the kennel" value={`${dogs.length} of ${project.kennelCapacity}`} />
      <StatRow label="Adults" value={adults.length} />
      <StatRow label="Puppies and youngsters" value={dogs.length - adults.length} />
      <StatRow label="Testing credits" value={project.testCredits} />
    </Card>
  );
}

export { Button };
