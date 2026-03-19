// ============================================================
// GET /api/spatial/score/:gene
// Returns the full spatial score breakdown for a gene.
// Includes all 5 weighted components + druggability score.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { SpatialScoringEngine } from '@/lib/algorithms/spatial-scoring';
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

    const engine = new SpatialScoringEngine();
    const [spatialScore, druggabilityScore] = await Promise.all([
      engine.calculateSpatialScore(gene, ensemblId),
      engine.calculateDruggabilityScore(gene, ensemblId),
    ]);

    return NextResponse.json({
      ...spatialScore,
      druggability_score: druggabilityScore,
    });
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
    console.error(`[GET /api/spatial/score/${gene}] Error:`, error);
    return NextResponse.json({ error: 'Spatial scoring failed.' }, { status: 500 });
  }
}
