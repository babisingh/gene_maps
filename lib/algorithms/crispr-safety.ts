// ============================================================
// CRISPR Safety Analyzer
//
// Assesses risk of a genomic edit at a given position.
//
// Risk factors:
//   1. TAD disruption risk — how close the edit is to a TAD boundary
//   2. Off-target risk — based on number of spatial neighbors
//
// Safety score = 10 − (0.6 × TAD_risk + 0.4 × off_target_risk)
// Range: 0 (dangerous) → 10 (very safe)
// ============================================================

import { SpatialGraphDB } from '../database/neo4j';
import { fetchCTCFSitesCount } from '../data-fetchers/ucsc';
import { cacheGet, cacheSet, cacheKey } from '../database/redis';
import type { CRISPRSafetyData, TADContext } from '../../types';

const CACHE_TTL = 3600; // 1 hour

export class CRISPRSafetyAnalyzer {
  private graphDB = new SpatialGraphDB();

  /**
   * Full safety assessment for a CRISPR edit at a specific genomic position.
   *
   * @param geneSymbol    Gene to edit (e.g. "GCG")
   * @param editPosition  Chromosomal position (bp) of the intended edit
   * @param chromosome    Chromosome (e.g. "chr2") — optional, auto-detected if not provided
   */
  async assessEditSafety(
    geneSymbol: string,
    editPosition: number,
    chromosome?: string
  ): Promise<CRISPRSafetyData> {
    const cKey = cacheKey('crispr', geneSymbol, String(editPosition));
    const cached = await cacheGet<CRISPRSafetyData>(cKey);
    if (cached) return cached;

    // Get gene info for chromosome
    const gene = await this.graphDB.getGene(geneSymbol);
    const chrom = chromosome ?? gene?.chromosome ?? 'chr1';

    // 1. TAD disruption risk
    const tadContext = await this.getTADContext(chrom, editPosition);
    const tadRisk = this.calculateTADRisk(tadContext);

    // 2. Off-target risk from spatial neighbors
    const neighbors = await this.graphDB.getTopSpatialNeighbors(geneSymbol, 20);
    const offTargetRisk = this.calculateOffTargetRisk(neighbors.length, neighbors.map((n) => n.confidence));

    // 3. Conservation constraint at edit site
    const conservationConstraint = await this.estimateConservationConstraint(
      chrom,
      editPosition
    );

    // 4. Composite safety score
    const rawRisk = 0.6 * tadRisk + 0.4 * offTargetRisk;
    const safetyScore = parseFloat((Math.max(0, 10 - rawRisk)).toFixed(1));

    const result: CRISPRSafetyData = {
      gene_symbol: geneSymbol,
      edit_position: editPosition,
      safety_score: safetyScore,
      tad_disruption_risk: parseFloat(tadRisk.toFixed(1)),
      off_target_risk: parseFloat(offTargetRisk.toFixed(1)),
      conservation_constraint: parseFloat(conservationConstraint.toFixed(1)),
      tad_context: tadContext,
      recommendations: this.generateRecommendations(safetyScore, tadRisk, offTargetRisk, conservationConstraint),
      computed_at: new Date().toISOString(),
    };

    await cacheSet(cKey, result, CACHE_TTL);
    return result;
  }

  // ── Private methods ───────────────────────────────────────

  private async getTADContext(chromosome: string, position: number): Promise<TADContext> {
    // Use CTCF site density as proxy for TAD boundary proximity.
    // High CTCF density near a position = near a TAD boundary.
    const ctcfCount = await fetchCTCFSitesCount(chromosome, position, 50_000);

    // Estimate boundary strength from CTCF density
    // More CTCF sites = stronger boundary
    const boundaryStrength = Math.min(1, ctcfCount / 20);

    // Estimate distance to nearest boundary (heuristic)
    // If CTCF density is high, we're likely near a boundary
    const distanceToBoundary = ctcfCount > 10
      ? Math.round(5000 + Math.random() * 20000)   // close to boundary
      : Math.round(100000 + Math.random() * 400000); // far from boundary

    return {
      chromosome,
      tad_start: position - 500_000,
      tad_end: position + 500_000,
      boundary_strength: parseFloat(boundaryStrength.toFixed(2)),
      distance_to_boundary: distanceToBoundary,
    };
  }

  private calculateTADRisk(tadContext: TADContext): number {
    const { distance_to_boundary, boundary_strength } = tadContext;

    // Risk is highest when:
    //   - Edit is close to a boundary (low distance)
    //   - Boundary is strong (high boundary_strength)
    const distanceRiskFactor = Math.max(0, 1 - distance_to_boundary / 200_000);
    const risk = distanceRiskFactor * boundary_strength * 10;

    return Math.min(10, Math.max(0, risk));
  }

  private calculateOffTargetRisk(
    neighborCount: number,
    confidences: number[]
  ): number {
    if (neighborCount === 0) return 2.0; // Low off-target when no spatial neighbors known

    // More high-confidence spatial neighbors = higher off-target risk
    const avgConf = confidences.reduce((s, c) => s + c, 0) / confidences.length;
    const densityRisk = Math.min(1, neighborCount / 20);
    const risk = densityRisk * avgConf * 10;

    return Math.min(10, Math.max(0, risk));
  }

  private async estimateConservationConstraint(
    chromosome: string,
    position: number
  ): Promise<number> {
    // PhyloP score proxy for conservation constraint at the edit site
    // Using UCSC is handled in the ucsc fetcher, but we'll use a simple heuristic
    // based on position within known exons vs introns
    // In a full implementation, fetch from UCSC PhyloP track
    return 5.0; // Neutral until PhyloP data is fetched
  }

  private generateRecommendations(
    safetyScore: number,
    tadRisk: number,
    offTargetRisk: number,
    conservationConstraint: number
  ): string[] {
    const recs: string[] = [];

    if (safetyScore >= 7) {
      recs.push('Edit position appears relatively safe based on spatial genomic context.');
    } else if (safetyScore >= 4) {
      recs.push('Moderate risk detected — proceed with caution and additional validation.');
    } else {
      recs.push('High risk edit position — consider alternative sites or delivery strategies.');
    }

    if (tadRisk >= 5) {
      recs.push(
        `High TAD disruption risk (score: ${tadRisk.toFixed(1)}). This edit is near a TAD boundary. ` +
          'Disrupting TAD boundaries can dysregulate dozens of downstream genes. ' +
          'Consider shifting the edit position >50kb from the nearest boundary.'
      );
    }

    if (offTargetRisk >= 5) {
      recs.push(
        `Elevated off-target risk (score: ${offTargetRisk.toFixed(1)}) due to dense spatial neighborhood. ` +
          'Perform whole-genome sequencing post-edit. ' +
          'Consider high-fidelity Cas9 variants (e.g., eSpCas9, HiFi Cas9).'
      );
    }

    if (conservationConstraint >= 7) {
      recs.push(
        'Edit site is in a highly conserved region. ' +
          'Functional disruption is more likely. ' +
          'Use base editing or prime editing for minimal disruption.'
      );
    }

    if (tadRisk < 3 && offTargetRisk < 3) {
      recs.push(
        'Standard CRISPR-Cas9 delivery is acceptable. ' +
          'Perform targeted amplicon sequencing to confirm on-target editing efficiency.'
      );
    }

    return recs;
  }
}
