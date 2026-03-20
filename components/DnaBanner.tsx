'use client';

// ============================================================
// DnaBanner — application header
// Option A: Animated Network Canvas
// Dark purple gradient background with a live canvas of
// floating network nodes (pink/purple) and gradient edges.
// Brand name made larger and more prominent.
// ============================================================

import { useEffect, useRef } from 'react';
import { Logo } from './Logo';

interface Props {
  className?: string;
}

// Node colors cycling through pink → mid → purple
const PALETTE = ['#FF8CA8', '#e879a8', '#cc6db8', '#b45fd1', '#a855f7', '#c084fc'];

export function DnaBanner({ className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const c: HTMLCanvasElement = canvas;
    const ctx = c.getContext('2d')!;
    let dpr = window.devicePixelRatio || 1;
    let animId = 0;
    let t = 0;

    interface NetNode {
      x: number; y: number;
      vx: number; vy: number;
      r: number;
      color: string;
      phase: number;
    }

    const N = 60;
    const LINK_DIST = 115;
    let nodes: NetNode[] = [];

    function logW() { return c.width  / dpr; }
    function logH() { return c.height / dpr; }

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const w = c.offsetWidth;
      const h = c.offsetHeight;
      c.width  = w * dpr;
      c.height = h * dpr;
    }

    function initNodes() {
      const w = logW();
      const h = logH();
      nodes = Array.from({ length: N }, () => ({
        x:     Math.random() * w,
        y:     Math.random() * h,
        vx:    (Math.random() - 0.5) * 0.28,
        vy:    (Math.random() - 0.5) * 0.28,
        r:     Math.random() * 2.4 + 0.9,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        phase: Math.random() * Math.PI * 2,
      }));
    }

    function draw() {
      t++;
      const w = logW();
      const h = logH();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Update positions
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0)  { n.x = 0;  n.vx =  Math.abs(n.vx); }
        if (n.x > w)  { n.x = w;  n.vx = -Math.abs(n.vx); }
        if (n.y < 0)  { n.y = 0;  n.vy =  Math.abs(n.vy); }
        if (n.y > h)  { n.y = h;  n.vy = -Math.abs(n.vy); }
      }

      // Draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST) {
            const alpha = (1 - d / LINK_DIST) * 0.28;
            const grad = ctx.createLinearGradient(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
            grad.addColorStop(0, `rgba(255,140,168,${alpha})`);
            grad.addColorStop(1, `rgba(168,85,247,${alpha})`);
            ctx.strokeStyle = grad;
            ctx.lineWidth   = 0.6;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        const pulse = n.r * (1 + 0.18 * Math.sin(t * 0.038 + n.phase));
        // Outer glow
        ctx.globalAlpha = 0.18;
        ctx.fillStyle   = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulse * 2.6, 0, Math.PI * 2);
        ctx.fill();
        // Core
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      animId = requestAnimationFrame(draw);
    }

    function onResize() {
      resize();
      // Clamp existing node positions to new bounds
      const w = logW();
      const h = logH();
      for (const n of nodes) {
        n.x = Math.min(n.x, w);
        n.y = Math.min(n.y, h);
      }
    }

    resize();
    initNodes();
    draw();

    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <header
      className={`relative w-full overflow-hidden ${className}`}
      style={{ background: 'linear-gradient(135deg, #0f0726 0%, #0a1628 100%)' }}
    >
      {/* Animated network canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        aria-hidden
      />

      {/* Foreground: logo + brand */}
      <div className="relative z-10 flex items-center gap-4 px-5 py-3.5">
        <Logo size={44} />

        <div className="flex flex-col justify-center">
          {/* Primary brand name — large, gradient */}
          <span
            className="font-extrabold tracking-widest uppercase font-mono gm-text"
            style={{ fontSize: '1.45rem', letterSpacing: '0.16em', lineHeight: 1.1 }}
          >
            Gene-Maps
          </span>
          {/* Subtitle — clearly visible */}
          <span
            className="font-medium tracking-widest uppercase font-mono text-white/60"
            style={{ fontSize: '0.82rem', letterSpacing: '0.14em', lineHeight: 1.2, marginTop: '2px' }}
          >
            3D Genome · Drug Discovery
          </span>
        </div>

        {/* Right-side attribution */}
        <div className="ml-auto hidden sm:flex items-center gap-2 text-xs text-white/30 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-gm-pink/60 animate-pulse" />
          <span>Powered by Genethropic</span>
        </div>
      </div>

      {/* Bottom border glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,140,168,0.55), rgba(168,85,247,0.55), transparent)',
        }}
      />
    </header>
  );
}
