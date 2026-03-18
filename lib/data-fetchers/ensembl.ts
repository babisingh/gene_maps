// ============================================================
// ENSEMBL REST API data fetcher.
// Docs: https://rest.ensembl.org
//
// Used for:
//   - Gene lookup (symbol → ENSEMBL ID, coordinates, biotype)
//   - Ortholog retrieval (cross-species homologs)
//   - Sequence features
//
// Rate limit: 15 requests/second (free public API).
// We apply a conservative 60 req/min limit to stay well under.
// ============================================================

import { ExternalAPIError } from '../utils/errors';
import { acquireToken } from '../utils/rate-limit';
import type { EnsemblGene, EnsemblOrtholog } from '../../types';

const BASE = process.env.ENSEMBL_API_BASE ?? 'https://rest.ensembl.org';
const RATE_LIMIT_RPM = parseInt(process.env.ENSEMBL_RATE_LIMIT_PER_MIN ?? '60', 10);
const TIMEOUT_MS = parseInt(process.env.EXTERNAL_API_TIMEOUT_MS ?? '10000', 10);

async function ensemblFetch<T>(path: string): Promise<T> {
  await acquireToken('ensembl', RATE_LIMIT_RPM);

  const url = `${BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    clearTimeout(timer);
    throw new ExternalAPIError(
      'ENSEMBL',
      url,
      undefined,
      `Network error: ${(err as Error).message}`
    );
  }
  clearTimeout(timer);

  if (!res.ok) {
    throw new ExternalAPIError('ENSEMBL', url, res.status, `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ── Public functions ──────────────────────────────────────────

/**
 * Fetch gene metadata by gene symbol for a given species.
 * Throws ExternalAPIError if the gene is not found or API is unavailable.
 */
export async function fetchGeneInfo(
  geneSymbol: string,
  species = 'homo_sapiens'
): Promise<EnsemblGene> {
  const data = await ensemblFetch<EnsemblGene>(
    `/lookup/symbol/${species}/${geneSymbol}?expand=0`
  );
  if (!data || !data.id) {
    throw new ExternalAPIError(
      'ENSEMBL',
      `/lookup/symbol/${species}/${geneSymbol}`,
      404,
      `Gene '${geneSymbol}' not found in ENSEMBL for species '${species}'`
    );
  }
  return data;
}

/**
 * Fetch ortholog data for an ENSEMBL gene ID.
 * Returns cross-species homologs with percent identity.
 */
export async function fetchOrthologData(
  ensemblId: string,
  targetSpecies?: string
): Promise<EnsemblOrtholog[]> {
  const speciesParam = targetSpecies ? `&target_species=${targetSpecies}` : '';
  const data = await ensemblFetch<{ data: Array<{ homologies: EnsemblOrtholog[] }> }>(
    `/homology/id/${ensemblId}?content-type=application/json&type=orthologues${speciesParam}`
  );

  if (!data?.data?.[0]?.homologies) {
    return [];
  }

  return data.data[0].homologies;
}

/**
 * Fetch orthologs for a specific set of species.
 * Used during conservation analysis to get targeted data.
 */
export async function fetchOrthologsForSpecies(
  ensemblId: string,
  species: string[]
): Promise<EnsemblOrtholog[]> {
  const all: EnsemblOrtholog[] = [];
  for (const sp of species) {
    try {
      const orthologs = await fetchOrthologData(ensemblId, sp);
      all.push(...orthologs);
    } catch {
      // Log but don't fail for individual species
      console.warn(`[ensembl] Could not fetch ortholog for ${ensemblId} in ${sp}`);
    }
  }
  return all;
}

/**
 * Fetch sequence features / regulatory regions for a genomic interval.
 * Used to estimate chromatin accessibility score.
 */
export async function fetchRegulatoryFeatures(
  chromosome: string,
  start: number,
  end: number,
  species = 'homo_sapiens'
): Promise<{ feature_type: string; start: number; end: number; score?: number }[]> {
  try {
    const data = await ensemblFetch<{ features: { feature_type: string; start: number; end: number; score?: number }[] }>(
      `/overlap/region/${species}/${chromosome}:${start}-${end}?feature=regulatory`
    );
    return data?.features ?? [];
  } catch {
    return [];
  }
}

/**
 * Batch lookup multiple genes. Returns a map of symbol → EnsemblGene.
 * Genes that fail lookup are omitted (logged as warnings).
 */
export async function batchFetchGenes(
  symbols: string[],
  species = 'homo_sapiens'
): Promise<Map<string, EnsemblGene>> {
  const results = new Map<string, EnsemblGene>();

  for (const symbol of symbols) {
    try {
      const gene = await fetchGeneInfo(symbol, species);
      results.set(symbol, gene);
    } catch (err) {
      console.warn(`[ensembl] Skipping ${symbol}: ${(err as Error).message}`);
    }
  }

  return results;
}
