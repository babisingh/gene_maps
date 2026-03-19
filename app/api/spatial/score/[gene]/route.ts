// ============================================================
// GET /api/spatial/score/:gene
// Returns the full spatial score breakdown for a gene.
// Includes all 5 weighted components + druggability score.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { SpatialScoringEngine } from '@/lib/algorithms/spatial-scoring';
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
    // Resolve ENSEMBL ID (DB first, then live API as fallback)
    let ensemblId: string | null = null;

    try {
      const dbGene = await getGeneBySymbol(gene);
      ensemblId = dbGene?.ensembl_id ?? null;
    } catch {
      // DB unavailable — fall through to live API
    }

    if (!ensemblId) {
      const ensemblGene = await fetchGeneInfo(gene);
      ensemblId = ensemblGene.id;
    }

    if (!ensemblId) {
      throw new GeneNotFoundError(gene);
    }

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
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error(`[GET /api/spatial/score/${gene}] Error:`, error);
    return NextResponse.json({ error: 'Spatial scoring failed.' }, { status: 500 });
  }
}
