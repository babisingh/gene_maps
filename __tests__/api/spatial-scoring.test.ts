// ============================================================
// Tests for SpatialScoringEngine
// Uses mocked dependencies — no live DB or API calls.
// ============================================================

import { SpatialScoringEngine } from '@/lib/algorithms/spatial-scoring';

// Mock all external dependencies
jest.mock('@/lib/database/neo4j', () => ({
  SpatialGraphDB: jest.fn().mockImplementation(() => ({
    getGene: jest.fn().mockResolvedValue({
      symbol: 'GCG',
      ensembl_id: 'ENSG00000115263',
      chromosome: 'chr2',
      start_pos: 161991038,
      end_pos: 162001815,
      description: 'Glucagon',
      spatial_score: 8.7,
      druggability_score: 7.2,
    }),
    getTopSpatialNeighbors: jest.fn().mockResolvedValue([
      { gene: 'INS', interaction_strength: 15.2, confidence: 0.88 },
      { gene: 'POMC', interaction_strength: 8.4, confidence: 0.75 },
      { gene: 'LEP', interaction_strength: 6.1, confidence: 0.70 },
    ]),
  })),
}));

jest.mock('@/lib/algorithms/conservation', () => ({
  ConservationAnalyzer: jest.fn().mockImplementation(() => ({
    getConservationScore: jest.fn().mockResolvedValue(8.5),
  })),
}));

jest.mock('@/lib/data-fetchers/string-db', () => ({
  fetchNetworkCentralityScore: jest.fn().mockResolvedValue(7.2),
}));

jest.mock('@/lib/data-fetchers/ucsc', () => ({
  fetchPhyloPScore: jest.fn().mockResolvedValue(6.8),
}));

jest.mock('@/lib/data-fetchers/gtex', () => ({
  fetchTissueSpecificityScore: jest.fn().mockResolvedValue(4.5),
  fetchTopExpressingTissues: jest.fn().mockResolvedValue([
    { tissue: 'Pancreas', median_tpm: 245.3 },
    { tissue: 'Small Intestine', median_tpm: 182.7 },
  ]),
}));

jest.mock('@/lib/database/redis', () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheKey: (...parts: string[]) => `sp:${parts.join(':')}`,
}));

describe('SpatialScoringEngine', () => {
  let engine: SpatialScoringEngine;

  beforeEach(() => {
    engine = new SpatialScoringEngine();
    jest.clearAllMocks();
  });

  describe('calculateSpatialScore', () => {
    it('returns a score object with required fields', async () => {
      const score = await engine.calculateSpatialScore('GCG', 'ENSG00000115263');

      expect(score).toMatchObject({
        gene_symbol: 'GCG',
        total_score: expect.any(Number),
        components: {
          conservation: expect.any(Number),
          accessibility: expect.any(Number),
          centrality: expect.any(Number),
          interactions: expect.any(Number),
          expression: expect.any(Number),
        },
        confidence: expect.any(Number),
        data_sources: expect.any(Array),
        computed_at: expect.any(String),
      });
    });

    it('total_score is within 0–10 range', async () => {
      const score = await engine.calculateSpatialScore('GCG', 'ENSG00000115263');
      expect(score.total_score).toBeGreaterThanOrEqual(0);
      expect(score.total_score).toBeLessThanOrEqual(10);
    });

    it('all component scores are within 0–10 range', async () => {
      const score = await engine.calculateSpatialScore('GCG', 'ENSG00000115263');
      const { conservation, accessibility, centrality, interactions, expression } = score.components;

      [conservation, accessibility, centrality, interactions, expression].forEach((s) => {
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(10);
      });
    });

    it('confidence is between 0 and 1', async () => {
      const score = await engine.calculateSpatialScore('GCG', 'ENSG00000115263');
      expect(score.confidence).toBeGreaterThanOrEqual(0);
      expect(score.confidence).toBeLessThanOrEqual(1);
    });

    it('high-quality gene (GCG) scores above 6.0', async () => {
      const score = await engine.calculateSpatialScore('GCG', 'ENSG00000115263');
      expect(score.total_score).toBeGreaterThan(6.0);
    });

    it('computed_at is a valid ISO timestamp', async () => {
      const score = await engine.calculateSpatialScore('GCG', 'ENSG00000115263');
      expect(() => new Date(score.computed_at)).not.toThrow();
      expect(new Date(score.computed_at).toISOString()).toBe(score.computed_at);
    });
  });

  describe('calculateDruggabilityScore', () => {
    it('returns a number between 0 and 10', async () => {
      const score = await engine.calculateDruggabilityScore('GCG', 'ENSG00000115263');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    });

    it('GCG druggability score above 6.0', async () => {
      const score = await engine.calculateDruggabilityScore('GCG', 'ENSG00000115263');
      expect(score).toBeGreaterThan(6.0);
    });
  });
});
