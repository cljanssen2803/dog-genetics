/**
 * The wordmark: "Dog Genetics" in the display face, ink-outlined like a
 * sticker, with a rosette and a paw. Inline SVG so the outline is a real
 * stroke (paint-order) rather than a text-shadow.
 */

export function Wordmark({ width = 300 }: { width?: number }) {
  return (
    <svg viewBox="0 0 320 96" width={width} height={(width * 96) / 320} role="img" aria-label="Dog Genetics">
      {/* Rosette */}
      <g transform="translate(34 40)">
        {Array.from({ length: 12 }, (_, i) => (
          <circle key={i} cx={Math.cos((i / 12) * Math.PI * 2) * 22} cy={Math.sin((i / 12) * Math.PI * 2) * 22} r={7} fill="#f2c230" stroke="#2c2d5a" strokeWidth={2} />
        ))}
        <circle r={20} fill="#f2c230" stroke="#2c2d5a" strokeWidth={2.5} />
        <circle r={13} fill="#fffaf0" stroke="#2c2d5a" strokeWidth={2} />
        {/* paw */}
        <ellipse cx={0} cy={3.5} rx={5} ry={4.2} fill="#2c2d5a" />
        <circle cx={-5.5} cy={-2.5} r={2.3} fill="#2c2d5a" />
        <circle cx={-1.8} cy={-5} r={2.3} fill="#2c2d5a" />
        <circle cx={1.8} cy={-5} r={2.3} fill="#2c2d5a" />
        <circle cx={5.5} cy={-2.5} r={2.3} fill="#2c2d5a" />
        {/* tails */}
        <path d="M-9 20 L-5 42 L-1 36 L3 42 L7 20 Z" fill="#6675e8" stroke="#2c2d5a" strokeWidth={2} strokeLinejoin="round" />
        <path d="M-1 22 L3 44 L7 38 L11 44 L15 22 Z" fill="#4b4faf" stroke="#2c2d5a" strokeWidth={2} strokeLinejoin="round" transform="translate(-6 0)" />
      </g>
      {/* Words */}
      <text
        x={76}
        y={44}
        fontFamily="Fraunces, Georgia, serif"
        fontWeight={800}
        fontSize={38}
        fill="#fffaf0"
        stroke="#2c2d5a"
        strokeWidth={5}
        strokeLinejoin="round"
        paintOrder="stroke"
        style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 100" }}
      >
        Dog
      </text>
      <text
        x={76}
        y={82}
        fontFamily="Fraunces, Georgia, serif"
        fontWeight={800}
        fontSize={38}
        fill="#f2c230"
        stroke="#2c2d5a"
        strokeWidth={5}
        strokeLinejoin="round"
        paintOrder="stroke"
        style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 100" }}
      >
        Genetics
      </text>
    </svg>
  );
}
