/**
 * Shared interface pieces: buttons, cards, bars, chips and the bottom sheet.
 * Keeping them in one place means the whole app stays visually consistent and
 * every tap target is comfortably big enough for a thumb.
 */

import { type ReactNode, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

const TONE_CLASS: Record<ButtonTone, string> = {
  primary: 'bg-[var(--brand)] text-white border-transparent active:bg-[var(--brand-2)]',
  accent: 'bg-rust text-white border-transparent active:bg-rust-deep',
  secondary:
    'bg-[var(--card)] text-[var(--text)] border-[var(--line)] active:bg-[var(--bg-2)]',
  ghost: 'bg-transparent text-[var(--text-soft)] border-transparent active:bg-[var(--bg-2)]',
  danger: 'bg-berry text-white border-transparent active:opacity-85',
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
      } rounded-xl border font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none ${className}`}
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

export function Section({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-5">
      <header className="flex items-end justify-between gap-3 mb-2 px-1">
        <div>
          <h2 className="display text-[17px] font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="text-[12px] text-[var(--text-faint)] mt-0.5">{subtitle}</p>}
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
    neutral: 'bg-[var(--bg-2)] text-[var(--text-soft)] border-[var(--line)]',
    good: 'bg-moss/15 text-moss border-moss/30',
    warn: 'bg-rust/15 text-rust border-rust/30',
    bad: 'bg-berry/15 text-berry border-berry/30',
    info: 'bg-sky/15 text-sky border-sky/30',
    rare: 'bg-clay/20 text-clay border-clay/40',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
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
      <div className="sheet-in relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-2xl bg-[var(--bg)] border-t border-[var(--line)] shadow-2xl">
        <div className="flex-none px-4 pt-3 pb-3 border-b border-[var(--line)]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--line)]" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="display text-[19px] font-semibold leading-tight truncate">{title}</h3>
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
