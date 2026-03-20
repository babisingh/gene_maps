// ============================================================
// Drug Target Scoring Algorithm
//
// Combines spatial score, structural features, and tissue
// specificity into a final druggability score.
//
// Exposed as a standalone module so it can be called
// independently from the spatial scoring engine.
// ============================================================

import { SpatialScoringEngine } from './spatial-scoring';
import { fetchTopExpressingTissues, fetchTissueSpecificityScore } from '../data-fetchers/gtex';
import { fetchProteinInteractions } from '../data-fetchers/string-db';
import { cacheGet, cacheSet, cacheKey } from '../database/redis';
import type { DrugTargetScore } from '../../types';

const CACHE_TTL = 3600;

export class DrugTargetScorer {
  private scoringEngine = new SpatialScoringEngine();

  /**
   * Full drug target scoring for a gene.
   */
  async scoreDrugTarget(
    geneSymbol: string,
    ensemblId: string
  ): Promise<DrugTargetScore> {
    const key = cacheKey('drug_target', geneSymbol);
    const cached = await cacheGet<DrugTargetScore>(key);
    if (cached) return cached;

    const [spatialResult, tissueResult, interactionResult] = await Promise.allSettled([
      this.scoringEngine.calculateSpatialScore(geneSymbol, ensemblId),
      fetchTissueSpecificityScore(geneSymbol),
      fetchProteinInteractions(geneSymbol, 700, 10),
      fetchTopExpressingTissues(geneSymbol, 3),
    ]);

    const spatialScore = spatialResult.status === 'fulfilled'
      ? spatialResult.value.total_score
      : 5.0;

    const tissueScore = tissueResult.status === 'fulfilled'
      ? tissueResult.value
      : 5.0;

    // Structural features proxy: high conservation + many interactions = good pocket
    const interactions = interactionResult.status === 'fulfilled'
      ? interactionResult.value
      : [];
    const interactionDensity = Math.min(10, interactions.length * 0.5);
    const structuralFeatures = (spatialScore * 0.6 + interactionDensity * 0.4);

    const druggabilityScore = parseFloat(
      (0.40 * spatialScore + 0.30 * structuralFeatures + 0.30 * tissueScore).toFixed(2)
    );

    // Infer likely drug classes from interaction types
    const drugClasses = this.inferDrugClasses(
      interactions.map((i) => i.preferredName_B ?? '')
    );

    const result: DrugTargetScore = {
      gene_symbol: geneSymbol,
      druggability_score: Math.min(10, Math.max(0, druggabilityScore)),
      spatial_contribution: spatialScore,
      structural_features: parseFloat(structuralFeatures.toFixed(2)),
      tissue_specificity: tissueScore,
      drug_classes: drugClasses,
      computed_at: new Date().toISOString(),
    };

    await cacheSet(key, result, CACHE_TTL);
    return result;
  }

  private inferDrugClasses(interactingGenes: string[]): string[] {
    const classes: string[] = [];
    // Simplified heuristic — in production, use UniProt annotations
    if (interactingGenes.some((g) => g.includes('KIN') || g.includes('CDK'))) {
      classes.push('Kinase inhibitor');
    }
    if (interactingGenes.some((g) => g.includes('R') || g.includes('EGFR'))) {
      classes.push('Monoclonal antibody');
    }
    if (classes.length === 0) {
      classes.push('Small molecule');
    }
    return classes;
  }
}
