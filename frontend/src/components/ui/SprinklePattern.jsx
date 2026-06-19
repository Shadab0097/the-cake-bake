'use client';

/**
 * SprinklePattern — a subtle, tiling backdrop of scattered sprinkles, like the
 * sprinkles dusted across a cake. Sits behind section content at low opacity so
 * product cards stay the hero.
 *
 * Pure SVG <pattern>, no image asset. Deterministic geometry (no randomness) so
 * server and client render identical markup (no hydration mismatch).
 *
 * Usage: place as the first child of a `relative` section and wrap the content
 * in a `relative z-10` container.
 */

const TILE = 150; // pattern tile size in px

// On-theme colors only: rose / pink / gold. Rods read as classic sprinkles;
// dots are gold dragées. Positions/rotations are within one tile.
const ROD = (x, y, r, c) => ({ x, y, r, c, t: 'rod' });
const DOT = (x, y, c) => ({ x, y, c, t: 'dot' });
const SPRINKLES = [
  ROD(22, 28, 28, '#D48AA6'),
  ROD(74, 16, -42, '#C94F7C'),
  ROD(118, 50, 62, '#E8B8C8'),
  DOT(52, 44, '#D9A441'),
  ROD(34, 84, -16, '#E8B8C8'),
  ROD(96, 96, 34, '#D48AA6'),
  DOT(104, 74, '#C94F7C'),
  ROD(14, 120, 72, '#D9A441'),
  ROD(128, 124, -52, '#D48AA6'),
  ROD(66, 62, 8, '#E8B8C8'),
];

export default function SprinklePattern({ className = '', opacity = 0.5 }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 z-0 h-full w-full ${className}`}
      aria-hidden="true"
      focusable="false"
      style={{ opacity }}
    >
      <defs>
        <pattern id="sprinkles" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          {SPRINKLES.map((s, i) =>
            s.t === 'dot' ? (
              <circle key={i} cx={s.x} cy={s.y} r="2.6" fill={s.c} />
            ) : (
              <rect
                key={i}
                x={s.x - 6}
                y={s.y - 2}
                width="12"
                height="4"
                rx="2"
                fill={s.c}
                transform={`rotate(${s.r} ${s.x} ${s.y})`}
              />
            ),
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#sprinkles)" />
    </svg>
  );
}
