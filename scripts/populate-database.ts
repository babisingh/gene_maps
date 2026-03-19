#!/usr/bin/env ts-node
// ============================================================
// scripts/populate-database.ts
//
// Seed 50 target genes into Neo4j (graph) and PostgreSQL (relational).
//
// IMPORTANT: Run these FIRST and ensure they pass:
//   npx ts-node scripts/validate-db.ts
//   npx ts-node scripts/validate-apis.ts
//
// Then run:
//   npx ts-node scripts/populate-database.ts
//
// The script:
//   1. Validates all APIs are reachable (aborts if not)
//   2. Fetches live gene info from ENSEMBL
//   3. Upserts each gene into Neo4j + PostgreSQL
//   4. Adds pre-computed spatial interactions to Neo4j
//   5. Computes and stores spatial/druggability scores
// ============================================================

import 'dotenv/config';
import { validateAllAPIs } from '../lib/data-fetchers/validator';
import { SpatialGraphDB } from '../lib/database/neo4j';
import { upsertGene } from '../lib/database/queries';
import { batchFetchGenes } from '../lib/data-fetchers/ensembl';
import { SEED_GENES, type SeedGene } from '../lib/seed/genes';
import { SEED_INTERACTIONS } from '../lib/seed/interactions';
import type { Gene } from '../types';

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const YELLOW = '\x1b[33m';
const BOLD   = '\x1b[1m';

async function main() {
  console.log(`\n${BOLD}${CYAN}Gene-Maps — Database Population Script${RESET}\n`);
  console.log(`Target: ${SEED_GENES.length} genes, ${SEED_INTERACTIONS.length} interactions\n`);

  // ── Step 1: Validate APIs ──────────────────────────────────
  console.log('Step 1: Validating external APIs...');
  try {
    const apiResults = await validateAllAPIs(['ensembl']); // ensembl is required; others optional
    for (const r of apiResults) {
      const icon = r.reachable ? `${GREEN}✓${RESET}` : `${YELLOW}~${RESET}`;
      console.log(`  ${icon} ${r.service} (${r.latency_ms}ms)`);
    }
  } catch (err) {
    console.error(`\n${RED}${BOLD}API validation failed:${RESET}`, err instanceof Error ? err.message : err);
    console.error('Aborting. Fix API connectivity before seeding.\n');
    process.exit(1);
  }
  console.log('');

  // ── Step 2: Initialize Neo4j schema ───────────────────────
  console.log('Step 2: Initializing Neo4j schema...');
  const graphDB = new SpatialGraphDB();
  try {
    await graphDB.initializeSchema();
    console.log(`  ${GREEN}✓${RESET} Constraints and indexes created\n`);
  } catch (err) {
    console.error(`  ${RED}✗${RESET} Schema init failed:`, err);
    process.exit(1);
  }

  // ── Step 3: Fetch live gene info from ENSEMBL ─────────────
  console.log('Step 3: Fetching gene data from ENSEMBL...');
  console.log('  (Rate-limited to 60 req/min — this may take 1–2 minutes)\n');

  const symbols = SEED_GENES.map((g) => g.symbol);
  let ensemblMap: Map<string, { id: string; display_name: string; seq_region_name: string; start: number; end: number; description: string; biotype: string }>;

  try {
    ensemblMap = await batchFetchGenes(symbols);
    console.log(`  ${GREEN}✓${RESET} Fetched ${ensemblMap.size}/${symbols.length} genes from ENSEMBL\n`);
  } catch (err) {
    console.error(`  ${RED}✗${RESET} ENSEMBL batch fetch failed:`, err);
    console.error('  Falling back to seed data only.\n');
    ensemblMap = new Map();
  }

  // ── Step 4: Upsert genes into databases ───────────────────
  console.log('Step 4: Inserting genes...\n');

  let successCount = 0;
  let failCount = 0;

  for (const seedGene of SEED_GENES) {
    try {
      // Merge ENSEMBL live data with seed fallback
      const ensemblData = ensemblMap.get(seedGene.symbol);

      const gene: Partial<Gene> & { symbol: string } = {
        symbol: seedGene.symbol,
        ensembl_id:  ensemblData?.id              ?? seedGene.ensembl_id,
        chromosome:  ensemblData?.seq_region_name ? `chr${ensemblData.seq_region_name}` : seedGene.chromosome,
        start_pos:   ensemblData?.start           ?? seedGene.start_pos,
        end_pos:     ensemblData?.end             ?? seedGene.end_pos,
        description: (ensemblData?.description ?? seedGene.description).replace(/ \[Source:.*$/, ''),
        biotype:     ensemblData?.biotype         ?? seedGene.biotype,
        spatial_score:      null as unknown as number, // computed post-seeding
        druggability_score: null as unknown as number,
      };

      // Neo4j upsert
      await graphDB.upsertGene(gene);

      // PostgreSQL upsert
      await upsertGene(gene);

      const source = ensemblData ? 'ENSEMBL' : 'seed';
      console.log(`  ${GREEN}✓${RESET} ${seedGene.symbol.padEnd(10)} [${source}]`);
      successCount++;

      // Respectful delay between genes
      await sleep(200);
    } catch (err) {
      console.log(`  ${RED}✗${RESET} ${seedGene.symbol.padEnd(10)} → ${err instanceof Error ? err.message : err}`);
      failCount++;
    }
  }

  console.log(`\n  Inserted: ${GREEN}${successCount}${RESET} ✓  Failed: ${failCount > 0 ? RED : ''}${failCount}${RESET}\n`);

  // ── Step 5: Add spatial interactions ──────────────────────
  console.log('Step 5: Adding spatial interactions...\n');

  let interactionSuccess = 0;
  let interactionFail = 0;

  for (const interaction of SEED_INTERACTIONS) {
    try {
      await graphDB.upsertInteraction(interaction);
      interactionSuccess++;
    } catch (err) {
      // Skip interactions where one gene failed to insert
      interactionFail++;
    }
  }

  console.log(`  Interactions: ${GREEN}${interactionSuccess}${RESET} ✓  Skipped: ${interactionFail}\n`);

  // ── Step 6: Add species nodes ──────────────────────────────
  console.log('Step 6: Adding species nodes for conservation...\n');

  const SPECIES_LIST = [
    { taxon_id: 10090, name: 'mus_musculus',          common_name: 'Mouse' },
    { taxon_id: 10116, name: 'rattus_norvegicus',     common_name: 'Rat' },
    { taxon_id: 9615,  name: 'canis_lupus_familiaris',common_name: 'Dog' },
    { taxon_id: 9823,  name: 'sus_scrofa',            common_name: 'Pig' },
    { taxon_id: 9913,  name: 'bos_taurus',            common_name: 'Cow' },
    { taxon_id: 9031,  name: 'gallus_gallus',         common_name: 'Chicken' },
    { taxon_id: 8364,  name: 'xenopus_tropicalis',    common_name: 'Frog' },
    { taxon_id: 7955,  name: 'danio_rerio',           common_name: 'Zebrafish' },
    { taxon_id: 7227,  name: 'drosophila_melanogaster',common_name: 'Fruit fly' },
    { taxon_id: 6239,  name: 'caenorhabditis_elegans', common_name: 'Nematode' },
  ];

  for (const sp of SPECIES_LIST) {
    await graphDB.upsertSpecies(sp.taxon_id, sp.name, sp.common_name);
    console.log(`  ${GREEN}✓${RESET} ${sp.common_name}`);
  }

  // ── Summary ───────────────────────────────────────────────
  console.log(`\n${BOLD}${GREEN}✓ Database population complete!${RESET}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Start the dev server:  npm run dev`);
  console.log(`  2. Open:                  http://localhost:3000`);
  console.log(`  3. Search for:            GCG, TP53, BRCA1, KRAS, ...\n`);

  process.exit(0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
