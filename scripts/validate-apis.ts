#!/usr/bin/env ts-node
// ============================================================
// scripts/validate-apis.ts
//
// Test all external API connections BEFORE running any pipeline.
// Exits with code 1 if any required API is unreachable.
//
// Usage:
//   npx ts-node scripts/validate-apis.ts
// ============================================================

import {
  validateEnsemblAPI,
  validateUCSCAPI,
  validateGTExAPI,
  validateStringAPI,
} from '../lib/data-fetchers/validator';
import type { ValidationResult } from '../types';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const CYAN  = '\x1b[36m';
const BOLD  = '\x1b[1m';

async function main() {
  console.log(`\n${BOLD}${CYAN}SpatialPharma — External API Validation${RESET}\n`);
  console.log('Testing connectivity to all required external APIs...\n');

  const checks: Array<{ name: string; fn: () => Promise<ValidationResult> }> = [
    { name: 'ENSEMBL REST API', fn: validateEnsemblAPI },
    { name: 'UCSC Genome Browser', fn: validateUCSCAPI },
    { name: 'GTEx Portal', fn: validateGTExAPI },
    { name: 'STRING Database', fn: validateStringAPI },
  ];

  const results = await Promise.allSettled(checks.map((c) => c.fn()));
  let allOk = true;
  let anyFailed = false;

  for (let i = 0; i < checks.length; i++) {
    const { name } = checks[i];
    const result = results[i];

    if (result.status === 'fulfilled') {
      const v = result.value;
      const icon = v.reachable ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
      const latency = v.latency_ms ? ` (${v.latency_ms}ms)` : '';
      const err = v.error ? `  → ${RED}${v.error}${RESET}` : '';

      console.log(`  ${icon} ${name}${latency}${err}`);

      if (!v.reachable) {
        allOk = false;
        anyFailed = true;
      }
    } else {
      console.log(`  ${RED}✗${RESET} ${name}  → Threw: ${result.reason}`);
      allOk = false;
      anyFailed = true;
    }
  }

  console.log('');

  if (anyFailed) {
    console.log(`${RED}${BOLD}⚠ One or more APIs are unreachable.${RESET}`);
    console.log('  Check your network connection and API status pages.');
    console.log('  Do NOT run the populate script until all APIs are reachable.\n');
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}✓ All APIs reachable. Safe to run populate-database.ts${RESET}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
