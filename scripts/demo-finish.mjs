/**
 * Turns the recorded demo into a shareable .mp4: converts the raw .webm,
 * generates the jingle to match its length, mixes it under, and writes the
 * result to the Desktop.
 *
 *   node scripts/demo-finish.mjs [output path]
 */

import ffmpeg from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const raw = join(process.cwd(), 'demo', 'raw.webm');
if (!existsSync(raw)) throw new Error('No demo/raw.webm — run scripts/demo-video.mjs first.');

// How long is the recording?
let seconds = 80;
try {
  execFileSync(ffmpeg, ['-i', raw], { stdio: 'pipe' });
} catch (e) {
  const m = String(e.stderr).match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (m) seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}
console.log(`recording is ${seconds.toFixed(1)} s`);

// The jingle, cut to the same length so it fades out with the end card.
execFileSync('python', ['scripts/demo-music.py', String(Math.ceil(seconds))], { stdio: 'inherit' });

const out = process.argv[2] ?? join(process.env.USERPROFILE ?? '', 'OneDrive', 'Desktop', 'Dog Genetics demo.mp4');
execFileSync(
  ffmpeg,
  [
    '-y',
    '-i', raw,
    '-i', join(process.cwd(), 'demo', 'music.wav'),
    // Phone-friendly H.264, and even dimensions (the encoder insists).
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest', '-movflags', '+faststart',
    out,
  ],
  { stdio: 'inherit' },
);
console.log(`wrote ${out}`);
