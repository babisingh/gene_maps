// ============================================================
// GET /api/health
// Checks connectivity to all databases and external APIs.
// Use this endpoint to verify the deployment is healthy.
// ============================================================

import { NextResponse } from 'next/server';
import { verifyNeo4jConnection } from '@/lib/database/neo4j';
import { verifyPostgresConnection } from '@/lib/database/postgres';
import { verifyRedisConnection } from '@/lib/database/redis';
import {
  validateEnsemblAPI,
  validateUCSCAPI,
  validateGTExAPI,
  validateStringAPI,
} from '@/lib/data-fetchers/validator';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: Record<string, { ok: boolean; latency_ms?: number; error?: string }> = {};

  // Run all checks in parallel
  const checks = await Promise.allSettled([
    checkDB('neo4j',    verifyNeo4jConnection),
    checkDB('postgres', verifyPostgresConnection),
    checkDB('redis',    verifyRedisConnection),
    validateEnsemblAPI(),
    validateUCSCAPI(),
    validateGTExAPI(),
    validateStringAPI(),
  ]);

  const labels = ['neo4j', 'postgres', 'redis', 'ensembl', 'ucsc', 'gtex', 'string'];

  for (let i = 0; i < labels.length; i++) {
    const result = checks[i];
    if (result.status === 'fulfilled') {
      const val = result.value;
      if (typeof val === 'object' && val !== null && 'reachable' in val) {
        results[labels[i]] = { ok: val.reachable, latency_ms: val.latency_ms, error: val.error };
      } else {
        results[labels[i]] = { ok: true };
      }
    } else {
      results[labels[i]] = { ok: false, error: String(result.reason) };
    }
  }

  const allOk = Object.values(results).every((r) => r.ok);

  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks: results },
    { status: allOk ? 200 : 207 }
  );
}

async function checkDB(name: string, fn: () => Promise<void>): Promise<{ name: string; ok: boolean }> {
  try {
    await fn();
    return { name, ok: true };
  } catch (err) {
    throw err;
  }
}
