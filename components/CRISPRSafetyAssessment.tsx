'use client';

// ============================================================
// CRISPRSafetyAssessment — TAD disruption and off-target risk.
// Calls POST /api/crispr/safety with gene + edit position.
// ============================================================

import { useState } from 'react';
import { Scissors, AlertTriangle, CheckCircle, AlertCircle, Info } from 'lucide-react';
import type { CRISPRSafetyData } from '@/types';

interface Props {
  geneSymbol: string;
}

function SafetyBadge({ score }: { score: number }) {
  if (score >= 7) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
        <CheckCircle className="h-3 w-3" /> Safe
      </span>
    );
  }
  if (score >= 4) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <AlertTriangle className="h-3 w-3" /> Moderate risk
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
      <AlertCircle className="h-3 w-3" /> High risk
    </span>
  );
}

const RISK_META: Record<string, { info: string }> = {
  'TAD Disruption Risk': {
    info:
      'Risk that the CRISPR cut will disrupt a TAD (Topologically Associating Domain) boundary. ' +
      'TAD boundaries are insulator regions anchored by CTCF proteins that prevent enhancers in one domain ' +
      'from activating genes in adjacent domains. Editing near a boundary (high CTCF density) can rewire gene regulation. ' +
      'Score 0–10: lower = safer (cut is far from boundaries).',
  },
  'Off-Target Risk': {
    info:
      'Estimated probability of unintended edits at other genomic loci with similar sequences. ' +
      'Derived from the number of spatial neighbors this gene has (more neighbors = more similar-sequence ' +
      'genomic regions that a guide RNA might bind). Score 0–10: lower = fewer predicted off-target sites.',
  },
  'Conservation Constraint': {
    info:
      'PhyloP100way score at the edit position (±100 bp window), normalized to 0–10. ' +
      'PhyloP measures per-base evolutionary conservation across 100 vertebrate genomes. ' +
      'High scores mean this exact position is under strong purifying selection — editing it risks ' +
      'disrupting an essential function even if on-target. Score 0–10: lower = less constrained.',
  },
};

function RiskMeter({ label, value }: { label: string; value: number }) {
  const color =
    value <= 3 ? 'bg-emerald-500' :
    value <= 6 ? 'bg-yellow-500' :
    'bg-red-500';
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <div className="flex items-center gap-1">
          <span>{label}</span>
          {RISK_META[label] && (
            <button
              onClick={() => setShowInfo((v) => !v)}
              aria-label={`Info about ${label}`}
              className="text-gray-300 hover:text-blue-500 transition"
            >
              <Info className="h-3 w-3" />
            </button>
          )}
        </div>
        <span className="font-semibold">{value.toFixed(1)}/10</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div
          className={`${color} h-2.5 rounded-full transition-all duration-500`}
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
      {showInfo && RISK_META[label] && (
        <p className="mt-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-2 leading-relaxed">
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

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/crispr/safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gene: geneSymbol, position: pos }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      setResult(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Scissors className="h-5 w-5 text-purple-600" />
        <h3 className="text-base font-semibold text-gray-900">CRISPR Safety Assessment</h3>
      </div>

      {/* What this does */}
      <div className="px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700 leading-relaxed">
        Enter a chromosomal base-pair position to assess the safety of editing{' '}
        <strong>{geneSymbol}</strong> at that location. The tool calculates TAD boundary disruption risk
        (using UCSC CTCF occupancy data), off-target risk (from spatial neighbor count), and evolutionary
        conservation constraint (PhyloP100way). Higher safety score = safer edit.
      </div>

      {/* Input form */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor="edit-position" className="sr-only">
            Edit position (bp)
          </label>
          <input
            id="edit-position"
            type="number"
            min="1"
            placeholder="Chromosomal edit position (bp)"
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl
                       focus:ring-2 focus:ring-purple-500 focus:border-transparent
                       disabled:opacity-50"
            value={editPosition}
            onChange={(e) => setEditPosition(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && analyzeSafety()}
            disabled={loading}
          />
        </div>
        <button
          onClick={analyzeSafety}
          disabled={loading || !editPosition}
          className="px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-xl
                     hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Analyzing…
            </>
          ) : (
            'Analyze Safety'
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Overall score */}
          <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Overall Safety Score</div>
                <div className="text-3xl font-bold text-gray-900">{result.safety_score.toFixed(1)}</div>
                <div className="text-xs text-gray-400">out of 10</div>
              </div>
              <SafetyBadge score={result.safety_score} />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Formula: <span className="font-mono text-gray-600">10 − (0.6 × TAD risk + 0.4 × off-target risk)</span>.
              Conservation constraint is reported separately as an independent safety signal.
            </p>
          </div>

          {/* Risk breakdown */}
          <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-900">Risk Breakdown</h4>
            <RiskMeter label="TAD Disruption Risk" value={result.tad_disruption_risk} />
            <RiskMeter label="Off-Target Risk" value={result.off_target_risk} />
            <RiskMeter label="Conservation Constraint" value={result.conservation_constraint} />
          </div>

          {/* TAD context */}
          {result.tad_context && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs">
              <h4 className="font-semibold text-gray-800 mb-2 text-sm">TAD Context</h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
                <dt className="font-medium">Chromosome</dt>
                <dd className="font-mono">{result.tad_context.chromosome}</dd>
                <dt className="font-medium">Distance to boundary</dt>
                <dd className="font-mono">{(result.tad_context.distance_to_boundary / 1000).toFixed(0)} kb</dd>
                <dt className="font-medium">Boundary strength</dt>
                <dd className="font-mono">{result.tad_context.boundary_strength.toFixed(2)}</dd>
              </dl>
            </div>
          )}

          {/* Recommendations */}
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <h4 className="font-semibold text-amber-900 text-sm mb-2">Recommendations</h4>
            <ul className="space-y-1.5">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                  <span className="mt-0.5 shrink-0">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
