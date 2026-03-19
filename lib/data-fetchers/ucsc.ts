// ============================================================
// UCSC Genome Browser API fetcher.
// Docs: https://genome.ucsc.edu/goldenPath/help/api.html
//
// Used for:
//   - PhyloP conservation scores (cross-species)
//   - PhastCons scores
//   - TAD boundary data (where available)
// ============================================================

import { ExternalAPIError } from '../utils/errors';
import { acquireToken } from '../utils/rate-limit';

const BASE = process.env.UCSC_API_BASE ?? 'https://api.genome.ucsc.edu';
const RATE_LIMIT_RPM = 60;
const TIMEOUT_MS = parseInt(process.env.EXTERNAL_API_TIMEOUT_MS ?? '10000', 10);

async function ucscFetch<T>(path: string): Promise<T> {
  await acquireToken('ucsc', RATE_LIMIT_RPM);

  const url = `${BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    clearTimeout(timer);
    throw new ExternalAPIError('UCSC', url, undefined, `Network error: ${(err as Error).message}`);
  }
  clearTimeout(timer);

  if (!res.ok) {
    throw new ExternalAPIError('UCSC', url, res.status, `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Public functions ──────────────────────────────────────────

/**
 * Fetch PhyloP conservation scores for a genomic region.
 * Returns average score over the interval (higher = more conserved).
 * PhyloP range: typically -14 to +6; positive = conserved.
 */
export async function fetchPhyloPScore(
  chromosome: string,
  start: number,
  end: number,
  genome = 'hg38'
): Promise<number> {
  try {
    const data = await ucscFetch<{ phyloP100way?: { value: number }[] }>(
      `/getData/track?genome=${genome}&track=phyloP100way&chrom=${chromosome}&start=${start}&end=${end}`
    );

    const points = data?.phyloP100way ?? [];
    if (points.length === 0) return 0;

    // Average the per-base PhyloP scores
    const avg = points.reduce((sum, p) => sum + p.value, 0) / points.length;

    // Normalize to 0–10 scale (raw PhyloP range: roughly -14 to +6)
    return Math.min(10, Math.max(0, ((avg + 14) / 20) * 10));
  } catch {
    return 5.0; // Neutral fallback
  }
}

/**
 * Fetch PhastCons conservation score for a genomic region.
 * PhastCons is a probability (0–1) of being in a conserved element.
 * We scale to 0–10.
 */
export async function fetchPhastConsScore(
  chromosome: string,
  start: number,
  end: number,
  genome = 'hg38'
): Promise<number> {
  try {
    const data = await ucscFetch<{ phastCons100way?: { value: number }[] }>(
      `/getData/track?genome=${genome}&track=phastCons100way&chrom=${chromosome}&start=${start}&end=${end}`
    );

    const points = data?.phastCons100way ?? [];
    if (points.length === 0) return 5.0;

    const avg = points.reduce((sum, p) => sum + p.value, 0) / points.length;
    return avg * 10; // Already 0–1, scale to 0–10
  } catch {
    return 5.0;
  }
}

/**
 * Fetch ENCODE CTCF binding sites near a genomic region.
 * CTCF sites mark TAD boundaries — density correlates with boundary strength.
 * Returns count of CTCF sites in a ±100kb window.
 */
export async function fetchCTCFSitesCount(
  chromosome: string,
  position: number,
  windowBp = 100_000,
  genome = 'hg38'
): Promise<number> {
  const start = Math.max(0, position - windowBp);
  const end = position + windowBp;

  try {
    const data = await ucscFetch<{ itemCount?: number }>(
      `/getData/track?genome=${genome}&track=encRegTfbsClustered&chrom=${chromosome}&start=${start}&end=${end}`
    );
    return data?.itemCount ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Fetch available UCSC tracks for a genome assembly.
 * Used during validation to confirm UCSC API is accessible.
 */
export async function fetchAvailableTracks(genome = 'hg38'): Promise<string[]> {
  const data = await ucscFetch<{ tracks?: Record<string, unknown> }>(
    `/list/tracks?genome=${genome}`
  );
  return Object.keys(data?.tracks ?? {});
}
