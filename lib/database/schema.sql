-- ============================================================
-- Gene-Maps PostgreSQL Schema
-- Run this once against your database to create all tables.
--
-- Usage:
--   psql $DATABASE_URL -f lib/database/schema.sql
--   OR copy-paste into your Neon/Supabase SQL editor.
-- ============================================================

-- ── Genes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS genes (
  id                SERIAL PRIMARY KEY,
  symbol            VARCHAR(20)  NOT NULL,
  ensembl_id        VARCHAR(50)  UNIQUE,
  chromosome        VARCHAR(10),
  start_pos         BIGINT,
  end_pos           BIGINT,
  description       TEXT,
  biotype           VARCHAR(50),
  spatial_score     FLOAT CHECK (spatial_score >= 0 AND spatial_score <= 10),
  druggability_score FLOAT CHECK (druggability_score >= 0 AND druggability_score <= 10),
  conservation_avg  FLOAT CHECK (conservation_avg >= 0 AND conservation_avg <= 100),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_genes_symbol ON genes (symbol);
CREATE INDEX IF NOT EXISTS idx_genes_chromosome ON genes (chromosome);

-- ── Cross-Species Conservation ────────────────────────────────

CREATE TABLE IF NOT EXISTS conservation (
  id                SERIAL PRIMARY KEY,
  gene_id           INTEGER REFERENCES genes(id) ON DELETE CASCADE,
  species           VARCHAR(50)  NOT NULL,
  common_name       VARCHAR(50),
  taxon_id          INTEGER,
  conservation_score FLOAT CHECK (conservation_score >= 0 AND conservation_score <= 100),
  synteny_block     VARCHAR(50),
  ortholog_id       VARCHAR(50),
  ortholog_symbol   VARCHAR(20),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conservation_gene_id ON conservation (gene_id);
CREATE INDEX IF NOT EXISTS idx_conservation_species ON conservation (species);

-- ── CRISPR Safety Assessments ─────────────────────────────────

CREATE TABLE IF NOT EXISTS crispr_safety (
  id                    SERIAL PRIMARY KEY,
  gene_id               INTEGER REFERENCES genes(id) ON DELETE CASCADE,
  edit_position         BIGINT NOT NULL,
  tad_disruption_risk   FLOAT CHECK (tad_disruption_risk >= 0 AND tad_disruption_risk <= 10),
  off_target_risk       FLOAT CHECK (off_target_risk >= 0 AND off_target_risk <= 10),
  safety_score          FLOAT CHECK (safety_score >= 0 AND safety_score <= 10),
  recommendations       TEXT,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crispr_gene_id ON crispr_safety (gene_id);

-- ── Analysis Cache (fallback for Redis misses) ─────────────────

CREATE TABLE IF NOT EXISTS analysis_cache (
  query_hash  VARCHAR(64)  PRIMARY KEY,
  result_data JSONB        NOT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  expires_at  TIMESTAMP    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cache_expires ON analysis_cache (expires_at);

-- ── Auto-update updated_at trigger ────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_genes_updated_at ON genes;
CREATE TRIGGER trg_genes_updated_at
  BEFORE UPDATE ON genes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
