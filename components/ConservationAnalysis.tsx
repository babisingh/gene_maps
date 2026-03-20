'use client';

import { useState, useEffect } from 'react';
import { Globe, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import type { ConservationData } from '@/types';

interface Props { geneSymbol: string; }

const SPECIES_ICONS: Record<string, string> = {
  Mouse: '🐭', Rat: '🐀', Dog: '🐶', Pig: '🐷', Cow: '🐄',
  Chicken: '🐔', Frog: '🐸', Zebrafish: '🐟', 'Fruit fly': '🪰', Nematode: '🪱',
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 80 ? '#34d399' : pct >= 60 ? '#FF8CA8' : pct >= 40 ? '#fbbf24' : '#f87171';
  return (
    <div className="w-full bg-white/10 rounded-full h-2 mt-1.5">
      <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export function ConservationAnalysis({ geneSymbol }: Props) {
  const [data, setData] = useState<ConservationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAvgInfo, setShowAvgInfo] = useState(false);

  useEffect(() => {
    if (!geneSymbol) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true); setError(null); setData(null);
      try {
        const res = await fetch(`/api/conservation/${encodeURIComponent(geneSymbol)}`);
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`); }
        if (!cancelled) setData(await res.json());
      } catch (err) { if (!cancelled) setError((err as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [geneSymbol]);

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      <div className="h-5 bg-white/10 rounded w-48" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-xl" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-start gap-2 p-4 bg-red-950/40 border border-red-500/25 rounded-xl text-red-300 text-sm">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      Conservation analysis failed: {error}
    </div>
  );

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-gm-pink" />
          <h3 className="text-base font-semibold text-white">Cross-Species Conservation</h3>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-white/55">
          Avg: <span className="font-bold text-gm-pink">{data.average_conservation}%</span>
          <button onClick={() => setShowAvgInfo(v => !v)} className="text-white/25 hover:text-gm-pink transition">
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {data.api_warning && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-950/40 border border-amber-500/25 rounded-lg text-xs text-amber-300 leading-relaxed">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
          <span>{data.api_warning}</span>
        </div>
      )}

      {showAvgInfo && (
        <div className="px-3 py-2 bg-gm-pink/8 border border-gm-pink/20 rounded-lg text-xs text-white/65 leading-relaxed">
          The average conservation is a <strong className="text-white/80">distance-weighted mean</strong> of ortholog percent identity
          across 10 model organisms. Species closer to humans (mouse, rat) are weighted more heavily than distant relatives (nematode, fruit fly).
          Percent identity is the fraction of amino acids identical between the human protein and its ortholog, as reported by the ENSEMBL homology API.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {data.species.map(sp => (
          <div key={sp.name}
            className="p-3 bg-white/[0.04] border border-white/8 rounded-xl hover:border-white/20 hover:bg-white/[0.07] transition"
            title={`${sp.conservation_score.toFixed(1)}% amino acid identity — ${sp.common_name} ortholog`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-lg" aria-hidden>{SPECIES_ICONS[sp.common_name] ?? '🧬'}</span>
              <span className="font-medium text-sm text-white/85 leading-tight">{sp.common_name}</span>
            </div>
            <div className="text-xl font-bold text-gm-pink">
              {sp.conservation_score.toFixed(0)}
              <span className="text-xs font-normal text-white/35 ml-0.5">%</span>
            </div>
            <ScoreBar score={sp.conservation_score} />
            {sp.ortholog_symbol && sp.ortholog_symbol !== 'N/A' && (
              <div className="mt-1.5 text-xs text-white/30">
                Ortholog: <span className="font-mono text-white/50">{sp.ortholog_symbol}</span>
              </div>
            )}
            {sp.conservation_score === 0 && (
              <div className="mt-1 text-xs text-white/20 italic">No ortholog found</div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 bg-gm-pink/8 border border-gm-pink/20 rounded-xl">
        <h4 className="font-semibold text-white/90 text-sm mb-1">What does this mean?</h4>
        <p className="text-white/65 text-xs leading-relaxed">
          <strong className="text-gm-pink">{geneSymbol}</strong> shows{' '}
          {data.average_conservation >= 70 ? 'high' : data.average_conservation >= 40 ? 'moderate' : 'low'} conservation
          across species (average {data.average_conservation}%).{' '}
          {data.average_conservation >= 70
            ? 'Highly conserved genes are under strong evolutionary constraint, suggesting essential function and potential druggability.'
            : data.average_conservation >= 40
            ? 'Moderate conservation suggests functional importance with some species-specific adaptations.'
            : 'Low conservation may indicate species-specific function or rapid evolutionary change.'}
        </p>
      </div>
    </div>
  );
}
