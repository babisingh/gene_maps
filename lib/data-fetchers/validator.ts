// ============================================================
// External API pre-flight validator.
//
// IMPORTANT: Always call validateAllAPIs() (or the individual
// validators) before starting any data pipeline or seeding job.
// If an API is unreachable, throw ExternalAPIError immediately
// rather than letting the pipeline fail mid-way.
// ============================================================

import { ExternalAPIError } from '../utils/errors';
import type { ValidationResult } from '../../types';

const TIMEOUT_MS = parseInt(process.env.EXTERNAL_API_TIMEOUT_MS ?? '10000', 10);

// ── Individual API checks ─────────────────────────────────────

/**
 * Check ENSEMBL REST API.
 * Uses the lightweight /info/ping endpoint.
 */
export async function validateEnsemblAPI(): Promise<ValidationResult> {
  const base = process.env.ENSEMBL_API_BASE ?? 'https://rest.ensembl.org';
  const url = `${base}/info/ping?content-type=application/json`;
  return probe('ENSEMBL', url);
}

/**
 * Check UCSC Genome Browser API.
 * Lists available genomes as a lightweight probe.
 */
export async function validateUCSCAPI(): Promise<ValidationResult> {
  const base = process.env.UCSC_API_BASE ?? 'https://api.genome.ucsc.edu';
  const url = `${base}/list/ucscGenomes`;
  return probe('UCSC', url);
}

/**
 * Check GTEx Portal API.
 */
export async function validateGTExAPI(): Promise<ValidationResult> {
  const base = process.env.GTEX_API_BASE ?? 'https://gtexportal.org/api/v2';
  const url = `${base}/dataset/tissueSiteDetail`;
  return probe('GTEx', url);
}

/**
 * Check STRING DB API.
 */
export async function validateStringAPI(): Promise<ValidationResult> {
  const base = process.env.STRING_API_BASE ?? 'https://string-db.org/api';
  const url = `${base}/json/version`;
  return probe('STRING', url);
}

// ── Composite validation ──────────────────────────────────────

/**
 * Validate all external APIs required by the data pipeline.
 * Throws ExternalAPIError for any API that fails.
 *
 * @param required  Which APIs to require (all by default)
 * @throws ExternalAPIError if any required API is unreachable
 */
export async function validateAllAPIs(
  required: ('ensembl' | 'ucsc' | 'gtex' | 'string')[] = ['ensembl', 'ucsc', 'gtex', 'string']
): Promise<ValidationResult[]> {
  const checks: Array<[string, () => Promise<ValidationResult>]> = [
    ['ensembl', validateEnsemblAPI],
    ['ucsc', validateUCSCAPI],
    ['gtex', validateGTExAPI],
    ['string', validateStringAPI],
  ].filter(([key]) => required.includes(key as 'ensembl' | 'ucsc' | 'gtex' | 'string')) as Array<[string, () => Promise<ValidationResult>]>;

  const results = await Promise.allSettled(checks.map(([, fn]) => fn()));
  const resolved: ValidationResult[] = [];

  for (let i = 0; i < checks.length; i++) {
    const [key] = checks[i];
    const result = results[i];

    if (result.status === 'fulfilled') {
      resolved.push(result.value);

      if (!result.value.reachable) {
        throw new ExternalAPIError(
          result.value.service,
          key,
          undefined,
          `${result.value.service} API is unreachable: ${result.value.error}. ` +
            'Aborting data pipeline. Check network connectivity and API status.'
        );
      }
    } else {
      // Promise itself rejected (unexpected)
      throw new ExternalAPIError(
        key.toUpperCase(),
        key,
        undefined,
        `${key} API check threw an error: ${result.reason}`
      );
    }
  }

  return resolved;
}

// ── Internal helper ───────────────────────────────────────────

async function probe(service: string, url: string): Promise<ValidationResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    return {
      service,
      reachable: res.ok,
      latency_ms: Date.now() - start,
      error: res.ok ? undefined : `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      service,
      reachable: false,
      latency_ms: Date.now() - start,
      error: msg.includes('AbortError') ? `Timeout after ${TIMEOUT_MS}ms` : msg,
    };
  }
}
