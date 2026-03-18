// ============================================================
// GET /api/spatial/network/:gene
// Returns the spatial interaction network for a gene.
// Used by the D3.js network visualization component.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { SpatialGraphDB } from '@/lib/database/neo4j';
import { cacheGet, cacheSet, cacheKey } from '@/lib/database/redis';
import type { NetworkData } from '@/types';

export const dynamic = 'force-dynamic';

const CACHE_TTL = 3600;

export async function GET(
  _request: NextRequest,
  { params }: { params: { gene: string } }
) {
  const gene = params.gene.toUpperCase().trim();

  if (!gene || gene.length < 1) {
    return NextResponse.json({ error: 'Gene symbol is required.' }, { status: 400 });
  }

  const key = cacheKey('network', gene);
  const cached = await cacheGet<NetworkData>(key);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const graphDB = new SpatialGraphDB();
    const networkData = await graphDB.getGeneSpatialNetwork(gene);

    await cacheSet(key, networkData, CACHE_TTL);
    return NextResponse.json(networkData);
  } catch (error) {
    console.error(`[GET /api/spatial/network/${gene}] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to load spatial network. Is the gene symbol valid and in the database?' },
      { status: 500 }
    );
  }
}
