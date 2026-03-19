'use client';

// ============================================================
// DrugTargetScore — Druggability and spatial score display.
// Fetches from /api/drug-score/:gene on mount.
// ============================================================

import { useState, useEffect } from 'react';
import { Pill, TrendingUp, AlertCircle, Info } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import type { DrugTargetScore as DrugTargetScoreType } from '@/types';

interface Props {
  geneSymbol: string;
}

// Metadata for each score component — shown on ⓘ click
const COMPONENT_META: Record<
  string,
  { label: string; icon: string; weight: string; description: string; interpretation: string }
> = {
  spatial: {
    label: 'Spatial Score',
    icon: '🧬',
    weight: '40%',
    description:
      'The composite spatial genome score (0–10) from the Spatial Score tab. It integrates evolutionary conservation, ' +
      'chromatin accessibility, network centrality, Hi-C contact frequency, and tissue expression breadth. ' +
      'Genes with high spatial scores are hubs in 3D chromatin space — typically more druggable.',
    interpretation: '≥7 excellent · 4–7 moderate · <4 low spatial privilege',
  },
  structural: {
    label: 'Structural Features',
    icon: '🔬',
    weight: '30%',
    description:
      'A proxy for the likelihood that this protein has a druggable binding pocket. Estimated from the number ' +
      'of high-confidence protein-protein interactions in STRING (interaction density) combined with spatial score. ' +
      'More interaction partners generally indicates a well-structured, accessible protein surface.',
    interpretation: '≥7 likely druggable pocket · 4–7 uncertain · <4 may be undruggable',
  },
  tissue: {
    label: 'Tissue Specificity',
    icon: '🫀',
    weight: '30%',
    description:
      'Derived from the GTEx Tau index (tissue specificity of expression). A score near 10 means highly tissue-restricted ' +
      '(high Tau) — the gene is expressed predominantly in one or few tissues, making it a potentially selective drug target ' +
      'with narrower off-tissue effects. A score near 0 means broadly expressed across all tissues (low Tau), ' +
      'which increases on-target efficacy but also systemic exposure risk.',
    interpretation: '≥7 tissue-restricted (selective) · 4–7 moderately specific · <4 broadly expressed (ubiquitous)',
  },
};

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(10, Math.max(0, score)) / 10;
  const strokeDashoffset = circumference * (1 - pct);

  const color =
    score >= 7 ? '#10b981' :
    score >= 4 ? '#f59e0b' :
    '#ef4444';

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={7} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={7} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
        className="transition-all duration-700"
      />
    </svg>
  );
}

function ComponentCard({
  id,
  value,
}: {
  id: 'spatial' | 'structural' | 'tissue';
  value: number;
}) {
  const meta = COMPONENT_META[id];
  const [showInfo, setShowInfo] = useState(false);

  const color =
    value >= 7 ? 'text-emerald-600' :
    value >= 4 ? 'text-amber-600' :
    'text-red-600';

  return (
    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-base" aria-hidden>{meta.icon}</span>
          <span className="text-xs font-medium text-gray-700">{meta.label}</span>
          <span className="text-xs text-gray-400 font-mono">×{meta.weight}</span>
        </div>
        <button
          onClick={() => setShowInfo((v) => !v)}
          aria-label={`Info about ${meta.label}`}
          className="text-gray-300 hover:text-blue-500 transition"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className={`text-xl font-bold ${color}`}>
        {value.toFixed(1)}
        <span className="text-xs font-normal text-gray-400 ml-0.5">/ 10</span>
      </div>
      {showInfo && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs text-gray-600 leading-relaxed bg-white border border-gray-100 rounded-lg px-2.5 py-2">
            {meta.description}
          </p>
          <p className="text-xs text-gray-400 italic">{meta.interpretation}</p>
        </div>
      )}
    </div>
  );
}

export function DrugTargetScore({ geneSymbol }: Props) {
  const [data, setData] = useState<DrugTargetScoreType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!geneSymbol) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const res = await fetch(`/api/drug-score/${encodeURIComponent(geneSymbol)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json: DrugTargetScoreType = await res.json();
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

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 bg-gray-200 rounded w-40" />
        <div className="h-32 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        Drug scoring failed: {error}
      </div>
    );
  }

  if (!data) return null;

  const radarData = [
    { subject: 'Spatial', value: data.spatial_contribution },
    { subject: 'Structure', value: data.structural_features },
    { subject: 'Tissue', value: data.tissue_specificity },
    { subject: 'Overall', value: data.druggability_score },
  ];

  const scoreInterpretation =
    data.druggability_score >= 7
      ? 'Strong druggability signal — this gene is a promising drug target candidate.'
      : data.druggability_score >= 4
      ? 'Moderate druggability — further experimental validation recommended before prioritizing.'
      : 'Low druggability signal — spatial or structural features suggest this target may be challenging to drug.';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Pill className="h-5 w-5 text-emerald-600" />
        <h3 className="text-base font-semibold text-gray-900">Drug Target Score</h3>
        <span className="ml-auto text-xs text-gray-400">(click ⓘ for component details)</span>
      </div>

      {/* Formula note */}
      <div className="px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700">
        <strong>Formula:</strong> Druggability = 40% × Spatial Score + 30% × Structural Features + 30% × Tissue Specificity
      </div>

      {/* Main score + radar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Score ring */}
        <div className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="relative">
            <ScoreRing score={data.druggability_score} size={100} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">
                {data.druggability_score.toFixed(1)}
              </span>
              <span className="text-xs text-gray-400">/ 10</span>
            </div>
          </div>
          <div className="mt-3 text-sm font-medium text-gray-700">Druggability Score</div>
          <p className="mt-2 text-xs text-gray-500 text-center leading-relaxed max-w-[180px]">
            {scoreInterpretation}
          </p>

          {data.drug_classes && data.drug_classes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
              {data.drug_classes.map((cls) => (
                <span
                  key={cls}
                  className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 rounded-full font-medium"
                  title="Inferred from protein interaction partners in STRING database"
                >
                  {cls}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Radar chart */}
        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Score Components
          </h4>
          <ResponsiveContainer width="100%" height={160}>
            <RadarChart data={radarData} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Radar
                name={geneSymbol}
                dataKey="value"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.2}
              />
              <Tooltip
                formatter={(value) => [`${Number(value ?? 0).toFixed(1)} / 10`, '']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Component breakdown with ⓘ explanations */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ComponentCard id="spatial" value={data.spatial_contribution} />
        <ComponentCard id="structural" value={data.structural_features} />
        <ComponentCard id="tissue" value={data.tissue_specificity} />
      </div>

      {/* What the drug classes mean */}
      {data.drug_classes && data.drug_classes.length > 0 && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 leading-relaxed">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-semibold text-gray-800 text-sm">Predicted Drug Classes</span>
          </div>
          Inferred from protein interaction partners in the STRING database (confidence ≥700).{' '}
          These are heuristic predictions based on interaction patterns — not clinical annotations.{' '}
          Always validate against DGIdb or ChEMBL for known drugs.
        </div>
      )}

      {/* Scientific context */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-800">Scientific context: </strong>
        The druggability score estimates how suitable this gene&apos;s protein product is for therapeutic intervention.
        It combines 3D genome spatial privilege (how central this gene is in chromatin space), structural accessibility
        (estimated binding pocket feasibility), and expression pattern (broadly expressed targets have more therapeutic
        reach; tissue-restricted ones have less off-tissue risk). Reference: Finan et al. (2017){' '}
        <em>Sci Transl Med</em> for druggable genome definitions.
      </div>

      <p className="text-xs text-gray-400 text-right">
        Computed: {new Date(data.computed_at).toLocaleString()}
      </p>
    </div>
  );
}
