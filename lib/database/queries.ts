// ============================================================
// PostgreSQL query helpers — typed wrappers around raw SQL.
// ============================================================

import { query, transaction } from './postgres';
import type { Gene, SpeciesConservation, CRISPRSafetyData } from '../../types';
import { PoolClient } from 'pg';

// ── Gene Queries ─────────────────────────────────────────────

export async function searchGenes(searchTerm: string, limit = 10): Promise<Gene[]> {
  const pattern = `%${searchTerm.toUpperCase()}%`;
  return query<Gene>(
    `SELECT id, symbol, ensembl_id, chromosome, start_pos, end_pos,
            description, spatial_score, druggability_score, conservation_avg
     FROM genes
     WHERE UPPER(symbol) LIKE $1 OR UPPER(description) LIKE $1
     ORDER BY
       CASE WHEN UPPER(symbol) LIKE $2 THEN 0 ELSE 1 END,
       symbol
     LIMIT $3`,
    [pattern, `${searchTerm.toUpperCase()}%`, limit]
  );
}

export async function getGeneBySymbol(symbol: string): Promise<Gene | null> {
  const rows = await query<Gene>(
    `SELECT * FROM genes WHERE symbol = $1`,
    [symbol.toUpperCase()]
  );
  return rows[0] ?? null;
}

export async function getGeneById(id: number): Promise<Gene | null> {
  const rows = await query<Gene>(`SELECT * FROM genes WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function upsertGene(gene: Partial<Gene> & { symbol: string }): Promise<number> {
  const rows = await query<{ id: number }>(
    `INSERT INTO genes (symbol, ensembl_id, chromosome, start_pos, end_pos,
                        description, biotype, spatial_score, druggability_score, conservation_avg)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (symbol) DO UPDATE SET
       ensembl_id        = EXCLUDED.ensembl_id,
       chromosome        = EXCLUDED.chromosome,
       start_pos         = EXCLUDED.start_pos,
       end_pos           = EXCLUDED.end_pos,
       description       = EXCLUDED.description,
       biotype           = EXCLUDED.biotype,
       spatial_score     = EXCLUDED.spatial_score,
       druggability_score = EXCLUDED.druggability_score,
       conservation_avg  = EXCLUDED.conservation_avg,
       updated_at        = CURRENT_TIMESTAMP
     RETURNING id`,
    [
      gene.symbol.toUpperCase(),
      gene.ensembl_id ?? null,
      gene.chromosome ?? null,
      gene.start_pos ?? null,
      gene.end_pos ?? null,
      gene.description ?? null,
      gene.biotype ?? null,
      gene.spatial_score ?? null,
      gene.druggability_score ?? null,
      gene.conservation_avg ?? null,
    ]
  );
  return rows[0].id;
}

// ── Conservation Queries ──────────────────────────────────────

export async function getConservationForGene(geneId: number): Promise<SpeciesConservation[]> {
  return query<SpeciesConservation>(
    `SELECT species AS name, common_name, taxon_id, conservation_score,
            synteny_block, ortholog_id, ortholog_symbol
     FROM conservation
     WHERE gene_id = $1
     ORDER BY conservation_score DESC`,
    [geneId]
  );
}

export async function upsertConservation(
  geneId: number,
  data: Omit<SpeciesConservation, 'conservation_score'> & { conservation_score: number }
): Promise<void> {
  await query(
    `INSERT INTO conservation (gene_id, species, common_name, taxon_id,
                               conservation_score, synteny_block, ortholog_id, ortholog_symbol)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT DO NOTHING`,
    [
      geneId,
      data.name,
      data.common_name,
      data.taxon_id,
      data.conservation_score,
      data.synteny_block ?? null,
      data.ortholog_id,
      data.ortholog_symbol,
    ]
  );
}

// ── CRISPR Safety Queries ─────────────────────────────────────

export async function saveCRISPRAssessment(
  geneId: number,
  assessment: Pick<CRISPRSafetyData, 'edit_position' | 'tad_disruption_risk' | 'off_target_risk' | 'safety_score' | 'recommendations'>
): Promise<void> {
  await query(
    `INSERT INTO crispr_safety (gene_id, edit_position, tad_disruption_risk, off_target_risk, safety_score, recommendations)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      geneId,
      assessment.edit_position,
      assessment.tad_disruption_risk,
      assessment.off_target_risk,
      assessment.safety_score,
      assessment.recommendations.join('\n'),
    ]
  );
}

// ── Cache Queries (DB-backed fallback) ────────────────────────

export async function dbCacheGet<T>(queryHash: string): Promise<T | null> {
  const rows = await query<{ result_data: T }>(
    `SELECT result_data FROM analysis_cache
     WHERE query_hash = $1 AND expires_at > CURRENT_TIMESTAMP`,
    [queryHash]
  );
  return rows[0]?.result_data ?? null;
}

export async function dbCacheSet(
  queryHash: string,
  data: unknown,
  ttlSeconds: number
): Promise<void> {
  await query(
    `INSERT INTO analysis_cache (query_hash, result_data, expires_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP + $3 * INTERVAL '1 second')
     ON CONFLICT (query_hash) DO UPDATE SET
       result_data = EXCLUDED.result_data,
       expires_at  = EXCLUDED.expires_at,
       created_at  = CURRENT_TIMESTAMP`,
    [queryHash, JSON.stringify(data), ttlSeconds]
  );
}

/** Purge expired cache rows — run periodically. */
export async function purgeExpiredCache(): Promise<void> {
  await query(`DELETE FROM analysis_cache WHERE expires_at <= CURRENT_TIMESTAMP`);
}
