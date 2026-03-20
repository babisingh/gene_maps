'use client';

import { useState, useEffect } from 'react';
import { Pill, TrendingUp, AlertCircle, Info } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import type { DrugTargetScore as DrugTargetScoreType } from '@/types';

interface Props { geneSymbol: string; }

const COMPONENT_META: Record<string, { label: string; icon: string; weight: string; description: string; interpretation: string }> = {
  spatial: {
    label: 'Spatial Score', icon: '🧬', weight: '40%',
    description: 'The composite spatial genome score (0–10). Integrates evolutionary conservation, chromatin accessibility, network centrality, Hi-C contact frequency, and tissue expression breadth. Genes with high spatial scores are hubs in 3D chromatin space — typically more druggable.',
    interpretation: '≥7 excellent · 4–7 moderate · <4 low spatial privilege',
  },
  structural: {
    label: 'Structural Features', icon: '🔬', weight: '30%',
    description: 'A proxy for the likelihood that this protein has a druggable binding pocket. Estimated from the number of high-confidence protein-protein interactions in STRING (interaction density) combined with spatial score.',
    interpretation: '≥7 likely druggable pocket · 4–7 uncertain · <4 may be undruggable',
  },
  tissue: {
    label: 'Tissue Specificity', icon: '🫀', weight: '30%',
    description: 'Derived from the GTEx Tau index. A score near 10 means highly tissue-restricted (high Tau) — the gene is expressed predominantly in one or few tissues, making it a potentially selective drug target with narrower off-tissue effects. A score near 0 means broadly expressed (low Tau).',
    interpretation: '≥7 tissue-restricted (selective) · 4–7 moderately specific · <4 broadly expressed (ubiquitous)',
  },
};

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(10, Math.max(0, score)) / 10);
  const color = score >= 7 ? '#34d399' : score >= 4 ? '#fbbf24' : '#f87171';
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={7}
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        className="transition-all duration-700" />
    </svg>
  );
}

function ComponentCard({ id, value }: { id: 'spatial' | 'structural' | 'tissue'; value: number }) {
  const meta = COMPONENT_META[id];
  const [showInfo, setShowInfo] = useState(false);
  const color = value >= 7 ? 'text-emerald-400' : value >= 4 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="p-3 bg-white/[0.04] border border-white/8 rounded-xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-base" aria-hidden>{meta.icon}</span>
          <span className="text-xs font-medium text-white/80">{meta.label}</span>
          <span className="text-xs text-white/30 font-mono">×{meta.weight}</span>
        </div>
        <button onClick={() => setShowInfo(v => !v)} className="text-white/20 hover:text-gm-pink transition">
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className={`text-xl font-bold ${color}`}>
        {value.toFixed(1)}<span className="text-xs font-normal text-white/35 ml-0.5">/ 10</span>
      </div>
      {showInfo && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs text-white/55 leading-relaxed bg-white/5 border border-white/8 rounded-lg px-2.5 py-2">{meta.description}</p>
          <p className="text-xs text-white/30 italic">{meta.interpretation}</p>
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
      setLoading(true); setError(null); setData(null);
      try {
        const res = await fetch(`/api/drug-score/${encodeURIComponent(geneSymbol)}`);
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`); }
        if (!cancelled) setData(await res.json());
      } catch (err) { if (!cancelled) setError((err as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [geneSymbol]);

  if (loading) return (
    <div className="animate-pulse space-y-3">
      <div className="h-5 bg-white/10 rounded w-40" />
      <div className="h-32 bg-white/5 rounded-xl" />
    </div>
  );

  if (error) return (
    <div className="flex items-start gap-2 p-4 bg-red-950/40 border border-red-500/25 rounded-xl text-red-300 text-sm">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />Drug scoring failed: {error}
    </div>
  );

  if (!data) return null;

  const radarData = [
    { subject: 'Spatial',    value: data.spatial_contribution },
    { subject: 'Structure',  value: data.structural_features },
    { subject: 'Tissue',     value: data.tissue_specificity },
    { subject: 'Overall',    value: data.druggability_score },
  ];

  const interp = data.druggability_score >= 7
    ? 'Strong druggability signal — this gene is a promising drug target candidate.'
    : data.druggability_score >= 4
    ? 'Moderate druggability — further experimental validation recommended before prioritizing.'
    : 'Low druggability signal — spatial or structural features suggest this target may be challenging to drug.';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Pill className="h-5 w-5 text-emerald-400" />
        <h3 className="text-base font-semibold text-white">Drug Target Score</h3>
        <span className="ml-auto text-xs text-white/35">(click ⓘ for component details)</span>
      </div>

      <div className="px-3 py-2 bg-emerald-950/40 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
        <strong>Formula:</strong> Druggability = 40% × Spatial Score + 30% × Structural Features + 30% × Tissue Specificity
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col items-center justify-center p-6 bg-white/[0.04] border border-white/10 rounded-xl">
          <div className="relative">
            <ScoreRing score={data.druggability_score} size={100} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white">{data.druggability_score.toFixed(1)}</span>
              <span className="text-xs text-white/35">/ 10</span>
            </div>
          </div>
          <div className="mt-3 text-sm font-medium text-white/70">Druggability Score</div>
          <p className="mt-2 text-xs text-white/45 text-center leading-relaxed max-w-[180px]">{interp}</p>
          {data.drug_classes && data.drug_classes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
              {data.drug_classes.map(cls => (
                <span key={cls} className="px-2 py-0.5 text-xs bg-emerald-500/15 text-emerald-400 rounded-full font-medium border border-emerald-500/20">
                  {cls}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-white/[0.03] border border-white/10 rounded-xl">
          <h4 className="text-xs font-semibold text-white/45 uppercase tracking-wide mb-2">Score Components</h4>
          <ResponsiveContainer width="100%" height={160}>
            <RadarChart data={radarData} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <Radar name={geneSymbol} dataKey="value" stroke="#34d399" fill="#34d399" fillOpacity={0.15} />
              <Tooltip formatter={v => [`${Number(v ?? 0).toFixed(1)} / 10`, '']}
                contentStyle={{ fontSize: 12, borderRadius: 8, background: 'rgba(15,7,38,0.95)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ComponentCard id="spatial"     value={data.spatial_contribution} />
        <ComponentCard id="structural"  value={data.structural_features} />
        <ComponentCard id="tissue"      value={data.tissue_specificity} />
      </div>

      {data.drug_classes && data.drug_classes.length > 0 && (
        <div className="p-4 bg-white/[0.03] border border-white/8 rounded-xl text-xs text-white/50 leading-relaxed">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-semibold text-white/75 text-sm">Predicted Drug Classes</span>
          </div>
          Inferred from protein interaction partners in the STRING database (confidence ≥700). These are heuristic predictions based
          on interaction patterns — not clinical annotations. Always validate against DGIdb or ChEMBL for known drugs.
        </div>
      )}

      <div className="p-4 bg-white/[0.03] border border-white/8 rounded-xl text-xs text-white/45 leading-relaxed">
        <strong className="text-white/65">Scientific context: </strong>
        The druggability score estimates how suitable this gene&apos;s protein product is for therapeutic intervention. It combines
        3D genome spatial privilege, structural accessibility (estimated binding pocket feasibility), and expression pattern.
        Reference: Finan et al. (2017) <em>Sci Transl Med</em>.
      </div>

      <p className="text-xs text-white/25 text-right">Computed: {new Date(data.computed_at).toLocaleString()}</p>
    </div>
  );
}
