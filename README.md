# Dog Genetics — Breeding Simulator

A selective dog-breeding sandbox built on real canine genetics. You define the
dog you want, receive an imperfect foundation population, and spend ten or
fifteen generations trying to create it — without wrecking the gene pool on the
way.

It runs entirely in the browser, installs to an iPhone home screen as a proper
offline app, and stores everything on the device. Nothing is uploaded anywhere.

## The idea

You are not trying to produce one outstanding dog. You are trying to build a
**population that reliably produces the dog you defined** — healthy, consistent,
and with enough genetic variety left to keep going.

The question every turn is: *what does my population need next, and which
breeding choice gets me there without creating a different problem?*

## What is actually simulated

**Single genes** follow real Mendelian inheritance — 30 of them, including coat
length (FGF5), furnishings (RSPO2), curl (KRT71), shedding (MC5R), the main
colour loci, merle, harlequin, natural bobtail, both hairless genes, and eleven
recessive disease mutations.

**Polygenic traits** — size, ten dimensions of temperament, longevity,
structural soundness and fertility — use an infinitesimal model. Each dog has a
hidden breeding value, an observed value shaped by environment, and a *spread*:
how much genetic variety it still has left to shuffle. Crossing two divergent
breeds creates a uniform first generation whose children then scatter wildly,
which is exactly how real crosses behave. Inbreeding and steady selection shrink
that spread, which is how a population eventually breeds true.

**Traits are correlated.** Hidden factors push on several traits at once, so
selecting hard for prey drive drags alertness and barking up with it, and
selecting for size drags longevity down. You can breed against these tendencies;
it costs you generations.

**Inbreeding has teeth.** COI is computed properly from the full pedigree, and
it drains fertility, litter size, lifespan and soundness while bringing hidden
recessives to the surface.

**Information is imperfect.** A DNA panel tells you a puppy's coat and disease
genes exactly on day one. Nothing can tell you its adult temperament or how long
it will live, so young dogs show ranges that narrow as they grow.

## Running it locally

```bash
npm install
npm run dev
```

## Checking it still works

```bash
npx tsx --tsconfig tsconfig.app.json scripts/soak-test.ts
```

The soak test plays fifteen generations of three different projects
automatically and verifies the simulation stays sane: seeds reproduce exactly,
embryo genetics are rolled only once, lethal gene pairings never produce living
puppies, inbreeding maths matches the textbook values, and no dog ever ends up
with corrupt data.

```bash
npx tsx --tsconfig tsconfig.app.json scripts/portrait-gallery.tsx
```

Renders every breed's procedural portrait to `portrait-gallery.html` so the
drawing code can be checked by eye.

```bash
node scripts/generate-icons.mjs
```

Regenerates the app icons.

## Installing on an iPhone

Open the deployed link in Safari, tap the Share button, then **Add to Home
Screen**. It then runs fullscreen with its own icon and works with no
connection at all.

Saves live in the phone's browser storage. iOS can clear that if space runs
short, so use **Backup and restore** on the home screen to save a file
occasionally.
