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
import { type Dog, ageMonths, currentWeight } from '../engine/dog';
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
  resolveSilhouette,
  resolveTail,
  type Silhouette,
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
  corded: 'body-corded.png',
  hairless: 'body-hairless.png',
};

const EAR_SRC: Record<EarType, string> = {
  erect: 'ear-erect.png',
  semiErect: 'ear-semi.png',
  button: 'ear-button.png',
  drop: 'ear-drop.png',
};

/**
 * Where the artist put the eye and the nose on each body, as percentages of
 * the canvas — measured from the artwork's own dark pixels. Every body is a
 * little different, so each has its own pair.
 */
const FACE: Record<Silhouette, { eye: [number, number]; nose: [number, number] }> = {
  sighthound: { eye: [82.0, 17.8], nose: [90.9, 23.4] },
  bull: { eye: [82.0, 28.0], nose: [88.5, 30.6] },
  heavy: { eye: [83.3, 23.4], nose: [91.1, 27.6] },
  spitz: { eye: [81.5, 21.3], nose: [89.5, 25.0] },
  lowSmooth: { eye: [82.8, 28.0], nose: [90.9, 32.6] },
  lowHeavy: { eye: [82.9, 28.0], nose: [91.2, 32.7] },
  flatLong: { eye: [84.5, 23.6], nose: [89.5, 24.5] },
  terrier: { eye: [79.3, 19.5], nose: [88.0, 23.6] },
  egg: { eye: [80.4, 19.8], nose: [88.9, 27.0] },
  jowl: { eye: [83.6, 18.3], nose: [91.5, 21.3] },
  lowWire: { eye: [78.7, 28.0], nose: [88.5, 34.6] },
  greyhound: { eye: [80.1, 17.0], nose: [88.9, 21.5] },
  tallHound: { eye: [84.6, 12.5], nose: [94.0, 17.4] },
  wrinkle: { eye: [83.4, 26.4], nose: [89.1, 28.8] },
  roughHound: { eye: [76.6, 16.1], nose: [86.1, 21.8] },
  silkyHound: { eye: [79.4, 17.7], nose: [88.2, 22.9] },
  retriever: { eye: [83.9, 19.5], nose: [94.1, 24.7] },
  pointer: { eye: [84.6, 15.9], nose: [93.0, 19.5] },
  shepherd: { eye: [79.7, 14.7], nose: [88.6, 19.2] },
  softWavy: { eye: [79.0, 26.1], nose: [88.0, 33.1] },
  hound: { eye: [80.7, 17.1], nose: [88.8, 22.8] },
  bully: { eye: [81.3, 18.3], nose: [90.5, 23.4] },
  spaniel: { eye: [81.8, 18.5], nose: [91.6, 24.6] },
  plush: { eye: [81.0, 17.7], nose: [89.8, 23.4] },
  mountain: { eye: [80.2, 19.4], nose: [88.3, 21.9] },
  basset: { eye: [79.6, 31.1], nose: [88.7, 37.6] },
  corded: { eye: [82.7, 18.7], nose: [90.7, 23.1] },
  smooth: { eye: [80.6, 21.9], nose: [88.0, 24.6] },
  short: { eye: [80.6, 21.9], nose: [88.0, 24.6] },
  silky: { eye: [83.2, 21.7], nose: [91.3, 24.6] },
  long: { eye: [84.5, 20.7], nose: [92.7, 24.4] },
  doubleThick: { eye: [81.6, 22.4], nose: [89.1, 24.9] },
  wire: { eye: [81.8, 19.6], nose: [91.0, 24.7] },
  wavyFurnished: { eye: [82.1, 21.7], nose: [90.1, 25.0] },
  curly: { eye: [78.7, 17.5], nose: [87.9, 22.7] },
  hairless: { eye: [81.3, 22.5], nose: [88.6, 25.0] },
};

/**
 * Bodies beyond the eight coats: a racy sighthound, a heavy flat-faced bull
 * type, and a Spitz. Until their artwork lands the fallback body stands in,
 * stretched the right way. When a file arrives, add it to HAVE below and the
 * sprite starts using it.
 */
type BuildSilhouette = 'sighthound' | 'tallHound' | 'bull' | 'heavy' | 'jowl' | 'egg' | 'terrier' | 'spitz' | 'lowSmooth' | 'lowHeavy' | 'lowWire' | 'flatLong' | 'wrinkle' | 'roughHound' | 'silkyHound' | 'retriever' | 'pointer' | 'shepherd' | 'softWavy' | 'hound' | 'bully' | 'spaniel' | 'plush' | 'mountain' | 'basset' | 'greyhound';
const SILHOUETTE_SRC: Record<BuildSilhouette, { file: string; fallback: CoatKind }> = {
  sighthound: { file: 'body-sighthound.png', fallback: 'smooth' },
  bull: { file: 'body-bull.png', fallback: 'smooth' },
  heavy: { file: 'body-heavy.png', fallback: 'smooth' },
  jowl: { file: 'body-jowl.png', fallback: 'smooth' },
  egg: { file: 'body-egg.png', fallback: 'smooth' },
  terrier: { file: 'body-terrier.png', fallback: 'smooth' },
  spitz: { file: 'body-spitz.png', fallback: 'doubleThick' },
  lowSmooth: { file: 'body-lowsmooth.png', fallback: 'smooth' },
  lowHeavy: { file: 'body-lowheavy.png', fallback: 'smooth' },
  lowWire: { file: 'body-lowwire.png', fallback: 'wire' },
  flatLong: { file: 'body-flatlong.png', fallback: 'silky' },
  tallHound: { file: 'body-tallhound.png', fallback: 'smooth' },
  wrinkle: { file: 'body-wrinkle.png', fallback: 'smooth' },
  roughHound: { file: 'body-roughhound.png', fallback: 'wire' },
  silkyHound: { file: 'body-silkyhound.png', fallback: 'silky' },
  retriever: { file: 'body-retriever.png', fallback: 'smooth' },
  pointer: { file: 'body-pointer.png', fallback: 'smooth' },
  shepherd: { file: 'body-shepherd.png', fallback: 'smooth' },
  softWavy: { file: 'body-softwavy.png', fallback: 'wavyFurnished' },
  hound: { file: 'body-hound.png', fallback: 'smooth' },
  bully: { file: 'body-bully.png', fallback: 'smooth' },
  spaniel: { file: 'body-spaniel.png', fallback: 'silky' },
  plush: { file: 'body-plush.png', fallback: 'doubleThick' },
  mountain: { file: 'body-mountain.png', fallback: 'doubleThick' },
  basset: { file: 'body-basset.png', fallback: 'smooth' },
  greyhound: { file: 'body-greyhound.png', fallback: 'smooth' },
};
const BUILD_SILHOUETTES: BuildSilhouette[] = ['sighthound', 'tallHound', 'bull', 'heavy', 'jowl', 'egg', 'terrier', 'spitz', 'lowSmooth', 'lowHeavy', 'lowWire', 'flatLong', 'wrinkle', 'roughHound', 'silkyHound', 'retriever', 'pointer', 'shepherd', 'softWavy', 'hound', 'bully', 'spaniel', 'plush', 'mountain', 'basset', 'greyhound'];

/**
 * Where the ears and tail attach on each body, as percentages of the canvas.
 * The eight coat bodies share one skeleton; the four build bodies each have
 * their own, measured from the artwork (top-rear of the skull, and the top of
 * the rump). Anything not listed uses the shared skeleton.
 */
/**
 * Measured from the artwork (scripts: the rump is the left end of the back
 * line, the skull top the highest point of the head), then offset the way the
 * smooth body's shared points are: the tail root 2.4% behind and 2.7% below
 * the rump corner, the ear 6% below the skull top.
 */
const RIG: Partial<Record<Silhouette, { ear: [number, number]; tail: [number, number] }>> = {
  sighthound: { ear: [76.5, 18.5], tail: [28.6, 48.9] },
  bull: { ear: [75.6, 25.2], tail: [28.9, 46.9] },
  heavy: { ear: [76.5, 21], tail: [30.3, 48.9] },
  spitz: { ear: [75, 19], tail: [30.0, 46.0] },
  lowSmooth: { ear: [78, 27], tail: [25.5, 60.7] },
  lowHeavy: { ear: [77, 26], tail: [21.9, 57.2] },
  flatLong: { ear: [78.5, 20.5], tail: [25.9, 49.5] },
  terrier: { ear: [74.3, 16.9], tail: [28.5, 45.4] },
  egg: { ear: [75, 18.5], tail: [27.8, 48.4] },
  jowl: { ear: [79.0, 16.9], tail: [27.0, 44.3] },
  lowWire: { ear: [77.5, 25.5], tail: [26.2, 56.3] },
  greyhound: { ear: [76.7, 16.9], tail: [28.1, 48.4] },
  tallHound: { ear: [79.5, 12.5], tail: [27.3, 44.7] },
  wrinkle: { ear: [76, 24], tail: [27.5, 49.8] },
  roughHound: { ear: [72.4, 16.9], tail: [33.1, 46.0] },
  silkyHound: { ear: [73.3, 16.9], tail: [29.2, 45.4] },
  retriever: { ear: [78.9, 17.8], tail: [20.9, 49.3] },
  pointer: { ear: [78.5, 13], tail: [26.8, 44.5] },
  corded: { ear: [77, 16], tail: [28.1, 46.7] },
  shepherd: { ear: [75.1, 14.7], tail: [28.5, 45.1] },
  softWavy: { ear: [77.8, 24], tail: [26.2, 55] },
  bully: { ear: [75.4, 16.9], tail: [26.7, 44.3] },
  spaniel: { ear: [75.7, 16.9], tail: [25.1, 46.9] },
  plush: { ear: [76.2, 16.9], tail: [25.9, 43.2] },
  mountain: { ear: [74.2, 16.9], tail: [28.8, 43.4] },
  basset: { ear: [74.4, 31.4], tail: [24.2, 61.8] },
  curly: { ear: [74.3, 16.9], tail: [29.3, 47.3] },
  hound: { ear: [74.9, 15.9], tail: [26.2, 44.5] },
};

const TAIL_SRC: Record<TailType, string> = {
  full: 'tail-full.png',
  bobtail: 'tail-bob.png',
  screw: 'tail-screw.png',
  whip: 'tail-whip.png',
  plume: 'tail-plume.png',
  sickle: 'tail-sickle.png',
  curled: 'tail-curled.png',
};

/**
 * Which of the ROUND FOUR files (see docs/sprite-brief.md) exist yet in
 * public/sprites. Add a filename here when its artwork lands; until then the
 * stand-ins below are used.
 */
const HAVE = new Set<string>([
  'body-greyhound.png',
  'body-lowwire.png',
  'body-bully.png',
  'body-spaniel.png',
  'body-plush.png',
  'body-mountain.png',
  'body-basset.png',
  'tail-brush.png',
  'tail-curlfluff.png',
  'tail-bushy.png',
  'tail-bobfluff.png',
  'body-shepherd.png',
  'body-softwavy.png',
  'body-hound.png',
  'body-sighthound.png',
  'body-bull.png',
  'body-heavy.png',
  'body-spitz.png',
  'tail-whip.png',
  'tail-plume.png',
  'tail-sickle.png',
  'tail-curled.png',
  'tail-screw.png',
  'body-lowsmooth.png',
  'body-lowheavy.png',
  'body-flatlong.png',
  'ear-hound.png',
  'ear-spaniel.png',
  'body-terrier.png',
  'body-egg.png',
  'body-jowl.png',

  'ear-bat.png',
  'ear-rose.png',
  'ear-shortdrop.png',
  'tail-otter.png',
  'tail-flag.png',
  'tail-sabre.png',
  'body-tallhound.png',
  'body-wrinkle.png',
  'body-roughhound.png',
  'body-silkyhound.png',
  'body-retriever.png',
  'body-pointer.png',
  'body-corded.png',
]);

/**
 * Stand-ins for tails whose artwork is still to come, built from the two
 * tails we do have: the full tail swung over the back, thinned and dropped,
 * fattened into a plume; the bobtail tightened into a screw. They are honest
 * about the dog, if not pretty.
 */
const TAIL_STANDIN: Partial<Record<TailType, { src: TailType; transform: string }>> = {
  curled: { src: 'full', transform: 'rotate(-118deg) scale(0.72, 0.9)' },
  sickle: { src: 'full', transform: 'rotate(-80deg) scale(0.9)' },
  whip: { src: 'full', transform: 'rotate(22deg) scale(1.05, 0.55)' },
  plume: { src: 'full', transform: 'rotate(-18deg) scale(1.08, 1.35)' },
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
  /** Degrees, clockwise, about the anchor. For tails drawn at the wrong carriage. */
  rotate?: number;
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
/** The Chow's rounded bear ear: its base is bottom-left of the artwork. */
const ROUND_EAR_FIT: Fit = { anchor: [72, 41], target: [74.5, 19], scale: 0.42 };
/** The long hound ear: hangs from its top edge, past the jaw. */
const HOUND_EAR_FIT: Fit = { anchor: [61.2, 6.3], target: [75.5, 17], scale: 0.31 };
/** The feathered spaniel ear, for the silky-coated drop-eared breeds. */
const SPANIEL_EAR_FIT: Fit = { anchor: [80, 18], target: [75.5, 17], scale: 0.45 };
/** The big rounded bat ear: French Bulldog, Corgi, Chihuahua. Base bottom-left. */
const BAT_EAR_FIT: Fit = { anchor: [45, 83], target: [74.5, 19], scale: 0.3 };
/** The small rose ear folded back: sighthounds and Bulldogs. */
const ROSE_EAR_FIT: Fit = { anchor: [75, 37], target: [75, 17], scale: 0.6 };
/** The short neat drop ear of a retriever. Hangs from its top edge. */
/** The short neat drop ear of a retriever. Hangs from its top edge. */
const SHORT_DROP_FIT: Fit = { anchor: [76, 31], target: [75.5, 16.5], scale: 0.55 };

const EAR_FIT: Record<EarType, Fit> = {
  erect: { anchor: [55.1, 91.7], target: [74.5, 19], scale: 0.206 },
  semiErect: { anchor: [57.6, 72.7], target: [74.5, 19], scale: 0.25 },
  button: { anchor: [50.1, 28], target: [75, 16], scale: 0.19 },
  drop: { anchor: [73.8, 30.6], target: [75.5, 16], scale: 0.52 },
};

const TAIL_FIT: Record<TailType, Fit> = {
  // The root is pushed a couple of percent INTO the rump and the tail drawn a
  // touch larger. It sits behind the body, so the overlap is hidden, and the
  // join can never open into a gap on a body whose rump sits differently.
  full: { anchor: [25, 47], target: [27.5, 47.5], scale: 1.08 },
  bobtail: { anchor: [26, 43], target: [27.5, 45.5], scale: 1.1 },
  // The screw was drawn floating mid-canvas; its top is the root.
  screw: { anchor: [50, 36], target: [28, 45.5], scale: 0.42 },
  // The whip was drawn trailing straight back; swung down so it hangs
  // between the hocks like a real sighthound's.
  whip: { anchor: [52, 46.5], target: [27.5, 47.5], scale: 0.75, rotate: -30 },
  // The plume was drawn flying straight up; tipped back to a flag.
  plume: { anchor: [51, 74], target: [27.5, 47.5], scale: 0.7, rotate: -20 },
  sickle: { anchor: [51, 76], target: [28, 48], scale: 0.65 },
  curled: { anchor: [59.5, 63], target: [28, 48], scale: 0.75 },
};

/** Extra tail pieces chosen by coat rather than by carriage. */
const OTTER_TAIL_FIT: Fit = { anchor: [72, 54], target: [27.5, 47.5], scale: 0.5, rotate: 12 };
/** The fox brush, hanging: Spitz and shepherd types with a low tail. Root at its top. */
const BRUSH_TAIL_FIT: Fit = { anchor: [61.9, 14.7], target: [27.5, 46.5], scale: 0.52 };
/** A bushy sabre for plush-coated dogs (Golden, Newfoundland). Root at its right end. */
const BUSHY_TAIL_FIT: Fit = { anchor: [84, 49], target: [27.5, 47.5], scale: 0.42, rotate: 14 };
/** The fluffy curl over the back of a coated Spitz. Root at its bottom. */
const CURLFLUFF_TAIL_FIT: Fit = { anchor: [47.8, 82], target: [28, 46], scale: 0.47 };
/** A tuft of a bobtail on a coated dog. Root at its base. */
const BOBFLUFF_TAIL_FIT: Fit = { anchor: [80, 58], target: [27.5, 45.5], scale: 0.5 };
const FLAG_TAIL_FIT: Fit = { anchor: [81, 42], target: [27.5, 46.5], scale: 0.5, rotate: -12 };
const SABRE_TAIL_FIT: Fit = { anchor: [62, 42], target: [27.5, 47.5], scale: 0.55 };

/** A fit moved to a different body's attachment point. */
function retarget(fit: Fit, target: [number, number] | undefined, base: [number, number]): Fit {
  if (!target) return fit;
  // Keep the small deliberate offset each piece has from the shared point
  // (a root pushed into the rump, an ear sat a touch back).
  return { ...fit, target: [target[0] + (fit.target[0] - base[0]), target[1] + (fit.target[1] - base[1])] };
}
const SHARED_EAR: [number, number] = [74.5, 19];
const SHARED_TAIL: [number, number] = [27.5, 47.5];

function fitStyle(fit: Fit): { transform: string; transformOrigin: string } {
  return {
    transformOrigin: `${fit.anchor[0]}% ${fit.anchor[1]}%`,
    transform: `translate(${(fit.target[0] - fit.anchor[0]).toFixed(2)}%, ${(
      fit.target[1] - fit.anchor[1]
    ).toFixed(2)}%) rotate(${fit.rotate ?? 0}deg) scale(${fit.scale})`,
  };
}

/** Where a weight sits between the smallest dog (0) and the biggest (1), on the log scale the eye reads size by. */
function sizeT(lbs: number): number {
  return Math.min(1, Math.max(0, (Math.log(lbs) - Math.log(4)) / (Math.log(170) - Math.log(4))));
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
  /** Eyes shut. Used by the litter reveal before a puppy has been "looked at". */
  asleep?: boolean;
  /** Draw the dog as if it were this many months old, whatever the calendar says. */
  asAge?: number;
  /** Fill the width of whatever holds it, keeping the picture's shape; `size` is ignored. */
  fluid?: boolean;
  /** Dev galleries only: force a body, tail or ear regardless of the genes. */
  force?: SpriteOverride;
}

export interface SpriteOverride {
  silhouette?: Silhouette;
  tail?: TailType;
  ears?: EarType;
}

export function DogSprite({ dog, size = 120, className = '', framed = true, asleep = false, asAge, fluid = false, force }: DogSpriteProps) {
  const height = (size * 1086) / 1448;
  // Puppies are drawn at their CURRENT weight, so a litter of newborns is
  // visibly a litter of newborns and a dog grows on screen as the months pass.
  const game = useGameMaybe();
  const months = asAge ?? (game ? ageMonths(dog, game.project.month) : 30);
  const nowLbs = asAge !== undefined ? currentWeight({ ...dog, birthMonth: 0 }, asAge) : game ? currentWeight(dog, game.project.month) : sizeToPounds(dog.observed.size);
  const art = useMemo(() => describe(dog, nowLbs, force), [dog, nowLbs, force]);

  // Puppy proportions. A puppy is not a shrunk adult: its head is bigger for
  // its body and its muzzle shorter. The head is drawn again, clipped and
  // enlarged about the neck, over the ordinary body; the ear and face ride
  // inside the same enlargement so they stay on the head.
  const puppy = Math.max(0, 1 - months / 8);
  const headScale = 1 + 0.22 * puppy;
  // Small dogs have big eyes, and puppies bigger still.
  const eyeScale = (1 + 0.4 * (1 - sizeT(sizeToPounds(dog.observed.size)))) * (1 + 0.25 * puppy);

  // Nothing shows until the body artwork has arrived, so a card never
  // flashes two eye dots on an empty stage.
  const [ready, setReady] = useState(false);
  // Tap the dog and it wags. Purely for the pleasure of it.
  const [wagging, setWagging] = useState(false);
  const wag = () => {
    if (wagging) return;
    setWagging(true);
    window.setTimeout(() => setWagging(false), 720);
  };

  return (
    <div
      className={`relative ${framed ? 'stage' : ''} ${className}`}
      style={{
        width: fluid ? '100%' : size,
        height: fluid ? undefined : height,
        aspectRatio: fluid ? '1448 / 1086' : undefined,
        isolation: 'isolate',
        borderRadius: framed ? 14 : 0,
        overflow: 'hidden',
      }}
      role="img"
      aria-label={`${dog.name}, ${art.colorName}, ${art.coatLabel}`}
      onPointerDown={wag}
    >
      {/* A soft shadow on the grass under the dog. */}
      {framed && (
        <div
          style={{
            position: 'absolute',
            left: '22%',
            right: '18%',
            top: '84%',
            height: '8%',
            borderRadius: '50%',
            background: 'rgb(0 0 0 / 10%)',
            filter: 'blur(2px)',
          }}
        />
      )}
      {/* Scaled about the feet, so a small dog stands on the same ground as a big
          one instead of floating in the middle of the box. */}
      <div style={{ position: 'absolute', inset: 0, transform: art.bodyTransform, transformOrigin: '50% 88%', opacity: ready ? 1 : 0, transition: 'opacity 180ms ease' }}>
        {/* Tail sits behind the body. The wrapper wags about the tail root. */}
        <div
          className={wagging ? 'wagging' : undefined}
          style={{ position: 'absolute', inset: 0, transformOrigin: `${art.tailFit.target[0]}% ${art.tailFit.target[1]}%` }}
        >
          <div style={{ position: 'absolute', inset: 0, transform: art.tailStandin, transformOrigin: `${art.tailFit.target[0]}% ${art.tailFit.target[1]}%` }}>
            <Layer src={art.tailSrc} colour={art.fill} fit={art.tailFit} />
          </div>
        </div>

        {/* The dog itself, carrying all the markings. */}
        <Layer src={art.bodySrc} colour={art.fill} onLoad={() => setReady(true)}>
          {art.markings}
        </Layer>

        {/* The head, ear and face — enlarged together on a puppy. */}
        <div style={{ position: 'absolute', inset: 0, transform: headScale > 1 ? `scale(${headScale.toFixed(3)}, ${(headScale * 1.04).toFixed(3)})` : undefined, transformOrigin: `${art.headPivot[0]}% ${art.headPivot[1]}%` }}>
          {headScale > 1 && (
            <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: art.headClip, maskImage: art.headClip, WebkitMaskComposite: 'source-in', maskComposite: 'intersect' }}>
              <Layer src={art.bodySrc} colour={art.fill}>
                {art.markings}
              </Layer>
            </div>
          )}

          {/* Ear in front. Slightly darker, as ear leather usually is. */}
          <Layer src={art.earSrc} colour={art.earColour} fit={art.earFit} />

          {/* Eye and nose, in the colours the genes give them. Drawn last and
              unmasked, over the artwork's own dark dots, so a blue eye or a
              liver nose actually shows. */}
          <Face face={art.face} eye={art.eyeColour} nose={art.noseColour} asleep={asleep} eyeScale={eyeScale} blinkSeed={dog.seedValue ?? 0} />
        </div>
      </div>
    </div>
  );
}

/** The eye (iris, pupil, catchlight) and the nose, as coloured dots. */
function Face({
  face,
  eye,
  nose,
  asleep = false,
  eyeScale = 1,
  blinkSeed = 0,
}: {
  face: { eye: [number, number]; nose: [number, number] };
  eye: string;
  nose: string;
  asleep?: boolean;
  /** 1 for a big dog; up to about 1.75 for a tiny puppy. */
  eyeScale?: number;
  /** Staggers the blink so a litter does not blink in unison. */
  blinkSeed?: number;
}) {
  const e = eyeScale;
  const dot = (cx: number, cy: number, w: number, h: number, fill: string, extra?: React.CSSProperties) => (
    <div
      style={{
        position: 'absolute',
        left: `${cx - w / 2}%`,
        top: `${cy - h / 2}%`,
        width: `${w}%`,
        height: `${h}%`,
        borderRadius: '50%',
        background: fill,
        ...extra,
      }}
    />
  );
  if (asleep) {
    // A closed eye: a short dark lash line where the eye would be, drawn
    // over the artwork's own eye dot so the dog is plainly sleeping.
    return (
      <>
        {dot(face.eye[0], face.eye[1] - 0.1, 2.4, 2.4 * 1.333, 'var(--sleep-lid, #d9c9a6)')}
        {dot(face.eye[0], face.eye[1] + 0.35, 2.2, 0.55 * 1.333, '#1a1512', { borderRadius: '0 0 50% 50%' })}
        {dot(face.nose[0], face.nose[1], 2.6, 2.6 * 1.1, nose, { boxShadow: '0 0 0 0.5px rgba(0,0,0,0.25)' })}
      </>
    );
  }
  return (
    <>
      {/* Iris, pupil, catchlight. Height is width × canvas aspect so it is
          round. The whole eye blinks now and then, closing about its centre. */}
      <div
        className="blink"
        style={{ position: 'absolute', inset: 0, transformOrigin: `${face.eye[0]}% ${face.eye[1]}%`, animationDelay: `${-((blinkSeed % 7000) / 1000).toFixed(2)}s`, animationDuration: `${(5.5 + (blinkSeed % 2300) / 1000).toFixed(2)}s` }}
      >
        {dot(face.eye[0], face.eye[1], 1.9 * e, 1.9 * e * 1.333, eye, { boxShadow: '0 0 0 0.6px rgba(0,0,0,0.35)' })}
        {dot(face.eye[0] + 0.15 * e, face.eye[1] + 0.2 * e, 0.9 * e, 0.9 * e * 1.333, '#1a1512')}
        {dot(face.eye[0] - 0.35 * e, face.eye[1] - 0.45 * e, 0.5 * e, 0.5 * e * 1.333, 'rgba(255,255,255,0.85)')}
      </div>
      {/* Nose, slightly wider than tall, with a soft edge. */}
      {dot(face.nose[0], face.nose[1], 2.6, 2.6 * 1.1, nose, { boxShadow: '0 0 0 0.5px rgba(0,0,0,0.25)' })}
    </>
  );
}

/**
 * Where each body sits on the canvas: left, top, right, bottom, as
 * percentages, measured from the artwork. The marking stencils were drawn on
 * the smooth body, so on any other body they are stretched from the smooth
 * body's box to that body's box — a Bulldog's head sits lower and further
 * forward, and its tan points and blaze have to move with it.
 */
const BODY_BOX: Record<string, [number, number, number, number]> = {
  'body-bull.png': [18.4, 19.2, 90.2, 87.3],
  'body-curly.png': [19.3, 10.9, 89.4, 87.3],
  'body-double.png': [19.5, 13.4, 90.6, 91.5],
  'body-hairless.png': [20.2, 10.5, 90.1, 88.4],
  'body-heavy.png': [20.3, 15.1, 92.8, 90.1],
  'body-long.png': [18.0, 11.4, 94.2, 92.3],
  'body-sighthound.png': [19.5, 12.5, 92.4, 90.8],
  'body-silky.png': [16.7, 12.3, 92.8, 91.9],
  'body-smooth.png': [19.5, 13.1, 89.4, 87.3],
  'body-spitz.png': [20.9, 12.9, 91.2, 91.0],
  'body-wavy.png': [18.9, 13.1, 91.6, 89.5],
  'body-wire.png': [18.2, 13.3, 92.4, 90.1],
  'body-lowheavy.png': [17.1, 20.1, 92.7, 87.5],
  'body-lowsmooth.png': [19.2, 21.0, 92.4, 87.1],
  'body-flatlong.png': [16.9, 14.7, 91.0, 87.5],
  'body-terrier.png': [19.2, 10.9, 89.5, 87.3],
  'body-egg.png': [18.8, 12.9, 90.3, 87.8],
  'body-jowl.png': [16.0, 10.9, 92.7, 87.3],
  'body-lowwire.png': [18.4, 19.5, 90.2, 87.3],
  'body-bully.png': [16.4, 10.9, 92.1, 87.3],
  'body-spaniel.png': [15.2, 10.9, 93.4, 87.3],
  'body-plush.png': [17.0, 10.9, 91.6, 87.3],
  'body-mountain.png': [19.1, 10.9, 89.5, 87.3],
  'body-basset.png': [18.4, 25.4, 90.2, 87.3],
  'body-shepherd.png': [18.4, 8.7, 90.2, 87.3],
  'body-softwavy.png': [18.4, 18.0, 90.2, 87.3],
  'body-hound.png': [18.4, 9.9, 90.2, 87.3],
  'body-greyhound.png': [18.2, 10.9, 90.3, 87.3],
  'body-tallhound.png': [17.0, 6.6, 95.4, 87.8],
  'body-wrinkle.png': [19.2, 17.9, 91.0, 88.6],
  'body-roughhound.png': [21.3, 10.9, 87.3, 87.3],
  'body-silkyhound.png': [18.9, 10.9, 89.6, 87.3],
  'body-retriever.png': [12.8, 11.8, 95.7, 87.3],
  'body-pointer.png': [16.7, 7.2, 94.5, 87.8],
  'body-corded.png': [18.2, 9.9, 92.3, 87.8],
};

/** The CSS transform that maps the smooth body's box onto another body's. */
function stencilFit(bodySrc: string): string | undefined {
  const from = BODY_BOX['body-smooth.png'];
  const to = BODY_BOX[bodySrc];
  if (!to || bodySrc === 'body-smooth.png') return undefined;
  const sx = (to[2] - to[0]) / (from[2] - from[0]);
  const sy = (to[3] - to[1]) / (from[3] - from[1]);
  const dx = to[0] - from[0] * sx;
  const dy = to[1] - from[1] * sy;
  return `translate(${dx.toFixed(2)}%, ${dy.toFixed(2)}%) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
}

/**
 * A marking stencil: a white-on-transparent shape drawn on the smooth body's
 * pose, used as a mask and filled with one colour. The body layer clips it,
 * so it cannot spill outside whichever body the dog actually has.
 */
function Stencil({ src, colour, opacity, transform }: { src: string; colour: string; opacity: number; transform?: string }) {
  const url = `url("${BASE}${src}")`;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: colour,
        opacity,
        transform,
        transformOrigin: '0 0',
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
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
  onLoad,
}: {
  src: string;
  colour: string;
  fit?: Fit;
  children?: React.ReactNode;
  onLoad?: () => void;
}) {
  const url = `url("${BASE}${src}")`;
  const placement = fit ? fitStyle(fit) : {};
  const mask: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    ...placement,
    background: colour,
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
        onLoad={onLoad}
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

function describe(dog: Dog, drawLbs?: number, force?: SpriteOverride) {
  const weight = sizeToPounds(dog.observed.size);
  const visual = drawLbs ?? weight;
  const coat = resolveCoat(dog.genotype, weight);
  const colour = resolveColor(dog.genotype);
  const ears = force?.ears ?? resolveEars(dog.observed.earSet);
  const tail = force?.tail ?? resolveTail(dog.genotype, dog.observed.tailSet, dog.observed.muzzle, coat.kind, weight);
  const shortLegs = legShortening(dog.genotype);

  // Which body. The coat, unless the build or head is distinctive enough to
  // deserve its own silhouette. Without the artwork, stretch the fallback.
  const silhouette = force?.silhouette ?? resolveSilhouette(coat, dog.observed.substance, dog.observed.muzzle, dog.observed.earSet, weight, shortLegs, dog.observed.tailSet);
  let bodySrc = BODY_SRC[coat.kind];
  let standinStretch = '';
  let rig: { ear: [number, number]; tail: [number, number] } | undefined = RIG[coat.kind];
  let face = FACE[coat.kind];
  // The giant smooth dogs (Great Dane, European type) wear the mastiff's
  // heavy head on a taller, narrower frame: the jowl body stretched up.
  if (silhouette === 'tallHound') {
    bodySrc = 'body-jowl.png';
    rig = RIG.jowl;
    face = FACE.jowl;
    standinStretch = ' scale(0.88, 1.06)';
  } else if ((BUILD_SILHOUETTES as string[]).includes(silhouette)) {
    const want = SILHOUETTE_SRC[silhouette as BuildSilhouette];
    if (HAVE.has(want.file)) {
      bodySrc = want.file;
      rig = RIG[silhouette];
      face = FACE[silhouette];
    } else {
      bodySrc = BODY_SRC[want.fallback];
      standinStretch = silhouette === 'sighthound' ? ' scale(0.88, 1.06)' : silhouette === 'bull' || silhouette === 'heavy' ? ' scale(1.14, 0.92)' : '';
    }
  }

  // A heavy, plush, curl-tailed Spitz with pricked ears is a Chow or an
  // Akita, and those carry small rounded bear ears rather than points.
  const roundEars = silhouette === 'spitz' && ears === 'erect' && dog.observed.substance > 68 && tail === 'curled';
  // Long-muzzled smooth dogs with drop ears and no undercoat are hounds, and
  // hounds have the long pendulous ear: Basset, Bloodhound, Dachshund.
  // Long-eared dogs: smooth hounds with a real muzzle (Basset, Bloodhound,
  // Dachshund) and the single-coated silky breeds (spaniels, Shih Tzu,
  // Cavalier). Plush-coated retrievers and the bull types keep short ears.
  const longEared =
    ears === 'drop' && !coat.undercoat && !coat.hairless && silhouette !== 'sighthound' && silhouette !== 'bull';
  const houndEars = longEared && (coat.kind === 'smooth' || coat.kind === 'short') && (dog.observed.muzzle > 55 || silhouette === 'hound') && silhouette !== 'tallHound';
  const spanielEars = longEared && !houndEars && (coat.kind === 'silky' || coat.kind === 'long' || silhouette === 'flatLong');
  // Big bat ears on the small flat-faced and low dogs; rose ears folded back
  // on sighthounds and Bulldogs; short neat drops on the plush-coated retrievers.
  const batEars = ears === 'erect' && !roundEars && (silhouette === 'bull' || silhouette === 'lowSmooth' || silhouette === 'lowHeavy' || silhouette === 'terrier');
  // The Frenchie and Corgi wear the full bat; a terrier's or Dachshund's
  // pricked ear is a smaller thing, and a flat-faced toy's smaller still.
  const batScale = (silhouette === 'bull' && weight >= 24) || silhouette === 'lowHeavy' ? 1 : silhouette === 'bull' ? 0.68 : 0.78;
  const roseEars = (ears === 'button' || ears === 'semiErect') && (silhouette === 'sighthound' || silhouette === 'tallHound' || silhouette === 'greyhound' || silhouette === 'bull' || silhouette === 'egg' || silhouette === 'wrinkle');
  const shortDrop = ears === 'drop' && coat.undercoat && !coat.hairless;

  // The tail: the real file if it exists, else a stand-in built from one we have.
  const standin = HAVE.has(TAIL_SRC[tail]) ? undefined : TAIL_STANDIN[tail];
  let tailKey: TailType = standin ? standin.src : tail;
  let tailFit = TAIL_FIT[tailKey];
  // The bushy full tail belongs on a coated dog. A smooth-coated hound or
  // Dalmatian carries a sleek one: the whip artwork, held out in a sabre. A
  // plush-coated shepherd type carries a furry one: the plume, hanging.
  const smoothKind = coat.kind === 'smooth' || coat.kind === 'short' || coat.kind === 'hairless';
  let tailSrc = TAIL_SRC[tailKey];
  const fluffy = coat.kind === 'doubleThick' || silhouette === 'plush' || silhouette === 'mountain' || silhouette === 'spitz';
  if ((tail === 'full' || tail === 'whip') && (silhouette === 'spitz' || silhouette === 'shepherd')) {
    // The fox brush, hanging; a whip is the same brush held a little lower.
    tailSrc = 'tail-brush.png';
    tailFit = { ...BRUSH_TAIL_FIT, rotate: tail === 'whip' ? 8 : 0 };
  } else if (tail === 'curled' && (fluffy || coat.kind === 'long' || coat.kind === 'silky')) {
    tailSrc = 'tail-curlfluff.png';
    tailFit = CURLFLUFF_TAIL_FIT;
  } else if (tail === 'bobtail' && !smoothKind) {
    tailSrc = 'tail-bobfluff.png';
    tailFit = BOBFLUFF_TAIL_FIT;
  } else if ((tail === 'full' || tail === 'plume') && (silhouette === 'plush' || silhouette === 'mountain')) {
    tailSrc = 'tail-bushy.png';
    tailFit = BUSHY_TAIL_FIT;
  } else if (tail === 'full' && smoothKind && coat.undercoat) {
    // The thick otter tail of a Labrador.
    tailSrc = 'tail-otter.png';
    tailFit = OTTER_TAIL_FIT;
  } else if (tail === 'full' && smoothKind) {
    // A hound's sabre, hanging in a curve.
    tailSrc = 'tail-sabre.png';
    tailFit = SABRE_TAIL_FIT;
  } else if (tail === 'plume' && silhouette === 'softWavy') {
    // A terrier's bushy tail, carried up: the full tail, drawn bushy.
    tailSrc = 'tail-full.png';
    tailFit = { ...TAIL_FIT.full, scale: 0.75, rotate: -25 };
  } else if (tail === 'plume' && (coat.kind === 'silky' || coat.kind === 'long')) {
    // Setters and spaniels carry the feathered flag level.
    tailSrc = 'tail-flag.png';
    tailFit = FLAG_TAIL_FIT;
  } else if (tail === 'whip' && (coat.kind === 'silky' || coat.kind === 'long' || coat.kind === 'doubleThick')) {
    // A low-set tail on a coated dog is still feathered: the flag, hanging.
    tailSrc = 'tail-flag.png';
    tailFit = { ...FLAG_TAIL_FIT, rotate: 34, scale: 0.45 };
  }
  const noise = makeNoise(dog.seedValue ?? 1);

  // Body build and size, applied by scaling rather than extra artwork.
  // Size has to be OBVIOUS. A Chihuahua and a Great Dane differ thirty-fold in
  // weight; drawing them within 30% of each other, as an earlier version did,
  // made every dog look the same. Weight is on a log scale here because that is
  // how size reads to the eye: 5 lb to 15 lb is a bigger visual jump than
  // 100 lb to 110 lb.
  const sizeScale = 0.46 + 0.7 * sizeT(visual);
  // Build widens the dog a little. On the bull and heavy bodies it does more,
  // because the artwork is drawn at the burly extreme: a Boxer shares the
  // Bulldog's frame but is a much leaner animal.
  const burly = silhouette === 'bull' || silhouette === 'heavy';
  // A shepherd type (plush coat, pricked ears, tail carried low) borrows the
  // Spitz body but is a leaner, longer animal, so it is narrowed a touch.
  const shepherd = silhouette === 'spitz' && dog.observed.tailSet < 60;
  // The sighthound body is narrowed further still for the lightest dogs.
  const substance = burly
    ? 0.8 + (dog.observed.substance / 100) * 0.24
    : silhouette === 'sighthound' || silhouette === 'tallHound' || silhouette === 'greyhound'
      ? 0.84 + (dog.observed.substance / 100) * 0.22
      : (shepherd ? 0.84 : 0.94) + (dog.observed.substance / 100) * 0.14;
  // Short-legged dogs read as longer and lower rather than simply smaller.
  // Short-legged dogs read as longer and lower; so does a shepherd type,
  // which is a longer, leaner animal than the Spitz whose body it borrows.
  // The whole body is squashed, not just the legs (there is one body image),
  // so the stretch widens it back into a long, low dog rather than a small one.
  // Only a little longer: too much stretch and a 20 lb Dachshund is drawn
  // as wide as a 50 lb Basset, which reads as a big dog rather than a low one.
  // No stretch at all for short legs: squashing the height already makes
  // the dog read as long, and a Scottie is low without being a sausage.
  // Dogs drawn on a purpose-made low body need no squash; coated
  // short-legged dogs (a Scottie, a Pekingese) still borrow a normal body.
  // Only when the purpose-made low body is actually in use; a stand-in still
  // needs its legs squashed.
  const lowBody = rig !== undefined && (silhouette === 'lowSmooth' || silhouette === 'lowHeavy' || silhouette === 'lowWire' || silhouette === 'flatLong' || silhouette === 'basset');
  const legSquash = lowBody ? 1 : shortLegs === 2 ? 0.66 : shortLegs === 1 ? 0.82 : shepherd ? 0.93 : 1;
  const stretch = shepherd ? 1.1 : 1;

  const bodyTransform = `scale(${(sizeScale * substance * stretch).toFixed(3)}, ${(sizeScale * legSquash).toFixed(3)})${standinStretch}`;

  const trueColour = coat.hairless ? shade(colour.base, 26) : colour.base;
  const base = forShading(trueColour);
  // The legendary coat is painted with a gradient rather than a colour.
  const RAINBOW = 'linear-gradient(105deg, #ff8a8a 0%, #ffc07a 20%, #fff29a 40%, #9ee8a8 60%, #8ccfff 80%, #d3a6ff 100%)';
  const fill = colour.rainbow ? RAINBOW : base;

  // Where a puppy's enlarged head is cut from the body and grown about: the
  // neck, just behind the skull. Low bodies carry their heads lower.
  const lowHead = silhouette === 'lowSmooth' || silhouette === 'lowHeavy' || silhouette === 'lowWire' || silhouette === 'basset';
  // Feathered, not hard-cut, so the enlarged copy fades into the body at
  // the neck and chest instead of leaving a step.
  const chest = lowHead ? 70 : silhouette === 'tallHound' || silhouette === 'sighthound' || silhouette === 'greyhound' ? 46 : 54;
  const headClip = `linear-gradient(to right, transparent 58%, black 66%), linear-gradient(to bottom, black ${chest - 12}%, transparent ${chest + 2}%)`;
  const headPivot: [number, number] = lowHead ? [70, 50] : [70, 34];

  return {
    bodySrc,
    fill,
    headClip,
    headPivot,
    earSrc: roundEars
      ? 'ear-round.png'
      : houndEars
        ? 'ear-hound.png'
        : spanielEars
          ? 'ear-spaniel.png'
          : batEars
            ? 'ear-bat.png'
            : roseEars
              ? 'ear-rose.png'
              : shortDrop
                ? 'ear-shortdrop.png'
                : EAR_SRC[ears],
    tailSrc,
    tailStandin: standin?.transform,
    earFit: retarget(
      ears === 'drop' && coat.undercoat
        ? { ...EAR_FIT.drop, scale: EAR_FIT.drop.scale * 0.8 }
        : silhouette === 'sighthound' || silhouette === 'tallHound' || silhouette === 'greyhound'
          ? { ...EAR_FIT[ears], scale: EAR_FIT[ears].scale * 0.7 }
          : roundEars
            ? ROUND_EAR_FIT
            : houndEars
              ? { ...HOUND_EAR_FIT, scale: HOUND_EAR_FIT.scale * (silhouette === 'basset' || silhouette === 'hound' || weight >= 45 ? 1 : 0.76) }
              : spanielEars
                ? SPANIEL_EAR_FIT
                : batEars
                  ? { ...BAT_EAR_FIT, scale: BAT_EAR_FIT.scale * batScale }
                  : roseEars
                    ? ROSE_EAR_FIT
                    : shortDrop
                      ? SHORT_DROP_FIT
            : silhouette === 'spitz' && ears === 'erect'
              // Spitz ears are small, thick triangles, not Shepherd sails.
              ? { ...EAR_FIT.erect, scale: EAR_FIT.erect.scale * (shortLegs > 0 ? 0.6 : 0.72) }
              : silhouette === 'flatLong' && (ears === 'erect' || ears === 'semiErect')
                // A Papillon-eared toy, not a Shepherd.
                ? { ...EAR_FIT[ears], scale: EAR_FIT[ears].scale * 0.7 }
                : EAR_FIT[ears],
      rig?.ear,
      SHARED_EAR,
    ),
    tailFit: retarget(tailFit, rig?.tail, SHARED_TAIL),
    bodyTransform,
    base,
    // Ear leather is genuinely darker than body coat, and the contrast is what
    // makes an ear read as an ear rather than a bump on the skull.
    earColour: colour.rainbow ? 'linear-gradient(105deg, #ff9ad5, #b98cff)' : shade(base, -32),
    face,
    eyeColour: colour.eye,
    noseColour: colour.nose,
    colorName: colour.name,
    coatLabel: coat.label,
    markings: (
      <Markings
        colour={colour}
        base={base}
        accent={forShading(colour.accent)}
        noise={noise}
        face={face}
        fit={stencilFit(bodySrc)}
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
  face,
  fit,
}: {
  colour: ReturnType<typeof resolveColor>;
  base: string;
  accent: string;
  noise: () => number;
  /** Where this body's eye and nose are, so head markings land on the head. */
  face: { eye: [number, number]; nose: [number, number] };
  /** Stretches the smooth-body stencils onto this body. */
  fit?: string;
}) {
  const shapes: React.ReactNode[] = [];
  const light = shade(base, 40);

  // A rainbow dog wears no markings, only sparkles.
  if (colour.rainbow) {
    const stars: React.ReactNode[] = [];
    for (let i = 0; i < 14; i++) {
      const s = 1.2 + noise() * 1.6;
      stars.push(
        <div
          key={`s${i}`}
          style={{
            position: 'absolute',
            left: `${22 + noise() * 66}%`,
            top: `${14 + noise() * 66}%`,
            width: `${s}%`,
            height: `${s * 1.33}%`,
            background: 'white',
            opacity: 0.85,
            clipPath: 'polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)',
          }}
        />,
      );
    }
    return <>{stars}</>;
  }
  // Head markings were measured on the smooth body. Other bodies carry their
  // heads elsewhere, so everything on the face is shifted by the difference.
  const hx = face.eye[0] - 80.6;
  const hy = face.eye[1] - 21.9;

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

  // --- Brindle -------------------------------------------------------------
  // A hand-drawn stripe stencil, tinted with the dark pigment and kept
  // translucent so it sits in the coat rather than on top of it.
  if (colour.brindle) {
    shapes.push(<Stencil key="brindle" src="mark-brindle.png" colour={accent} opacity={0.42} transform={fit} />);
  }

  // --- Tan points ------------------------------------------------------------
  if (colour.tanPoints) {
    shapes.push(<Stencil key="tan" src="mark-tan.png" colour={accent} opacity={0.95} transform={fit} />);
  }

  // --- Merle ---------------------------------------------------------------
  // Merle dilutes the BODY and leaves torn patches at full strength, so the
  // stencil paints the dark patches. A sable merle has almost no black
  // pigment for merle to act on, so its patches are faint. Double merle has
  // lost most of its patches; harlequin has bleached the base to white and
  // keeps only black.
  if (colour.merle) {
    const patchColour = colour.harlequin ? '#1d1a17' : colour.doubleMerle ? shade(base, 40) : forShading(colour.merlePatch);
    const opacity = colour.harlequin ? 0.96 : colour.merleSubtle ? 0.22 : colour.doubleMerle ? 0.35 : 0.9;
    shapes.push(<Stencil key="merle" src="mark-merle.png" colour={patchColour} opacity={opacity} transform={fit} />);
  }

  // --- White markings ------------------------------------------------------
  // Four hand-drawn stencils, one per level of white. White creeps inward in
  // a fixed order on a real dog — feet and chest first, then collar and
  // blaze, then up the flanks — and the stencils follow that order.
  if (colour.white > 0.08) {
    const w = colour.white;
    const white = '#f7f2e8';
    // Real piebald and Irish white vary from dog to dog with the same genes,
    // so each dog picks one of the drawings for its level with its own noise.
    const roll = noise();
    let src: string;
    let patches = false;
    if (w >= 0.8) src = 'mark-extreme.png';
    else if (w >= 0.5) {
      if (roll < 0.4) src = 'mark-piebald.png';
      else if (roll < 0.7) src = 'mark-extended.png';
      else {
        // White all over, with the colour left as torn patches.
        src = 'mark-extreme.png';
        patches = true;
      }
    } else src = roll < 0.55 ? 'mark-irish.png' : 'mark-collar.png';
    // The extreme-white stencil was drawn a whisker inside the body; grown a
    // touch so no coloured rim shows along the back.
    const grow = src === 'mark-extreme.png' ? ' translate(-1.7%, -1.7%) scale(1.035)' : '';
    shapes.push(<Stencil key="white" src={src} colour={white} opacity={1} transform={`${fit ?? ''}${grow}`.trim() || undefined} />);
    if (patches) shapes.push(<Stencil key="patches" src="mark-patches.png" colour={base} opacity={1} transform={fit} />);
  }

  // --- Ticking -------------------------------------------------------------
  // Ticking is flecks of colour appearing IN white markings. On a solid dog
  // there is no white for it to appear in, and scattering dots over a coloured
  // coat just looks like the dog needs a bath.
  if (colour.ticked && colour.white >= 0.85) {
    // A mostly-white ticked dog is a Dalmatian: bold round spots of the
    // coat's own colour, all over, head included.
    const spots: React.ReactNode[] = [];
    for (let i = 0; i < 34; i++) {
      const s = 1.6 + noise() * 2.6;
      spots.push(blob(`t${i}`, 18 + noise() * 66, 14 + noise() * 74, s, s * 1.25, colour.base, 0.95));
    }
    spots.push(blob('t-head', 82 + hx + noise() * 6, 16 + hy + noise() * 6, 3, 3.6, colour.base, 0.95));
    shapes.push(<div key="spots" style={{ position: 'absolute', inset: 0 }}>{spots}</div>);
  } else if (colour.ticked && colour.white > 0.1) {
    // Ticking proper: a hand-drawn peppering of flecks, in the coat colour.
    shapes.push(<Stencil key="ticking" src="mark-ticking.png" colour={colour.base} opacity={0.85} transform={fit} />);
  }

  // --- Dark mask over the muzzle -------------------------------------------
  if (colour.mask) {
    // From just in front of the eye to past the nose, and down over the
    // mouth. A rounded box rather than an ellipse, so the lips are covered.
    shapes.push(
      <div
        key="mask"
        style={{
          position: 'absolute',
          left: `${face.eye[0] - 1.5}%`,
          top: `${face.eye[1] - 5}%`,
          width: `${face.nose[0] - face.eye[0] + 10}%`,
          height: `${face.nose[1] - face.eye[1] + 16}%`,
          background: accent,
          opacity: 0.85,
          borderRadius: '45% 50% 50% 40% / 55% 50% 50% 45%',
        }}
      />,
    );
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
