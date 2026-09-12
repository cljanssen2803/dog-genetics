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

## If the pilot works — the full set

**Base bodies (6)** — each with no ears and no tail:
fine and racy build; medium build; heavy and thick build; and the same three
again on short Dachshund-style legs.

**Ears (4)** — erect and pointed; semi-erect with a folded tip; small button
ear folded forward; long drop ear hanging beside the cheek.

**Tails (2)** — long full tail; short natural bobtail stub.

**Coat overlays (8)** — drawn as fur sitting over the body, transparent where
there is no fur: smooth short; long silky; long furnished with feathering;
dense double coat with a thick ruff; wiry with beard and eyebrows; wavy
furnished; tight curly like a Poodle; hairless with tufts on the head, feet and
tail tip.

That is 20 images total.

---

## What happens when you send them back

Save them anywhere and tell me the folder. I will build the compositing layer,
tune each piece's offset and scale so everything registers, and wire it to the
genetics. Colour, markings, merle, brindle, white patches and body size are all
applied in code on top — they are not part of the artwork.
