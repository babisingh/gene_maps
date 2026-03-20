// ============================================================
// GTEx Portal API fetcher.
// Docs: https://gtexportal.org/api/v2/api-docs
//
// Used for:
//   - Tissue-specific gene expression (median TPM per tissue)
//   - Expression specificity score (Tau index)
//   - Expression breadth (number of tissues expressed in)
// ============================================================

import { ExternalAPIError } from '../utils/errors';
import { acquireToken } from '../utils/rate-limit';

const BASE = process.env.GTEX_API_BASE ?? 'https://gtexportal.org/api/v2';
const RATE_LIMIT_RPM = 60;
const TIMEOUT_MS = parseInt(process.env.EXTERNAL_API_TIMEOUT_MS ?? '10000', 10);

interface GTExExpressionResult {
  geneSymbol: string;
  // GTEx v2 API uses tissueSiteDetailId (no tissueSiteDetail field in response)
  tissueSiteDetailId: string;
  median: number;
  unit: string;
}

interface GTExReferenceGene {
  gencodeId: string; // versioned ENSEMBL ID, e.g. "ENSG00000141510.16"
  geneSymbol: string;
}

async function gtexFetch<T>(path: string): Promise<T> {
  await acquireToken('gtex', RATE_LIMIT_RPM);

  const url = `${BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    clearTimeout(timer);
    throw new ExternalAPIError('GTEx', url, undefined, `Network error: ${(err as Error).message}`);
  }
  clearTimeout(timer);

  if (!res.ok) {
    throw new ExternalAPIError('GTEx', url, res.status, `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Internal helpers ──────────────────────────────────────────

/**
 * Resolve a gene symbol to the GTEx versioned gencodeId.
 * GTEx v2 medianGeneExpression requires gencodeId (e.g. "ENSG00000141510.16"),
 * not a plain symbol or unversioned ENSEMBL ID.
 */
async function fetchGencodeId(geneSymbol: string): Promise<string> {
  const data = await gtexFetch<{ data: GTExReferenceGene[] }>(
    `/reference/gene?geneId=${encodeURIComponent(geneSymbol)}&datasetId=gtex_v8`
  );
  const gene = data?.data?.[0];
  if (!gene?.gencodeId) {
    throw new Error(`GTEx reference gene not found for ${geneSymbol}`);
  }
  return gene.gencodeId;
}

// ── Public functions ──────────────────────────────────────────

/**
 * Fetch median gene expression across all GTEx tissues.
 * Returns a sorted array from highest to lowest expression.
 */
export async function fetchGeneExpression(
  geneSymbol: string
): Promise<GTExExpressionResult[]> {
  try {
    const gencodeId = await fetchGencodeId(geneSymbol);
    const data = await gtexFetch<{ data: GTExExpressionResult[] }>(
      `/expression/medianGeneExpression?gencodeId=${encodeURIComponent(gencodeId)}&datasetId=gtex_v8`
    );
    return (data?.data ?? []).sort((a, b) => b.median - a.median);
  } catch (err) {
    console.warn(`[gtex] Could not fetch expression for ${geneSymbol}: ${(err as Error).message}`);
    return [];
  }
}

/**
 * Calculate tissue specificity score using the Tau index (Yanai et al. 2005).
 *   τ = Σᵢ(1 − x̂ᵢ) / (n − 1),  x̂ᵢ = xᵢ / max(xᵢ)
 *   τ → 0: ubiquitously expressed across all tissues
 *   τ → 1: expressed in exactly one tissue
 *
 * Returns score scaled to 0–10.
 */
export async function fetchTissueSpecificityScore(geneSymbol: string): Promise<number> {
  const expressions = await fetchGeneExpression(geneSymbol);
  if (expressions.length === 0) return 5.0;

  const values = expressions.map((e) => e.median);
  const maxVal = Math.max(...values);
  if (maxVal === 0) return 0;

  const n = values.length;
  const tau = values.reduce((sum, val) => sum + (1 - val / maxVal), 0) / (n - 1);

  return Math.min(10, Math.max(0, tau * 10));
}

/**
 * Get top expressing tissues for a gene.
 * Useful for drug target context (e.g., "highly expressed in liver, kidney").
 */
export async function fetchTopExpressingTissues(
  geneSymbol: string,
  topN = 5
): Promise<{ tissue: string; median_tpm: number }[]> {
  const expressions = await fetchGeneExpression(geneSymbol);
  return expressions.slice(0, topN).map((e) => ({
    // tissueSiteDetailId uses underscores; replace for readable display
    tissue: e.tissueSiteDetailId.replace(/_/g, ' '),
    median_tpm: e.median,
  }));
}
