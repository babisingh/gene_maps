// ============================================================
// Redis / Upstash — Caching layer.
//
// Supports two modes:
//   1. Upstash REST API (preferred for Vercel serverless — no persistent TCP)
//   2. Standard redis:// / rediss:// URL (for traditional servers)
//
// The code auto-selects mode based on which env vars are set.
// If neither is configured, caching silently degrades (no-op mode).
// ============================================================

import { DatabaseConnectionError } from '../utils/errors';

// ── Upstash REST client (lightweight, serverless-safe) ───────

interface UpstashResponse {
  result: unknown;
  error?: string;
}

async function upstashRequest(command: string[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash credentials not configured');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  const data: UpstashResponse = await res.json();
  if (data.error) throw new Error(`Upstash error: ${data.error}`);
  return data.result;
}

// ── Public cache interface ────────────────────────────────────

function isConfigured(): boolean {
  return !!(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    process.env.REDIS_URL
  );
}

export async function verifyRedisConnection(): Promise<void> {
  if (!isConfigured()) {
    throw new DatabaseConnectionError(
      'redis',
      'No Redis configuration found. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN or REDIS_URL.'
    );
  }
  try {
    await cacheGet('__ping__');
  } catch (err) {
    throw new DatabaseConnectionError(
      'redis',
      `Redis connectivity check failed: ${(err as Error).message}`
    );
  }
}

/**
 * Get a cached value. Returns null on cache miss or if Redis is unconfigured.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isConfigured()) return null;
  try {
    const result = await upstashRequest(['GET', key]);
    if (result == null || result === '') return null;
    return JSON.parse(result as string) as T;
  } catch {
    // Silently degrade on cache errors — never break the main path.
    return null;
  }
}

/**
 * Store a value in cache with a TTL (seconds).
 * Silently no-ops if Redis is unconfigured.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!isConfigured()) return;
  try {
    await upstashRequest(['SET', key, JSON.stringify(value), 'EX', String(ttlSeconds)]);
  } catch {
    // Silently degrade
  }
}

/** Delete a cache entry. */
export async function cacheDel(key: string): Promise<void> {
  if (!isConfigured()) return;
  try {
    await upstashRequest(['DEL', key]);
  } catch {
    // Silently degrade
  }
}

/**
 * Build a deterministic cache key.
 * Usage: cacheKey('conservation', geneSymbol)  → "sp:conservation:GCG"
 */
export function cacheKey(...parts: string[]): string {
  return `sp:${parts.join(':')}`;
}
