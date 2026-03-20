'use client';

// ============================================================
// DnaBanner — application header with DNA double-helix SVG.
// Option D: DNA Strand Gradient Banner
// Dark charcoal/purple gradient background with a pink-to-
// transparent DNA helix running across the right portion.
// ============================================================

import { Logo } from './Logo';

interface Props {
  className?: string;
}

// ── Helix geometry ────────────────────────────────────────
const W   = 1200;  // SVG viewBox width
const H   = 72;    // SVG viewBox height
const CY  = H / 2; // Center Y = 36
const AMP = 24;    // Helix amplitude (px)
const T   = 220;   // Period (px) — one full rotation

/** Generate a smooth path for one DNA strand. */
function strandPath(phase: number): string {
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 4) {
    const y = CY + AMP * Math.sin((2 * Math.PI * x) / T + phase);
    pts.push(x === 0 ? `M${x},${y.toFixed(2)}` : `L${x},${y.toFixed(2)}`);
  }
  return pts.join(' ');
}

/** Base-pair rung positions — where sin = ±1, strands at maximum separation. */
function rungXPositions(): number[] {
  // sin(2π*x/T + 0) = ±1  →  x = T/4 + k*T/2
  const xs: number[] = [];
  for (let x = T / 4; x <= W; x += T / 2) xs.push(x);
  return xs;
}

const STRAND1 = strandPath(0);
const STRAND2 = strandPath(Math.PI);
const RUNGS   = rungXPositions();

export function DnaBanner({ className = '' }: Props) {
  return (
    <header className={`relative w-full overflow-hidden ${className}`} style={{ background: 'linear-gradient(135deg, #0f0726 0%, #0a1628 100%)' }}>
      {/* ── DNA helix SVG ── */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        aria-hidden
      >
        <defs>
          {/* Left-to-right fade: transparent on left (text area), opaque in middle, fades at far right */}
          <linearGradient id="dna-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="white" stopOpacity="0"    />
            <stop offset="30%"  stopColor="white" stopOpacity="0"    />
            <stop offset="50%"  stopColor="white" stopOpacity="0.55" />
            <stop offset="80%"  stopColor="white" stopOpacity="0.7"  />
            <stop offset="100%" stopColor="white" stopOpacity="0.25" />
          </linearGradient>
          <mask id="dna-mask">
            <rect width={W} height={H} fill="url(#dna-fade)" />
          </mask>

          {/* Pink → purple gradient for strands */}
          <linearGradient id="s1-grad" x1="0" y1="0" x2={W} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#FF8CA8" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="s2-grad" x1="0" y1="0" x2={W} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#a855f7" />
            <stop offset="100%" stopColor="#FF8CA8" />
          </linearGradient>
        </defs>

        <g mask="url(#dna-mask)">
          {/* Base-pair rungs */}
          {RUNGS.map((x) => {
            const y1 = CY + AMP * Math.sin((2 * Math.PI * x) / T);
            const y2 = CY - AMP * Math.sin((2 * Math.PI * x) / T);
            return (
              <line
                key={x}
                x1={x} y1={y1}
                x2={x} y2={y2}
                stroke="#FF8CA8"
                strokeWidth="1.2"
                strokeOpacity="0.45"
              />
            );
          })}

          {/* Strand 2 (behind) */}
          <path d={STRAND2} stroke="url(#s2-grad)" strokeWidth="2" fill="none" strokeOpacity="0.7" />

          {/* Strand 1 (front) */}
          <path d={STRAND1} stroke="url(#s1-grad)" strokeWidth="2.5" fill="none" strokeOpacity="0.9" />

          {/* Node dots on strand 1 at rung positions */}
          {RUNGS.map((x) => {
            const y = CY + AMP * Math.sin((2 * Math.PI * x) / T);
            return <circle key={`n1-${x}`} cx={x} cy={y} r="2.5" fill="#FF8CA8" fillOpacity="0.8" />;
          })}
          {/* Node dots on strand 2 */}
          {RUNGS.map((x) => {
            const y = CY - AMP * Math.sin((2 * Math.PI * x) / T);
            return <circle key={`n2-${x}`} cx={x} cy={y} r="2.5" fill="#a855f7" fillOpacity="0.8" />;
          })}
        </g>
      </svg>

      {/* ── Foreground: logo + brand name ── */}
      <div className="relative z-10 flex items-center gap-3 px-5 py-3.5">
        <Logo size={38} />
        <div className="flex flex-col leading-tight">
          <span
            className="font-bold tracking-widest uppercase text-base font-mono gm-text"
            style={{ letterSpacing: '0.18em' }}
          >
            Gene-Maps
          </span>
          <span className="text-xs text-white/45 tracking-wider uppercase" style={{ letterSpacing: '0.12em' }}>
            3D Genome · Drug Discovery
          </span>
        </div>

        {/* Right-side attribution */}
        <div className="ml-auto hidden sm:flex items-center gap-2 text-xs text-white/30 font-mono">
          <span className="h-1 w-1 rounded-full bg-gm-pink/60 animate-pulse" />
          <span>Powered by Genethropic</span>
        </div>
      </div>

      {/* Bottom border glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,140,168,0.4), rgba(168,85,247,0.4), transparent)' }}
      />
    </header>
  );
}
