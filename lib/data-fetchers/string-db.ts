// ============================================================
// STRING Database API fetcher.
// Docs: https://string-db.org/help/api/
//
// Used for:
//   - Protein-protein interaction networks
//   - Functional enrichment context
//   - Network centrality estimation
// ============================================================

import { ExternalAPIError } from '../utils/errors';
import { acquireToken } from '../utils/rate-limit';

const BASE = process.env.STRING_API_BASE ?? 'https://string-db.org/api';
const RATE_LIMIT_RPM = parseInt(process.env.STRING_RATE_LIMIT_PER_MIN ?? '60', 10);
const TIMEOUT_MS = parseInt(process.env.EXTERNAL_API_TIMEOUT_MS ?? '10000', 10);
const HUMAN_TAXON = 9606;

interface STRINGInteraction {
  stringId_A: string;
  stringId_B: string;
  preferredName_A: string;
  preferredName_B: string;
  score: number;
  nscore: number;  // neighborhood score
  fscore: number;  // fusion score
  pscore: number;  // phylogenetic profile
  ascore: number;  // coexpression score
  escore: number;  // experimental score
  dscore: number;  // database score
  tscore: number;  // text-mining score
}

async function stringFetch<T>(path: string, params: URLSearchParams): Promise<T> {
  await acquireToken('string', RATE_LIMIT_RPM);

  const url = `${BASE}/${path}?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    clearTimeout(timer);
    throw new ExternalAPIError('STRING', url, undefined, `Network error: ${(err as Error).message}`);
  }
  clearTimeout(timer);

  if (!res.ok) {
    throw new ExternalAPIError('STRING', url, res.status, `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Public functions ──────────────────────────────────────────

/**
 * Fetch protein interactions for a gene from STRING DB.
 * Returns interactions above a confidence threshold (default: 700/1000).
 */
export async function fetchProteinInteractions(
  geneSymbol: string,
  confidenceThreshold = 700,
  limit = 20
): Promise<STRINGInteraction[]> {
  try {
    const params = new URLSearchParams({
      identifiers: geneSymbol,
      species: String(HUMAN_TAXON),
      limit: String(limit),
      required_score: String(confidenceThreshold),
      caller_identity: 'gene_maps_research_tool',
    });

    return await stringFetch<STRINGInteraction[]>('json/interaction_partners', params);
  } catch (err) {
    console.warn(`[string] Could not fetch interactions for ${geneSymbol}: ${(err as Error).message}`);
    return [];
  }
}

/**
 * Get network centrality estimate for a gene.
 * Approximated as the number of high-confidence interactions (degree centrality).
 * Returns 0–10 scaled score.
 */
export async function fetchNetworkCentralityScore(geneSymbol: string): Promise<number> {
  const interactions = await fetchProteinInteractions(geneSymbol, 700, 50);

  // Degree centrality: more interactions = more central
  // Normalize against a typical highly-connected hub (TP53 has ~100+)
  const degree = interactions.length;
  const maxExpected = 50;
  const raw = Math.min(degree / maxExpected, 1);

  // Also factor in average confidence
  const avgConfidence =
    interactions.length > 0
      ? interactions.reduce((sum, i) => sum + i.score, 0) / interactions.length / 1000
      : 0;

  return Math.min(10, Math.max(0, (raw * 0.6 + avgConfidence * 0.4) * 10));
}

/**
 * Get functional neighbors that STRING predicts as interacting partners.
 * Used for spatial interaction network fallback when Hi-C data is unavailable.
 */
export async function fetchFunctionalNeighbors(
  geneSymbol: string
): Promise<{ gene: string; score: number }[]> {
  const interactions = await fetchProteinInteractions(geneSymbol, 400, 20);
  return interactions.map((i) => ({
    gene: i.preferredName_B ?? i.stringId_B,
    score: i.score / 1000,
  }));
}
