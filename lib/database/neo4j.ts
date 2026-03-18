// ============================================================
// Neo4j AuraDB — Graph database connection and query helpers.
// Uses the official neo4j-driver package.
//
// Connection: Singleton driver (re-used across serverless invocations).
// IMPORTANT: AuraDB URI must use neo4j+s:// scheme (TLS required).
// ============================================================

import neo4j, { Driver, Session } from 'neo4j-driver';
import { DatabaseConnectionError } from '../utils/errors';
import type {
  Gene,
  NetworkData,
  NetworkNode,
  NetworkLink,
  SpatialInteraction,
} from '../../types';

// Singleton driver — instantiated once per process.
let _driver: Driver | null = null;

function getDriver(): Driver {
  if (_driver) return _driver;

  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !user || !password) {
    throw new DatabaseConnectionError(
      'neo4j',
      'Missing NEO4J_URI, NEO4J_USER, or NEO4J_PASSWORD environment variables. ' +
        'See .env.example for setup instructions.'
    );
  }

  _driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    maxConnectionPoolSize: 10,
    connectionAcquisitionTimeout: 10_000,
  });

  return _driver;
}

/** Verify the connection is alive. Throws DatabaseConnectionError on failure. */
export async function verifyNeo4jConnection(): Promise<void> {
  try {
    const driver = getDriver();
    await driver.verifyConnectivity();
  } catch (err) {
    throw new DatabaseConnectionError(
      'neo4j',
      `Neo4j connectivity check failed: ${(err as Error).message}`
    );
  }
}

// ── Graph Operations ─────────────────────────────────────────

export class SpatialGraphDB {
  private session(): Session {
    return getDriver().session();
  }

  // ── Schema Initialization ───────────────────────────────

  async initializeSchema(): Promise<void> {
    const session = this.session();
    try {
      // Constraints ensure uniqueness and create indexes
      await session.run(
        'CREATE CONSTRAINT gene_symbol_unique IF NOT EXISTS FOR (g:Gene) REQUIRE g.symbol IS UNIQUE'
      );
      await session.run(
        'CREATE CONSTRAINT species_taxon_unique IF NOT EXISTS FOR (s:Species) REQUIRE s.taxon_id IS UNIQUE'
      );
    } finally {
      await session.close();
    }
  }

  // ── Gene CRUD ───────────────────────────────────────────

  async upsertGene(gene: Partial<Gene> & { symbol: string }): Promise<void> {
    const session = this.session();
    try {
      await session.run(
        `MERGE (g:Gene {symbol: $symbol})
         SET g.ensembl_id = $ensembl_id,
             g.chromosome = $chromosome,
             g.start = $start_pos,
             g.end = $end_pos,
             g.description = $description,
             g.spatial_score = $spatial_score,
             g.druggability_score = $druggability_score`,
        {
          symbol: gene.symbol,
          ensembl_id: gene.ensembl_id ?? '',
          chromosome: gene.chromosome ?? '',
          start_pos: neo4j.int(gene.start_pos ?? 0),
          end_pos: neo4j.int(gene.end_pos ?? 0),
          description: gene.description ?? '',
          spatial_score: gene.spatial_score ?? 0,
          druggability_score: gene.druggability_score ?? 0,
        }
      );
    } finally {
      await session.close();
    }
  }

  async upsertSpecies(
    taxon_id: number,
    name: string,
    common_name: string
  ): Promise<void> {
    const session = this.session();
    try {
      await session.run(
        `MERGE (s:Species {taxon_id: $taxon_id})
         SET s.name = $name, s.common_name = $common_name`,
        { taxon_id: neo4j.int(taxon_id), name, common_name }
      );
    } finally {
      await session.close();
    }
  }

  async upsertConservation(
    geneSymbol: string,
    taxon_id: number,
    conservation_score: number,
    ortholog_id: string,
    synteny_block: string
  ): Promise<void> {
    const session = this.session();
    try {
      await session.run(
        `MATCH (g:Gene {symbol: $geneSymbol})
         MATCH (s:Species {taxon_id: $taxon_id})
         MERGE (g)-[r:CONSERVED_IN]->(s)
         SET r.conservation_score = $conservation_score,
             r.ortholog_id = $ortholog_id,
             r.synteny_block = $synteny_block`,
        {
          geneSymbol,
          taxon_id: neo4j.int(taxon_id),
          conservation_score,
          ortholog_id,
          synteny_block,
        }
      );
    } finally {
      await session.close();
    }
  }

  async upsertInteraction(interaction: SpatialInteraction): Promise<void> {
    const session = this.session();
    try {
      await session.run(
        `MATCH (g1:Gene {symbol: $source}), (g2:Gene {symbol: $target})
         MERGE (g1)-[r:INTERACTS_WITH]-(g2)
         SET r.hic_frequency = $hic_frequency,
             r.distance_3d = $distance_3d,
             r.confidence = $confidence`,
        {
          source: interaction.source_gene,
          target: interaction.target_gene,
          hic_frequency: interaction.hic_frequency,
          distance_3d: interaction.distance_3d,
          confidence: interaction.confidence,
        }
      );
    } finally {
      await session.close();
    }
  }

  // ── Queries ─────────────────────────────────────────────

  /**
   * Returns the spatial interaction network for a gene:
   * the gene itself plus its top spatial neighbors and their links.
   */
  async getGeneSpatialNetwork(geneSymbol: string): Promise<NetworkData> {
    const session = this.session();
    try {
      const result = await session.run(
        `MATCH (g:Gene {symbol: $geneSymbol})-[r:INTERACTS_WITH]-(neighbor:Gene)
         RETURN
           g.symbol AS center_symbol,
           g.spatial_score AS center_score,
           neighbor.symbol AS neighbor_symbol,
           neighbor.spatial_score AS neighbor_score,
           r.hic_frequency AS hic_frequency,
           r.confidence AS confidence
         ORDER BY r.hic_frequency DESC
         LIMIT 20`,
        { geneSymbol }
      );

      if (result.records.length === 0) {
        // Return isolated node if no interactions found
        return {
          nodes: [{ id: geneSymbol, group: 1, score: 0.5 }],
          links: [],
        };
      }

      const centerScore =
        result.records[0].get('center_score') ?? 0.5;

      const nodesMap = new Map<string, NetworkNode>();
      nodesMap.set(geneSymbol, {
        id: geneSymbol,
        group: 1,
        score: normalizeScore(centerScore),
      });

      const links: NetworkLink[] = [];

      for (const record of result.records) {
        const neighborSymbol: string = record.get('neighbor_symbol');
        const neighborScore: number = record.get('neighbor_score') ?? 0.3;
        const hicFreq: number = record.get('hic_frequency') ?? 1;
        const confidence: number = record.get('confidence') ?? 0.5;

        if (!nodesMap.has(neighborSymbol)) {
          nodesMap.set(neighborSymbol, {
            id: neighborSymbol,
            group: 2,
            score: normalizeScore(neighborScore),
          });
        }

        links.push({
          source: geneSymbol,
          target: neighborSymbol,
          value: hicFreq,
          confidence,
        });
      }

      return { nodes: Array.from(nodesMap.values()), links };
    } finally {
      await session.close();
    }
  }

  /** Search genes by symbol prefix — used by the search endpoint. */
  async searchGenes(query: string, limit = 10): Promise<{ symbol: string; description: string }[]> {
    const session = this.session();
    try {
      const result = await session.run(
        `MATCH (g:Gene)
         WHERE g.symbol STARTS WITH $prefix OR g.symbol CONTAINS $query
         RETURN g.symbol AS symbol, g.description AS description
         ORDER BY
           CASE WHEN g.symbol STARTS WITH $prefix THEN 0 ELSE 1 END,
           g.symbol
         LIMIT $limit`,
        { prefix: query.toUpperCase(), query: query.toUpperCase(), limit: neo4j.int(limit) }
      );
      return result.records.map((r) => ({
        symbol: r.get('symbol'),
        description: r.get('description') ?? '',
      }));
    } finally {
      await session.close();
    }
  }

  /** Fetch spatial neighbors ranked by Hi-C frequency. */
  async getTopSpatialNeighbors(
    geneSymbol: string,
    limit = 20
  ): Promise<{ gene: string; interaction_strength: number; confidence: number }[]> {
    const session = this.session();
    try {
      const result = await session.run(
        `MATCH (g:Gene {symbol: $geneSymbol})-[r:INTERACTS_WITH]-(neighbor:Gene)
         RETURN neighbor.symbol AS gene, r.hic_frequency AS interaction_strength, r.confidence AS confidence
         ORDER BY r.hic_frequency DESC
         LIMIT $limit`,
        { geneSymbol, limit: neo4j.int(limit) }
      );
      return result.records.map((r) => ({
        gene: r.get('gene'),
        interaction_strength: r.get('interaction_strength'),
        confidence: r.get('confidence'),
      }));
    } finally {
      await session.close();
    }
  }

  /** Get gene node with all stored properties. */
  async getGene(geneSymbol: string): Promise<Gene | null> {
    const session = this.session();
    try {
      const result = await session.run(
        `MATCH (g:Gene {symbol: $geneSymbol}) RETURN g`,
        { geneSymbol }
      );
      if (result.records.length === 0) return null;
      const props = result.records[0].get('g').properties;
      return {
        symbol: props.symbol,
        ensembl_id: props.ensembl_id,
        chromosome: props.chromosome,
        start_pos: props.start?.toNumber() ?? 0,
        end_pos: props.end?.toNumber() ?? 0,
        description: props.description,
        spatial_score: props.spatial_score,
        druggability_score: props.druggability_score,
      };
    } finally {
      await session.close();
    }
  }

  /** Close the driver — call during graceful shutdown. */
  async close(): Promise<void> {
    if (_driver) {
      await _driver.close();
      _driver = null;
    }
  }
}

function normalizeScore(score: number | null | undefined): number {
  if (score == null) return 0.5;
  return Math.min(1, Math.max(0, score / 10));
}
