// ============================================================
// GET /api/drug-score/:gene
// Returns drug target scoring for a gene.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { DrugTargetScorer } from '@/lib/algorithms/drug-target';
import { resolveEnsemblId } from '@/lib/utils/resolve-ensembl-id';
import { GeneNotFoundError, ExternalAPIError } from '@/lib/utils/errors';

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
    const ensemblId = await resolveEnsemblId(gene);

    const scorer = new DrugTargetScorer();
    const result = await scorer.scoreDrugTarget(gene, ensemblId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GeneNotFoundError) {
      return NextResponse.json(
        { error: `Gene '${gene}' not found. Use an official HGNC symbol (e.g. GCG, BRCA1, TP53).` },
        { status: 404 }
      );
    }
    if (error instanceof ExternalAPIError && error.statusCode === 404) {
      return NextResponse.json(
        { error: `Gene '${gene}' not found in ENSEMBL. Check the spelling.` },
        { status: 404 }
      );
    }
    console.error(`[GET /api/drug-score/${gene}] Error:`, error);
    return NextResponse.json({ error: 'Drug target scoring failed.' }, { status: 500 });
  }
}
