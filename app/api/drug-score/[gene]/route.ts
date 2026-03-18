// ============================================================
// GET /api/drug-score/:gene
// Returns drug target scoring for a gene.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { DrugTargetScorer } from '@/lib/algorithms/drug-target';
import { getGeneBySymbol } from '@/lib/database/queries';
import { fetchGeneInfo } from '@/lib/data-fetchers/ensembl';
import { GeneNotFoundError } from '@/lib/utils/errors';

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
    let ensemblId: string | null = null;

    try {
      const dbGene = await getGeneBySymbol(gene);
      ensemblId = dbGene?.ensembl_id ?? null;
    } catch {
      // DB unavailable, fall through
    }

    if (!ensemblId) {
      const ensemblGene = await fetchGeneInfo(gene);
      ensemblId = ensemblGene.id;
    }

    if (!ensemblId) {
      throw new GeneNotFoundError(gene);
    }

    const scorer = new DrugTargetScorer();
    const result = await scorer.scoreDrugTarget(gene, ensemblId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GeneNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error(`[GET /api/drug-score/${gene}] Error:`, error);
    return NextResponse.json({ error: 'Drug target scoring failed.' }, { status: 500 });
  }
}
