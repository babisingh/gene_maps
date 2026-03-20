'use client';

import { useState } from 'react';
import { Scissors, AlertTriangle, CheckCircle, AlertCircle, Info } from 'lucide-react';
import type { CRISPRSafetyData } from '@/types';

interface Props { geneSymbol: string; }

function SafetyBadge({ score }: { score: number }) {
  if (score >= 7) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
      <CheckCircle className="h-3 w-3" /> Safe
    </span>
  );
  if (score >= 4) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
      <AlertTriangle className="h-3 w-3" /> Moderate risk
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/25">
      <AlertCircle className="h-3 w-3" /> High risk
    </span>
  );
}

const RISK_META: Record<string, { info: string }> = {
  'TAD Disruption Risk': {
    info: 'Risk that the CRISPR cut will disrupt a TAD boundary. Editing near a boundary (high CTCF density) can rewire gene regulation. Score 0–10: lower = safer.',
  },
  'Off-Target Risk': {
    info: 'Estimated probability of unintended edits at other genomic loci. Derived from the number of spatial neighbors this gene has. Score 0–10: lower = fewer off-target sites.',
  },
  'Conservation Constraint': {
    info: 'PhyloP100way score at the edit position (±100 bp window), normalized to 0–10. High scores mean this position is under strong purifying selection. Score 0–10: lower = less constrained.',
  },
};

function RiskMeter({ label, value }: { label: string; value: number }) {
  const color = value <= 3 ? '#34d399' : value <= 6 ? '#fbbf24' : '#f87171';
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div>
      <div className="flex justify-between text-xs text-white/60 mb-1">
        <div className="flex items-center gap-1">
          <span>{label}</span>
          {RISK_META[label] && (
            <button onClick={() => setShowInfo(v => !v)} className="text-white/20 hover:text-gm-pink transition">
              <Info className="h-3 w-3" />
            </button>
          )}
        </div>
        <span className="font-semibold text-white/80">{value.toFixed(1)}/10</span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2.5">
        <div className="h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${(value / 10) * 100}%`, backgroundColor: color }} />
      </div>
      {showInfo && RISK_META[label] && (
        <p className="mt-1.5 text-xs text-white/50 bg-white/5 border border-white/8 rounded-lg px-2.5 py-2 leading-relaxed">
          {RISK_META[label].info}
        </p>
      )}
    </div>
  );
}

export function CRISPRSafetyAssessment({ geneSymbol }: Props) {
  const [editPosition, setEditPosition] = useState('');
  const [result, setResult] = useState<CRISPRSafetyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeSafety = async () => {
    const pos = parseInt(editPosition, 10);
    if (!geneSymbol || isNaN(pos) || pos <= 0) {
      setError('Please enter a valid chromosomal position (positive integer).');
      return;
    }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/crispr/safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gene: geneSymbol, position: pos }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`); }
      setResult(await res.json());
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Scissors className="h-5 w-5 text-gm-purple" />
        <h3 className="text-base font-semibold text-white">CRISPR Safety Assessment</h3>
      </div>

      <div className="px-3 py-2.5 bg-gm-purple/10 border border-gm-purple/25 rounded-lg text-xs text-purple-300 leading-relaxed">
        Enter a chromosomal base-pair position to assess the safety of editing{' '}
        <strong className="text-white/80">{geneSymbol}</strong> at that location. The tool calculates TAD boundary disruption risk
        (using UCSC CTCF occupancy data), off-target risk (from spatial neighbor count), and evolutionary conservation constraint (PhyloP100way).
        Higher safety score = safer edit.
      </div>

      <div className="flex gap-2">
        <input
          id="edit-position" type="number" min="1"
          placeholder="Chromosomal edit position (bp)"
          className="flex-1 px-3 py-2.5 text-sm rounded-xl border border-white/20 bg-white/90 text-gray-900
                     placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gm-purple/50 focus:border-gm-purple/40
                     disabled:opacity-50"
          value={editPosition}
          onChange={e => setEditPosition(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && analyzeSafety()}
          disabled={loading}
        />
        <button
          onClick={analyzeSafety}
          disabled={loading || !editPosition}
          className="px-4 py-2.5 text-sm font-medium rounded-xl transition flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: 'white' }}
        >
          {loading ? (
            <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />Analyzing…</>
          ) : 'Analyze Safety'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-950/40 border border-red-500/25 rounded-xl text-red-300 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="p-4 bg-white/[0.04] border border-white/10 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-white/40 mb-0.5">Overall Safety Score</div>
                <div className="text-3xl font-bold text-white">{result.safety_score.toFixed(1)}</div>
                <div className="text-xs text-white/30">out of 10</div>
              </div>
              <SafetyBadge score={result.safety_score} />
            </div>
            <p className="text-xs text-white/40 leading-relaxed">
              Formula: <span className="font-mono text-white/55">10 − (0.6 × TAD risk + 0.4 × off-target risk)</span>.
              Conservation constraint is reported separately as an independent safety signal.
            </p>
          </div>

          <div className="p-4 bg-white/[0.04] border border-white/10 rounded-xl space-y-3">
            <h4 className="text-sm font-semibold text-white/80">Risk Breakdown</h4>
            <RiskMeter label="TAD Disruption Risk"       value={result.tad_disruption_risk} />
            <RiskMeter label="Off-Target Risk"            value={result.off_target_risk} />
            <RiskMeter label="Conservation Constraint"    value={result.conservation_constraint} />
          </div>

          {result.tad_context && (
            <div className="p-4 bg-white/[0.03] border border-white/8 rounded-xl text-xs">
              <h4 className="font-semibold text-white/80 mb-2 text-sm">TAD Context</h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-white/55">
                <dt className="font-medium text-white/70">Chromosome</dt>
                <dd className="font-mono">{result.tad_context.chromosome}</dd>
                <dt className="font-medium text-white/70">Distance to boundary</dt>
                <dd className="font-mono">{(result.tad_context.distance_to_boundary / 1000).toFixed(0)} kb</dd>
                <dt className="font-medium text-white/70">Boundary strength</dt>
                <dd className="font-mono">{result.tad_context.boundary_strength.toFixed(2)}</dd>
              </dl>
            </div>
          )}

          <div className="p-4 bg-amber-950/30 border border-amber-500/20 rounded-xl">
            <h4 className="font-semibold text-amber-300 text-sm mb-2">Recommendations</h4>
            <ul className="space-y-1.5">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-300/80">
                  <span className="mt-0.5 shrink-0">•</span><span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
