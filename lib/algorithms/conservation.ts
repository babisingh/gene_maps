// ============================================================
// Cross-Species Conservation Analyzer
//
// Fetches real ortholog data from ENSEMBL and computes a
// conservation profile across 10 model organism species.
//
// Scoring:
//   - Percent identity from ENSEMBL ortholog data
//   - Weighted by evolutionary distance from human
//   - Final score: 0–100 (percent)
// ============================================================

import { fetchOrthologDataBySymbol } from '../data-fetchers/ensembl';
import { cacheGet, cacheSet, cacheKey } from '../database/redis';
import type { ConservationData, SpeciesConservation } from '../../types';

// Target species with evolutionary distance weights.
// Closer to human = higher weight for conservation score.
const CONSERVATION_SPECIES: Array<{
  ensembl_name: string;  // ENSEMBL species name
  common_name: string;
  taxon_id: number;
  distance_weight: number; // 0–1, higher = closer to human
}> = [
  { ensembl_name: 'mus_musculus',          common_name: 'Mouse',       taxon_id: 10090, distance_weight: 0.90 },
  { ensembl_name: 'rattus_norvegicus',     common_name: 'Rat',         taxon_id: 10116, distance_weight: 0.88 },
  { ensembl_name: 'canis_lupus_familiaris',common_name: 'Dog',         taxon_id: 9615,  distance_weight: 0.82 },
  { ensembl_name: 'sus_scrofa',            common_name: 'Pig',         taxon_id: 9823,  distance_weight: 0.80 },
  { ensembl_name: 'bos_taurus',            common_name: 'Cow',         taxon_id: 9913,  distance_weight: 0.78 },
  { ensembl_name: 'gallus_gallus',         common_name: 'Chicken',     taxon_id: 9031,  distance_weight: 0.60 },
  { ensembl_name: 'xenopus_tropicalis',    common_name: 'Frog',        taxon_id: 8364,  distance_weight: 0.45 },
  { ensembl_name: 'danio_rerio',           common_name: 'Zebrafish',   taxon_id: 7955,  distance_weight: 0.40 },
  { ensembl_name: 'drosophila_melanogaster', common_name: 'Fruit fly', taxon_id: 7227,  distance_weight: 0.25 },
  { ensembl_name: 'caenorhabditis_elegans', common_name: 'Nematode',   taxon_id: 6239,  distance_weight: 0.15 },
];

const CACHE_TTL = parseInt(process.env.CACHE_TTL_CONSERVATION ?? '86400', 10);

export class ConservationAnalyzer {
  /**
   * Full conservation analysis for a gene across 10 species.
   * Uses real ENSEMBL ortholog data with Redis caching.
   *
   * @param geneSymbol   Gene symbol (e.g. "GCG")
   * @param ensemblId    ENSEMBL gene ID (e.g. "ENSG00000115263")
   */
  async analyzeGeneConservation(
    geneSymbol: string,
    ensemblId: string
  ): Promise<ConservationData> {
    const key = cacheKey('conservation', geneSymbol);
    const cached = await cacheGet<ConservationData>(key);
    if (cached) return cached;

    let orthologs: Awaited<ReturnType<typeof fetchOrthologDataBySymbol>> = [];
    let apiWarning: string | undefined;

    try {
      orthologs = await fetchOrthologDataBySymbol(geneSymbol);
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      console.warn(`[conservation] ENSEMBL ortholog fetch failed for ${ensemblId}: ${msg}`);
      apiWarning =
        'ENSEMBL ortholog API is currently unavailable — conservation scores are shown as 0%. ' +
        'The ENSEMBL ID was resolved successfully; try again later to load real data.';
    }

    // Build a map: species_name → best ortholog percent_identity
    const orthologMap = new Map<string, { perc_id: number; ortholog_id: string; ortholog_symbol: string }>();

    for (const o of orthologs) {
      const speciesKey = o.target?.species;
      if (!speciesKey) continue;

      const existing = orthologMap.get(speciesKey);
      // Keep the highest-identity ortholog per species
      if (!existing || o.target.perc_id > existing.perc_id) {
        orthologMap.set(speciesKey, {
          perc_id: o.target.perc_id,
          ortholog_id: o.target.id,
          ortholog_symbol: o.target.display_label ?? '',
        });
      }
    }

    // Build conservation profile
    const speciesConservation: SpeciesConservation[] = [];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const sp of CONSERVATION_SPECIES) {
      const ortholog = orthologMap.get(sp.ensembl_name);
      const score = ortholog?.perc_id ?? 0; // 0 = not conserved / not found

      speciesConservation.push({
        name: sp.ensembl_name.replace(/_/g, ' '),
        common_name: sp.common_name,
        taxon_id: sp.taxon_id,
        conservation_score: parseFloat(score.toFixed(1)),
        ortholog_id: ortholog?.ortholog_id ?? '',
        ortholog_symbol: ortholog?.ortholog_symbol ?? 'N/A',
      });

      // Weight by evolutionary distance for the summary score
      weightedSum += score * sp.distance_weight;
      totalWeight += sp.distance_weight;
    }

    const averageConservation = totalWeight > 0
      ? parseFloat((weightedSum / totalWeight).toFixed(1))
      : 0;

    const result: ConservationData = {
      gene_symbol: geneSymbol,
      average_conservation: averageConservation,
      species: speciesConservation,
      ...(apiWarning ? { api_warning: apiWarning } : {}),
      computed_at: new Date().toISOString(),
    };

    await cacheSet(key, result, CACHE_TTL);
    return result;
  }

  /**
   * Get a 0–10 conservation score suitable for use in spatial scoring.
   * Converts average_conservation (0–100%) → 0–10 scale.
   */
  async getConservationScore(geneSymbol: string, ensemblId: string): Promise<number> {
    const data = await this.analyzeGeneConservation(geneSymbol, ensemblId);
    return data.average_conservation / 10;
  }
}
