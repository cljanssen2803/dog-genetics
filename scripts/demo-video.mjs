/**
 * Records a short demo of the game as a video: a scripted play-through at
 * phone size with caption cards drawn over the top.
 *
 * Needs the dev server running (npm run dev, port 5176), then:
 *   node scripts/demo-video.mjs
 * Writes demo/raw.webm; scripts/demo-finish.mjs turns it into an .mp4 with music.
 */

import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const URL = process.env.DEMO_URL ?? 'http://localhost:5176/';
const OUT = join(process.cwd(), 'demo');
mkdirSync(OUT, { recursive: true });

const W = 390;
const H = 844;

const browser = await chromium.launch();
// Recorded at twice phone size for crispness: a double-size viewport with the
// page zoomed 2x, which looks exactly like a phone (a real 2x device scale
// factor makes Playwright's recorder letterbox the frame).
const context = await browser.newContext({
  viewport: { width: W * 2, height: H * 2 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'light',
  recordVideo: { dir: OUT, size: { width: W * 2, height: H * 2 } },
});
const page = await context.newPage();
const wait = (ms) => page.waitForTimeout(ms);
// The page is zoomed 2x, which confuses Playwright's hit-testing; firing the
// click on the element directly sidesteps that.
const tap = (locator) => locator.dispatchEvent('click');

/** A caption card at the bottom of the screen, styled like the game's stickers. */
async function caption(text, ms = 0) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      Object.assign(el.style, {
        position: 'fixed',
        left: '14px',
        right: '14px',
        bottom: '96px',
        zIndex: '99999',
        background: '#fffaf0',
        color: '#2c2d5a',
        border: '2.5px solid #2c2d5a',
        borderRadius: '16px',
        boxShadow: '5px 5px 0 #2c2d5a',
        padding: '12px 14px',
        fontFamily: 'Fraunces, Georgia, serif',
        fontWeight: '700',
        fontSize: '18px',
        lineHeight: '1.25',
        textAlign: 'center',
        transform: 'rotate(-1deg)',
        transition: 'opacity 250ms ease',
        pointerEvents: 'none',
      });
      document.body.appendChild(el);
    }
    el.style.opacity = t ? '1' : '0';
    if (t) el.textContent = t;
  }, text);
  if (ms) await wait(ms);
}

/** A full-screen card: the title at the start, the link at the end. */
async function card(title, sub, ms) {
  await page.evaluate(
    ([t, s]) => {
      const el = document.createElement('div');
      el.id = 'demo-card';
      Object.assign(el.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '100000',
        background: '#4b4faf',
        backgroundImage: 'radial-gradient(rgba(255,250,240,0.18) 2px, transparent 2.2px)',
        backgroundSize: '22px 22px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        textAlign: 'center',
        fontFamily: 'Fraunces, Georgia, serif',
        color: '#fffaf0',
        transition: 'opacity 400ms ease',
      });
      el.innerHTML = `<div style="font-size:44px;font-weight:800;line-height:1.05;text-shadow:4px 4px 0 #2c2d5a">${t}</div>
        <div style="margin-top:18px;font-family:Inter,system-ui,sans-serif;font-size:17px;line-height:1.4;max-width:30ch;opacity:.95">${s}</div>`;
      document.body.appendChild(el);
    },
    [title, sub],
  );
  await wait(ms);
  await page.evaluate(() => {
    const el = document.getElementById('demo-card');
    if (el) {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 450);
    }
  });
  await wait(500);
}

async function scrollBy(px, ms) {
  const steps = Math.max(1, Math.round(ms / 40));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, px / steps);
    await wait(40);
  }
}

// ---------------------------------------------------------------- the demo
try {
await page.goto(URL);
await page.addStyleTag({ content: 'html { zoom: 2; }' });
await page.getByText('New breeding project').waitFor();
await wait(600);

await card('Dog Genetics', 'A breeding game where every gene is real. Design a dog, then actually create it.', 3600);

await caption('Design the dog you want, then breed it over generations.', 2800);

await tap(page.getByText('New breeding project'));
await page.getByText('Start this project').first().waitFor();
await caption('Pick a goal. Say, a calm family dog that barely sheds.', 1800);
await scrollBy(260, 900);
await wait(1200);
await tap(page.getByText('Start this project').first());

await page.getByRole('button', { name: 'Kennel' }).waitFor();
// The first-time tutorial would cover the game; skip it.
const skip = page.getByText('Skip the tutorial');
if (await skip.count()) {
  await tap(skip);
  await wait(400);
}
await wait(900);
await caption('You begin with founders from real breeds.', 2600);

await tap(page.getByRole('button', { name: 'Kennel' }));
await wait(800);
await caption('Every dog carries hidden genes: coat, colour, size, health.', 800);
await scrollBy(520, 2600);
await wait(900);

// Open the first dog.
const firstCard = page.locator('button', { hasText: /Calm \d+/ }).first();
await tap(firstCard);
await wait(900);
await caption('Peek inside: what it shows, and what it secretly carries.', 2600);
await scrollBy(300, 1800);
await tap(page.getByRole('button', { name: 'Close' }).last());
await wait(600);

// Breed.
await tap(page.getByRole('button', { name: 'Breed', exact: true }));
await wait(900);
await caption('The game predicts the puppies before you commit.', 2200);
await tap(page.getByRole('button', { name: 'Plan my pairings' }));
await page.getByRole('button', { name: /Breed all/ }).waitFor();
await wait(2600);
await tap(page.getByRole('button', { name: /Breed all/ }));
await wait(1200);

// Time passes: the litter arrives.
await caption('Press Time. Two months later…', 1400);
await tap(page.getByRole('button', { name: 'Advance time' }));
const sleeping = page.getByRole('button', { name: 'A sleeping puppy. Tap to look.' });
await sleeping.first().waitFor({ timeout: 15000 });
await wait(900);
await caption('…puppies. Tap each one to see what the dice rolled.', 1200);
// The first litter is the show: wake five by hand. Later litters go quickly.
for (let i = 0; i < 5; i++) {
  if (!(await sleeping.count())) break;
  await tap(sleeping.first());
  await wait(1400);
}
await wait(800);
await caption('', 200);
// Walk through whatever sheets follow: more litters, the month report, milestones.
for (let guard = 0; guard < 12; guard++) {
  const sheets = page.locator('div.fixed.inset-0.z-50');
  if (!(await sheets.count())) break;
  // Only the topmost sheet is clickable.
  const top = sheets.last();
  const wakeAll = top.getByRole('button', { name: 'Wake them all' });
  if (await wakeAll.count()) {
    await tap(wakeAll);
    await wait(1600);
  }
  const next = top.getByRole('button', { name: /^Sort the litter$|^Next litter$|^Next: what else happened$|^Continue$|^Carry on$|^Got it$|^Done$/ });
  if (await next.count()) {
    await wait(700);
    await tap(next.last());
    await wait(900);
    continue;
  }
  // No known button: the X in the sheet's corner.
  await tap(top.locator('button[aria-label="Close"]').last());
  await wait(600);
}
// The game lands on the Puppies tab by itself; just start from the top.
await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('main')?.scrollTo(0, 0); });
await wait(900);
await scrollBy(700, 2600);
await caption('Keep the best, place the rest, breed again — fifteen generations.', 3200);

// The gallery.
await tap(page.getByRole('button', { name: 'More' }));
await tap(page.getByText('Breed gallery'));
await page.getByPlaceholder('Search a breed').waitFor();
await wait(700);
await caption('124 real breeds, every one drawn from its genes.', 1000);
await scrollBy(900, 4200);
await wait(600);
await caption('…and you can found a breed of your own.', 2400);
await caption('', 300);

await card('Dog Genetics', 'Free to play in any browser<br><b>cljanssen2803.github.io/dog-genetics</b>', 4200);

} catch (err) {
  await page.screenshot({ path: join(OUT, 'failed.png') });
  console.error(err);
}
await context.close();
await browser.close();

// Playwright names the file itself; give it a stable name.
const webm = readdirSync(OUT).find((f) => f.endsWith('.webm') && f !== 'raw.webm');
if (webm) renameSync(join(OUT, webm), join(OUT, 'raw.webm'));
console.log('wrote demo/raw.webm');
