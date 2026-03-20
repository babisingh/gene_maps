'use client';

import { useState, useEffect } from 'react';
import { Dna, AlertCircle, Info } from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip,
} from 'recharts';
import type { SpatialScore as SpatialScoreType } from '@/types';

interface Props { geneSymbol: string; }

const COMPONENT_META: Record<string, { label: string; weight: number; description: string; color: string }> = {
  conservation: {
    label: 'Conservation', weight: 25,
    description: 'Evolutionary constraint measured by percent sequence identity of orthologs across 10 model organisms. High conservation = essential function preserved over ~700M years.',
    color: '#FF8CA8',
  },
  accessibility: {
    label: 'Chromatin Access', weight: 20,
    description: 'Chromatin accessibility estimated from UCSC PhyloP conservation scores at the promoter region. Highly conserved promoters tend to be in constitutively open chromatin.',
    color: '#a855f7',
  },
  centrality: {
    label: 'Network Hub', weight: 25,
    description: 'Degree centrality in the STRING protein-protein interaction network. Hub genes (many high-confidence interactions) propagate signals widely and are often druggable.',
    color: '#34d399',
  },
  interactions: {
    label: 'Hi-C Contacts', weight: 20,
    description: 'Average Hi-C contact frequency with spatial neighbors, from stored interaction data. Higher frequency = physically closer in 3D nuclear space = stronger co-regulation.',
    color: '#fbbf24',
  },
  expression: {
    label: 'Expression', weight: 10,
    description: 'Expression plasticity from GTEx (inverse of Tau tissue specificity index). Broadly expressed genes (Tau near 0) score near 10 — ubiquitous expression is a proxy for constitutively open, euchromatic (A-compartment) chromatin, which correlates with spatial centrality in the nucleus. Tissue-restricted genes (Tau near 1) tend to reside in conditionally accessible regions and score near 0.',
    color: '#f87171',
  },
};

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-white/10 rounded-full h-2.5 overflow-hidden">
        <div className="h-2.5 rounded-full transition-all duration-700"
          style={{ width: `${(value / 10) * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-bold text-white w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

function ComponentRow({ id, value }: { id: string; value: number }) {
  const meta = COMPONENT_META[id];
  const [showInfo, setShowInfo] = useState(false);
  if (!meta) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-white/80">{meta.label}</span>
        <span className="text-xs text-white/35 font-mono">×{meta.weight}%</span>
        <button onClick={() => setShowInfo(v => !v)} className="text-white/20 hover:text-gm-pink transition">
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>
      <ScoreBar value={value} color={meta.color} />
      {showInfo && (
        <p className="text-xs text-white/55 bg-white/5 border border-white/8 rounded-lg px-3 py-2 leading-relaxed">
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
      setLoading(true); setError(null); setData(null);
      try {
        const res = await fetch(`/api/spatial/score/${encodeURIComponent(geneSymbol)}`);
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${res.status}`); }
        if (!cancelled) setData(await res.json());
      } catch (err) { if (!cancelled) setError((err as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [geneSymbol]);

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-5 bg-white/10 rounded w-40" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-white/5 rounded-xl" /><div className="h-48 bg-white/5 rounded-xl" />
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-start gap-2 p-4 bg-red-950/40 border border-red-500/25 rounded-xl text-red-300 text-sm">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />Spatial scoring failed: {error}
    </div>
  );

  if (!data) return null;

  const radarData = [
    { subject: 'Conservation',  value: data.components.conservation,  fullMark: 10 },
    { subject: 'Accessibility', value: data.components.accessibility,  fullMark: 10 },
    { subject: 'Network Hub',   value: data.components.centrality,     fullMark: 10 },
    { subject: 'Hi-C Contacts', value: data.components.interactions,   fullMark: 10 },
    { subject: 'Expression',    value: data.components.expression,     fullMark: 10 },
  ];

  const scoreColor = data.total_score >= 7 ? 'text-emerald-400' : data.total_score >= 4 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Dna className="h-5 w-5 text-gm-pink" />
        <h3 className="text-base font-semibold text-white">Spatial Genome Score</h3>
        <span className="ml-auto text-xs text-white/35">Data confidence: {Math.round(data.confidence * 100)}%</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-gm-pink/20"
          style={{ background: 'linear-gradient(135deg, rgba(255,140,168,0.07), rgba(168,85,247,0.07))' }}>
          <div className={`text-5xl font-bold ${scoreColor}`}>{data.total_score.toFixed(1)}</div>
          <div className="text-sm text-white/40 mt-1">out of 10</div>
          <div className="mt-2 text-xs font-medium text-white/50 uppercase tracking-wider">Spatial Score</div>
          {data.druggability_score !== undefined && (
            <div className="mt-3 pt-3 border-t border-white/10 w-full text-center">
              <div className="text-2xl font-bold text-emerald-400">{data.druggability_score.toFixed(1)}</div>
              <div className="text-xs text-white/40">Druggability Score</div>
            </div>
          )}
          {data.data_sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1 justify-center">
              {data.data_sources.map(src => (
                <span key={src} className="px-1.5 py-0.5 text-xs bg-white/8 text-white/45 rounded border border-white/10">{src}</span>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03]">
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="rgba(255,255,255,0.12)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.55)' }} />
              <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickCount={3} />
              <Radar name={geneSymbol} dataKey="value" stroke="#FF8CA8" fill="#FF8CA8" fillOpacity={0.15} strokeWidth={2} />
              <Tooltip formatter={v => [`${Number(v ?? 0).toFixed(1)} / 10`, '']}
                contentStyle={{ fontSize: 12, borderRadius: 8, background: 'rgba(15,7,38,0.95)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5 space-y-4">
        <h4 className="text-sm font-semibold text-white/80">
          Score Components <span className="ml-2 font-normal text-white/30 text-xs">(click ⓘ for biological rationale)</span>
        </h4>
        {Object.entries(data.components).map(([id, value]) => <ComponentRow key={id} id={id} value={value} />)}
      </div>

      <div className="p-4 bg-white/[0.03] border border-white/8 rounded-xl text-xs text-white/45 leading-relaxed">
        <strong className="text-white/65">Score interpretation: </strong>
        The spatial score integrates five dimensions of 3D genome privilege. Genes scoring above 7 tend to be hubs in spatial
        interaction networks with strong evolutionary constraint — characteristics associated with druggable targets in published
        pharmacogenomics studies (Finan et al. 2017 Sci Transl Med). Scores below 4 may indicate spatially isolated or rapidly-evolving genes.
      </div>
    </div>
  );
}
