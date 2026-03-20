'use client';

// ============================================================
// GeneInfoPanel — compact gene metadata header.
// Shows chromosome locus, biotype, description, and external
// database links (ENSEMBL, UCSC Genome Browser, GeneCards).
// Fetches from local DB first; falls back to ENSEMBL API.
// ============================================================

import { useState, useEffect } from 'react';
import { ExternalLink, MapPin, Tag, Dna } from 'lucide-react';
import type { Gene } from '@/types';

interface Props {
  geneSymbol: string;
}

interface EnsemblInfo {
  symbol: string;
  ensembl_id: string;
  description: string | null;
  chromosome: string;
  start_pos: number;
  end_pos: number;
  strand: string;
  biotype: string;
  assembly: string;
}

// Biotype labels mapping ENSEMBL biotype IDs to human-readable strings
const BIOTYPE_LABELS: Record<string, string> = {
  protein_coding:              'Protein coding',
  lncRNA:                      'lncRNA',
  processed_pseudogene:        'Pseudogene',
  unprocessed_pseudogene:      'Pseudogene',
  miRNA:                       'miRNA',
  snRNA:                       'snRNA',
  snoRNA:                      'snoRNA',
  rRNA:                        'rRNA',
  TEC:                         'To be experimentally confirmed',
};

function formatPosition(chrom: string, start: number, end: number): string {
  const length = end - start;
  const kb = length >= 1000 ? `${(length / 1000).toFixed(0)} kb` : `${length} bp`;
  return `${chrom}:${start.toLocaleString()}–${end.toLocaleString()} (${kb})`;
}

function buildUCSCUrl(chrom: string, start: number, end: number): string {
  const padding = 5000;
  return (
    `https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38` +
    `&position=${chrom}%3A${start - padding}-${end + padding}`
  );
}

function buildEnsemblUrl(ensemblId: string): string {
  return `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${ensemblId}`;
}

function buildGeneCardsUrl(symbol: string): string {
  return `https://www.genecards.org/cgi-bin/carddisp.pl?gene=${symbol}`;
}

// Merge DB gene record with ENSEMBL info, preferring DB values where present
function mergeInfo(
  db: Gene | null,
  ensembl: EnsemblInfo | null
): {
  description: string | null;
  ensembl_id: string | null;
  chromosome: string | null;
  start_pos: number | null;
  end_pos: number | null;
  biotype: string | null;
  strand: string | null;
  assembly: string | null;
} {
  return {
    description: db?.description || ensembl?.description || null,
    ensembl_id: db?.ensembl_id || ensembl?.ensembl_id || null,
    chromosome: db?.chromosome || ensembl?.chromosome || null,
    start_pos: db?.start_pos ?? ensembl?.start_pos ?? null,
    end_pos: db?.end_pos ?? ensembl?.end_pos ?? null,
    biotype: db?.biotype || ensembl?.biotype || null,
    strand: ensembl?.strand ?? null,
    assembly: ensembl?.assembly ?? null,
  };
}

export function GeneInfoPanel({ geneSymbol }: Props) {
  const [dbGene, setDbGene] = useState<Gene | null>(null);
  const [ensemblInfo, setEnsemblInfo] = useState<EnsemblInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!geneSymbol) return;
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setDbGene(null);
      setEnsemblInfo(null);

      // Fetch local DB and ENSEMBL in parallel
      const [dbRes, ensemblRes] = await Promise.allSettled([
        fetch(`/api/genes/search?q=${encodeURIComponent(geneSymbol)}`).then(async (r) => {
          if (!r.ok) return null;
          const results: Gene[] = await r.json();
          return results.find((g) => g.symbol.toUpperCase() === geneSymbol.toUpperCase()) ?? null;
        }),
        fetch(`/api/genes/info/${encodeURIComponent(geneSymbol)}`).then(async (r) => {
          if (!r.ok) return null;
          return r.json() as Promise<EnsemblInfo>;
        }),
      ]);

      if (!cancelled) {
        if (dbRes.status === 'fulfilled' && dbRes.value) setDbGene(dbRes.value);
        if (ensemblRes.status === 'fulfilled' && ensemblRes.value) setEnsemblInfo(ensemblRes.value);
        setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [geneSymbol]);

  const info = mergeInfo(dbGene, ensemblInfo);

  if (loading) {
    return (
      <div className="animate-pulse flex gap-4 p-4 bg-white border border-gray-200 rounded-xl">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 bg-gray-100 rounded w-20" />
          <div className="h-6 bg-gray-100 rounded w-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="flex flex-wrap items-start gap-4">
        {/* Description + locus */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Gene symbol badge + description */}
          <div className="flex items-start gap-2">
            <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold font-mono">
              <Dna className="h-3 w-3" />
              {geneSymbol}
            </span>
            {info.description ? (
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                {info.description}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">
                No description available.
              </p>
            )}
          </div>

          {/* Locus row */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {info.chromosome && info.start_pos != null && info.end_pos != null && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-gray-400" />
                <span className="font-mono">
                  {formatPosition(info.chromosome, info.start_pos, info.end_pos)}
                </span>
                {info.strand && (
                  <span className="text-gray-400 font-mono">({info.strand})</span>
                )}
              </span>
            )}
            {info.biotype && (
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3 text-gray-400" />
                {BIOTYPE_LABELS[info.biotype] ?? info.biotype}
              </span>
            )}
            {info.ensembl_id && (
              <span className="flex items-center gap-1 font-mono text-gray-400">
                {info.ensembl_id}
              </span>
            )}
            {info.assembly && (
              <span className="text-gray-300">{info.assembly}</span>
            )}
          </div>
        </div>

        {/* External links */}
        <div className="flex gap-2 shrink-0 flex-wrap">
          {info.ensembl_id && (
            <a
              href={buildEnsemblUrl(info.ensembl_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700
                         border border-green-200 rounded-lg hover:bg-green-100 transition"
            >
              ENSEMBL <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {info.chromosome && info.start_pos != null && info.end_pos != null && (
            <a
              href={buildUCSCUrl(info.chromosome, info.start_pos, info.end_pos)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700
                         border border-blue-200 rounded-lg hover:bg-blue-100 transition"
            >
              UCSC <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <a
            href={buildGeneCardsUrl(geneSymbol)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 text-purple-700
                       border border-purple-200 rounded-lg hover:bg-purple-100 transition"
          >
            GeneCards <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
