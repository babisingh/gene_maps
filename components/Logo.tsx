// Gene-Maps logo — DNA ↔ Network Node
// Option A: Stylized network hub with a tiny DNA helix coiled inside the central node.
// Outer nodes are sized like spatial score circles. Pink-to-purple gradient fill.
// Pure SVG, no external deps.

interface Props {
  size?: number;
  className?: string;
}

export function Logo({ size = 36, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Gene-Maps logo"
    >
      <defs>
        {/* Pink → Purple diagonal gradient */}
        <linearGradient id="gm-lg" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FF8CA8" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        {/* Radial glow behind center hub */}
        <radialGradient id="gm-hub-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#FF8CA8" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0"    />
        </radialGradient>
        {/* Clip the mini helix to the center circle */}
        <clipPath id="helix-clip">
          <circle cx="22" cy="22" r="5" />
        </clipPath>
      </defs>

      {/* ── Outer ring edges (subtle, low opacity) ── */}
      <g stroke="url(#gm-lg)" strokeWidth="0.5" opacity="0.22">
        <line x1="8"  y1="8"  x2="36" y2="8"  />
        <line x1="36" y1="8"  x2="39" y2="22" />
        <line x1="39" y1="22" x2="30" y2="37" />
        <line x1="30" y1="37" x2="14" y2="37" />
        <line x1="14" y1="37" x2="5"  y2="22" />
        <line x1="5"  y1="22" x2="8"  y2="8"  />
        <line x1="22" y1="5"  x2="36" y2="8"  />
        <line x1="22" y1="5"  x2="8"  y2="8"  />
      </g>

      {/* ── Spoke edges: outer nodes → center ── */}
      <g stroke="url(#gm-lg)" strokeWidth="0.85" opacity="0.55">
        <line x1="8"  y1="8"  x2="22" y2="22" />
        <line x1="22" y1="5"  x2="22" y2="22" />
        <line x1="36" y1="8"  x2="22" y2="22" />
        <line x1="39" y1="22" x2="22" y2="22" />
        <line x1="30" y1="37" x2="22" y2="22" />
        <line x1="14" y1="37" x2="22" y2="22" />
        <line x1="5"  y1="22" x2="22" y2="22" />
      </g>

      {/* ── Outer nodes (varied sizes like spatial score circles) ── */}
      {/* Top — pink */}
      <circle cx="22" cy="5"  r="1.6" fill="#FF8CA8" opacity="0.9" />
      {/* Top-left — large, pink */}
      <circle cx="8"  cy="8"  r="2.7" fill="#FF8CA8" opacity="0.88" />
      {/* Top-right — medium, mid-gradient */}
      <circle cx="36" cy="8"  r="2.1" fill="url(#gm-lg)" opacity="0.88" />
      {/* Right — medium, mid */}
      <circle cx="39" cy="22" r="2.4" fill="url(#gm-lg)" opacity="0.88" />
      {/* Bottom-right — small, purple */}
      <circle cx="30" cy="37" r="1.9" fill="#a855f7" opacity="0.9" />
      {/* Bottom-left — medium, purple */}
      <circle cx="14" cy="37" r="2.2" fill="#a855f7" opacity="0.9" />
      {/* Left — small, pink */}
      <circle cx="5"  cy="22" r="1.7" fill="#FF8CA8" opacity="0.82" />

      {/* ── Center hub ── */}
      {/* Soft radial glow */}
      <circle cx="22" cy="22" r="9" fill="url(#gm-hub-glow)" />
      {/* Hub border ring */}
      <circle cx="22" cy="22" r="5.8" stroke="url(#gm-lg)" strokeWidth="1.3" fill="rgba(255,255,255,0.05)" />

      {/* ── Mini DNA double helix (clipped inside center circle) ── */}
      <g clipPath="url(#helix-clip)">
        {/* Base-pair rungs at peaks (x=19 and x=23) */}
        <line x1="19" y1="23.8" x2="19" y2="20.2" stroke="#FF8CA8" strokeWidth="0.9" strokeOpacity="0.75" strokeLinecap="round" />
        <line x1="23" y1="20.2" x2="23" y2="23.8" stroke="#a855f7" strokeWidth="0.9" strokeOpacity="0.75" strokeLinecap="round" />
        {/* Strand 2 — purple, goes LOW first */}
        <path
          d="M17,22 C17.5,20.2 20.5,20.2 21,22 C21.5,23.8 24.5,23.8 25,22 C25.5,20.2 26.5,20.2 27,20.2"
          stroke="#a855f7"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        {/* Strand 1 — pink, goes HIGH first */}
        <path
          d="M17,22 C17.5,23.8 20.5,23.8 21,22 C21.5,20.2 24.5,20.2 25,22 C25.5,23.8 26.5,23.8 27,23.8"
          stroke="#FF8CA8"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          opacity="0.95"
        />
      </g>

      {/* Center dot */}
      <circle cx="22" cy="22" r="1.1" fill="white" opacity="0.55" />
    </svg>
  );
}
