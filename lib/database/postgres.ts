// ============================================================
// PostgreSQL — Connection pool and basic helpers.
// Uses the pg package (node-postgres).
// Works with Neon, Supabase, Railway, or any standard PG.
// ============================================================

import { Pool, PoolClient } from 'pg';
import { DatabaseConnectionError } from '../utils/errors';

// Singleton connection pool — shared across API route invocations.
let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new DatabaseConnectionError(
      'postgres',
      'Missing DATABASE_URL environment variable. See .env.example for setup instructions.'
    );
  }

  _pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  _pool.on('error', (err) => {
    console.error('[postgres] Unexpected pool error:', err.message);
  });

  return _pool;
}

/** Verify the PostgreSQL connection is alive. */
export async function verifyPostgresConnection(): Promise<void> {
  let client: PoolClient | undefined;
  try {
    client = await getPool().connect();
    await client.query('SELECT 1');
  } catch (err) {
    throw new DatabaseConnectionError(
      'postgres',
      `PostgreSQL connectivity check failed: ${(err as Error).message}`
    );
  } finally {
    client?.release();
  }
}

/**
 * Execute a single parameterized query.
 * Automatically acquires and releases a pool connection.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T = Record<string, any>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = getPool();
  // Cast to any to avoid QueryResultRow constraint — our types are intentionally broader
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (pool as any).query(sql, params);
  return result.rows as T[];
}

/**
 * Run multiple queries inside a single transaction.
 * Rolls back automatically on any error.
 */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
