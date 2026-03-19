'use client';

// ============================================================
// Gene-Maps — Home page (main dashboard).
// Gene search → gene info → tabbed analysis panels.
// ============================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dna, FlaskConical, Network, Globe, Scissors, Pill } from 'lucide-react';
import { GeneSearchInterface } from '@/components/GeneSearchInterface';
import { GeneInfoPanel } from '@/components/GeneInfoPanel';
import { SpatialNetworkVisualization } from '@/components/SpatialNetworkVisualization';
import { SpatialScore } from '@/components/SpatialScore';
import { ConservationAnalysis } from '@/components/ConservationAnalysis';
import { CRISPRSafetyAssessment } from '@/components/CRISPRSafetyAssessment';
import { DrugTargetScore } from '@/components/DrugTargetScore';
import type { NetworkData } from '@/types';

type Tab = 'network' | 'score' | 'conservation' | 'crispr' | 'drug';

const FEATURED_GENES = ['GCG', 'BRCA1', 'TP53', 'EGFR', 'KRAS', 'INS', 'APOE', 'SNCA'];

const FEATURE_CARDS = [
  {
    icon: '🧬',
    title: 'Spatial Networks',
    desc: 'Interactive D3.js force-directed graph of Hi-C 3D genome contacts',
  },
  {
    icon: '📊',
    title: 'Spatial Score',
    desc: '5-component weighted score: conservation, accessibility, PPI centrality, Hi-C contacts, GTEx expression',
  },
  {
    icon: '🌍',
    title: 'Conservation',
    desc: 'Real ENSEMBL ortholog data across 10 model organisms with percent identity',
  },
  {
    icon: '✂️',
    title: 'CRISPR Safety',
    desc: 'Deterministic TAD disruption risk (CTCF density) + PhyloP conservation constraint',
  },
  {
    icon: '💊',
    title: 'Drug Target',
    desc: 'Druggability scoring combining spatial features, structural context, and tissue specificity',
  },
];

export default function HomePage() {
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('network');
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const handleGeneSelect = (gene: string) => {
    setSelectedGene(gene);
    setActiveTab('network');
    setNetworkData(null);
    setNetworkError(null);
  };

  // Fetch network data when gene changes
  useEffect(() => {
    if (!selectedGene) return;
    let cancelled = false;

    const fetchNetwork = async () => {
      setNetworkLoading(true);
      setNetworkError(null);
      try {
        const res = await fetch(`/api/spatial/network/${encodeURIComponent(selectedGene)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: NetworkData = await res.json();
        if (!cancelled) setNetworkData(data);
      } catch (err) {
        if (!cancelled) setNetworkError((err as Error).message);
      } finally {
        if (!cancelled) setNetworkLoading(false);
      }
    };

    fetchNetwork();
    return () => { cancelled = true; };
  }, [selectedGene]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'network',      label: 'Network',       icon: <Network className="h-4 w-4" /> },
    { id: 'score',        label: 'Spatial Score',  icon: <Dna className="h-4 w-4" /> },
    { id: 'conservation', label: 'Conservation',   icon: <Globe className="h-4 w-4" /> },
    { id: 'crispr',       label: 'CRISPR',         icon: <Scissors className="h-4 w-4" /> },
    { id: 'drug',         label: 'Drug Target',    icon: <Pill className="h-4 w-4" /> },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="px-4 py-12 md:py-16 text-center max-w-4xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Dna className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Gene<span className="text-blue-600">-Maps</span>
          </h1>
        </div>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto mb-1">
          Explore the 3D genome architecture of drug targets.
        </p>
        <p className="text-gray-500 text-sm max-w-xl mx-auto mb-8">
          Real genomic data · ENSEMBL · UCSC PhyloP · STRING · GTEx · Hi-C
        </p>

        <div className="flex justify-center">
          <GeneSearchInterface onGeneSelect={handleGeneSelect} />
        </div>

        {/* Quick-access gene chips */}
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          <span className="text-xs text-gray-400 self-center">Try:</span>
          {FEATURED_GENES.map((gene) => (
            <button
              key={gene}
              onClick={() => handleGeneSelect(gene)}
              className="px-3 py-1 text-xs font-mono bg-white border border-gray-200 text-blue-700
                         rounded-full hover:border-blue-400 hover:bg-blue-50 transition shadow-sm"
            >
              {gene}
            </button>
          ))}
        </div>
      </section>

      {/* ── Analysis panel ─────────────────────────────────── */}
      <AnimatePresence>
        {selectedGene && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-5xl mx-auto px-4 pb-16 space-y-4"
          >
            {/* Gene title bar */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
                <FlaskConical className="h-5 w-5 text-blue-600" />
                <span className="font-bold text-xl text-gray-900 font-mono">{selectedGene}</span>
              </div>
              <span className="text-sm text-gray-400">spatial pharmacogenomics analysis</span>
            </div>

            {/* Gene info panel (description, locus, external links) */}
            <GeneInfoPanel geneSymbol={selectedGene} />

            {/* Tab nav */}
            <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition
                    ${activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 min-h-[400px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Spatial Network */}
                  {activeTab === 'network' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Network className="h-5 w-5 text-blue-600" />
                        <h3 className="text-base font-semibold text-gray-900">
                          3D Spatial Interaction Network
                        </h3>
                        <span className="ml-auto text-xs text-gray-400">
                          Hi-C contact data · drag nodes to explore
                        </span>
                      </div>
                      {networkLoading && (
                        <div className="flex items-center justify-center h-72 text-gray-400 text-sm gap-2">
                          <span className="animate-spin inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                          Loading spatial network…
                        </div>
                      )}
                      {networkError && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm">
                          <strong>Network unavailable:</strong> {networkError}
                          <br />
                          <span className="text-xs text-yellow-600 mt-1 block">
                            Run <code className="font-mono bg-yellow-100 px-1 rounded">npm run db:seed</code> to
                            populate gene interaction data, then search again.
                          </span>
                        </div>
                      )}
                      {networkData && !networkLoading && (
                        <SpatialNetworkVisualization data={networkData} height={500} />
                      )}
                    </div>
                  )}

                  {/* Spatial Score */}
                  {activeTab === 'score' && (
                    <SpatialScore geneSymbol={selectedGene} />
                  )}

                  {/* Conservation */}
                  {activeTab === 'conservation' && (
                    <ConservationAnalysis geneSymbol={selectedGene} />
                  )}

                  {/* CRISPR */}
                  {activeTab === 'crispr' && (
                    <CRISPRSafetyAssessment geneSymbol={selectedGene} />
                  )}

                  {/* Drug Target */}
                  {activeTab === 'drug' && (
                    <DrugTargetScore geneSymbol={selectedGene} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Feature cards (empty state) ─────────────────────── */}
      {!selectedGene && (
        <div className="max-w-5xl mx-auto px-4 pb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {FEATURE_CARDS.map(({ icon, title, desc }) => (
              <div key={title} className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm text-center hover:shadow-md transition">
                <div className="text-3xl mb-3" aria-hidden>{icon}</div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Data source attribution */}
          <p className="text-center text-xs text-gray-400 mt-8">
            Data sources: ENSEMBL REST API · UCSC PhyloP100way · STRING DB · GTEx v8 · Hi-C (pre-computed)
          </p>
        </div>
      )}
    </main>
  );
}
