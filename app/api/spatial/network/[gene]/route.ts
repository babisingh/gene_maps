// ============================================================
// GET /api/spatial/network/:gene
// Returns the spatial interaction network for a gene.
// Used by the D3.js network visualization component.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { SpatialGraphDB } from '@/lib/database/neo4j';
import { cacheGet, cacheSet, cacheKey } from '@/lib/database/redis';
import { SEED_INTERACTIONS } from '@/lib/seed/interactions';
import type { NetworkData, NetworkNode, NetworkLink } from '@/types';

export const dynamic = 'force-dynamic';

const CACHE_TTL = 3600;

/**
 * Builds a NetworkData from pre-computed seed interactions when Neo4j is
 * unavailable. Returns null when the gene has no seed entries.
 */
function buildSeedNetwork(gene: string): NetworkData | null {
  const relevant = SEED_INTERACTIONS.filter(
    (i) => i.source_gene === gene || i.target_gene === gene
  );
  if (relevant.length === 0) return null;

  const nodesMap = new Map<string, NetworkNode>();
  nodesMap.set(gene, { id: gene, group: 1, score: 0.7 });

  const links: NetworkLink[] = [];

  for (const interaction of relevant) {
    const neighbor =
      interaction.source_gene === gene ? interaction.target_gene : interaction.source_gene;

    if (!nodesMap.has(neighbor)) {
      nodesMap.set(neighbor, {
        id: neighbor,
        group: 2,
        score: Math.min(1, interaction.confidence * 0.85),
      });
    }

    links.push({
      source: gene,
      target: neighbor,
      value: interaction.hic_frequency,
      confidence: interaction.confidence,
      distance_3d: interaction.distance_3d,
    });
  }

  return { nodes: Array.from(nodesMap.values()), links };
}

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

  // Try Neo4j first; fall back to seed data if the database is unavailable.
  try {
    const graphDB = new SpatialGraphDB();
    const networkData = await graphDB.getGeneSpatialNetwork(gene);
    await cacheSet(key, networkData, CACHE_TTL);
    return NextResponse.json(networkData);
  } catch (dbError) {
    console.warn(`[GET /api/spatial/network/${gene}] Neo4j unavailable, trying seed data:`, dbError);
  }

  const seedNetwork = buildSeedNetwork(gene);
  if (seedNetwork) {
    return NextResponse.json(seedNetwork, {
      headers: { 'X-Data-Source': 'seed' },
    });
  }

  return NextResponse.json(
    { error: `No network data found for gene "${gene}". Check the gene symbol or seed the database.` },
    { status: 404 }
  );
}
