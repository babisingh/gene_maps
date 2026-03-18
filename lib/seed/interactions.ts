// ============================================================
// Pre-computed spatial interactions seed data.
//
// Based on known biological relationships and published Hi-C
// studies. Used as fallback when live Hi-C data is unavailable.
//
// hic_frequency: normalized contact frequency (higher = closer in 3D)
// distance_3d:   estimated spatial distance (0–1, lower = closer)
// confidence:    data confidence score (0–1)
// ============================================================

import type { SpatialInteraction } from '../../types';

export const SEED_INTERACTIONS: SpatialInteraction[] = [
  // ── Metabolic network ─────────────────────────────────────
  { source_gene: 'GCG',    target_gene: 'INS',    hic_frequency: 15.2, distance_3d: 0.65, confidence: 0.88 },
  { source_gene: 'GCG',    target_gene: 'POMC',   hic_frequency: 8.4,  distance_3d: 0.72, confidence: 0.75 },
  { source_gene: 'GCG',    target_gene: 'LEP',    hic_frequency: 6.1,  distance_3d: 0.80, confidence: 0.70 },
  { source_gene: 'INS',    target_gene: 'INSR',   hic_frequency: 18.7, distance_3d: 0.55, confidence: 0.92 },
  { source_gene: 'INS',    target_gene: 'PPARG',  hic_frequency: 7.3,  distance_3d: 0.75, confidence: 0.72 },
  { source_gene: 'PPARG',  target_gene: 'FTO',    hic_frequency: 9.2,  distance_3d: 0.68, confidence: 0.78 },
  { source_gene: 'LDLR',   target_gene: 'APOE',   hic_frequency: 22.1, distance_3d: 0.42, confidence: 0.95 },
  { source_gene: 'LDLR',   target_gene: 'SORT1',  hic_frequency: 14.5, distance_3d: 0.58, confidence: 0.85 },
  { source_gene: 'SORT1',  target_gene: 'APOE',   hic_frequency: 12.3, distance_3d: 0.62, confidence: 0.82 },

  // ── Cancer network ────────────────────────────────────────
  { source_gene: 'TP53',   target_gene: 'MDM2',   hic_frequency: 28.4, distance_3d: 0.35, confidence: 0.97 },
  { source_gene: 'TP53',   target_gene: 'CDKN2A', hic_frequency: 19.6, distance_3d: 0.48, confidence: 0.91 },
  { source_gene: 'TP53',   target_gene: 'RB1',    hic_frequency: 16.2, distance_3d: 0.55, confidence: 0.88 },
  { source_gene: 'TP53',   target_gene: 'MYC',    hic_frequency: 14.8, distance_3d: 0.60, confidence: 0.85 },
  { source_gene: 'BRCA1',  target_gene: 'BRCA2',  hic_frequency: 11.3, distance_3d: 0.65, confidence: 0.82 },
  { source_gene: 'EGFR',   target_gene: 'ERBB2',  hic_frequency: 24.7, distance_3d: 0.40, confidence: 0.94 },
  { source_gene: 'EGFR',   target_gene: 'BRAF',   hic_frequency: 13.5, distance_3d: 0.62, confidence: 0.80 },
  { source_gene: 'KRAS',   target_gene: 'BRAF',   hic_frequency: 21.3, distance_3d: 0.44, confidence: 0.93 },
  { source_gene: 'KRAS',   target_gene: 'PIK3CA', hic_frequency: 17.8, distance_3d: 0.52, confidence: 0.89 },
  { source_gene: 'PIK3CA', target_gene: 'PTEN',   hic_frequency: 20.1, distance_3d: 0.46, confidence: 0.92 },
  { source_gene: 'MYC',    target_gene: 'CCND1',  hic_frequency: 16.9, distance_3d: 0.54, confidence: 0.87 },
  { source_gene: 'CCND1',  target_gene: 'RB1',    hic_frequency: 23.5, distance_3d: 0.41, confidence: 0.94 },
  { source_gene: 'VHL',    target_gene: 'VEGFA',  hic_frequency: 18.4, distance_3d: 0.50, confidence: 0.90 },
  { source_gene: 'VEGFA',  target_gene: 'EGFR',   hic_frequency: 10.2, distance_3d: 0.69, confidence: 0.76 },
  { source_gene: 'APC',    target_gene: 'TP53',   hic_frequency: 9.7,  distance_3d: 0.71, confidence: 0.74 },
  { source_gene: 'IDH1',   target_gene: 'TP53',   hic_frequency: 11.5, distance_3d: 0.65, confidence: 0.80 },
  { source_gene: 'NF1',    target_gene: 'KRAS',   hic_frequency: 14.2, distance_3d: 0.60, confidence: 0.83 },
  { source_gene: 'MDM2',   target_gene: 'RB1',    hic_frequency: 13.0, distance_3d: 0.63, confidence: 0.81 },

  // ── Immune network ────────────────────────────────────────
  { source_gene: 'CTLA4',  target_gene: 'CD274',  hic_frequency: 17.5, distance_3d: 0.53, confidence: 0.88 },
  { source_gene: 'IL6',    target_gene: 'TNF',    hic_frequency: 22.8, distance_3d: 0.42, confidence: 0.93 },
  { source_gene: 'IL6',    target_gene: 'CTLA4',  hic_frequency: 8.9,  distance_3d: 0.73, confidence: 0.72 },
  { source_gene: 'TNF',    target_gene: 'IL6',    hic_frequency: 22.8, distance_3d: 0.42, confidence: 0.93 },

  // ── Neurological network ──────────────────────────────────
  { source_gene: 'APP',    target_gene: 'PSEN1',  hic_frequency: 19.3, distance_3d: 0.49, confidence: 0.91 },
  { source_gene: 'APP',    target_gene: 'APOE',   hic_frequency: 14.7, distance_3d: 0.59, confidence: 0.84 },
  { source_gene: 'PSEN1',  target_gene: 'PSEN2',  hic_frequency: 16.1, distance_3d: 0.55, confidence: 0.87 },
  { source_gene: 'MAPT',   target_gene: 'APP',    hic_frequency: 10.5, distance_3d: 0.68, confidence: 0.77 },
  { source_gene: 'SNCA',   target_gene: 'LRRK2',  hic_frequency: 15.8, distance_3d: 0.56, confidence: 0.86 },
  { source_gene: 'SOD1',   target_gene: 'FUS',    hic_frequency: 12.4, distance_3d: 0.63, confidence: 0.80 },
  { source_gene: 'FUS',    target_gene: 'C9orf72', hic_frequency: 11.9, distance_3d: 0.64, confidence: 0.79 },

  // ── Cross-pathway ─────────────────────────────────────────
  { source_gene: 'CFTR',   target_gene: 'EGFR',   hic_frequency: 6.8,  distance_3d: 0.79, confidence: 0.65 },
  { source_gene: 'HTT',    target_gene: 'TP53',   hic_frequency: 7.2,  distance_3d: 0.77, confidence: 0.68 },
  { source_gene: 'JAK2',   target_gene: 'IL6',    hic_frequency: 20.3, distance_3d: 0.47, confidence: 0.91 },
  { source_gene: 'ALK',    target_gene: 'EGFR',   hic_frequency: 13.8, distance_3d: 0.61, confidence: 0.82 },
  { source_gene: 'VEGFA',  target_gene: 'IL6',    hic_frequency: 9.5,  distance_3d: 0.71, confidence: 0.74 },
  { source_gene: 'HNF4A',  target_gene: 'INS',    hic_frequency: 11.0, distance_3d: 0.66, confidence: 0.78 },
  { source_gene: 'HNF4A',  target_gene: 'PPARG',  hic_frequency: 16.4, distance_3d: 0.54, confidence: 0.87 },
  { source_gene: 'COMT',   target_gene: 'CACNA1C', hic_frequency: 7.5, distance_3d: 0.77, confidence: 0.67 },
];
