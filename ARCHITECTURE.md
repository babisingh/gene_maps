# Gene-Maps (Gene_Maps) - Architecture Documentation

> **Living document.** Update this file whenever the architecture changes.
> Last updated: 2026-03-18

---

## Project Overview

Gene-Maps is a consumer-friendly spatial pharmacogenomics research platform. It makes 3D genome concepts (spatial gene interactions, TAD topology, cross-species conservation) accessible while maintaining scientific accuracy.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                           │
│   Next.js 14 (React 18 + TypeScript + TailwindCSS)             │
│   D3.js network viz │ Recharts plots │ Framer Motion animations │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP / WebSocket
┌───────────────────────────────▼─────────────────────────────────┐
│                    NEXT.JS API ROUTES (/api/*)                   │
│   - No separate Express server                                  │
│   - All backend logic co-located with frontend (single repo)    │
│   - Deployed on Vercel                                          │
└────┬──────────────┬──────────────────┬──────────────────────────┘
     │              │                  │
┌────▼────┐  ┌──────▼──────┐  ┌───────▼──────┐
│  Neo4j  │  │ PostgreSQL  │  │    Redis     │
│ AuraDB  │  │  (Neon or   │  │  (Upstash    │
│  Free   │  │  Supabase)  │  │  free tier)  │
│ (Graph) │  │ (Relational)│  │  (Cache)     │
└────┬────┘  └──────┬──────┘  └──────────────┘
     │              │
┌────▼──────────────▼────────────────────────┐
│           EXTERNAL DATA SOURCES            │
│  ENSEMBL REST API  │  UCSC Genome Browser  │
│  GTEx API          │  STRING Database      │
└────────────────────────────────────────────┘
```

---

## Directory Structure

```
gene_maps/
├── ARCHITECTURE.md              ← This file
├── README.md
├── .env.example                 ← All required environment variables
├── .env.local                   ← Local secrets (git-ignored)
│
├── app/                         ← Next.js App Router
│   ├── layout.tsx               ← Root layout with providers
│   ├── page.tsx                 ← Home page (gene search + dashboard)
│   ├── globals.css
│   └── api/                     ← All backend API routes
│       ├── health/route.ts      ← DB + external API health check
│       ├── genes/search/route.ts
│       ├── spatial/network/[gene]/route.ts
│       ├── conservation/[gene]/route.ts
│       ├── crispr/safety/route.ts
│       └── drug-score/[gene]/route.ts
│
├── components/                  ← React UI components
│   ├── GeneSearchInterface.tsx
│   ├── SpatialNetworkVisualization.tsx
│   ├── ConservationAnalysis.tsx
│   ├── CRISPRSafetyAssessment.tsx
│   └── DrugTargetScore.tsx
│
├── lib/                         ← Core library (shared server-side)
│   ├── database/
│   │   ├── neo4j.ts             ← Neo4j AuraDB driver + graph queries
│   │   ├── postgres.ts          ← PostgreSQL pool + connection
│   │   ├── redis.ts             ← Redis client (Upstash compatible)
│   │   ├── schema.sql           ← PostgreSQL DDL (run once at setup)
│   │   └── queries.ts           ← PostgreSQL query helpers
│   │
│   ├── data-fetchers/           ← External API integrations
│   │   ├── ensembl.ts           ← ENSEMBL REST API (gene info, orthologs)
│   │   ├── ucsc.ts              ← UCSC Genome Browser (conservation)
│   │   ├── gtex.ts              ← GTEx (tissue expression)
│   │   ├── string-db.ts         ← STRING DB (protein interactions)
│   │   └── validator.ts         ← Pre-flight API connectivity checks
│   │
│   ├── algorithms/              ← Core scoring engines
│   │   ├── spatial-scoring.ts   ← Composite spatial score (weighted)
│   │   ├── conservation.ts      ← Cross-species conservation analysis
│   │   ├── crispr-safety.ts     ← TAD disruption + off-target risk
│   │   └── drug-target.ts       ← Druggability scoring algorithm
│   │
│   ├── seed/                    ← Pre-computed seed data
│   │   ├── genes.ts             ← 50 validated target genes
│   │   └── interactions.ts      ← Pre-computed spatial interactions
│   │
│   └── utils/
│       ├── cache.ts             ← Redis caching helpers
│       ├── errors.ts            ← Custom error classes
│       └── rate-limit.ts        ← API rate limiting
│
├── types/
│   └── index.ts                 ← Shared TypeScript interfaces
│
├── scripts/                     ← One-off admin scripts (ts-node)
│   ├── validate-apis.ts         ← Test all external APIs before relying on them
│   ├── validate-db.ts           ← Test all DB connections
│   └── populate-database.ts     ← Seed 50 genes into Neo4j + PostgreSQL
│
└── __tests__/                   ← Jest test suite
    ├── api/spatial-scoring.test.ts
    └── components/SpatialNetwork.test.tsx
```

---

## Database Design

### Neo4j AuraDB (Graph Database)
**Purpose:** Stores spatial relationships between genes — the core 3D genome topology.

**Node types:**
| Label | Key properties | Description |
|-------|---------------|-------------|
| `Gene` | symbol, ensembl_id, chromosome, start, end, spatial_score, druggability_score | Genomic locus |
| `Species` | name, common_name, taxon_id | Evolutionary species |
| `TAD` | chromosome, start, end, boundary_strength | Topologically Associating Domain |

**Relationship types:**
| Type | Properties | Description |
|------|-----------|-------------|
| `INTERACTS_WITH` | hic_frequency, distance_3d, confidence | Hi-C spatial contact |
| `CONSERVED_IN` | conservation_score, synteny_block, ortholog_id | Evolutionary conservation |
| `LOCATED_IN` | — | Gene → TAD membership |

### PostgreSQL (Relational Metadata)
**Purpose:** Tabular metadata, analysis history, and caching.

**Tables:** `genes`, `conservation`, `crispr_safety`, `analysis_cache`

See `lib/database/schema.sql` for full DDL.

### Redis / Upstash
**Purpose:** Cache expensive external API responses and computed scores.

**Strategy:** TTL-based caching.
- External API responses: 24h TTL
- Computed spatial scores: 1h TTL
- Gene search results: 10min TTL

---

## External APIs

| API | Base URL | Rate Limit | Used For |
|-----|----------|-----------|---------|
| ENSEMBL REST | `https://rest.ensembl.org` | 15 req/s | Gene info, orthologs, sequence |
| UCSC API | `https://api.genome.ucsc.edu` | ~100 req/min | Conservation tracks, genome browser |
| GTEx Portal | `https://gtexportal.org/api/v2` | ~100 req/min | Tissue-specific expression |
| STRING DB | `https://string-db.org/api` | ~100 req/min | Protein-protein interactions |

**IMPORTANT:** Before any data pipeline runs, `scripts/validate-apis.ts` must confirm all APIs are reachable. The pipeline throws `ExternalAPIError` if any required API is unavailable.

---

## Scoring Algorithms

### Spatial Score (0–10)
Composite score indicating how spatially privileged a gene is in 3D genome context.

```
spatial_score = 0.25 × conservation_score
              + 0.20 × accessibility_score
              + 0.25 × network_centrality
              + 0.20 × interaction_strength
              + 0.10 × expression_plasticity
```

### Druggability Score (0–10)
```
druggability = 0.40 × spatial_score
             + 0.30 × structural_features
             + 0.30 × tissue_specificity
```

### CRISPR Safety Score (0–10, higher = safer)
```
tad_disruption_risk = f(proximity_to_tad_boundary, boundary_strength)
off_target_risk      = f(spatial_neighbors_count, sequence_similarity)
safety_score         = 10 − (0.6 × tad_disruption_risk + 0.4 × off_target_risk)
```

---

## Deployment (Production)

| Service | Platform | Tier | Cost |
|---------|----------|------|------|
| Frontend + API | Vercel | Free | $0/mo |
| Neo4j | Neo4j AuraDB | Free (50k nodes) | $0/mo |
| PostgreSQL | Neon.tech | Free (0.5GB) | $0/mo |
| Redis | Upstash | Free (10k req/day) | $0/mo |
| Domain | Namecheap | — | ~$1/mo |

**Total: ~$1–5/month**

---

## Environment Variables

See `.env.example` for all required variables with descriptions.

Run `npx ts-node scripts/validate-db.ts` to verify DB connectivity.
Run `npx ts-node scripts/validate-apis.ts` to verify external API access.

---

## Development Workflow

```bash
# Install deps
npm install

# Copy and fill in environment variables
cp .env.example .env.local

# Validate connectivity (MUST pass before running populate script)
npx ts-node scripts/validate-db.ts
npx ts-node scripts/validate-apis.ts

# Seed 50 target genes into databases
npx ts-node scripts/populate-database.ts

# Start development server
npm run dev

# Run tests
npm test
```

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-18 | Initial architecture — Phase 1 foundation | Claude |

