#!/usr/bin/env ts-node
// ============================================================
// scripts/validate-db.ts
//
// Test all database connections (Neo4j, PostgreSQL, Redis).
// Exits with code 1 if any connection fails.
//
// Usage:
//   npx ts-node scripts/validate-db.ts
// ============================================================

import 'dotenv/config';
import { verifyNeo4jConnection } from '../lib/database/neo4j';
import { verifyPostgresConnection } from '../lib/database/postgres';
import { verifyRedisConnection } from '../lib/database/redis';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const CYAN  = '\x1b[36m';
const BOLD  = '\x1b[1m';
const YELLOW = '\x1b[33m';

async function checkConnection(
  name: string,
  fn: () => Promise<void>,
  required = true
): Promise<boolean> {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    console.log(`  ${GREEN}✓${RESET} ${name} (${ms}ms)`);
    return true;
  } catch (err) {
    const ms = Date.now() - start;
    const icon = required ? `${RED}✗${RESET}` : `${YELLOW}~${RESET}`;
    const label = required ? 'REQUIRED' : 'OPTIONAL';
    console.log(`  ${icon} ${name} (${ms}ms) [${label}]`);
    console.log(`       → ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function main() {
  console.log(`\n${BOLD}${CYAN}Gene-Maps — Database Connection Validation${RESET}\n`);

  // Check required env vars before attempting connections
  const missing: string[] = [];
  if (!process.env.NEO4J_URI)    missing.push('NEO4J_URI');
  if (!process.env.NEO4J_USER)   missing.push('NEO4J_USER');
  if (!process.env.NEO4J_PASSWORD) missing.push('NEO4J_PASSWORD');
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');

  if (missing.length > 0) {
    console.log(`${RED}${BOLD}Missing required environment variables:${RESET}`);
    missing.forEach((v) => console.log(`  ${RED}✗${RESET} ${v}`));
    console.log(`\nCopy .env.example to .env.local and fill in values.\n`);
    process.exit(1);
  }

  const results = await Promise.all([
    checkConnection('Neo4j AuraDB',    verifyNeo4jConnection,    true),
    checkConnection('PostgreSQL',      verifyPostgresConnection, true),
    checkConnection('Redis / Upstash', verifyRedisConnection,    false),
  ]);

  console.log('');

  const requiredFailed = !results[0] || !results[1];

  if (requiredFailed) {
    console.log(`${RED}${BOLD}⚠ Required database connections failed.${RESET}`);
    console.log('  Verify your credentials in .env.local.');
    console.log('  Neo4j: https://console.neo4j.io');
    console.log('  PostgreSQL (Neon): https://neon.tech\n');
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}✓ Required databases connected.${RESET}`);
    if (!results[2]) {
      console.log(`${YELLOW}  ℹ Redis is not configured — caching will be disabled.${RESET}`);
      console.log('  Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for caching.');
    }
    console.log('');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
