// Gene-Maps logo — Sphere with gene network pins + pill badge.
// Option B: "Rotating Sphere with Gene Pins"
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
        {/* Pink → Purple gradient (main) */}
        <linearGradient id="gm-lg" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FF8CA8" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        {/* Same gradient, very transparent (sphere fill) */}
        <linearGradient id="gm-fill" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FF8CA8" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0.12" />
        </linearGradient>
        {/* Radial glow at center */}
        <radialGradient id="gm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#FF8CA8" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sphere glow */}
      <circle cx="22" cy="22" r="18" fill="url(#gm-glow)" />

      {/* Sphere outline */}
      <circle cx="22" cy="22" r="16" stroke="url(#gm-lg)" strokeWidth="1.4" fill="url(#gm-fill)" />

      {/* Equatorial ellipse — depth cue */}
      <ellipse cx="22" cy="22" rx="16" ry="5" stroke="url(#gm-lg)" strokeWidth="0.8" fill="none" opacity="0.45" />

      {/* Vertical meridian arc — depth cue */}
      <ellipse cx="22" cy="22" rx="5.5" ry="16" stroke="url(#gm-lg)" strokeWidth="0.8" fill="none" opacity="0.45" />

      {/* ── Network edges ── */}
      <g stroke="#FF8CA8" strokeWidth="0.75" opacity="0.65">
        <line x1="22" y1="7"  x2="35" y2="14" />
        <line x1="35" y1="14" x2="37" y2="23" />
        <line x1="37" y1="23" x2="32" y2="33" />
        <line x1="32" y1="33" x2="22" y2="37" />
      </g>
      <g stroke="#a855f7" strokeWidth="0.75" opacity="0.65">
        <line x1="22" y1="7"  x2="9"  y2="14" />
        <line x1="9"  y1="14" x2="7"  y2="23" />
        <line x1="7"  y1="23" x2="12" y2="33" />
        <line x1="12" y1="33" x2="22" y2="37" />
      </g>
      {/* Cross-connections through center */}
      <g stroke="url(#gm-lg)" strokeWidth="0.5" opacity="0.3">
        <line x1="35" y1="14" x2="22" y2="22" />
        <line x1="9"  y1="14" x2="22" y2="22" />
        <line x1="32" y1="33" x2="22" y2="22" />
        <line x1="12" y1="33" x2="22" y2="22" />
        <line x1="37" y1="23" x2="22" y2="22" />
        <line x1="7"  y1="23" x2="22" y2="22" />
      </g>

      {/* ── Gene pin nodes ── */}
      {/* Top pole */}
      <circle cx="22" cy="7"  r="2.4" fill="#FF8CA8" />
      {/* Upper hemisphere */}
      <circle cx="35" cy="14" r="1.9" fill="#FF8CA8" />
      <circle cx="9"  cy="14" r="1.9" fill="#FF8CA8" />
      {/* Equator */}
      <circle cx="37" cy="23" r="1.7" fill="url(#gm-lg)" />
      <circle cx="7"  cy="23" r="1.7" fill="url(#gm-lg)" />
      {/* Lower hemisphere */}
      <circle cx="32" cy="33" r="1.9" fill="#a855f7" />
      <circle cx="12" cy="33" r="1.9" fill="#a855f7" />
      {/* Bottom pole */}
      <circle cx="22" cy="37" r="2.4" fill="#a855f7" />
      {/* Center hub — white core */}
      <circle cx="22" cy="22" r="2.8" fill="white" opacity="0.85" />
      <circle cx="22" cy="22" r="1.4" fill="url(#gm-lg)" />

      {/* ── Pill badge (drug target indicator) ── */}
      <rect x="28" y="34" width="13" height="6" rx="3" fill="url(#gm-lg)" opacity="0.92" />
      {/* Pill highlight */}
      <circle cx="31" cy="37" r="1.8" fill="white" opacity="0.22" />
      {/* Capsule divider line */}
      <line x1="34.5" y1="34.2" x2="34.5" y2="39.8" stroke="white" strokeWidth="0.5" opacity="0.35" />
    </svg>
  );
}
