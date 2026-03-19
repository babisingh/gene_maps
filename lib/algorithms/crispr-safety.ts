// ============================================================
// CRISPR Safety Analyzer
//
// Assesses risk of a genomic edit at a given position.
//
// Risk factors:
//   1. TAD disruption risk — proximity to TAD boundary × boundary strength
//   2. Off-target risk — density of spatial neighbors (Hi-C contacts)
//   3. Conservation constraint — PhyloP score at the edit site (UCSC)
//
// Safety score = 10 − (0.6 × TAD_risk + 0.4 × off_target_risk)
// Range: 0 (dangerous) → 10 (very safe)
//
// Biological rationale:
//   TADs (Topologically Associating Domains) are ~1Mb chromatin domains
//   that insulate regulatory elements. CTCF proteins bind at TAD boundaries
//   and their density is a validated proxy for boundary strength
//   (Dixon et al. 2012 Nature; Rao et al. 2014 Cell).
//   Editing near a boundary disrupts insulation → ectopic enhancer-gene
//   contacts → dysregulation of multiple genes (Lupiáñez et al. 2015 Cell).
// ============================================================

import { SpatialGraphDB } from '../database/neo4j';
import { fetchCTCFSitesCount, fetchPhyloPScore } from '../data-fetchers/ucsc';
import { cacheGet, cacheSet, cacheKey } from '../database/redis';
import type { CRISPRSafetyData, TADContext } from '../../types';

const CACHE_TTL = 3600; // 1 hour

// CTCF density thresholds derived from ENCODE data (GEO: GSE30263)
// ≥15 sites/100kb window → very near a boundary (typical boundary footprint)
// 8–14 sites            → near boundary (transition zone)
// 3–7 sites             → moderate distance
// 0–2 sites             → deep within TAD interior
const CTCF_BOUNDARY_THRESHOLDS = {
  VERY_HIGH: 15,  // ≥15 CTCF sites → estimated distance 2–15 kb
  HIGH:      8,   // 8–14            → estimated 15–50 kb
  MODERATE:  3,   // 3–7             → estimated 50–150 kb
  LOW:       0,   // 0–2             → estimated 150–500 kb
};

// Typical TAD size in human genome: 200kb–2Mb, median ~880kb
// We use ±440kb as the canonical half-TAD radius for boundary estimates
const HALF_TAD_RADIUS_BP = 440_000;

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

    // Get gene info for chromosome auto-detection
    const gene = await this.graphDB.getGene(geneSymbol);
    const chrom = chromosome ?? gene?.chromosome ?? 'chr1';

    // Run all three risk assessments in parallel for performance
    const [tadContext, neighbors, conservationConstraint] = await Promise.all([
      this.getTADContext(chrom, editPosition),
      this.graphDB.getTopSpatialNeighbors(geneSymbol, 20),
      this.fetchConservationConstraint(chrom, editPosition),
    ]);

    const tadRisk = this.calculateTADRisk(tadContext);
    const offTargetRisk = this.calculateOffTargetRisk(
      neighbors.length,
      neighbors.map((n) => n.confidence)
    );

    // Safety score penalizes TAD risk (60%) and off-target risk (40%).
    // Conservation constraint is reported separately as it informs edit strategy
    // rather than directly contraindicate the edit.
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
      recommendations: this.generateRecommendations(
        safetyScore,
        tadRisk,
        offTargetRisk,
        conservationConstraint
      ),
      computed_at: new Date().toISOString(),
    };

    await cacheSet(cKey, result, CACHE_TTL);
    return result;
  }

  // ── Private methods ───────────────────────────────────────

  /**
   * Estimate TAD context using CTCF site density from UCSC ENCODE data.
   *
   * Method: CTCF ChIP-seq peaks are enriched at TAD boundaries.
   * We query the ENCODE clustered CTCF track in a ±50kb window around
   * the edit site. High density → near boundary.
   *
   * Distance estimation is DETERMINISTIC — based on CTCF count thresholds,
   * no randomness. Same position always yields same estimate.
   */
  private async getTADContext(chromosome: string, position: number): Promise<TADContext> {
    const ctcfCount = await fetchCTCFSitesCount(chromosome, position, 50_000);

    // Boundary strength: proportional to CTCF density.
    // Normalized to [0,1] using VERY_HIGH threshold as ceiling.
    const boundaryStrength = Math.min(1, ctcfCount / CTCF_BOUNDARY_THRESHOLDS.VERY_HIGH);

    // Deterministic distance estimate from CTCF count tiers.
    // Uses the midpoint of each tier's expected range to ensure
    // reproducibility — same input always produces same output.
    let distanceToBoundary: number;
    if (ctcfCount >= CTCF_BOUNDARY_THRESHOLDS.VERY_HIGH) {
      // Very near boundary: 2–15 kb range, use midpoint 8 kb
      distanceToBoundary = 8_000;
    } else if (ctcfCount >= CTCF_BOUNDARY_THRESHOLDS.HIGH) {
      // Near boundary: 15–50 kb range, use midpoint 32 kb
      // Scale linearly within range based on exact count
      const fraction = (ctcfCount - CTCF_BOUNDARY_THRESHOLDS.HIGH) /
                       (CTCF_BOUNDARY_THRESHOLDS.VERY_HIGH - CTCF_BOUNDARY_THRESHOLDS.HIGH);
      distanceToBoundary = Math.round(50_000 - fraction * 35_000); // 15k–50k
    } else if (ctcfCount >= CTCF_BOUNDARY_THRESHOLDS.MODERATE) {
      // Moderate: 50–150 kb range
      const fraction = (ctcfCount - CTCF_BOUNDARY_THRESHOLDS.MODERATE) /
                       (CTCF_BOUNDARY_THRESHOLDS.HIGH - CTCF_BOUNDARY_THRESHOLDS.MODERATE);
      distanceToBoundary = Math.round(150_000 - fraction * 100_000); // 50k–150k
    } else {
      // TAD interior: 150–500 kb range, scale by inverse CTCF count
      const fraction = Math.max(0, ctcfCount) /
                       Math.max(1, CTCF_BOUNDARY_THRESHOLDS.MODERATE);
      distanceToBoundary = Math.round(500_000 - fraction * 350_000); // 150k–500k
    }

    return {
      chromosome,
      tad_start: position - HALF_TAD_RADIUS_BP,
      tad_end: position + HALF_TAD_RADIUS_BP,
      boundary_strength: parseFloat(boundaryStrength.toFixed(2)),
      distance_to_boundary: distanceToBoundary,
    };
  }

  /**
   * TAD disruption risk from proximity and boundary strength.
   *
   * Biological basis: Risk is proportional to both HOW CLOSE the edit
   * is to the boundary AND how STRONG the boundary is.
   * A strong boundary at TAD edges contains active enhancers; disrupting it
   * allows promiscuous enhancer-gene contacts (Lupiáñez et al. 2015 Cell).
   *
   * Distance decay: Linear decay to zero at 200kb (beyond this, editing
   * rarely disrupts boundary function per published perturbation studies).
   */
  private calculateTADRisk(tadContext: TADContext): number {
    const { distance_to_boundary, boundary_strength } = tadContext;
    const MAX_RISK_DISTANCE_BP = 200_000;

    const distanceRiskFactor = Math.max(
      0,
      1 - distance_to_boundary / MAX_RISK_DISTANCE_BP
    );
    const risk = distanceRiskFactor * boundary_strength * 10;

    return Math.min(10, Math.max(0, risk));
  }

  /**
   * Off-target risk from spatial neighborhood density.
   *
   * Biological basis: Genes in close spatial proximity (Hi-C contacts)
   * share regulatory machinery. Highly connected genes are more likely
   * to have paralogs or regulatory elements that cross-react with
   * guide RNAs designed for the target gene.
   *
   * Risk increases with: number of neighbors AND their contact confidence.
   */
  private calculateOffTargetRisk(
    neighborCount: number,
    confidences: number[]
  ): number {
    if (neighborCount === 0) return 2.0; // Minimal but non-zero baseline

    const avgConf = confidences.reduce((s, c) => s + c, 0) / confidences.length;
    // Normalized density: 20 neighbors = maximum density (from our seed data range)
    const densityRisk = Math.min(1, neighborCount / 20);
    const risk = densityRisk * avgConf * 10;

    return Math.min(10, Math.max(0, risk));
  }

  /**
   * Conservation constraint at the edit site using UCSC PhyloP100way.
   *
   * PhyloP (phylogenetic p-value) measures evolutionary conservation at
   * each base. Positive scores = conserved (selection against change).
   * Negative scores = accelerated evolution (selection for change).
   *
   * Scoring (from Pollard et al. 2010 Nature Reviews Genetics):
   *   PhyloP > +2.0  → highly constrained (e.g., splice sites, active sites)
   *   PhyloP 0–2.0   → moderately conserved
   *   PhyloP < 0     → lineage-specific or neutral
   *
   * We fetch a 200bp window centered on the edit position to capture
   * local conservation context, then scale to 0–10.
   *
   * High constraint (score ≥ 7) → recommend base editing over DSB-inducing
   * Cas9 to minimize functional disruption.
   */
  private async fetchConservationConstraint(
    chromosome: string,
    position: number
  ): Promise<number> {
    try {
      // 200bp window centered on edit position captures local constraint context
      const windowBp = 100;
      const start = Math.max(0, position - windowBp);
      const end = position + windowBp;

      const phyloPScore = await fetchPhyloPScore(chromosome, start, end);
      return phyloPScore; // Already normalized to 0–10 by fetchPhyloPScore
    } catch {
      // Neutral fallback — does not inflate or deflate safety score
      return 5.0;
    }
  }

  private generateRecommendations(
    safetyScore: number,
    tadRisk: number,
    offTargetRisk: number,
    conservationConstraint: number
  ): string[] {
    const recs: string[] = [];

    // Overall safety verdict
    if (safetyScore >= 7) {
      recs.push('Edit position is relatively safe based on spatial genomic context.');
    } else if (safetyScore >= 4) {
      recs.push('Moderate risk — proceed with caution and orthogonal validation.');
    } else {
      recs.push(
        'High-risk edit position — strongly consider alternative sites or safer genome-editing modalities.'
      );
    }

    // TAD disruption guidance
    if (tadRisk >= 7) {
      recs.push(
        `Very high TAD disruption risk (${tadRisk.toFixed(1)}/10). ` +
        'Edit site is within ~50kb of a strong CTCF-anchored TAD boundary. ' +
        'Disruption risks ectopic enhancer-gene contacts affecting multiple flanking genes. ' +
        'Shift the cut site >100kb from the boundary, or use a catalytically inactive dCas9 ' +
        'approach (CRISPRi/a) which does not create DSBs.'
      );
    } else if (tadRisk >= 4) {
      recs.push(
        `Moderate TAD disruption risk (${tadRisk.toFixed(1)}/10). ` +
        'Monitor expression of genes flanking the TAD boundary post-editing. ' +
        'Validate with 4C-seq or Capture Hi-C to confirm insulation is preserved.'
      );
    }

    // Off-target guidance
    if (offTargetRisk >= 7) {
      recs.push(
        `High off-target risk (${offTargetRisk.toFixed(1)}/10) — dense spatial neighborhood detected. ` +
        'Use a high-fidelity Cas9 variant: eSpCas9(1.1), HiFi Cas9, or evoCas9. ' +
        'Perform GUIDE-seq or CIRCLE-seq genome-wide off-target profiling. ' +
        'Whole-genome sequencing of edited clones is mandatory.'
      );
    } else if (offTargetRisk >= 4) {
      recs.push(
        `Moderate off-target risk (${offTargetRisk.toFixed(1)}/10). ` +
        'Run in silico off-target prediction (CRISPOR, Cas-OFFinder) before proceeding. ' +
        'Validate top 5 predicted off-target sites by targeted sequencing.'
      );
    }

    // Conservation constraint guidance
    if (conservationConstraint >= 8) {
      recs.push(
        `High evolutionary constraint at edit site (PhyloP score: ${conservationConstraint.toFixed(1)}/10). ` +
        'This position is under strong purifying selection across vertebrates. ' +
        'Any nucleotide change is likely to have functional consequences. ' +
        'Prefer base editing (ABE/CBE) or prime editing to minimize off-pathway outcomes. ' +
        'If using Cas9, restrict to synonymous or non-coding edits where possible.'
      );
    } else if (conservationConstraint >= 6) {
      recs.push(
        `Moderate evolutionary constraint (PhyloP: ${conservationConstraint.toFixed(1)}/10). ` +
        'Functional impact is likely — validate edited cells with phenotypic assays.'
      );
    }

    // Positive guidance when low risk
    if (tadRisk < 3 && offTargetRisk < 3 && conservationConstraint < 5) {
      recs.push(
        'Low-risk profile overall. Standard SpCas9 + sgRNA delivery is appropriate. ' +
        'Confirm on-target editing efficiency by amplicon sequencing (ICE or TIDE analysis).'
      );
    }

    return recs;
  }
}
