/**
 * Generates the app icons as real PNG files.
 *
 * iOS will not accept an SVG for the home-screen icon, and we do not want to
 * pull in an image library for four small pictures, so this script writes the
 * PNGs by hand: it paints the pixels into an array and then wraps them in the
 * PNG container format using Node's built-in compression.
 *
 * Run with:  node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
mkdirSync(publicDir, { recursive: true });

// --- PNG plumbing ----------------------------------------------------------

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bits per channel
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Each row is prefixed with a filter byte of 0 (no filtering).
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Drawing helpers -------------------------------------------------------

const BACKGROUND_TOP = [102, 117, 232]; // periwinkle
const BACKGROUND_BOTTOM = [75, 79, 175]; // indigo
const PAW = [242, 194, 48]; // gold
const ACCENT = [138, 151, 240]; // light periwinkle

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Signed distance to an ellipse, used for smooth edges. */
function ellipseCoverage(px, py, cx, cy, rx, ry, softness) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  const d = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, Math.min(1, (1 - d) / softness + 0.5));
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const s = size / 512; // everything below is designed at 512 and scaled

  // Rounded-square mask so the icon looks right on Android too. iOS applies
  // its own mask on top of this.
  const radius = size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Rounded rectangle coverage.
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      let inside = 1;
      if (cx < radius && cy < radius) {
        const dx = radius - cx;
        const dy = radius - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        inside = Math.max(0, Math.min(1, (radius - d) / 1.5 + 0.5));
      }

      // Vertical gradient background.
      let colour = mix(BACKGROUND_TOP, BACKGROUND_BOTTOM, y / size);

      // A soft rust glow behind the paw, so the icon has some depth.
      const glow = ellipseCoverage(x, y, size * 0.5, size * 0.56, size * 0.42, size * 0.42, 1.6);
      colour = mix(colour, ACCENT, glow * 0.16);

      // Paw pad: wider than it is tall, which is what reads as a paw.
      let paw = ellipseCoverage(x, y, 256 * s, 348 * s, 112 * s, 84 * s, 0.06);

      // Four toes, arced across the top.
      const toes = [
        [140, 226, 40, 50],
        [211, 172, 42, 53],
        [301, 172, 42, 53],
        [372, 226, 40, 50],
      ];
      for (const [tx, ty, trx, try_] of toes) {
        paw = Math.max(paw, ellipseCoverage(x, y, tx * s, ty * s, trx * s, try_ * s, 0.08));
      }

      colour = mix(colour, PAW, paw);

      rgba[i] = colour[0];
      rgba[i + 1] = colour[1];
      rgba[i + 2] = colour[2];
      rgba[i + 3] = Math.round(255 * inside);
    }
  }

  return encodePng(size, size, rgba);
}

for (const size of [180, 192, 512]) {
  const png = drawIcon(size);
  writeFileSync(join(publicDir, `icon-${size}.png`), png);
  console.log(`wrote public/icon-${size}.png (${(png.length / 1024).toFixed(1)} kB)`);
}

// A vector version for anywhere that prefers it.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#6675e8"/><stop offset="1" stop-color="#4b4faf"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <g fill="#f2c230">
    <ellipse cx="256" cy="330" rx="118" ry="96"/>
    <ellipse cx="150" cy="205" rx="44" ry="56"/>
    <ellipse cx="215" cy="165" rx="46" ry="58"/>
    <ellipse cx="297" cy="165" rx="46" ry="58"/>
    <ellipse cx="362" cy="205" rx="44" ry="56"/>
  </g>
</svg>`;
writeFileSync(join(publicDir, 'icon.svg'), svg);
console.log('wrote public/icon.svg');
