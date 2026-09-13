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

import { useMemo, useState } from 'react';
import { type Dog, currentWeight } from '../engine/dog';
import { useGameMaybe } from './GameContext';
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

/**
 * Measured, not guessed. Each ear's anchor is the real edge of its artwork
 * where it meets the skull — the bottom edge for an ear that stands up, the top
 * edge for one that hangs down. The target is the top-rear of the skull on the
 * body art, which is where an ear actually joins a dog. Earlier values put the
 * join on the cheek, so ears hung off the jaw like saddlebags.
 *
 * The scales look drastic because they are: the erect ear was drawn nearly as
 * tall as the whole dog.
 */
const EAR_FIT: Record<EarType, Fit> = {
  erect: { anchor: [65.8, 77.2], target: [74.5, 19], scale: 0.27 },
  semiErect: { anchor: [57.6, 72.7], target: [74.5, 19], scale: 0.25 },
  button: { anchor: [77.8, 31.5], target: [75, 16], scale: 0.52 },
  drop: { anchor: [73.8, 30.6], target: [75.5, 16], scale: 0.52 },
};

const TAIL_FIT: Record<TailType, Fit> = {
  // The root is pushed a couple of percent INTO the rump and the tail drawn a
  // touch larger. It sits behind the body, so the overlap is hidden, and the
  // join can never open into a gap on a body whose rump sits differently.
  full: { anchor: [25, 47], target: [27.5, 47.5], scale: 1.08 },
  bobtail: { anchor: [26, 43], target: [27.5, 45.5], scale: 1.1 },
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
  const height = (size * 1086) / 1448;
  // Just enough to take the hard edge off. Any more and white markings turn
  // into a glow, as though the dog were lit from inside.
  // Markings get a ragged "fur" edge from an SVG displacement filter. The
  // filter's strength is in pixels, so a small card and a large portrait use
  // different ones or the small one turns to mush.
  const furFilter = size < 110 ? 'fur-edge-s' : size < 170 ? 'fur-edge-m' : 'fur-edge-l';
  // Puppies are drawn at their CURRENT weight, so a litter of newborns is
  // visibly a litter of newborns and a dog grows on screen as the months pass.
  const game = useGameMaybe();
  const nowLbs = game ? currentWeight(dog, game.project.month) : sizeToPounds(dog.observed.size);
  const art = useMemo(() => describe(dog, Math.max(0.6, size * 0.005), furFilter, nowLbs), [dog, size, furFilter, nowLbs]);

  // Tap the dog and it wags. Purely for the pleasure of it.
  const [wagging, setWagging] = useState(false);
  const wag = () => {
    if (wagging) return;
    setWagging(true);
    window.setTimeout(() => setWagging(false), 720);
  };

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
      onPointerDown={wag}
    >
      {/* Scaled about the feet, so a small dog stands on the same ground as a big
          one instead of floating in the middle of the box. */}
      <div style={{ position: 'absolute', inset: 0, transform: art.bodyTransform, transformOrigin: '50% 88%' }}>
        {/* Tail sits behind the body. The wrapper wags about the tail root. */}
        <div
          className={wagging ? 'wagging' : undefined}
          style={{ position: 'absolute', inset: 0, transformOrigin: `${art.tailFit.target[0]}% ${art.tailFit.target[1]}%` }}
        >
          <Layer src={art.tailSrc} colour={art.base} fit={art.tailFit} />
        </div>

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

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
}

/**
 * Lighten a colour before the artwork's shading is multiplied over it.
 *
 * Multiply can only ever darken. A near-black dog filled with its true colour
 * has nowhere left to go, so every fold and muscle the artist drew collapses
 * and the dog becomes a flat silhouette. Lifting the fill first leaves headroom
 * for the shading to work in, and the shaded result reads as black again —
 * which is also how a black dog actually photographs. Pure black fur is
 * essentially never pure black on the eye.
 */
function forShading(hex: string): string {
  const light = luminance(hex);
  if (light >= 96) return hex;
  // Just enough headroom for the shading to read, no more. Lift too far and a
  // black dog turns grey.
  return shade(hex, (96 - light) * 0.72);
}

/** A colour guaranteed to be visible against the given one. */
function contrastInk(hex: string, strength = 58): string {
  return shade(hex, luminance(hex) < 120 ? strength : -strength);
}

function describe(dog: Dog, blurPx: number, furFilter = 'fur-edge-m', drawLbs?: number) {
  const weight = sizeToPounds(dog.observed.size);
  const visual = drawLbs ?? weight;
  const coat = resolveCoat(dog.genotype, weight);
  const colour = resolveColor(dog.genotype);
  const ears = resolveEars(dog.observed.earSet);
  const tail = resolveTail(dog.genotype);
  const shortLegs = legShortening(dog.genotype);
  const noise = makeNoise(dog.seedValue ?? 1);

  // Body build and size, applied by scaling rather than extra artwork.
  // Size has to be OBVIOUS. A Chihuahua and a Great Dane differ thirty-fold in
  // weight; drawing them within 30% of each other, as an earlier version did,
  // made every dog look the same. Weight is on a log scale here because that is
  // how size reads to the eye: 5 lb to 15 lb is a bigger visual jump than
  // 100 lb to 110 lb.
  const sizeScale = 0.46 + 0.7 * Math.min(1, Math.max(0, (Math.log(visual) - Math.log(4)) / (Math.log(170) - Math.log(4))));
  const substance = 0.94 + (dog.observed.substance / 100) * 0.14;
  // Short-legged dogs read as longer and lower rather than simply smaller.
  const legSquash = shortLegs === 2 ? 0.82 : shortLegs === 1 ? 0.91 : 1;
  const stretch = shortLegs > 0 ? 1.1 : 1;

  const bodyTransform = `scale(${(sizeScale * substance * stretch).toFixed(3)}, ${(sizeScale * legSquash).toFixed(3)})`;

  const trueColour = coat.hairless ? shade(colour.base, 26) : colour.base;
  const base = forShading(trueColour);

  return {
    bodySrc: BODY_SRC[coat.kind],
    earSrc: EAR_SRC[ears],
    tailSrc: TAIL_SRC[tail],
    earFit: EAR_FIT[ears],
    tailFit: TAIL_FIT[tail],
    bodyTransform,
    base,
    // Ear leather is genuinely darker than body coat, and the contrast is what
    // makes an ear read as an ear rather than a bump on the skull.
    earColour: shade(base, -32),
    colorName: colour.name,
    coatLabel: coat.label,
    markings: (
      <Markings
        colour={colour}
        base={base}
        accent={forShading(colour.accent)}
        noise={noise}
        blurPx={blurPx}
        furFilter={furFilter}
      />
    ),
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
  accent,
  noise,
  blurPx,
  furFilter,
}: {
  colour: ReturnType<typeof resolveColor>;
  base: string;
  accent: string;
  noise: () => number;
  /** Softening for the white markings, scaled to how big the dog is drawn. */
  blurPx: number;
  furFilter: string;
}) {
  const shapes: React.ReactNode[] = [];
  const fleck = contrastInk(base);
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

  /**
   * A patch of colour with an irregular outline: a cluster of overlapping
   * ellipses, each nudged and resized by the dog's own noise. One ellipse reads
   * as a sticker; four jostling ellipses read as a marking.
   */
  const patch = (key: string, x: number, y: number, w: number, h: number, fill: string, opacity = 1) => {
    const parts: React.ReactNode[] = [];
    for (let i = 0; i < 4; i++) {
      const dx = (noise() - 0.5) * w * 0.55;
      const dy = (noise() - 0.5) * h * 0.55;
      const sw = w * (0.55 + noise() * 0.5);
      const sh = h * (0.55 + noise() * 0.5);
      parts.push(blob(key + '-' + i, x + w / 2 - sw / 2 + dx, y + h / 2 - sh / 2 + dy, sw, sh, fill, opacity));
    }
    return parts;
  };

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
            background: accent,
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
    const tan: React.ReactNode[] = [];
    tan.push(
      blob('tp-leg1', 24, 66, 9, 26, accent, 0.95),
      blob('tp-leg2', 36, 68, 9, 24, accent, 0.95),
      blob('tp-leg3', 62, 66, 9, 26, accent, 0.95),
      blob('tp-leg4', 72, 68, 9, 24, accent, 0.95),
      blob('tp-muzzle', 84, 20, 10, 10, accent, 0.9),
      blob('tp-brow', 80, 13, 5, 4, accent, 0.85),
      blob('tp-chest', 72, 44, 10, 14, accent, 0.8),
    );
    shapes.push(
      <div key="tan" style={{ position: 'absolute', inset: 0, filter: `url(#${furFilter})` }}>
        {tan}
      </div>,
    );
  }

  // --- Merle: torn patches of diluted pigment ------------------------------
  if (colour.merle) {
    // Real merle is torn, not spotted: many patches of very different sizes,
    // a few large and most small, so the eye reads marbling rather than dots.
    const count = colour.doubleMerle ? 6 : 22;
    const spots: React.ReactNode[] = [];
    for (let i = 0; i < count; i++) {
      const big = i < 5;
      spots.push(
        blob(
          `m${i}`,
          16 + noise() * 72,
          10 + noise() * 72,
          big ? 8 + noise() * 12 : 2.5 + noise() * 6,
          big ? 7 + noise() * 12 : 2.5 + noise() * 6,
          // Merle dilutes the BODY and leaves patches at full strength, so the
          // patches are the dark ones. On a sable merle the patches are faint,
          // because a fawn coat has almost no black pigment for merle to act on.
          colour.harlequin
            ? '#1d1a17'
            : colour.doubleMerle
              ? shade(base, 40)
              : forShading(colour.merlePatch),
          colour.harlequin ? 0.96 : colour.merleSubtle ? 0.22 : 0.9,
        ),
      );
    }
    shapes.push(
      <div key="merle" style={{ position: 'absolute', inset: 0, filter: `url(#${furFilter})` }}>
        {spots}
      </div>,
    );
  }

  // --- White markings ------------------------------------------------------
  // White does not land at random on a real dog. It creeps inward in a fixed
  // order from the extremities: chest and toes first, then a collar and blaze,
  // then up the flanks until only islands of colour remain. Following that
  // order is what makes a marked dog read as a dog rather than a cow.
  //
  // The whole group is softened at the end. A hard-edged ellipse reads as a
  // sticker on the dog; real white breaks into the surrounding coat.
  if (colour.white > 0.08) {
    const w = colour.white;
    const white = '#f7f2e8';
    const marks: React.ReactNode[] = [];

    // The chest marking runs down the FRONT of the chest, between the forelegs.
    // Seen from the side that is a narrow strip at the leading edge, not a
    // patch on the shoulder.
    marks.push(...patch('w-chest', 73, 43, 8, 21, white));
    marks.push(blob('w-toe1', 24, 85, 7, 9, white));
    marks.push(blob('w-toe2', 36, 87, 7, 8, white));
    marks.push(blob('w-toe3', 62, 85, 7, 9, white));
    marks.push(blob('w-toe4', 72, 87, 7, 8, white));

    if (w > 0.25) {
      marks.push(blob('w-throat', 77, 30, 7, 13, white));
      marks.push(blob('w-blaze', 85, 11, 4, 12, white, 0.95));
      marks.push(blob('w-tailtip', 7, 43, 10, 10, white, 0.9));
      marks.push(blob('w-sock1', 24, 74, 8, 16, white));
      marks.push(blob('w-sock2', 62, 74, 8, 16, white));
    }

    if (w > 0.4) {
      // A collar across the shoulders, which is where piebald goes next. Kept
      // clear of the skull so it does not look like the head has come off.
      marks.push(...patch('w-collar', 57, 28, 14, 30, white, 0.96));
      marks.push(...patch('w-belly', 28, 58, 42, 20, white));
    }

    if (w > 0.55) {
      marks.push(...patch('w-flank', 22, 34, 40, 34, white, 0.95));
      marks.push(...patch('w-neck', 55, 18, 16, 26, white, 0.9));
    }

    shapes.push(
      <div key="white" style={{ position: 'absolute', inset: 0, filter: `url(#${furFilter}) blur(${blurPx * 0.6}px)` }}>
        {marks}
      </div>,
    );
  }

  // --- Ticking -------------------------------------------------------------
  // Ticking is flecks of colour appearing IN white markings. On a solid dog
  // there is no white for it to appear in, and scattering dots over a coloured
  // coat just looks like the dog needs a bath.
  if (colour.ticked && colour.white > 0.2) {
    for (let i = 0; i < 16; i++) {
      shapes.push(
        blob(`t${i}`, 22 + noise() * 56, 66 + noise() * 24, 0.8, 1.1, fleck, 0.45),
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

/**
 * The SVG filters that give markings a ragged fur edge. Mounted once, at the
 * top of the app; every sprite refers to them by id. Three strengths, because
 * displacement is measured in pixels and a small card needs far less than a
 * full-size portrait.
 */
export function SpriteFilters() {
  const variants: [string, number, number][] = [
    ['fur-edge-s', 0.09, 2.2],
    ['fur-edge-m', 0.07, 4.2],
    ['fur-edge-l', 0.05, 7],
  ];
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {variants.map(([id, freq, scale]) => (
          <filter key={id} id={id} x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves="3" seed="11" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        ))}
      </defs>
    </svg>
  );
}
