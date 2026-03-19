# SpatialPharma — 3D Genome Drug Discovery Platform

A consumer-friendly spatial pharmacogenomics research tool that makes
3D genome concepts accessible with scientific accuracy.

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![Neo4j](https://img.shields.io/badge/Neo4j-AuraDB-green)](https://neo4j.com/cloud/platform/aura-graph-database)
[![License](https://img.shields.io/badge/License-MIT-gray)](#)

---

## What it does

Search any human gene to instantly explore:

| Feature | Data source | What it shows |
|---------|------------|---------------|
| **3D Spatial Network** | Hi-C (pre-computed) | Interactive D3.js graph of chromatin contacts |
| **Spatial Score** | ENSEMBL · STRING · UCSC · GTEx | 5-component weighted score (0–10) |
| **Cross-species Conservation** | ENSEMBL REST API | Ortholog percent identity across 10 species |
| **CRISPR Safety** | UCSC ENCODE (CTCF) · PhyloP | TAD disruption risk + conservation constraint |
| **Drug Target Score** | All of the above | Composite druggability assessment |

---

## Quick start (local development)

### Prerequisites
- Node.js 18+
- Accounts at: [Neo4j AuraDB](https://console.neo4j.io), [Neon.tech](https://neon.tech), [Upstash](https://upstash.com)

### 1. Clone and install
```bash
git clone <repo-url> gene_maps
cd gene_maps
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Edit .env.local — fill in Neo4j, PostgreSQL, Upstash credentials
```

### 3. Set up databases
Run the schema SQL in your PostgreSQL dashboard (Neon → SQL editor):
```bash
# Copy and paste contents of:
cat lib/database/schema.sql
```

### 4. Validate connectivity (required before seeding)
```bash
npm run db:validate    # tests Neo4j + PostgreSQL + Redis
npm run api:validate   # tests ENSEMBL, UCSC, GTEx, STRING APIs
```
Both must pass before proceeding. The seed script will abort if they don't.

### 5. Seed 50 target genes
```bash
npm run db:seed
# Takes ~2 minutes (rate-limited to 60 req/min for ENSEMBL)
```

### 6. Start development server
```bash
npm run dev
# Open: http://localhost:3000
```

---

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full living architecture document.

```
Next.js 14 (App Router + TypeScript)
├── /app/api/         → All backend API routes (no separate server)
├── /components/      → React UI components
├── /lib/
│   ├── algorithms/   → Spatial scoring, conservation, CRISPR, drug target
│   ├── database/     → Neo4j, PostgreSQL, Redis connections
│   ├── data-fetchers/→ ENSEMBL, UCSC, GTEx, STRING API clients
│   └── seed/         → 50 gene seed data + spatial interactions
└── /scripts/         → validate-db, validate-apis, populate-database
```

### Scoring algorithms

**Spatial Score** (composite, 0–10):
```
0.25 × conservation_score   (ENSEMBL orthologs, 10 species)
0.20 × accessibility_score  (UCSC PhyloP100way promoter region)
0.25 × network_centrality   (STRING DB degree centrality)
0.20 × interaction_strength (Hi-C contact frequency)
0.10 × expression_plasticity (GTEx Tau index inverse)
```

**CRISPR Safety** (0–10, higher = safer):
```
TAD disruption risk = f(CTCF density, boundary strength)
  — CTCF count from UCSC ENCODE clustered track (±50kb window)
  — Deterministic distance tiers: no randomness
  — Biological ref: Dixon et al. 2012; Lupiáñez et al. 2015

Conservation constraint = PhyloP100way score at edit site (±100bp)
  — High PhyloP → recommend base/prime editing over Cas9 DSB
  — Biological ref: Pollard et al. 2010 Nat Rev Genetics

Safety = 10 − (0.6 × TAD_risk + 0.4 × off_target_risk)
```

---

## Available scripts

```bash
npm run dev           # Start development server
npm run build         # Production build
npm run test          # Run Jest test suite
npm run test:coverage # Coverage report
npm run db:validate   # Test database connections
npm run api:validate  # Test external API connectivity
npm run db:seed       # Seed 50 genes into Neo4j + PostgreSQL
```

---

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm install -g vercel

# Add secrets to Vercel project
vercel env add NEO4J_URI
vercel env add NEO4J_USER
vercel env add NEO4J_PASSWORD
vercel env add DATABASE_URL
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN

# Deploy
vercel --prod
```

---

## Cost estimate

| Service | Platform | Monthly cost |
|---------|----------|-------------|
| Frontend + API | Vercel free | $0 |
| Graph database | Neo4j AuraDB free (50k nodes) | $0 |
| PostgreSQL | Neon.tech free (0.5GB) | $0 |
| Cache | Upstash free (10k req/day) | $0 |
| Domain | Namecheap | ~$1 |
| **Total** | | **~$1/month** |

---

## 50 target genes

Distributed across 5 biological categories:

- **Drug targets (12):** GCG, EGFR, ERBB2, BRAF, ALK, JAK2, VEGFA, TNF, LDLR, CFTR, HTT, APOE
- **Cancer drivers (15):** MYC, TP53, BRCA1, BRCA2, KRAS, PIK3CA, PTEN, RB1, APC, VHL, IDH1, NF1, CDKN2A, MDM2, CCND1
- **Neurological (12):** APP, PSEN1, PSEN2, MAPT, SNCA, LRRK2, SOD1, FUS, C9orf72, DISC1, CACNA1C, COMT
- **Metabolic (8):** INS, INSR, LEP, POMC, PPARG, HNF4A, SORT1, FTO
- **Immune (3):** IL6, CTLA4, CD274

---

## External APIs

| API | Base URL | Used for | Rate limit |
|-----|----------|----------|-----------|
| ENSEMBL REST | `rest.ensembl.org` | Gene info, orthologs | 15 req/s |
| UCSC | `api.genome.ucsc.edu` | PhyloP, CTCF tracks | ~100 req/min |
| GTEx | `gtexportal.org/api/v2` | Tissue expression | ~100 req/min |
| STRING | `string-db.org/api` | PPI networks | ~100 req/min |

All APIs are free public endpoints — no API keys required.

---

## References

- Dixon JR et al. (2012) Topological domains in mammalian genomes. *Nature* 485:376–380
- Lupiáñez DG et al. (2015) Disruptions of topological chromatin domains cause pathogenic rewiring. *Cell* 161:1012–1025
- Rao SS et al. (2014) A 3D map of the human genome. *Cell* 159:1665–1680
- Pollard KS et al. (2010) Detection of nonneutral substitution rates on mammalian phylogenies. *Genome Res* 20:110–121
- Finan C et al. (2017) The druggable genome and support for target identification. *Sci Transl Med* 9:eaag1166
- GTEx Consortium (2020) The GTEx Consortium atlas of genetic regulatory effects. *Science* 369:1318–1330
