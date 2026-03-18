'use client';

// ============================================================
// SpatialPharma — Home page (main dashboard).
// Gene search → network viz + conservation + CRISPR + drug score.
// ============================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dna, FlaskConical, Network, Globe, Scissors, Pill } from 'lucide-react';
import { GeneSearchInterface } from '@/components/GeneSearchInterface';
import { SpatialNetworkVisualization } from '@/components/SpatialNetworkVisualization';
import { ConservationAnalysis } from '@/components/ConservationAnalysis';
import { CRISPRSafetyAssessment } from '@/components/CRISPRSafetyAssessment';
import { DrugTargetScore } from '@/components/DrugTargetScore';
import type { NetworkData } from '@/types';

type Tab = 'network' | 'conservation' | 'crispr' | 'drug';

const FEATURED_GENES = ['GCG', 'BRCA1', 'TP53', 'EGFR', 'KRAS', 'INS'];

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
        if (!res.ok) throw new Error(`Network fetch failed: ${res.status}`);
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
    { id: 'network',      label: 'Spatial Network',  icon: <Network className="h-4 w-4" /> },
    { id: 'conservation', label: 'Conservation',      icon: <Globe className="h-4 w-4" /> },
    { id: 'crispr',       label: 'CRISPR Safety',     icon: <Scissors className="h-4 w-4" /> },
    { id: 'drug',         label: 'Drug Target',        icon: <Pill className="h-4 w-4" /> },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero section */}
      <section className="px-4 py-12 md:py-16 text-center max-w-4xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Dna className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Spatial<span className="text-blue-600">Pharma</span>
          </h1>
        </div>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto mb-2">
          Explore the 3D genome architecture of drug targets.
        </p>
        <p className="text-gray-500 text-sm max-w-xl mx-auto mb-8">
          Real genomic data · Cross-species conservation · CRISPR safety · Drug target scoring
        </p>

        {/* Search bar */}
        <div className="flex justify-center">
          <GeneSearchInterface onGeneSelect={handleGeneSelect} />
        </div>

        {/* Featured genes */}
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

      {/* Analysis panel */}
      <AnimatePresence>
        {selectedGene && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-5xl mx-auto px-4 pb-16"
          >
            {/* Gene title */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
                <FlaskConical className="h-5 w-5 text-blue-600" />
                <span className="font-bold text-xl text-gray-900 font-mono">{selectedGene}</span>
              </div>
              <span className="text-sm text-gray-500">Spatial analysis</span>
            </div>

            {/* Tab nav */}
            <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-xl shadow-sm mb-6 overflow-x-auto">
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
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'network' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Network className="h-5 w-5 text-blue-600" />
                        <h3 className="text-base font-semibold text-gray-900">
                          Spatial Interaction Network
                        </h3>
                      </div>
                      {networkLoading && (
                        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                          <span className="animate-spin mr-2 inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                          Loading network…
                        </div>
                      )}
                      {networkError && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm">
                          {networkError} — The gene may not yet be in the database. Run the seed script first.
                        </div>
                      )}
                      {networkData && !networkLoading && (
                        <SpatialNetworkVisualization data={networkData} height={500} />
                      )}
                    </div>
                  )}

                  {activeTab === 'conservation' && (
                    <ConservationAnalysis geneSymbol={selectedGene} />
                  )}

                  {activeTab === 'crispr' && (
                    <CRISPRSafetyAssessment geneSymbol={selectedGene} />
                  )}

                  {activeTab === 'drug' && (
                    <DrugTargetScore geneSymbol={selectedGene} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!selectedGene && (
        <div className="max-w-4xl mx-auto px-4 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '🧬', title: 'Spatial Networks', desc: 'Visualize 3D gene interaction networks from Hi-C data' },
              { icon: '🌍', title: 'Conservation', desc: 'Cross-species conservation scores across 10 organisms' },
              { icon: '✂️', title: 'CRISPR Safety', desc: 'TAD disruption and off-target risk assessment' },
              { icon: '💊', title: 'Drug Target', desc: 'Composite druggability scoring from spatial features' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm text-center">
                <div className="text-3xl mb-3" aria-hidden>{icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
