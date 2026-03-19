// ============================================================
// Spatial Scoring Engine
//
// Computes a composite "spatial score" indicating how privileged
// a gene is in 3D genome space.
//
// Formula:
//   spatial = 0.25 × conservation
//           + 0.20 × accessibility
//           + 0.25 × network_centrality
//           + 0.20 × interaction_strength
//           + 0.10 × expression_plasticity
//
// All component scores are on a 0–10 scale.
// ============================================================

import { SpatialGraphDB } from '../database/neo4j';
import { ConservationAnalyzer } from './conservation';
import { fetchNetworkCentralityScore } from '../data-fetchers/string-db';
import { fetchPhyloPScore } from '../data-fetchers/ucsc';
import { fetchTissueSpecificityScore } from '../data-fetchers/gtex';
import { cacheGet, cacheSet, cacheKey } from '../database/redis';
import type { SpatialScore, SpatialScoreComponents } from '../../types';

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SPATIAL_SCORE ?? '3600', 10);

export class SpatialScoringEngine {
  private graphDB = new SpatialGraphDB();
  private conservationAnalyzer = new ConservationAnalyzer();

  /**
   * Calculate the full spatial score for a gene.
   *
   * @param geneSymbol  Gene symbol (e.g. "GCG")
   * @param ensemblId   ENSEMBL gene ID (required for conservation lookup)
   */
  async calculateSpatialScore(
    geneSymbol: string,
    ensemblId: string
  ): Promise<SpatialScore> {
    const key = cacheKey('spatial_score', geneSymbol);
    const cached = await cacheGet<SpatialScore>(key);
    if (cached) return cached;

    // Fetch all components in parallel for performance
    const [
      conservationScore,
      accessibilityScore,
      networkCentrality,
      interactionStrength,
      expressionScore,
    ] = await Promise.allSettled([
      this.getConservationScore(geneSymbol, ensemblId),
      this.getAccessibilityScore(geneSymbol),
      this.getNetworkCentrality(geneSymbol),
      this.getInteractionStrength(geneSymbol),
      this.getExpressionPlasticity(geneSymbol),
    ]);

    const components: SpatialScoreComponents = {
      conservation:  resolveScore(conservationScore,  6.0),
      accessibility: resolveScore(accessibilityScore, 5.0),
      centrality:    resolveScore(networkCentrality,  5.0),
      interactions:  resolveScore(interactionStrength,5.0),
      expression:    resolveScore(expressionScore,    5.0),
    };

    const totalScore = parseFloat(
      (
        0.25 * components.conservation +
        0.20 * components.accessibility +
        0.25 * components.centrality +
        0.20 * components.interactions +
        0.10 * components.expression
      ).toFixed(2)
    );

    const dataSources: string[] = [];
    if (conservationScore.status === 'fulfilled') dataSources.push('ENSEMBL orthologs');
    if (accessibilityScore.status === 'fulfilled') dataSources.push('UCSC PhyloP');
    if (networkCentrality.status === 'fulfilled') dataSources.push('STRING DB');
    if (interactionStrength.status === 'fulfilled') dataSources.push('Neo4j Hi-C');
    if (expressionScore.status === 'fulfilled') dataSources.push('GTEx');

    const result: SpatialScore = {
      gene_symbol: geneSymbol,
      total_score: Math.min(10, Math.max(0, totalScore)),
      components,
      confidence: dataSources.length / 5,  // 0–1 based on how many sources succeeded
      data_sources: dataSources,
      computed_at: new Date().toISOString(),
    };

    await cacheSet(key, result, CACHE_TTL);
    return result;
  }

  /**
   * Calculate druggability score.
   * Combines spatial score with structural features and tissue specificity.
   */
  async calculateDruggabilityScore(
    geneSymbol: string,
    ensemblId: string
  ): Promise<number> {
    const key = cacheKey('druggability', geneSymbol);
    const cached = await cacheGet<number>(key);
    if (cached !== null) return cached;

    const [spatialResult, tissueSpec] = await Promise.allSettled([
      this.calculateSpatialScore(geneSymbol, ensemblId),
      fetchTissueSpecificityScore(geneSymbol),
    ]);

    const spatialScore = spatialResult.status === 'fulfilled'
      ? spatialResult.value.total_score
      : 5.0;

    const tissueScore = tissueSpec.status === 'fulfilled'
      ? tissueSpec.value
      : 5.0;

    // Structural features are estimated from conservation + interaction data
    // (proxy for pocket accessibility)
    const structuralFeatures = spatialScore * 0.7 + tissueScore * 0.3;

    const druggability = parseFloat(
      (0.40 * spatialScore + 0.30 * structuralFeatures + 0.30 * tissueScore).toFixed(2)
    );

    const clamped = Math.min(10, Math.max(0, druggability));
    await cacheSet(key, clamped, CACHE_TTL);
    return clamped;
  }

  // ── Private component calculators ────────────────────────

  private async getConservationScore(geneSymbol: string, ensemblId: string): Promise<number> {
    return this.conservationAnalyzer.getConservationScore(geneSymbol, ensemblId);
  }

  /**
   * Accessibility score from UCSC PhyloP.
   * Highly conserved → often open chromatin → accessible.
   * Uses gene coordinates from Neo4j.
   */
  private async getAccessibilityScore(geneSymbol: string): Promise<number> {
    const gene = await this.graphDB.getGene(geneSymbol);
    if (!gene) return 5.0;

    const phyloP = await fetchPhyloPScore(
      gene.chromosome,
      gene.start_pos,
      Math.min(gene.start_pos + 5000, gene.end_pos) // promoter region
    );

    return phyloP;
  }

  /** Network centrality from STRING DB interactions. */
  private async getNetworkCentrality(geneSymbol: string): Promise<number> {
    return fetchNetworkCentralityScore(geneSymbol);
  }

  /**
   * Interaction strength from stored Hi-C data in Neo4j.
   * Average of top neighbor interaction frequencies, normalized.
   */
  private async getInteractionStrength(geneSymbol: string): Promise<number> {
    const neighbors = await this.graphDB.getTopSpatialNeighbors(geneSymbol, 10);
    if (neighbors.length === 0) return 3.0;

    const avgFreq = neighbors.reduce((s, n) => s + n.interaction_strength, 0) / neighbors.length;
    // Normalize: typical Hi-C freq range 0–30+
    return Math.min(10, (avgFreq / 20) * 10);
  }

  /**
   * Expression plasticity = inverse of tissue specificity (GTEx Tau index).
   * Broadly expressed genes (low Tau, specificity near 0) → high plasticity → score near 10.
   * Highly tissue-specific genes (Tau near 1, specificity near 10) → low plasticity → score near 0.
   *
   * Using full range (10 − specificity) for maximum granularity across the 0–10 scale.
   */
  private async getExpressionPlasticity(geneSymbol: string): Promise<number> {
    const specificity = await fetchTissueSpecificityScore(geneSymbol);
    // Full inversion: low Tau (ubiquitous) = high plasticity score
    return Math.min(10, Math.max(0, 10 - specificity));
  }
}

// ── Helpers ───────────────────────────────────────────────────

function resolveScore(
  result: PromiseSettledResult<number>,
  fallback: number
): number {
  if (result.status === 'fulfilled') {
    return Math.min(10, Math.max(0, result.value));
  }
  console.warn('[spatial-scoring] Component failed, using fallback:', result.reason);
  return fallback;
}
