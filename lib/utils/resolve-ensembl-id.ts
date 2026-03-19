// ============================================================
// resolveEnsemblId — shared ENSEMBL ID lookup utility.
//
// Lookup order (fastest → slowest / most network-dependent):
//   1. Seed gene dictionary (50 known genes, always available)
//   2. PostgreSQL database (populated after db:seed)
//   3. ENSEMBL REST API live lookup (requires network)
//
// This ensures the app works for the 50 seed genes even when
// the ENSEMBL API is unreachable.
// ============================================================

import { getSeedGene } from '../seed/genes';
import { getGeneBySymbol } from '../database/queries';
import { fetchGeneInfo } from '../data-fetchers/ensembl';
import { GeneNotFoundError } from './errors';

/**
 * Resolve an ENSEMBL stable ID for a gene symbol.
 * Throws GeneNotFoundError if the gene cannot be found by any method.
 */
export async function resolveEnsemblId(geneSymbol: string): Promise<string> {
  const symbol = geneSymbol.toUpperCase().trim();

  // 1. Seed dictionary — instant, no network required
  const seedGene = getSeedGene(symbol);
  if (seedGene?.ensembl_id) {
    return seedGene.ensembl_id;
  }

  // 2. PostgreSQL — populated after `npm run db:seed`
  try {
    const dbGene = await getGeneBySymbol(symbol);
    if (dbGene?.ensembl_id) return dbGene.ensembl_id;
  } catch {
    // DB unavailable — fall through
  }

  // 3. ENSEMBL REST API — requires network access
  const ensemblGene = await fetchGeneInfo(symbol);
  if (!ensemblGene?.id) {
    throw new GeneNotFoundError(symbol);
  }
  return ensemblGene.id;
}
