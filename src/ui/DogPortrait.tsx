/**
 * PROCEDURAL DOG PORTRAITS
 *
 * Every dog is drawn from its own genes. Nothing here is a stock picture:
 * the body length, leg length, muzzle, ears, coat texture, colour, markings
 * and tail all come from what the dog actually inherited, so two littermates
 * that differ genetically also look different on screen.
 *
 * Random-looking details (where the merle patches land, how the fur clumps)
 * are derived from the dog's id, so a given dog always draws identically.
 */

import { useMemo } from 'react';
import { hashString } from '../engine/rng';
import type { Dog } from '../engine/dog';
import { sizeToPounds } from '../engine/traits';
import { legShortening, resolveCoat, resolveColor, resolveEars, resolveTail } from '../engine/phenotype';

/** A tiny deterministic generator so each dog's details never move. */
function makeNoise(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export interface DogPortraitProps {
  dog: Dog;
  /** Pixel width. The drawing scales to fit. */
  size?: number;
  className?: string;
  /** Show a soft background panel behind the dog. */
  framed?: boolean;
}

export function DogPortrait({ dog, size = 120, className = '', framed = true }: DogPortraitProps) {
  const art = useMemo(() => buildArt(dog), [dog]);
  const clipId = `clip-${dog.id}`;

  return (
    <svg
      viewBox="0 0 220 150"
      width={size}
      height={(size * 150) / 220}
      className={className}
      role="img"
      aria-label={`${dog.name}, ${art.colorName}, ${art.coatLabel}`}
    >
      {framed && (
        <rect x="0" y="0" width="220" height="150" rx="12" fill={art.backdrop} />
      )}

      <defs>
        <clipPath id={clipId}>{art.silhouette}</clipPath>
        <linearGradient id={`grad-${dog.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(art.base, 18)} />
          <stop offset="100%" stopColor={shade(art.base, -22)} />
        </linearGradient>
      </defs>

      {/* Ground shadow, so the dog is standing on something. */}
      <ellipse cx={art.bodyX} cy={133} rx={54} ry={5} fill="#000" opacity="0.11" />

      {/* Tail and far legs sit behind the body. */}
      {art.tail}
      {art.farLegs}

      {/* The dog itself. */}
      <g>
        <g fill={`url(#grad-${dog.id})`}>{art.silhouette}</g>
        <g clipPath={`url(#${clipId})`}>{art.markings}</g>
      </g>

      {art.nearLegs}
      {art.coatTexture}
      {art.ears}
      {art.face}
    </svg>
  );
}

interface Art {
  silhouette: React.ReactNode;
  markings: React.ReactNode;
  coatTexture: React.ReactNode;
  ears: React.ReactNode;
  face: React.ReactNode;
  tail: React.ReactNode;
  farLegs: React.ReactNode;
  nearLegs: React.ReactNode;
  base: string;
  backdrop: string;
  bodyX: number;
  colorName: string;
  coatLabel: string;
}

function buildArt(dog: Dog): Art {
  const noise = makeNoise(dog.seedValue ?? hashString(dog.id));
  const weight = sizeToPounds(dog.observed.size);
  const coat = resolveCoat(dog.genotype, weight);
  const color = resolveColor(dog.genotype);
  const ears = resolveEars(dog.observed.earSet);
  const tailType = resolveTail(dog.genotype);
  const shortLegs = legShortening(dog.genotype);

  // --- Proportions --------------------------------------------------------
  const ground = 132;
  const sizeFactor = 0.78 + 0.34 * Math.min(1, Math.max(0, (Math.log(weight) - Math.log(4)) / (Math.log(170) - Math.log(4))));

  const bodyDepth = (24 + dog.observed.substance * 0.17) * sizeFactor;
  const legFactor = shortLegs === 2 ? 0.3 : shortLegs === 1 ? 0.55 : 1;
  const legLength = (16 + (100 - dog.observed.substance) * 0.1) * legFactor * sizeFactor;

  const bodyRx = (44 + (shortLegs > 0 ? 8 : 0)) * sizeFactor;
  const bodyRy = bodyDepth / 2;
  const bodyY = ground - legLength - bodyRy;
  const bodyX = 92;

  // Head sits forward and above the shoulder.
  const headX = bodyX + bodyRx + 16 * sizeFactor;
  const headY = bodyY - bodyRy - 12 * sizeFactor;
  const skullR = 13 * sizeFactor;
  const muzzleLen = (6 + dog.observed.muzzle * 0.19) * sizeFactor;
  const muzzleH = 8.5 * sizeFactor;

  const base = coat.hairless ? shade(color.base, 34) : color.base;
  const accent = color.accent;
  const dark = shade(base, -30);
  const light = shade(base, 26);

  const backdrop = '#00000008';

  // --- Silhouette ---------------------------------------------------------
  const legTop = bodyY + bodyRy - 3;
  const legW = (7 + dog.observed.substance * 0.05) * sizeFactor;

  const leg = (x: number, key: string, fill?: string) => (
    <rect
      key={key}
      x={x - legW / 2}
      y={legTop}
      width={legW}
      height={ground - legTop}
      rx={legW / 2.2}
      fill={fill}
    />
  );

  const silhouette = (
    <>
      {/* Barrel of the body */}
      <ellipse cx={bodyX} cy={bodyY} rx={bodyRx} ry={bodyRy} />
      {/* Chest, slightly deeper at the front */}
      <ellipse cx={bodyX + bodyRx * 0.55} cy={bodyY + 2} rx={bodyRx * 0.42} ry={bodyRy * 1.05} />
      {/* Neck */}
      <path
        d={`M ${bodyX + bodyRx * 0.55} ${bodyY - bodyRy * 0.5}
            L ${headX - skullR * 0.6} ${headY + skullR * 0.2}
            L ${headX - skullR * 0.2} ${headY + skullR * 1.15}
            L ${bodyX + bodyRx * 0.7} ${bodyY + bodyRy * 0.45} Z`}
      />
      {/* Skull */}
      <ellipse cx={headX} cy={headY} rx={skullR} ry={skullR * 0.92} />
      {/* Muzzle */}
      <path
        d={`M ${headX + skullR * 0.3} ${headY - muzzleH * 0.35}
            L ${headX + skullR * 0.5 + muzzleLen} ${headY - muzzleH * 0.15}
            Q ${headX + skullR * 0.6 + muzzleLen} ${headY + muzzleH * 0.5} ${headX + skullR * 0.4 + muzzleLen} ${headY + muzzleH * 0.62}
            L ${headX + skullR * 0.2} ${headY + muzzleH * 0.75} Z`}
      />
    </>
  );

  // --- Legs ---------------------------------------------------------------
  const farLegs = (
    <g fill={shade(base, -26)}>
      {leg(bodyX - bodyRx * 0.52, 'fl1')}
      {leg(bodyX + bodyRx * 0.58, 'fl2')}
    </g>
  );
  const nearLegs = (
    <g fill={color.tanPoints ? accent : base}>
      {leg(bodyX - bodyRx * 0.72, 'nl1')}
      {leg(bodyX + bodyRx * 0.78, 'nl2')}
    </g>
  );

  // --- Tail ---------------------------------------------------------------
  const tailBaseX = bodyX - bodyRx * 0.92;
  const tailBaseY = bodyY - bodyRy * 0.45;
  const tail =
    tailType === 'bobtail' ? (
      <ellipse cx={tailBaseX - 4} cy={tailBaseY} rx={7 * sizeFactor} ry={6 * sizeFactor} fill={base} />
    ) : (
      <path
        d={`M ${tailBaseX} ${tailBaseY}
            Q ${tailBaseX - 26 * sizeFactor} ${tailBaseY - 22 * sizeFactor} ${tailBaseX - 12 * sizeFactor} ${tailBaseY - 34 * sizeFactor}`}
        stroke={base}
        strokeWidth={(coat.kind === 'smooth' ? 6 : 10) * sizeFactor}
        strokeLinecap="round"
        fill="none"
      />
    );

  // --- Ears ---------------------------------------------------------------
  const earX = headX - skullR * 0.35;
  const earY = headY - skullR * 0.7;
  let earShape: React.ReactNode;

  if (ears === 'erect') {
    earShape = (
      <path
        d={`M ${earX} ${earY} L ${earX - 3} ${earY - 17 * sizeFactor} L ${earX + 10 * sizeFactor} ${earY - 4} Z`}
        fill={shade(base, -12)}
      />
    );
  } else if (ears === 'semiErect') {
    earShape = (
      <path
        d={`M ${earX} ${earY} L ${earX - 2} ${earY - 13 * sizeFactor}
            Q ${earX + 7 * sizeFactor} ${earY - 15 * sizeFactor} ${earX + 10 * sizeFactor} ${earY - 2} Z`}
        fill={shade(base, -12)}
      />
    );
  } else if (ears === 'button') {
    earShape = (
      <path
        d={`M ${earX - 1} ${earY} Q ${earX - 4} ${earY - 11 * sizeFactor} ${earX + 8 * sizeFactor} ${earY - 8 * sizeFactor}
            Q ${earX + 11 * sizeFactor} ${earY + 1} ${earX + 5 * sizeFactor} ${earY + 4} Z`}
        fill={shade(base, -14)}
      />
    );
  } else {
    earShape = (
      <ellipse
        cx={earX - 1}
        cy={earY + 9 * sizeFactor}
        rx={6.5 * sizeFactor}
        ry={13 * sizeFactor}
        fill={shade(base, -16)}
        transform={`rotate(-12 ${earX - 1} ${earY + 9 * sizeFactor})`}
      />
    );
  }

  // --- Markings -----------------------------------------------------------
  const markings: React.ReactNode[] = [];

  if (color.brindle) {
    for (let i = 0; i < 12; i++) {
      const x = bodyX - bodyRx + (i * (bodyRx * 2)) / 12 + noise() * 3;
      markings.push(
        <rect
          key={`br${i}`}
          x={x}
          y={bodyY - bodyRy - 6}
          width={2.6 + noise() * 2}
          height={bodyRy * 2 + 14}
          fill={color.accent}
          opacity={0.85}
          transform={`rotate(${-8 + noise() * 6} ${x} ${bodyY})`}
        />,
      );
    }
  }

  if (color.merle) {
    const patchCount = color.doubleMerle ? 5 : 10;
    for (let i = 0; i < patchCount; i++) {
      markings.push(
        <ellipse
          key={`m${i}`}
          cx={bodyX - bodyRx + noise() * bodyRx * 2.4}
          cy={bodyY - bodyRy + noise() * bodyRy * 2}
          rx={5 + noise() * 9}
          ry={4 + noise() * 7}
          fill={color.harlequin ? '#1d1a17' : shade(base, color.doubleMerle ? -10 : -46)}
          opacity={color.harlequin ? 0.95 : 0.8}
        />,
      );
    }
  }

  // White markings: chest, muzzle band, feet, tail tip.
  if (color.white > 0.08) {
    const w = color.white;
    markings.push(
      <ellipse
        key="wchest"
        cx={bodyX + bodyRx * 0.62}
        cy={bodyY + bodyRy * 0.55}
        rx={bodyRx * 0.3 * (0.6 + w)}
        ry={bodyRy * 0.85 * (0.6 + w)}
        fill="#f6f1e6"
      />,
    );
    if (w > 0.3) {
      markings.push(
        <ellipse
          key="wbelly"
          cx={bodyX - bodyRx * 0.1}
          cy={bodyY + bodyRy * 0.8}
          rx={bodyRx * 0.75}
          ry={bodyRy * 0.6}
          fill="#f6f1e6"
        />,
      );
    }
    if (w > 0.5) {
      for (let i = 0; i < 4; i++) {
        markings.push(
          <ellipse
            key={`wp${i}`}
            cx={bodyX - bodyRx + noise() * bodyRx * 2}
            cy={bodyY - bodyRy * 0.6 + noise() * bodyRy}
            rx={8 + noise() * 12}
            ry={7 + noise() * 9}
            fill="#f6f1e6"
          />,
        );
      }
    }
  }

  if (color.ticked) {
    for (let i = 0; i < 18; i++) {
      markings.push(
        <circle
          key={`t${i}`}
          cx={bodyX - bodyRx + noise() * bodyRx * 2}
          cy={bodyY - bodyRy + noise() * bodyRy * 2}
          r={0.9 + noise() * 1.1}
          fill={dark}
          opacity="0.65"
        />,
      );
    }
  }

  if (color.tanPoints) {
    markings.push(
      <ellipse
        key="tp"
        cx={bodyX + bodyRx * 0.7}
        cy={bodyY + bodyRy * 0.7}
        rx={bodyRx * 0.28}
        ry={bodyRy * 0.5}
        fill={accent}
        opacity="0.9"
      />,
    );
  }

  // --- Coat texture -------------------------------------------------------
  const texture: React.ReactNode[] = [];
  const outlinePoints: [number, number][] = [];
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * Math.PI * 2;
    outlinePoints.push([bodyX + Math.cos(angle) * bodyRx * 0.98, bodyY + Math.sin(angle) * bodyRy * 1.02]);
  }

  if (coat.kind === 'curly') {
    for (let i = 0; i < outlinePoints.length; i++) {
      const [x, y] = outlinePoints[i];
      texture.push(<circle key={`c${i}`} cx={x} cy={y} r={4.6 + noise() * 1.6} fill={light} opacity="0.95" />);
    }
    for (let i = 0; i < 16; i++) {
      texture.push(
        <circle
          key={`ci${i}`}
          cx={bodyX - bodyRx * 0.8 + noise() * bodyRx * 1.6}
          cy={bodyY - bodyRy * 0.7 + noise() * bodyRy * 1.4}
          r={3.4 + noise() * 1.6}
          fill={light}
          opacity="0.5"
        />,
      );
    }
    texture.push(
      <circle key="ch" cx={headX - 2} cy={headY - skullR * 0.7} r={8 * sizeFactor} fill={light} opacity="0.9" />,
    );
  } else if (coat.kind === 'long' || coat.kind === 'silky' || coat.kind === 'doubleThick') {
    const fluff = coat.kind === 'doubleThick' ? 8.5 : 7;
    for (let i = 0; i < outlinePoints.length; i++) {
      const [x, y] = outlinePoints[i];
      // Heavier fringe along the underside and back of the dog.
      const lower = y > bodyY ? 1.35 : 0.85;
      texture.push(
        <ellipse
          key={`l${i}`}
          cx={x}
          cy={y}
          rx={(fluff + noise() * 2) * lower}
          ry={(fluff - 1 + noise() * 2) * lower}
          fill={base}
          opacity="0.98"
        />,
      );
    }
    if (coat.kind === 'doubleThick') {
      texture.push(
        <ellipse key="ruff" cx={bodyX + bodyRx * 0.72} cy={bodyY - bodyRy * 0.15} rx={16 * sizeFactor} ry={20 * sizeFactor} fill={light} opacity="0.55" />,
      );
    }
  } else if (coat.kind === 'wire' || coat.kind === 'wavyFurnished') {
    for (let i = 0; i < outlinePoints.length; i += 2) {
      const [x, y] = outlinePoints[i];
      texture.push(
        <path
          key={`w${i}`}
          d={`M ${x} ${y} l ${(noise() - 0.5) * 6} ${-4 - noise() * 4}`}
          stroke={light}
          strokeWidth="2.2"
          strokeLinecap="round"
        />,
      );
    }
    // Beard and eyebrows, the giveaway of a furnished coat.
    texture.push(
      <ellipse
        key="beard"
        cx={headX + skullR * 0.45 + muzzleLen * 0.7}
        cy={headY + muzzleH * 0.75}
        rx={7 * sizeFactor}
        ry={6 * sizeFactor}
        fill={light}
      />,
      <ellipse
        key="brow"
        cx={headX + skullR * 0.25}
        cy={headY - skullR * 0.45}
        rx={5 * sizeFactor}
        ry={3 * sizeFactor}
        fill={light}
      />,
    );
  } else if (coat.hairless) {
    // A crest on the head and a plume on the tail, which is what the dominant
    // hairless gene actually leaves behind.
    texture.push(
      <ellipse key="crest" cx={headX - skullR * 0.2} cy={headY - skullR} rx={7 * sizeFactor} ry={6 * sizeFactor} fill={shade(color.base, -20)} opacity="0.9" />,
      <circle key="tuft" cx={tailBaseX - 12 * sizeFactor} cy={tailBaseY - 32 * sizeFactor} r={6 * sizeFactor} fill={shade(color.base, -20)} opacity="0.9" />,
    );
  }

  // --- Face ---------------------------------------------------------------
  const noseX = headX + skullR * 0.5 + muzzleLen;
  const face = (
    <g>
      {color.mask && (
        <ellipse
          cx={headX + skullR * 0.4 + muzzleLen * 0.5}
          cy={headY + muzzleH * 0.15}
          rx={muzzleLen * 0.7 + 4}
          ry={muzzleH * 0.7}
          fill="#2a2521"
          opacity="0.82"
        />
      )}
      <circle cx={headX + skullR * 0.28} cy={headY - skullR * 0.12} r={2.5 * sizeFactor} fill={color.eye} />
      <circle cx={headX + skullR * 0.28 + 0.7} cy={headY - skullR * 0.2} r={0.9 * sizeFactor} fill="#fff" opacity="0.85" />
      <ellipse cx={noseX - 1} cy={headY - muzzleH * 0.05} rx={2.8 * sizeFactor} ry={2.2 * sizeFactor} fill={color.nose} />
    </g>
  );

  return {
    silhouette,
    markings,
    coatTexture: texture,
    ears: earShape,
    face,
    tail,
    farLegs,
    nearLegs,
    base,
    backdrop,
    bodyX,
    colorName: color.name,
    coatLabel: coat.label,
  };
}
