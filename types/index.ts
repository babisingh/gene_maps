// ============================================================
// Gene-Maps — Shared TypeScript Types
// Keep all cross-cutting interfaces here to avoid circular deps.
// ============================================================

// ── Genes ────────────────────────────────────────────────────

export interface Gene {
  id?: number;
  symbol: string;
  ensembl_id: string;
  chromosome: string;
  start_pos: number;
  end_pos: number;
  description: string;
  biotype?: string;
  strand?: number;
  spatial_score?: number;
  druggability_score?: number;
  conservation_avg?: number;
}

// ── Network Visualization ─────────────────────────────────────

export interface NetworkNode {
  id: string;          // gene symbol
  group: number;       // cluster / pathway group
  score: number;       // spatial score (0–1 normalized)
  ensembl_id?: string;
  chromosome?: string;
}

export interface NetworkLink {
  source: string;      // gene symbol
  target: string;      // gene symbol
  value: number;       // Hi-C interaction frequency
  confidence: number;  // 0–1
  distance_3d?: number;
}

export interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

// ── Spatial Scoring ───────────────────────────────────────────

export interface SpatialScoreComponents {
  conservation: number;    // 0–10
  accessibility: number;   // 0–10
  centrality: number;      // 0–10
  interactions: number;    // 0–10
  expression: number;      // 0–10
}

export interface SpatialScore {
  gene_symbol: string;
  total_score: number;          // 0–10
  components: SpatialScoreComponents;
  confidence: number;           // 0–1
  data_sources: string[];
  computed_at: string;          // ISO timestamp
}

// ── Conservation ──────────────────────────────────────────────

export interface SpeciesConservation {
  name: string;           // e.g. "Mus musculus"
  common_name: string;    // e.g. "mouse"
  taxon_id: number;
  conservation_score: number;   // 0–100 (percentage)
  ortholog_id: string;
  ortholog_symbol: string;
  synteny_block?: string;
}

export interface ConservationData {
  gene_symbol: string;
  average_conservation: number;   // 0–100
  species: SpeciesConservation[];
  constraint_score?: number;      // gnomAD pLI or similar
  api_warning?: string;           // set when ortholog data could not be fetched
  computed_at: string;
}

// ── CRISPR Safety ─────────────────────────────────────────────

export interface CRISPRSafetyData {
  gene_symbol: string;
  edit_position: number;
  safety_score: number;           // 0–10 (higher = safer)
  tad_disruption_risk: number;    // 0–10
  off_target_risk: number;        // 0–10
  conservation_constraint: number; // 0–10
  tad_context?: TADContext;
  recommendations: string[];
  computed_at: string;
}

export interface TADContext {
  tad_id?: string;
  chromosome: string;
  tad_start: number;
  tad_end: number;
  boundary_strength: number;      // 0–1
  distance_to_boundary: number;   // bp
}

// ── Drug Target Scoring ───────────────────────────────────────

export interface DrugTargetScore {
  gene_symbol: string;
  druggability_score: number;     // 0–10
  spatial_contribution: number;   // 0–10
  structural_features: number;    // 0–10
  tissue_specificity: number;     // 0–10
  known_drugs?: string[];
  drug_classes?: string[];
  computed_at: string;
}

// ── External API Responses ────────────────────────────────────

export interface EnsemblGene {
  id: string;           // ENSEMBL ID e.g. ENSG00000115263
  display_name: string; // gene symbol
  description: string;
  object_type: string;
  biotype: string;
  seq_region_name: string; // chromosome
  start: number;
  end: number;
  strand: number;
  species: string;
}

export interface EnsemblOrtholog {
  id: string;
  target: {
    id: string;
    species: string;
    perc_id: number;
    perc_pos: number;
    display_label: string;
  };
  type: string;
  source: { id: string };
}

// ── Database Entities ─────────────────────────────────────────

export interface Neo4jGeneNode {
  symbol: string;
  ensembl_id: string;
  chromosome: string;
  start: number;
  end: number;
  spatial_score: number;
  druggability_score: number;
}

export interface SpatialInteraction {
  source_gene: string;
  target_gene: string;
  hic_frequency: number;
  distance_3d: number;
  confidence: number;
}

// ── API Responses ─────────────────────────────────────────────

export interface APIError {
  error: string;
  code?: string;
  details?: unknown;
}

export interface ValidationResult {
  service: string;
  reachable: boolean;
  latency_ms?: number;
  error?: string;
}

// ── TAD 3D Visualization ──────────────────────────────────────

// NetworkNode extended with optional 3D coordinates and domain membership.
// x3d/y3d/z3d are derived from Hi-C MDS or force-simulation in 3D space.
// Falls back to Fibonacci sphere placement when coordinates are absent.
export interface NetworkNode3D extends NetworkNode {
  x3d?: number;
  y3d?: number;
  z3d?: number;
  tad_id?: string;          // which TADDomain this gene belongs to
  compartment?: 'A' | 'B'; // A = active/gene-rich (nuclear interior), B = inactive/periphery
  strand?: number;          // 1 or -1 (gene orientation on chromosome)
}

// A single Topologically Associating Domain.
// Represents a self-interacting chromatin region (~200kb–2Mb) insulated at
// its boundaries by CTCF proteins.
export interface TADDomain {
  tad_id: string;
  chromosome: string;
  tad_start: number;         // genomic coordinate (bp)
  tad_end: number;           // genomic coordinate (bp)
  size_bp: number;           // tad_end - tad_start
  boundary_strength: number; // 0–1, derived from CTCF site density
  gene_ids: string[];        // gene symbols that fall within this domain
  compartment: 'A' | 'B';
  color?: string;            // optional hex override for visualization
}

// Top-level payload for the 3D TAD network scene.
// Drop-in alongside the existing NetworkData for the 2D view.
export interface NetworkData3D {
  nodes: NetworkNode3D[];
  links: NetworkLink[];
  tads: TADDomain[];
  nucleus_radius?: number; // scene scale in arbitrary units (default 88)
}

// ── Caching ───────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  cached_at: string;
  ttl_seconds: number;
}
