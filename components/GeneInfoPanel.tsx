'use client';

// ============================================================
// GeneInfoPanel — compact gene metadata header.
// Shows chromosome locus, biotype, description, and external
// database links (ENSEMBL, UCSC Genome Browser, GeneCards).
// ============================================================

import { useState, useEffect } from 'react';
import { ExternalLink, MapPin, Tag } from 'lucide-react';
import type { Gene } from '@/types';

interface Props {
  geneSymbol: string;
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

export function GeneInfoPanel({ geneSymbol }: Props) {
  const [gene, setGene] = useState<Gene | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!geneSymbol) return;
    let cancelled = false;

    const fetchGene = async () => {
      setLoading(true);
      setGene(null);
      try {
        // Try the PostgreSQL gene endpoint first
        const res = await fetch(`/api/genes/search?q=${encodeURIComponent(geneSymbol)}`);
        if (res.ok) {
          const results: Gene[] = await res.json();
          const match = results.find(
            (g) => g.symbol.toUpperCase() === geneSymbol.toUpperCase()
          );
          if (match && !cancelled) setGene(match);
        }
      } catch {
        // Non-critical — panel degrades gracefully if gene metadata is missing
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchGene();
    return () => { cancelled = true; };
  }, [geneSymbol]);

  if (loading) {
    return (
      <div className="animate-pulse flex gap-4 p-4 bg-white border border-gray-200 rounded-xl">
        <div className="h-4 bg-gray-200 rounded w-64" />
        <div className="h-4 bg-gray-100 rounded w-48" />
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="flex flex-wrap items-start gap-4">
        {/* Description */}
        <div className="flex-1 min-w-0">
          {gene?.description ? (
            <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
              {gene.description}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">
              Description loading… (will appear after database is seeded)
            </p>
          )}

          {/* Locus + biotype */}
          {gene?.chromosome && gene.start_pos && gene.end_pos && (
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-gray-400" />
                <span className="font-mono">
                  {formatPosition(gene.chromosome, gene.start_pos, gene.end_pos)}
                </span>
              </span>
              {gene.biotype && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3 text-gray-400" />
                  {BIOTYPE_LABELS[gene.biotype] ?? gene.biotype}
                </span>
              )}
            </div>
          )}
        </div>

        {/* External links */}
        <div className="flex gap-2 shrink-0 flex-wrap">
          {gene?.ensembl_id && (
            <a
              href={buildEnsemblUrl(gene.ensembl_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700
                         border border-green-200 rounded-lg hover:bg-green-100 transition"
            >
              ENSEMBL <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {gene?.chromosome && gene.start_pos && gene.end_pos && (
            <a
              href={buildUCSCUrl(gene.chromosome, gene.start_pos, gene.end_pos)}
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
