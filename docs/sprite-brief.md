# Dog sprite kit — art brief

This describes a set of layered images that get stacked and tinted in code to
draw any dog the genetics engine can produce.

**Do not generate the whole set yet.** Generate the three pilot pieces at the
bottom first. If they line up, we commit to the rest. If they do not, we have
lost ten minutes rather than an afternoon.

---

## Why it is layered

Every dog in the game is assembled from its genes. There are eight coat types,
four ear carriages, two tail types, three leg lengths, a continuous size range
and roughly fifteen colour outcomes, plus merle, brindle and white markings.
That is thousands of combinations, and a Great Dane × Poodle cross looks like
no breed that exists — so there can be no pre-drawn picture of it.

Instead: one **base body**, with **ears**, **tail** and **coat** stacked on top,
and the whole thing tinted to the dog's genetic colour in code.

---

## The rules every image must follow

These matter more than the artwork. A beautiful piece that breaks one of these
is useless.

1. **Canvas: exactly 1024 × 768 pixels.** Every single image, including the
   small ones like ears. Do not crop to the subject.

2. **Transparent background.** PNG with a real alpha channel. Not white, not a
   checkerboard pattern drawn in — actually transparent.

3. **Pure white fur with soft grey shading only.** No browns, no blacks, no
   colour of any kind. The code multiplies a genetic colour through these, so
   white becomes the dog's colour and the grey becomes its shadows. A coloured
   image cannot be re-tinted.

4. **Side profile, facing right.** Standing square, all four legs visible,
   head up and level, alert but relaxed. The same pose in every image.

5. **Flat vector illustration.** Clean shapes, soft cel shading, no outline or
   a very light grey one. No gradients meshes, no photorealism, no texture
   noise, no background scenery, no ground shadow, no grass.

6. **Anchor positions — the critical part.** Every image shares the same
   invisible skeleton so the pieces line up:
   - Feet stand on a ground line at **y = 690**
   - Top of the shoulders at **y = 250**
   - Base of the ear, where it meets the skull, at **x = 760, y = 250**
   - Base of the tail, where it meets the rump, at **x = 250, y = 330**
   - Tip of the nose at **x = 960, y = 300**

   The pieces do not need to be perfect to the pixel. I can nudge each layer in
   code once I can see them. But they must be close, and consistent.

---

## Style preamble

Paste this at the front of every prompt so the whole set matches:

> Flat vector illustration of a dog, side profile facing right, standing square
> with all four legs visible. Pure white fur with soft light-grey cel shading
> only — absolutely no colour, no brown, no black. Clean simple shapes, minimal
> or no outline. Transparent background, PNG with alpha. 1024×768 canvas, the
> dog centred with its feet on a ground line at 690 pixels from the top. No
> background, no scenery, no ground shadow, no text. Children's picture-book
> style, warm and appealing, not photorealistic.

---

## PILOT — generate only these three

### Pilot 1 — base body

> [style preamble]
> A medium-build dog of average proportions, like a mixed-breed farm dog about
> the size of a Labrador. Short smooth coat. **Draw it with no ears and no
> tail at all** — leave those areas bare, they are added separately. Head, neck,
> body and all four legs only. Muzzle of moderate length. Eye visible as a
> simple dark dot.

### Pilot 2 — erect ear

> [style preamble]
> A single dog's ear, erect and upright, pointed like a German Shepherd's ear.
> Just the ear alone on an otherwise completely empty transparent canvas.
> Position it in the upper right area of the canvas so its base sits at roughly
> 760 pixels from the left and 250 pixels from the top. Same white fur with
> soft grey shading. Nothing else in the image.

### Pilot 3 — full tail

> [style preamble]
> A single dog's tail, long and gently curved, held low with a slight upward
> sweep at the tip, moderately furred. Just the tail alone on an otherwise
> completely empty transparent canvas. Position it in the left-middle area so
> its thick base sits at roughly 250 pixels from the left and 330 pixels from
> the top, sweeping back and to the left. Same white fur with soft grey
> shading. Nothing else in the image.

---

## PILOT RESULT — passed, 2026-09-12

All three came back at exactly 1448×1086, genuinely transparent, effectively
pure greyscale (11 coloured pixels in 1.5 million, being the nose and eye), and
the ear and tail landed on the head and rump with no adjustment needed.

Two things learned:

- **The ground line is unavoidable.** It got drawn under the feet regardless of
  the instruction. Ignore it — `scripts/clean-sprites.mjs` now detects and
  erases it automatically.
- **Canvas size does not need to be 1024×768.** Whatever size comes out
  natively is fine. What matters is that **every image is the same size as
  every other**, which they were.
- **Exact positioning does not need to be perfect** either. Each layer's offset
  can be nudged in code. Shape and consistency are what matter.

---

## THE FULL SET — 14 images

Revised down from 20. The original plan had coat overlays separate from body
builds, which cannot work: an overlay drawn over a medium dog will not fit a
racy one, and unlike position, that is not fixable in code.

Instead each coat type is a **complete dog**, and body build and size are
applied by scaling in code.

### Bodies — 8 images, one per coat type

Every one of these is a **complete dog with no ears and no tail**, in the same
pose and proportions as the pilot body. Use the pilot body as a reference image
if that helps keep them consistent.

1. **Smooth** — short, close, sleek coat like a Labrador.
2. **Long silky** — long straight coat with feathering on the legs, chest and
   underside, like a Setter.
3. **Long furnished** — long coat with a fuller face, a moustache and eyebrows.
4. **Dense double** — thick plush coat with a heavy ruff around the neck, like a
   Samoyed or Husky.
5. **Wiry** — harsh, slightly spiky coat with a pronounced beard and bushy
   eyebrows, like a Schnauzer.
6. **Wavy furnished** — soft wavy coat with a beard, like a Labradoodle.
7. **Curly** — tight dense curls all over, like a Standard Poodle in a plain
   clip.
8. **Hairless** — bare skin with a soft crest of hair on top of the head and
   small tufts on the feet. Smooth, slightly wrinkled bare skin everywhere else.

### Ears — 4 images

Just the ear, alone on an empty canvas, positioned roughly where it sits on the
pilot dog's head. **Make these four clearly distinct from each other:**

9. **Erect** — standing straight up, pointed, like a German Shepherd. Tall and
   upright, NOT hanging down.
10. **Semi-erect** — standing up but with the top third folded forward, like a
    Collie.
11. **Button** — small, folded forward and down against the skull, like a Jack
    Russell.
12. **Drop** — long, hanging straight down beside the cheek, like a Spaniel.
    (The pilot ear was this one.)

### Tails — 2 images

Just the tail, alone on an empty canvas, at the rump.

13. **Full tail** — long, gently curved, sweeping back and down. (The pilot
    tail was this one, and it worked — regenerate only if you want it tidier.)
14. **Bobtail** — a short natural stub, only a few inches long.

---

## What happens when you send them back

Save them anywhere and tell me the folder. I will run the cleaner, build the
compositing layer, tune each piece's offset, and wire it to the genetics.
Colour, markings, merle, brindle, white patches, body build and size are all
applied in code — they are not part of the artwork.

---

## What happens when you send them back

Save them anywhere and tell me the folder. I will build the compositing layer,
tune each piece's offset and scale so everything registers, and wire it to the
genetics. Colour, markings, merle, brindle, white patches and body size are all
applied in code on top — they are not part of the artwork.

---

## ROUND THREE — pattern stencils (optional, 7 images)

The colours and markings are currently drawn by code as shapes clipped to the
dog. Code has been pushed as far as it usefully goes: ragged edges, irregular
patches. It will always look a little constructed, because it is.

The fix is the same trick that fixed the dogs themselves: hand-drawn stencils.
Each image is a **marking pattern**, drawn as **pure white shapes on a
transparent background**, in the **same pose and canvas as the pilot body**.
The code will clip each one to whatever coat body the dog has, then colour it.
Because the body mask does the clipping, the pattern only has to be roughly the
right shape — it does not need to match any one coat outline.

Style preamble, paste at the front of every prompt:

> Flat vector illustration. The SAME dog as before — medium build, side profile
> facing right, standing square, no ears, no tail — but this image shows ONLY
> the white markings, drawn as solid pure-white shapes with soft slightly
> feathered edges, on a fully transparent background. Draw nothing else: no
> body outline, no shading, no colour, no eyes or nose. The white shapes must
> sit exactly where they would fall on that dog. 1448×1086 canvas, transparent
> PNG.

Generate these seven:

15. **Irish white** — a white blaze down the chest and throat, white on all
    four feet up to the pastern, and a white tail tip. Nothing else. This is
    the classic Border Collie / Boston Terrier pattern.
16. **Irish white, extended** — as above, plus a full white collar right
    round the neck and a narrow white blaze up the centre of the face.
17. **Piebald** — white over roughly half the dog: the whole chest, belly,
    legs, neck and muzzle, leaving large coloured patches on the back, over
    the ears, and around one eye. Like a Springer Spaniel.
18. **Extreme white** — almost the entire dog white, with only one small
    coloured patch over one ear and one at the root of the tail. Like a
    mostly-white Bull Terrier.
19. **Tan points** — draw the TAN areas as the white shapes: both eyebrows,
    the sides of the muzzle, a patch on each side of the chest, the lower half
    of all four legs, and under the tail. Like a Rottweiler or Doberman.
20. **Merle** — torn, ragged, irregular patches scattered over the entire
    body, head and legs, each with jagged edges, covering roughly forty
    percent of the dog. Like an Australian Shepherd's merle patches.
21. **Brindle** — soft vertical stripes across the body barrel, neck and upper
    legs, each stripe slightly wavy and tapering, as on a brindle Boxer. Draw
    the STRIPES as the white shapes.

Save them anywhere and tell me the folder. I will run the cleaner, wire each to
the genetics, and the code-drawn shapes go away.

---

## ROUND FOUR — body builds and tail shapes (8 images)

Result of the breed run-through (2026-09-13): every one of the eight bodies is
the same medium build with the same medium muzzle, and there are only two
tails. So a Greyhound, a Bulldog, a Pug, a Mastiff and a Labrador all come out
as the same dog in a different colour, and every Spitz breed has a hanging
tail. The code now picks a body and a tail from the genetics; these are the
pieces it is waiting for. Until each file arrives it stretches or rotates the
existing artwork as a stand-in, so nothing is broken — it is just less good.

Same rules as the full set: 1024×768, transparent, white with grey shading,
feet on y = 690, shoulders at y = 250, ear base at (760, 250), tail root at
(250, 330), nose tip at (960, 300). Use the pilot body as a reference image.

Style preamble, paste at the front of every prompt:

> Flat vector illustration of a dog, side profile facing right, standing square
> with all four legs visible. Pure white fur with soft light-grey cel shading
> only — absolutely no colour, no brown, no black. Clean simple shapes, minimal
> or no outline. Transparent background, PNG with alpha. 1024×768 canvas, the
> dog centred with its feet on a ground line at 690 pixels from the top. No
> background, no scenery, no ground shadow, no text. Children's picture-book
> style, warm and appealing, not photorealistic.

### Bodies — 3 images, complete dog, NO ears and NO tail

22. **Sighthound** — `body-sighthound.png`. A Greyhound: very deep chest
    sweeping up to a tucked, narrow waist; long thin legs; long slender neck;
    a long narrow head with a fine pointed muzzle; smooth coat. Elegant and
    racy. Keep the feet on the ground line and the shoulders at the same
    height as the pilot so it lines up.
23. **Bull** — `body-bull.png`. A Bulldog / Mastiff type: wide, heavy,
    barrel-chested body; thick short neck; broad head with a very short,
    flat, pushed-in muzzle and heavy jowls; sturdy legs set wide; smooth coat.
    Nose tip well behind the usual x = 960 is fine — this dog has no muzzle to
    speak of — but keep the eye where the pilot's is.
24. **Spitz** — `body-spitz.png`. A Husky / Akita type: compact, well-muscled
    body; thick plush coat with a full ruff around the neck and chest; a
    wedge-shaped head with a moderately short muzzle; furry legs. No ears, no
    tail — those come separately.

### Tails — 5 images, just the tail, at the rump

25. **Curled** — `tail-curled.png`. A tight plush curl carried right over the
    back, like an Akita or a Pug. Rooted at (250, 330) and curling UP and
    FORWARD over the rump.
26. **Sickle** — `tail-sickle.png`. A looser sweep up and over the back in a
    sickle shape, well furred, like a Husky. Rooted at (250, 330).
27. **Plume** — `tail-plume.png`. Long, carried level or slightly up, with
    long flowing feathering along the underside, like a Golden Retriever or
    a Papillon. Rooted at (250, 330).
28. **Whip** — `tail-whip.png`. Long, very thin, carried low and tucked between
    the hind legs with a slight upward curve at the tip, like a Greyhound.
    Rooted at (250, 330).
29. **Screw** — `tail-screw.png`. A short, thick, tightly kinked corkscrew
    stub, like an English Bulldog. Rooted at (250, 330).

### What happens when you send them back

Drop them in a folder and tell me where. I run the cleaner, measure each one,
and add its filename to the `HAVE` list in `src/ui/DogSprite.tsx` — at that
moment the stand-in switches off and the real piece is used. One file at a
time is fine; the code copes with any subset.

### ROUND FOUR RESULT — delivered 2026-09-13

Eight files came back: four bodies (sighthound, bull, a heavy long-muzzled
mastiff type that was not asked for but is very useful, and spitz) and four
tails (whip, plume, sickle, curled). The screw tail was not drawn; the bobtail
stands in for it, a touch smaller. Sickle and curled were drawn curling the
wrong way (tip pointing backward) and were mirrored before cleaning. The whip
came back trailing straight out and the plume flying straight up; both are
rotated in code (`TAIL_FIT` in DogSprite.tsx) rather than redrawn.

Still wanted, at leisure: **29. Screw tail** as briefed above, and the
ROUND THREE pattern stencils.
