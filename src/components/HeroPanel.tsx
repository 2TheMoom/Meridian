// The hero mark — not a mock data panel, an instrument reading. A horizon
// line with tick marks like a sextant scale, and a single body crossing it:
// the moment something needs a second thought before it settles below the
// line. Purely decorative SVG, no live data, so it never risks looking like
// a real (or fake) wallet event.
export function HeroPanel() {
  const ticks = Array.from({ length: 21 }, (_, i) => i * 20);

  return (
    <svg
      viewBox="0 0 400 300"
      className="w-full max-w-[260px] sm:max-w-sm lg:max-w-md"
      role="img"
      aria-label="A body crossing the horizon line"
    >
      <g opacity={0.16} stroke="#EDE7DA" strokeWidth={1}>
        <path d="M 20 120 Q 200 60 380 120" fill="none" />
        <path d="M 20 150 Q 200 100 380 150" fill="none" />
      </g>

      <line x1="10" y1="190" x2="390" y2="190" stroke="#EDE7DA" strokeOpacity={0.35} strokeWidth={1} />
      {ticks.map((x) => (
        <line key={x} x1={x} y1={186} x2={x} y2={194} stroke="#EDE7DA" strokeOpacity={0.25} strokeWidth={1} />
      ))}

      <circle cx="266" cy="190" r="46" fill="#C89B4A" opacity={0.12} />
      <circle cx="266" cy="190" r="26" fill="#C89B4A" />

      <line x1="266" y1="150" x2="266" y2="170" stroke="#C89B4A" strokeWidth={1} />
      <text x="272" y="148" fontFamily="var(--font-plex-mono)" fontSize="10" fill="#8A8779" letterSpacing="0.05em">
        the moment
      </text>
    </svg>
  );
}
