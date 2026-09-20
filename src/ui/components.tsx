/**
 * Shared interface pieces: buttons, cards, bars, chips and the bottom sheet.
 * Keeping them in one place means the whole app stays visually consistent and
 * every tap target is comfortably big enough for a thumb.
 */

import { useState, type ReactNode, useEffect } from 'react';
import {
  AlertTriangle, Award, BookOpen, Brain, CalendarDays, Dna, Dog, Dumbbell, GraduationCap, Home, Hourglass, Leaf,
  type LucideIcon, Network, PawPrint, Pencil, Pin, Ruler, Scissors, Scroll, Settings, Sparkles, Stethoscope, TrendingUp, Trophy,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

const TONE_CLASS: Record<ButtonTone, string> = {
  primary: 'btn-3d bg-[var(--brand)] text-white border-transparent [--btn-shadow:#1f8a4f]',
  accent: 'btn-3d bg-rust text-white border-transparent [--btn-shadow:#d5651c]',
  secondary: 'bg-[var(--card)] text-[var(--text)] border-[var(--line)] active:bg-[var(--bg-2)]',
  ghost: 'bg-transparent text-[var(--text-soft)] border-transparent active:bg-[var(--bg-2)]',
  danger: 'btn-3d bg-berry text-white border-transparent [--btn-shadow:#c23d60]',
};

export function Button({
  children,
  onClick,
  tone = 'primary',
  disabled,
  full,
  small,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  full?: boolean;
  small?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${TONE_CLASS[tone]} ${full ? 'w-full' : ''} ${
        small ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-3 text-[15px]'
      } rounded-xl border font-semibold disabled:opacity-40 disabled:pointer-events-none ${className}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`card p-3 text-left w-full ${onClick ? 'active:scale-[0.99] transition-transform' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}

/**
 * Every section heading gets a little icon in a coloured badge. Callers can
 * pass one; otherwise it is guessed from the title, so the whole app picked
 * them up at once without touching every screen.
 */
const SECTION_ICONS: [RegExp, LucideIcon][] = [
  [/breed book|your breed$|standard|aiming/i, BookOpen],
  [/^time$|generation|progress|history|snapshot|right now|numbers/i, Hourglass],
  [/expert|stuck/i, GraduationCap],
  [/show|line-up|judge|critique|scored|champion/i, Trophy],
  [/litter|puppies|born|whelp|expected|happening/i, PawPrint],
  [/death|retire|place in a pet|delete/i, Leaf],
  [/attention|warning|cost/i, AlertTriangle],
  [/health|carriers|disease/i, Stethoscope],
  [/diversity|pedigree|family|parents|whose/i, Network],
  [/coat/i, Scissors],
  [/habit|story|post|discover|something new|changed/i, Sparkles],
  [/genetic|polygenic|carries|seed|genes/i, Dna],
  [/temperament/i, Brain],
  [/constitution/i, Dumbbell],
  [/retention/i, Pin],
  [/breed status|establish/i, Award],
  [/warning|population/i, AlertTriangle],
  [/size|body/i, Ruler],
  [/name/i, Pencil],
  [/project|preset|build your own|focus|bench|free play|just play/i, Home],
  [/improve|likely/i, TrendingUp],
  [/how long/i, CalendarDays],
  [/club|fashion/i, Scroll],
  [/settings/i, Settings],
  [/kennel|take it further/i, Dog],
];

function sectionIcon(title: string): LucideIcon {
  for (const [pattern, icon] of SECTION_ICONS) if (pattern.test(title)) return icon;
  return Dog;
}

export function Section({
  title,
  subtitle,
  right,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  icon?: string;
  children: ReactNode;
}) {
  const Icon = sectionIcon(title);
  void icon;
  return (
    <section className="mb-7">
      <header className="flex items-start justify-between gap-3 mb-2.5 px-1">
        <div className="flex items-start gap-2 min-w-0">
          <Icon aria-hidden="true" size={18} strokeWidth={2} className="flex-none mt-[3px] text-[var(--brand)]" />
          <div className="min-w-0">
            <h2 className="display text-[18px] leading-tight">{title}</h2>
            {subtitle && <p className="text-[12px] text-[var(--text-faint)] mt-0.5 leading-snug">{subtitle}</p>}
          </div>
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="card p-6 text-center text-[13px] text-[var(--text-faint)] leading-relaxed">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

export function Chip({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'rare';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-[var(--bg-2)] text-[var(--text-soft)]',
    good: 'bg-moss/12 text-[#1f7a46]',
    warn: 'bg-rust/12 text-[#b85a19]',
    bad: 'bg-berry/12 text-[#b3304f]',
    info: 'bg-sky/12 text-[#1d6fa8]',
    rare: 'bg-sun/30 text-[#8a5a0c]',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Goal pips: one dot per goal in the standard, filled when the dog hits it.
 * "6 of 9" is a slope the player can watch move; "meets the standard" is a
 * cliff they fall off for years. Pass `hits` to keep the dots in goal order.
 */
export function Pips({
  hit,
  total,
  hits,
  size = 7,
  maxWidth,
  className = '',
}: {
  hit: number;
  total: number;
  hits?: boolean[];
  size?: number;
  /** When the dots would not fit in this many pixels, show just the count. */
  maxWidth?: number;
  className?: string;
}) {
  if (total === 0) return null;
  const dots = hits ?? Array.from({ length: total }, (_, i) => i < hit);
  if (maxWidth !== undefined && total * (size + 3) + 26 > maxWidth) {
    return (
      <span className={`text-[10.5px] font-bold text-[var(--text-faint)] tabular-nums ${className}`} title={`${hit} of ${total} goals hit`}>
        {hit}/{total} goals
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-[3px] ${className}`}
      role="img"
      aria-label={`${hit} of ${total} goals hit`}
      title={`${hit} of ${total} goals hit`}
    >
      {dots.map((on, i) => (
        <span
          key={i}
          style={{ width: size, height: size }}
          className={`rounded-full ${on ? 'bg-[#1f8a4f]' : 'bg-[var(--line)]'}`}
        />
      ))}
      <span className="text-[10.5px] font-bold text-[var(--text-faint)] ml-0.5 tabular-nums">
        {hit}/{total}
      </span>
    </span>
  );
}

/**
 * A horizontal bar for a 0-100 trait. When a range is supplied the bar shows
 * the uncertain span rather than pretending to know an exact figure.
 */
export function TraitBar({
  label,
  value,
  low,
  high,
  hint,
  tone = 'brand',
}: {
  label: string;
  value: number;
  low?: number;
  high?: number;
  hint?: string;
  tone?: 'brand' | 'rust' | 'moss' | 'berry';
}) {
  const colors = {
    brand: 'var(--brand)',
    rust: 'var(--color-rust)',
    moss: 'var(--color-moss)',
    berry: 'var(--color-berry)',
  };
  const uncertain = low !== undefined && high !== undefined && high - low > 2;

  return (
    <div className="mb-2.5">
      <div className="flex justify-between items-baseline text-[12px] mb-1">
        <span className="text-[var(--text-soft)]">{label}</span>
        <span className="font-semibold tabular-nums">
          {uncertain ? `${Math.round(low!)}–${Math.round(high!)}` : Math.round(value)}
          {hint && <span className="text-[var(--text-faint)] font-normal ml-1">{hint}</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-2)] relative overflow-hidden">
        {uncertain ? (
          <div
            className="absolute h-full rounded-full opacity-45"
            style={{ left: `${low}%`, width: `${Math.max(2, high! - low!)}%`, background: colors[tone] }}
          />
        ) : null}
        <div
          className="absolute h-full w-[3px] rounded-full"
          style={{ left: `calc(${Math.max(0, Math.min(100, value))}% - 1.5px)`, background: colors[tone] }}
        />
      </div>
    </div>
  );
}

export function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: 'good' | 'warn' | 'bad';
}) {
  const color =
    tone === 'good'
      ? 'text-moss'
      : tone === 'warn'
        ? 'text-rust'
        : tone === 'bad'
          ? 'text-berry'
          : '';
  return (
    <div className="flex justify-between items-baseline gap-3 py-1.5 border-b border-[var(--line)] last:border-0">
      <span className="text-[13px] text-[var(--text-soft)]">{label}</span>
      <span className={`text-[13px] font-semibold text-right ${color}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bottom sheet
// ---------------------------------------------------------------------------

/**
 * Detailed information opens in a sheet that slides up from the bottom, rather
 * than expanding the page. On a phone this keeps the player's place and puts
 * the close button within thumb reach.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center fade-in">
      <button
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="sheet-in relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl bg-[var(--bg)] border-t-2 border-[var(--line)] shadow-2xl">
        <div className="flex-none px-4 pt-3 pb-3 border-b border-[var(--line)]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--line)]" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="display text-[19px] font-semibold leading-tight">{title}</h3>
              {subtitle && (
                <div className="text-[12px] text-[var(--text-faint)] mt-0.5">{subtitle}</div>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-none w-8 h-8 rounded-full bg-[var(--bg-2)] text-[var(--text-soft)] text-[18px] leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer && (
          <div className="flex-none px-4 py-3 border-t border-[var(--line)] safe-bottom bg-[var(--bg)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, 3200);
    return () => clearTimeout(timer);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] fade-in px-4 w-full max-w-sm">
      <div className="rounded-xl bg-[var(--text)] text-[var(--bg)] px-4 py-3 text-[13px] font-medium shadow-lg text-center leading-snug">
        {message}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-2)] border border-[var(--line)]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 py-2 text-[12px] font-semibold transition-colors ${
            value === o.value
              ? 'bg-[var(--card)] text-[var(--text)] shadow-sm'
              : 'text-[var(--text-faint)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A labelled explanation the player can open when they want more detail. */
/**
 * Copy that matters the first time and clutters every time after. Shown in
 * full on the first visit (per device), then folded to a small "?" that
 * brings it back. `id` should be unique per piece of text.
 */
export function Intro({ id, children }: { id: string; children: ReactNode }) {
  const key = `dg.intro.${id}`;
  const [seen, setSeen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(false);
  const dismiss = () => {
    try {
      localStorage.setItem(key, '1');
    } catch {
      // nothing to do: it will simply show again next time
    }
    setSeen(true);
    setOpen(false);
  };
  if (seen && !open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[11.5px] text-[var(--text-faint)] mb-3 inline-flex items-center gap-1" aria-label="Explain this">
        <span className="inline-flex w-4 h-4 rounded-full border border-[var(--line)] items-center justify-center text-[10px] font-bold">?</span>
        What is this?
      </button>
    );
  }
  return (
    <div className="card p-3 mb-3">
      <div className="text-[12.5px] leading-relaxed text-[var(--text-soft)] space-y-2">{children}</div>
      <button onClick={dismiss} className="text-[11.5px] font-semibold text-[var(--brand)] mt-2">
        Got it
      </button>
    </div>
  );
}

export function Explain({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="card p-3 mb-3">
      <summary className="text-[13px] font-semibold cursor-pointer list-none flex items-center justify-between">
        <span>{title}</span>
        <span className="text-[var(--text-faint)] text-[11px]">tap</span>
      </summary>
      <div className="mt-2 text-[13px] leading-relaxed text-[var(--text-soft)] space-y-2">
        {children}
      </div>
    </details>
  );
}
