/**
 * Cleans generated sprite PNGs so they can be used as game layers.
 *
 * The image generator draws a ground line under the dog's feet no matter how
 * firmly it is asked not to. A dark line baked into the artwork looks wrong
 * once the sprite is tinted and placed on the game's own background, so this
 * finds it and erases it.
 *
 * The detection is deliberately narrow: it only looks in the bottom third of
 * the image, and only at rows that contain a long horizontal run of dark
 * pixels — far wider than a paw. Everything else is left alone.
 *
 * Run with:  node scripts/clean-sprites.mjs
 */

import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const spriteDir = join(here, '..', 'public', 'sprites');

// ---------------------------------------------------------------------------
// Minimal PNG reading and writing (8-bit RGB or RGBA, no interlacing)
// ---------------------------------------------------------------------------

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(buffer) {
  let offset = 8; // skip signature
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNGs are not supported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`unsupported PNG: bitDepth ${bitDepth}, colorType ${colorType}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));

    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? line[i - channels] : 0;
      const up = previous[i];
      const upLeft = i >= channels ? previous[i - channels] : 0;
      let value = line[i];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      line[i] = value & 0xff;
    }

    for (let x = 0; x < width; x++) {
      const from = x * channels;
      const to = (y * width + x) * 4;
      out[to] = line[from];
      out[to + 1] = line[from + 1];
      out[to + 2] = line[from + 2];
      out[to + 3] = channels === 4 ? line[from + 3] : 255;
    }
    previous = line;
  }

  return { width, height, data: out };
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

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

// ---------------------------------------------------------------------------
// Ground-line removal
// ---------------------------------------------------------------------------

const DARK = 190; // anything below this brightness counts as "line", not "fur"

function stripGroundLine(image) {
  const { width, height, data } = image;
  const startRow = Math.floor(height * 0.66);
  const minRun = Math.floor(width * 0.3);

  const lineRows = [];

  for (let y = startRow; y < height; y++) {
    let run = 0;
    let best = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      const luminance = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      if (a > 40 && luminance < DARK) {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    if (best >= minRun) lineRows.push(y);
  }

  if (lineRows.length === 0) return { cleared: 0, rows: 0 };

  // Include a couple of rows either side to catch the line's soft edges.
  const from = Math.max(startRow, lineRows[0] - 2);
  const to = Math.min(height - 1, lineRows[lineRows.length - 1] + 2);

  let cleared = 0;
  for (let y = from; y <= to; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] <= 40) continue;
      const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (luminance < DARK) {
        data[i + 3] = 0;
        cleared += 1;
      }
    }
  }

  return { cleared, rows: to - from + 1 };
}

// ---------------------------------------------------------------------------

const files = readdirSync(spriteDir).filter((f) => f.endsWith('.png'));
if (files.length === 0) {
  console.log('No sprites found in public/sprites.');
  process.exit(0);
}

for (const file of files) {
  const path = join(spriteDir, file);
  const image = decodePng(readFileSync(path));
  const result = stripGroundLine(image);
  writeFileSync(path, encodePng(image.width, image.height, image.data));
  console.log(
    `${file.padEnd(20)} ${image.width}x${image.height}  ` +
      (result.cleared
        ? `erased ${result.cleared} ground-line pixels across ${result.rows} rows`
        : 'no ground line found'),
  );
}
