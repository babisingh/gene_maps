'use client';

// ============================================================
// ConservationAnalysis — Cross-species conservation display.
// Fetches from /api/conservation/:gene on mount.
// ============================================================

import { useState, useEffect } from 'react';
import { Globe, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import type { ConservationData } from '@/types';

interface Props {
  geneSymbol: string;
}

// Emoji flags for common species (cosmetic)
const SPECIES_ICONS: Record<string, string> = {
  Mouse: '🐭',
  Rat: '🐀',
  Dog: '🐶',
  Pig: '🐷',
  Cow: '🐄',
  Chicken: '🐔',
  Frog: '🐸',
  Zebrafish: '🐟',
  'Fruit fly': '🪰',
  Nematode: '🪱',
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 60 ? 'bg-blue-500' :
    pct >= 40 ? 'bg-yellow-500' :
    'bg-red-400';

  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1.5">
      <div
        className={`${color} h-2 rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
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
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const res = await fetch(`/api/conservation/${encodeURIComponent(geneSymbol)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json: ConservationData = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [geneSymbol]);

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Conservation analysis failed: {error}</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-semibold text-gray-900">Cross-Species Conservation</h3>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          Avg:{' '}
          <span className="font-bold text-blue-700">{data.average_conservation}%</span>
          <button
            onClick={() => setShowAvgInfo((v) => !v)}
            aria-label="Info about average conservation score"
            className="text-gray-300 hover:text-blue-500 transition"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {data.api_warning && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
          <span>{data.api_warning}</span>
        </div>
      )}

      {showAvgInfo && (
        <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 leading-relaxed">
          The average conservation is a <strong>distance-weighted mean</strong> of ortholog percent identity across 10 model organisms.
          Species closer to humans (mouse, rat) are weighted more heavily than distant relatives (nematode, fruit fly).
          Percent identity is the fraction of amino acids identical between the human protein and its ortholog in each species,
          as reported by the ENSEMBL homology API.
        </div>
      )}

      {/* Species grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {data.species.map((sp) => (
          <div
            key={sp.name}
            className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition"
            title={`${sp.conservation_score.toFixed(1)}% amino acid identity between human ${geneSymbol} and ${sp.common_name} ortholog${sp.ortholog_id ? ` (${sp.ortholog_id})` : ''}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-lg" aria-hidden>
                {SPECIES_ICONS[sp.common_name] ?? '🧬'}
              </span>
              <span className="font-medium text-sm text-gray-800 leading-tight">
                {sp.common_name}
              </span>
            </div>
            <div className="text-xl font-bold text-blue-700">
              {sp.conservation_score.toFixed(0)}
              <span className="text-xs font-normal text-gray-400 ml-0.5">%</span>
            </div>
            <ScoreBar score={sp.conservation_score} />
            {sp.ortholog_symbol && sp.ortholog_symbol !== 'N/A' && (
              <div className="mt-1.5 text-xs text-gray-400">
                Ortholog: <span className="font-mono text-gray-600">{sp.ortholog_symbol}</span>
              </div>
            )}
            {sp.conservation_score === 0 && (
              <div className="mt-1 text-xs text-gray-300 italic">No ortholog found</div>
            )}
          </div>
        ))}
      </div>

      {/* Insight box */}
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <h4 className="font-semibold text-blue-900 text-sm mb-1">What does this mean?</h4>
        <p className="text-blue-800 text-xs leading-relaxed">
          <strong>{geneSymbol}</strong> shows {data.average_conservation >= 70 ? 'high' : data.average_conservation >= 40 ? 'moderate' : 'low'} conservation
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
