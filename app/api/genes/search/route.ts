// ============================================================
// GET /api/genes/search?q=<query>
// Search for genes by symbol or description.
// Returns up to 10 matching genes for the autocomplete UI.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { searchGenes } from '@/lib/database/queries';
import { SpatialGraphDB } from '@/lib/database/neo4j';
import { cacheGet, cacheSet, cacheKey } from '@/lib/database/redis';

export const dynamic = 'force-dynamic';

const CACHE_TTL = parseInt(process.env.CACHE_TTL_GENE_SEARCH ?? '600', 10);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  // Check cache first
  const key = cacheKey('gene_search', q.toUpperCase());
  const cached = await cacheGet<ReturnType<typeof searchGenes>>(key);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // Try PostgreSQL first (richer metadata), fall back to Neo4j
    let genes: { symbol: string; description: string }[] = [];

    try {
      genes = await searchGenes(q, 10);
    } catch {
      // Fallback to Neo4j if PostgreSQL is unavailable
      const graphDB = new SpatialGraphDB();
      genes = await graphDB.searchGenes(q, 10);
    }

    await cacheSet(key, genes, CACHE_TTL);
    return NextResponse.json(genes);
  } catch (error) {
    console.error('[GET /api/genes/search] Error:', error);
    return NextResponse.json(
      { error: 'Gene search failed. Please try again.' },
      { status: 500 }
    );
  }
}
