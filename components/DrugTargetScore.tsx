'use client';

// ============================================================
// DrugTargetScore — Druggability and spatial score display.
// Fetches from /api/drug-score/:gene on mount.
// ============================================================

import { useState, useEffect } from 'react';
import { Pill, TrendingUp, AlertCircle } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import type { DrugTargetScore as DrugTargetScoreType } from '@/types';

interface Props {
  geneSymbol: string;
}

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
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={7}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className="transition-all duration-700"
      />
    </svg>
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
    { subject: 'Tissue\nSpecific', value: data.tissue_specificity },
    { subject: 'Druggability', value: data.druggability_score },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Pill className="h-5 w-5 text-emerald-600" />
        <h3 className="text-base font-semibold text-gray-900">Drug Target Score</h3>
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

          {data.drug_classes && data.drug_classes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
              {data.drug_classes.map((cls) => (
                <span
                  key={cls}
                  className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 rounded-full font-medium"
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
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 10, fill: '#6b7280' }}
              />
              <Radar
                name={geneSymbol}
                dataKey="value"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Component breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Spatial Score', value: data.spatial_contribution, icon: '🧬' },
          { label: 'Structural', value: data.structural_features, icon: '🔬' },
          { label: 'Tissue', value: data.tissue_specificity, icon: '🫀' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
            <div className="text-xl mb-1" aria-hidden>{icon}</div>
            <div className="text-lg font-bold text-gray-900">{value.toFixed(1)}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-right">
        Computed: {new Date(data.computed_at).toLocaleString()}
      </p>
    </div>
  );
}
