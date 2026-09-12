/**
 * DOG SPRITES
 *
 * Draws a dog by stacking hand-drawn layers and colouring them from genetics.
 *
 * The artwork is deliberately white with grey shading only. It is a stencil,
 * not a picture. For each layer we:
 *
 *   1. Use the PNG's own transparency as a MASK, so everything we paint stays
 *      inside the dog's outline and never leaks past it.
 *   2. Fill that shape with the dog's genetic colour.
 *   3. Paint the patterns — white markings, merle, brindle, tan points — on top,
 *      still inside the mask.
 *   4. Lay the original artwork over everything in "multiply" mode, so the
 *      artist's shading and muscle definition show through whatever colour and
 *      pattern ended up underneath.
 *
 * This is why no extra images are needed for colour. There are thousands of
 * possible colour-and-pattern combinations per coat type; drawing them all
 * would be impossible, whereas fourteen stencils cover every one of them.
 */

import { useMemo } from 'react';
import type { Dog } from '../engine/dog';
import { sizeToPounds } from '../engine/traits';
import {
  type CoatKind,
  type EarType,
  type TailType,
  legShortening,
  resolveCoat,
  resolveColor,
  resolveEars,
  resolveTail,
} from '../engine/phenotype';

const BASE = `${import.meta.env.BASE_URL}sprites/`;

const BODY_SRC: Record<CoatKind, string> = {
  smooth: 'body-smooth.png',
  short: 'body-smooth.png',
  silky: 'body-silky.png',
  long: 'body-long.png',
  doubleThick: 'body-double.png',
  wire: 'body-wire.png',
  wavyFurnished: 'body-wavy.png',
  curly: 'body-curly.png',
  hairless: 'body-hairless.png',
};

const EAR_SRC: Record<EarType, string> = {
  erect: 'ear-erect.png',
  semiErect: 'ear-semi.png',
  button: 'ear-button.png',
  drop: 'ear-drop.png',
};

const TAIL_SRC: Record<TailType, string> = {
  full: 'tail-full.png',
  bobtail: 'tail-bob.png',
};

/**
 * Fitting the parts to the body.
 *
 * The pieces were drawn separately, and two of the ears came back zoomed right
 * in — the erect ear is drawn as large as the entire dog. Simply scaling a
 * layer down does not work, because scaling pulls the artwork toward the middle
 * of the canvas and the ear ends up in the dog's ribs.
 *
 * So each part declares an ANCHOR: the point in its own artwork that has to
 * touch the body (the base of an ear, the root of a tail), and a TARGET: where
 * that point sits on the dog. Scaling happens about the anchor, so the join
 * stays put however much the piece is resized.
 *
 * All figures are percentages of the shared 1448x1086 canvas, measured off the
 * alignment rig in sprite-align.html.
 */
interface Fit {
  /** The point in this piece's own art that must meet the body. */
  anchor: [number, number];
  /** Where that point belongs on the dog. */
  target: [number, number];
  scale: number;
}

const EAR_FIT: Record<EarType, Fit> = {
  // Drawn at roughly four times body scale, anchored at the base of the ear.
  erect: { anchor: [66, 77], target: [79.5, 30], scale: 0.22 },
  semiErect: { anchor: [57, 73], target: [79, 31], scale: 0.26 },
  // These two arrived close to the right size already.
  button: { anchor: [78, 33], target: [79, 30.5], scale: 1 },
  drop: { anchor: [74, 31], target: [79, 29], scale: 0.55 },
};

const TAIL_FIT: Record<TailType, Fit> = {
  full: { anchor: [25, 47], target: [25, 47], scale: 1 },
  bobtail: { anchor: [26, 43], target: [25.5, 45], scale: 1 },
};

function fitStyle(fit: Fit): { transform: string; transformOrigin: string } {
  return {
    transformOrigin: `${fit.anchor[0]}% ${fit.anchor[1]}%`,
    transform: `translate(${(fit.target[0] - fit.anchor[0]).toFixed(2)}%, ${(
      fit.target[1] - fit.anchor[1]
    ).toFixed(2)}%) scale(${fit.scale})`,
  };
}

/** A deterministic little generator so a dog's patches never move. */
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

export interface DogSpriteProps {
  dog: Dog;
  size?: number;
  className?: string;
  framed?: boolean;
}

export function DogSprite({ dog, size = 120, className = '', framed = true }: DogSpriteProps) {
  const art = useMemo(() => describe(dog), [dog]);
  const height = (size * 1086) / 1448;

  return (
    <div
      className={`relative ${className}`}
      style={{
        width: size,
        height,
        isolation: 'isolate',
        borderRadius: framed ? 10 : 0,
        background: framed ? 'rgb(0 0 0 / 3%)' : 'transparent',
        overflow: 'hidden',
      }}
      role="img"
      aria-label={`${dog.name}, ${art.colorName}, ${art.coatLabel}`}
    >
      <div style={{ position: 'absolute', inset: 0, transform: art.bodyTransform }}>
        {/* Tail sits behind the body. */}
        <Layer src={art.tailSrc} colour={art.base} fit={art.tailFit} />

        {/* The dog itself, carrying all the markings. */}
        <Layer src={art.bodySrc} colour={art.base}>
          {art.markings}
        </Layer>

        {/* Ear in front. Slightly darker, as ear leather usually is. */}
        <Layer src={art.earSrc} colour={art.earColour} fit={art.earFit} />
      </div>
    </div>
  );
}

/**
 * One masked, tinted, shaded layer.
 */
function Layer({
  src,
  colour,
  fit,
  children,
}: {
  src: string;
  colour: string;
  fit?: Fit;
  children?: React.ReactNode;
}) {
  const url = `url("${BASE}${src}")`;
  const placement = fit ? fitStyle(fit) : {};
  const mask: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    ...placement,
    backgroundColor: colour,
    isolation: 'isolate',
    WebkitMaskImage: url,
    maskImage: url,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  };

  return (
    <div style={mask}>
      {children}
      <img
        src={`${BASE}${src}`}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Turning genes into layers, colours and patterns
// ---------------------------------------------------------------------------

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function describe(dog: Dog) {
  const weight = sizeToPounds(dog.observed.size);
  const coat = resolveCoat(dog.genotype, weight);
  const colour = resolveColor(dog.genotype);
  const ears = resolveEars(dog.observed.earSet);
  const tail = resolveTail(dog.genotype);
  const shortLegs = legShortening(dog.genotype);
  const noise = makeNoise(dog.seedValue ?? 1);

  // Body build and size, applied by scaling rather than extra artwork.
  const sizeScale = 0.82 + 0.3 * Math.min(1, Math.max(0, (Math.log(weight) - Math.log(4)) / (Math.log(170) - Math.log(4))));
  const substance = 0.94 + (dog.observed.substance / 100) * 0.14;
  // Short-legged dogs read as longer and lower rather than simply smaller.
  const legSquash = shortLegs === 2 ? 0.82 : shortLegs === 1 ? 0.91 : 1;
  const stretch = shortLegs > 0 ? 1.1 : 1;

  const bodyTransform = `scale(${(sizeScale * substance * stretch).toFixed(3)}, ${(sizeScale * legSquash).toFixed(3)})`;

  const base = coat.hairless ? shade(colour.base, 26) : colour.base;

  return {
    bodySrc: BODY_SRC[coat.kind],
    earSrc: EAR_SRC[ears],
    tailSrc: TAIL_SRC[tail],
    earFit: EAR_FIT[ears],
    tailFit: TAIL_FIT[tail],
    bodyTransform,
    base,
    earColour: shade(base, -14),
    colorName: colour.name,
    coatLabel: coat.label,
    markings: <Markings colour={colour} base={base} noise={noise} />,
  };
}

/**
 * The patterns, drawn as simple shapes. They are inside the mask, so they can
 * never spill outside the dog, and the artwork's shading is laid over them
 * afterwards so they sit in the coat rather than on top of it.
 *
 * Coordinates are percentages of the sprite canvas, chosen against the
 * artwork: the barrel of the body runs roughly x 22-72%, the chest and
 * shoulder x 62-78%, the head x 76-93% and y 12-34%, and the legs below y 62%.
 */
function Markings({
  colour,
  base,
  noise,
}: {
  colour: ReturnType<typeof resolveColor>;
  base: string;
  noise: () => number;
}) {
  const shapes: React.ReactNode[] = [];
  const dark = shade(base, -52);
  const light = shade(base, 40);

  const blob = (
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    opacity = 1,
  ) => (
    <div
      key={key}
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: `${w}%`,
        height: `${h}%`,
        background: fill,
        borderRadius: '50%',
        opacity,
      }}
    />
  );

  // --- Brindle: soft tiger striping across the barrel ----------------------
  // Confined to the body and kept translucent. Hard black bars running over the
  // head and legs read as a zebra rather than a dog.
  if (colour.brindle) {
    const stripes: React.ReactNode[] = [];
    for (let i = 0; i < 11; i++) {
      stripes.push(
        <div
          key={`br${i}`}
          style={{
            position: 'absolute',
            left: `${i * 9.5 + noise() * 3}%`,
            top: '-14%',
            // Wide, soft-edged and faint. Real brindle is a shadow in the coat,
            // not a painted stripe.
            width: `${5 + noise() * 4}%`,
            height: '128%',
            background: colour.accent,
            opacity: 0.2 + noise() * 0.12,
            borderRadius: '50%',
            transform: `rotate(${-8 + noise() * 10}deg)`,
          }}
        />,
      );
    }
    shapes.push(
      <div
        key="brindle"
        style={{ position: 'absolute', left: '16%', top: '20%', width: '62%', height: '58%', overflow: 'hidden' }}
      >
        {stripes}
      </div>,
    );
  }

  // --- Tan points: legs, muzzle, eyebrows, chest ---------------------------
  if (colour.tanPoints) {
    shapes.push(
      blob('tp-leg1', 24, 66, 9, 26, colour.accent, 0.95),
      blob('tp-leg2', 36, 68, 9, 24, colour.accent, 0.95),
      blob('tp-leg3', 62, 66, 9, 26, colour.accent, 0.95),
      blob('tp-leg4', 72, 68, 9, 24, colour.accent, 0.95),
      blob('tp-muzzle', 84, 20, 10, 10, colour.accent, 0.9),
      blob('tp-brow', 80, 13, 5, 4, colour.accent, 0.85),
      blob('tp-chest', 72, 44, 10, 14, colour.accent, 0.8),
    );
  }

  // --- Merle: torn patches of diluted pigment ------------------------------
  if (colour.merle) {
    const count = colour.doubleMerle ? 6 : 13;
    for (let i = 0; i < count; i++) {
      shapes.push(
        blob(
          `m${i}`,
          16 + noise() * 72,
          10 + noise() * 72,
          5 + noise() * 11,
          5 + noise() * 12,
          colour.harlequin ? '#1d1a17' : shade(base, colour.doubleMerle ? 46 : -44),
          colour.harlequin ? 0.94 : 0.78,
        ),
      );
    }
  }

  // --- White markings ------------------------------------------------------
  // White does not land at random on a real dog. It creeps inward in a fixed
  // order from the extremities: chest and toes first, then a collar and blaze,
  // then up the flanks until only patches of colour remain. Following that
  // order is what makes a marked dog read as a dog rather than a cow.
  if (colour.white > 0.08) {
    const w = colour.white;
    const white = '#f7f2e8';

    shapes.push(blob('w-chest', 70, 40, 13, 22, white));
    shapes.push(blob('w-toe1', 24, 84, 8, 11, white));
    shapes.push(blob('w-toe2', 36, 86, 8, 10, white));
    shapes.push(blob('w-toe3', 62, 84, 8, 11, white));
    shapes.push(blob('w-toe4', 72, 86, 8, 10, white));

    if (w > 0.25) {
      shapes.push(blob('w-throat', 76, 27, 10, 14, white));
      shapes.push(blob('w-blaze', 85, 11, 4.5, 13, white, 0.95));
      shapes.push(blob('w-tailtip', 7, 43, 11, 11, white, 0.9));
      shapes.push(blob('w-sock1', 24, 72, 9, 18, white));
      shapes.push(blob('w-sock2', 62, 72, 9, 18, white));
    }

    if (w > 0.4) {
      // A collar across the shoulders, which is where piebald goes next.
      shapes.push(blob('w-collar', 62, 24, 15, 32, white, 0.96));
      shapes.push(blob('w-belly', 28, 58, 42, 20, white));
    }

    if (w > 0.55) {
      // Extensive white leaves islands of colour over the ears, eye and rump.
      shapes.push(blob('w-flank', 22, 34, 40, 34, white, 0.95));
      shapes.push(blob('w-neck', 55, 18, 16, 26, white, 0.9));
    }
  }

  // --- Ticking: flecks of colour scattered through the white ---------------
  if (colour.ticked) {
    for (let i = 0; i < 26; i++) {
      shapes.push(
        blob(`t${i}`, 20 + noise() * 62, 30 + noise() * 58, 0.9, 1.2, dark, 0.6),
      );
    }
  }

  // --- Dark mask over the muzzle -------------------------------------------
  if (colour.mask) {
    shapes.push(blob('mask', 82, 16, 14, 16, '#2a2521', 0.8));
  }

  // Soft highlight along the topline, which stops flat colours looking dead.
  shapes.push(blob('sheen', 30, 26, 44, 12, light, 0.16));

  return <>{shapes}</>;
}
