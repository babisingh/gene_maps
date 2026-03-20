'use client';

// ============================================================
// SpatialScore — displays the composite spatial score and its
// 5 weighted components with scientific explanations.
//
// Component weights (see ARCHITECTURE.md):
//   Conservation   25% — evolutionary constraint across 10 species
//   Accessibility  20% — chromatin openness (PhyloP proxy)
//   Centrality     25% — network centrality in STRING PPI graph
//   Interactions   20% — Hi-C contact frequency with neighbors
//   Expression     10% — tissue expression plasticity (GTEx)
// ============================================================

import { useState, useEffect } from 'react';
import { Dna, AlertCircle, Info } from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { SpatialScore as SpatialScoreType } from '@/types';

interface Props {
  geneSymbol: string;
}

const COMPONENT_META: Record<
  string,
  { label: string; weight: number; description: string; color: string }
> = {
  conservation: {
    label: 'Conservation',
    weight: 25,
    description:
      'Evolutionary constraint measured by percent sequence identity of orthologs across 10 model organisms. ' +
      'High conservation = essential function preserved over ~700M years.',
    color: '#3b82f6',
  },
  accessibility: {
    label: 'Chromatin Access',
    weight: 20,
    description:
      'Chromatin accessibility estimated from UCSC PhyloP conservation scores at the promoter region. ' +
      'Highly conserved promoters tend to be in constitutively open chromatin.',
    color: '#8b5cf6',
  },
  centrality: {
    label: 'Network Hub',
    weight: 25,
    description:
      'Degree centrality in the STRING protein-protein interaction network. ' +
      'Hub genes (many high-confidence interactions) propagate signals widely and are often druggable.',
    color: '#10b981',
  },
  interactions: {
    label: 'Hi-C Contacts',
    weight: 20,
    description:
      'Average Hi-C contact frequency with spatial neighbors, from stored interaction data. ' +
      'Higher frequency = physically closer in 3D nuclear space = stronger co-regulation.',
    color: '#f59e0b',
  },
  expression: {
    label: 'Expression',
    weight: 10,
    description:
      'Expression plasticity from GTEx (inverse of Tau tissue specificity index). ' +
      'Broadly expressed genes (Tau near 0) score near 10 — ubiquitous expression is a proxy for constitutively open, euchromatic (A-compartment) chromatin, which correlates with spatial centrality in the nucleus. ' +
      'Tissue-restricted genes (Tau near 1) tend to reside in conditionally accessible regions and score near 0. Full 0–10 range used for maximum granularity.',
    color: '#ef4444',
  },
};

function ScoreBar({
  value,
  color,
  weight,
}: {
  value: number;
  color: string;
  weight: number;
}) {
  const pct = (value / 10) * 100;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className="h-3 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-bold text-gray-900 w-8 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function ComponentRow({
  id,
  value,
}: {
  id: string;
  value: number;
}) {
  const meta = COMPONENT_META[id];
  const [showInfo, setShowInfo] = useState(false);

  if (!meta) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-700">{meta.label}</span>
          <span className="text-xs text-gray-400 font-mono">×{meta.weight}%</span>
          <button
            onClick={() => setShowInfo((v) => !v)}
            aria-label={`Info about ${meta.label}`}
            className="text-gray-300 hover:text-gray-500 transition"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <ScoreBar value={value} color={meta.color} weight={meta.weight} />
      {showInfo && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
          {meta.description}
        </p>
      )}
    </div>
  );
}

export function SpatialScore({ geneSymbol }: Props) {
  const [data, setData] = useState<(SpatialScoreType & { druggability_score?: number }) | null>(null);
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
        const res = await fetch(`/api/spatial/score/${encodeURIComponent(geneSymbol)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = await res.json();
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
      <div className="space-y-4 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-40" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-gray-100 rounded-xl" />
          <div className="h-48 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        Spatial scoring failed: {error}
      </div>
    );
  }

  if (!data) return null;

  const radarData = [
    { subject: 'Conservation', value: data.components.conservation, fullMark: 10 },
    { subject: 'Accessibility', value: data.components.accessibility, fullMark: 10 },
    { subject: 'Network Hub', value: data.components.centrality, fullMark: 10 },
    { subject: 'Hi-C Contacts', value: data.components.interactions, fullMark: 10 },
    { subject: 'Expression', value: data.components.expression, fullMark: 10 },
  ];

  const confidencePct = Math.round(data.confidence * 100);
  const scoreColor =
    data.total_score >= 7 ? 'text-emerald-600' :
    data.total_score >= 4 ? 'text-amber-600' :
    'text-red-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Dna className="h-5 w-5 text-blue-600" />
        <h3 className="text-base font-semibold text-gray-900">Spatial Genome Score</h3>
        <span className="ml-auto text-xs text-gray-400">
          Data confidence: {confidencePct}%
        </span>
      </div>

      {/* Score summary + radar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total score */}
        <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl">
          <div className={`text-5xl font-bold ${scoreColor}`}>
            {data.total_score.toFixed(1)}
          </div>
          <div className="text-sm text-gray-500 mt-1">out of 10</div>
          <div className="mt-3 text-xs font-medium text-gray-600">Spatial Score</div>
          {data.druggability_score !== undefined && (
            <div className="mt-3 pt-3 border-t border-blue-200 w-full text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {data.druggability_score.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500">Druggability Score</div>
            </div>
          )}
          {/* Data sources */}
          {data.data_sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1 justify-center">
              {data.data_sources.map((src) => (
                <span
                  key={src}
                  className="px-1.5 py-0.5 text-xs bg-white/70 text-blue-700 rounded border border-blue-200"
                >
                  {src}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Radar chart */}
        <div className="p-4 bg-white border border-gray-200 rounded-xl">
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 10, fill: '#6b7280' }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 10]}
                tick={{ fontSize: 9, fill: '#9ca3af' }}
                tickCount={3}
              />
              <Radar
                name={geneSymbol}
                dataKey="value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Tooltip
                formatter={(value) => [`${Number(value ?? 0).toFixed(1)} / 10`, '']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Component breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-semibold text-gray-800">
          Score Components
          <span className="ml-2 font-normal text-gray-400 text-xs">
            (click ⓘ for biological rationale)
          </span>
        </h4>
        {Object.entries(data.components).map(([id, value]) => (
          <ComponentRow key={id} id={id} value={value} />
        ))}
      </div>

      {/* Interpretation */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
        <strong className="text-slate-800">Score interpretation: </strong>
        The spatial score integrates five dimensions of 3D genome privilege.
        Genes scoring above 7 tend to be hubs in spatial interaction networks with
        strong evolutionary constraint — characteristics associated with druggable targets
        in published pharmacogenomics studies (Finan et al. 2017 Sci Transl Med).
        Scores below 4 may indicate spatially isolated or rapidly-evolving genes.
      </div>
    </div>
  );
}
