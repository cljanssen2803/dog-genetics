"""
A cheerful little 8-bit jingle for the demo video, synthesised from scratch
(no samples, no libraries) so it is free to use anywhere.

    python scripts/demo-music.py [seconds]   ->  demo/music.wav
"""
import math, random, struct, sys, wave, os

RATE = 22050
SECONDS = float(sys.argv[1]) if len(sys.argv) > 1 else 80.0
BPM = 132
BEAT = 60 / BPM

# Notes as semitones from A4 = 440 Hz.
def hz(n):
    return 440.0 * 2 ** (n / 12)

# C major pentatonic-ish bounce, written as (semitone offset from A4, beats).
# Two eight-bar phrases so it does not feel like a two-second loop.
MELODY_A = [
    (3, .5), (7, .5), (10, .5), (7, .5), (5, 1), (3, 1),
    (0, .5), (3, .5), (7, .5), (3, .5), (5, 1), (-2, 1),
    (3, .5), (7, .5), (10, .5), (12, .5), (10, 1), (7, 1),
    (5, .5), (7, .5), (3, .5), (0, .5), (3, 2),
]
MELODY_B = [
    (7, .5), (10, .5), (12, .5), (10, .5), (7, 1), (5, 1),
    (3, .5), (5, .5), (7, .5), (5, .5), (3, 1), (0, 1),
    (-2, .5), (0, .5), (3, .5), (5, .5), (7, 1), (10, 1),
    (12, .5), (10, .5), (7, .5), (5, .5), (3, 2),
]
# Bass roots per bar (semitones), one note per beat with a bounce.
BASS = [-21, -21, -14, -14, -19, -19, -21, -21]

def square(t, f, duty=0.5):
    return 1.0 if (t * f) % 1 < duty else -1.0

def triangle(t, f):
    x = (t * f) % 1
    return 4 * abs(x - 0.5) - 1

def env(t, length, a=0.005, r=0.12):
    """Quick attack, gentle release."""
    if t < a: return t / a
    if t > length - r: return max(0.0, (length - t) / r)
    return 1.0

n_samples = int(RATE * SECONDS)
buf = [0.0] * n_samples

def add_note(start, length, f, gen, gain, duty=0.5):
    s0 = int(start * RATE)
    s1 = min(n_samples, int((start + length) * RATE))
    for i in range(s0, s1):
        t = (i - s0) / RATE
        v = gen(t, f, duty) if gen is square else gen(t, f)
        buf[i] += v * gain * env(t, length)

# Lay the melody down phrase after phrase until the time runs out.
t = 0.0
phrase = 0
while t < SECONDS:
    mel = MELODY_A if phrase % 2 == 0 else MELODY_B
    bar_start = t
    for n, beats in mel:
        length = beats * BEAT
        add_note(t, length * 0.92, hz(n), square, 0.16, duty=0.25)
        # A soft octave-below shadow makes it rounder.
        add_note(t, length * 0.92, hz(n - 12), triangle, 0.06)
        t += length
    # Bass under the phrase: one note per beat, eight bars of two beats... the
    # phrases are 16 beats long, so four bass roots of four beats each.
    for b in range(16):
        root = BASS[(b // 2 + phrase * 8) % len(BASS)]
        add_note(bar_start + b * BEAT, BEAT * 0.5, hz(root), triangle, 0.2)
    # Drums: a thump on 1 and 3, a hat on every off-beat.
    for b in range(16):
        s = int((bar_start + b * BEAT) * RATE)
        if b % 2 == 0:
            for i in range(s, min(n_samples, s + int(0.09 * RATE))):
                tt = (i - s) / RATE
                buf[i] += math.sin(2 * math.pi * (70 - 300 * tt) * tt) * 0.35 * max(0, 1 - tt / 0.09)
        s2 = int((bar_start + (b + 0.5) * BEAT) * RATE)
        for i in range(s2, min(n_samples, s2 + int(0.03 * RATE))):
            tt = (i - s2) / RATE
            buf[i] += (random.random() * 2 - 1) * 0.08 * max(0, 1 - tt / 0.03)
    phrase += 1

# Fade in over a second, fade out over the last four.
for i in range(n_samples):
    tt = i / RATE
    g = min(1.0, tt / 1.0) * min(1.0, (SECONDS - tt) / 4.0)
    buf[i] *= g

peak = max(abs(v) for v in buf) or 1.0
os.makedirs('demo', exist_ok=True)
with wave.open('demo/music.wav', 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v / peak * 0.85)) * 32767)) for v in buf))
print('wrote demo/music.wav')
