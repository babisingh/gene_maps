// ============================================================
// GET /api/conservation/:gene
// Returns cross-species conservation analysis for a gene.
// Fetches real ortholog data from ENSEMBL.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { ConservationAnalyzer } from '@/lib/algorithms/conservation';
import { getGeneBySymbol } from '@/lib/database/queries';
import { fetchGeneInfo } from '@/lib/data-fetchers/ensembl';
import { GeneNotFoundError } from '@/lib/utils/errors';
import type { ConservationData } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { gene: string } }
) {
  const gene = params.gene.toUpperCase().trim();

  if (!gene) {
    return NextResponse.json({ error: 'Gene symbol is required.' }, { status: 400 });
  }

  try {
    // Get ENSEMBL ID — check DB first, then live API
    let ensemblId: string | null = null;

    try {
      const dbGene = await getGeneBySymbol(gene);
      ensemblId = dbGene?.ensembl_id ?? null;
    } catch {
      // PostgreSQL not available, fall through to ENSEMBL
    }

    if (!ensemblId) {
      const ensemblGene = await fetchGeneInfo(gene);
      ensemblId = ensemblGene.id;
    }

    if (!ensemblId) {
      throw new GeneNotFoundError(gene);
    }

    const analyzer = new ConservationAnalyzer();
    const conservationData: ConservationData = await analyzer.analyzeGeneConservation(gene, ensemblId);

    return NextResponse.json(conservationData);
  } catch (error) {
    if (error instanceof GeneNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error(`[GET /api/conservation/${gene}] Error:`, error);
    return NextResponse.json(
      { error: 'Conservation analysis failed. The gene may not be in our database.' },
      { status: 500 }
    );
  }
}
