'use client';
export const dynamic = 'force-dynamic';

// ============================================================
// Gene-Maps — Home page (main dashboard).
// Dark Purple-Gradient + Glassmorphism theme.
// Gene search → gene info → tabbed analysis panels.
// ============================================================

import { useState, useEffect } from 'react';
import { Dna, FlaskConical, Network, Globe, Scissors, Pill } from 'lucide-react';
import { DnaBanner } from '@/components/DnaBanner';
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
  { icon: '🧬', title: 'Spatial Networks',  desc: 'Interactive D3.js force-directed graph of Hi-C 3D genome contacts' },
  { icon: '📊', title: 'Spatial Score',     desc: '5-component weighted score: conservation, accessibility, PPI centrality, Hi-C contacts, GTEx expression' },
  { icon: '🌍', title: 'Conservation',      desc: 'Real ENSEMBL ortholog data across 10 model organisms with percent identity' },
  { icon: '✂️', title: 'CRISPR Safety',     desc: 'Deterministic TAD disruption risk (CTCF density) + PhyloP conservation constraint' },
  { icon: '💊', title: 'Drug Target',       desc: 'Druggability scoring combining spatial features, structural context, and tissue specificity' },
];

export default function HomePage() {
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('network');
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [networkSource, setNetworkSource] = useState<'live' | 'seed' | null>(null);

  const handleGeneSelect = (gene: string) => {
    setSelectedGene(gene);
    setActiveTab('network');
    setNetworkData(null);
    setNetworkError(null);
    setNetworkSource(null);
  };

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
        if (!cancelled) {
          setNetworkData(data);
          setNetworkSource(res.headers.get('x-data-source') === 'seed' ? 'seed' : 'live');
        }
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
    { id: 'network',      label: 'Network',      icon: <Network   className="h-4 w-4" /> },
    { id: 'score',        label: 'Spatial Score', icon: <Dna       className="h-4 w-4" /> },
    { id: 'conservation', label: 'Conservation',  icon: <Globe     className="h-4 w-4" /> },
    { id: 'crispr',       label: 'CRISPR',        icon: <Scissors  className="h-4 w-4" /> },
    { id: 'drug',         label: 'Drug Target',   icon: <Pill      className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen">
      {/* ── DNA Header Banner ─────────────────────────────── */}
      <DnaBanner />

      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="px-4 py-12 md:py-16 text-center max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-5">
            <span className="gm-text">Explore the 3D Genome</span>
            <br />
            <span className="text-white/80 text-2xl md:text-3xl font-normal">Architecture of Drug Targets</span>
          </h1>

          {/* App introduction */}
          <div className="max-w-2xl mx-auto mb-8 space-y-1.5 text-center">
            <p className="text-white/80 text-base leading-relaxed">
              Gene-Maps decodes the spatial language of the human genome, because where a gene
              lives in 3D nuclear space is as critical as what it encodes.
            </p>
            <p className="text-white/60 text-sm leading-relaxed">
              Every query integrates live data across five dimensions: evolutionary conservation,
              chromatin accessibility, protein interaction topology, Hi-C contact frequency,
              and tissue-resolved expression, all converging into a single spatial pharmacogenomics score.
            </p>
            <p className="text-white/50 text-sm leading-relaxed">
              Identify high-confidence drug targets, assess CRISPR edit safety at base-pair
              resolution, and visualise how genome architecture shapes therapeutic opportunity.
            </p>
            <p className="text-white/35 text-xs font-mono tracking-widest uppercase mt-3">
              ENSEMBL · UCSC PhyloP · STRING · GTEx v8 · Hi-C
            </p>
          </div>

          <div className="flex justify-center">
            <GeneSearchInterface onGeneSelect={handleGeneSelect} />
          </div>

          {/* Quick-access gene chips */}
          <div className="mt-5 flex flex-wrap gap-2 justify-center">
            <span className="text-xs text-white/30 self-center font-mono">Try:</span>
            {FEATURED_GENES.map((gene) => (
              <button
                key={gene}
                onClick={() => handleGeneSelect(gene)}
                className="px-3 py-1 text-xs font-mono glass rounded-full
                           text-white/70 hover:text-gm-pink hover:border-gm-pink/40
                           transition border border-white/10"
              >
                {gene}
              </button>
            ))}
          </div>
        </section>

        {/* ── Analysis panel ───────────────────────────────── */}
          {selectedGene && (
            <section className="max-w-5xl mx-auto px-4 pb-16 space-y-4 gm-fade-in">
              {/* Gene title bar */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl">
                  <FlaskConical className="h-5 w-5 text-gm-pink" />
                  <span className="font-bold text-xl text-white font-mono">{selectedGene}</span>
                </div>
                <span className="text-sm text-white/40">spatial pharmacogenomics analysis</span>
              </div>

              {/* Gene info panel */}
              <GeneInfoPanel geneSymbol={selectedGene} />

              {/* Tab nav */}
              <div className="flex gap-1 p-1 glass rounded-xl overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition
                      ${activeTab === tab.id
                        ? 'gm-tab-active shadow-sm'
                        : 'text-white/60 hover:bg-white/10 hover:text-white/90'
                      }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="glass rounded-xl p-6 min-h-[400px]">
                  <div key={activeTab} className="gm-fade-in">
                    {activeTab === 'network' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Network className="h-5 w-5 text-gm-pink" />
                          <h3 className="text-base font-semibold text-white">3D Spatial Interaction Network</h3>
                          <span className="ml-auto text-xs text-white/40">Hi-C contact data · drag nodes to explore</span>
                        </div>
                        {networkLoading && (
                          <div className="flex items-center justify-center h-72 text-white/50 text-sm gap-2">
                            <span className="animate-spin inline-block w-5 h-5 border-2 border-gm-pink border-t-transparent rounded-full" />
                            Loading spatial network…
                          </div>
                        )}
                        {networkError && (
                          <div className="p-4 rounded-xl text-sm border bg-amber-950/40 border-amber-500/25 text-amber-300">
                            <strong>Network unavailable:</strong> {networkError}
                            <br />
                            <span className="text-xs text-amber-400/70 mt-1 block">
                              Run <code className="font-mono bg-amber-500/10 px-1 rounded">npm run db:seed</code> to populate gene interaction data.
                            </span>
                          </div>
                        )}
                        {networkData && !networkLoading && (
                          <div className="space-y-2">
                            {networkSource === 'seed' && (
                              <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                                <span>
                                  <strong>Demo data</strong> — showing pre-computed seed interactions.
                                  Connect a Neo4j database to load live Hi-C contact data.
                                </span>
                              </div>
                            )}
                            {networkSource === 'live' && (
                              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                                Live Neo4j data
                              </div>
                            )}
                            <SpatialNetworkVisualization data={networkData} height={500} />
                          </div>
                        )}
                      </div>
                    )}
                    {activeTab === 'score'        && <SpatialScore           geneSymbol={selectedGene} />}
                    {activeTab === 'conservation' && <ConservationAnalysis   geneSymbol={selectedGene} />}
                    {activeTab === 'crispr'       && <CRISPRSafetyAssessment geneSymbol={selectedGene} />}
                    {activeTab === 'drug'         && <DrugTargetScore        geneSymbol={selectedGene} />}
                  </div>
              </div>
            </section>
          )}

        {/* ── Feature cards + About (empty state) ─────────── */}
        {!selectedGene && (
          <div className="max-w-5xl mx-auto px-4 pb-16 space-y-12">

            {/* Feature cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {FEATURE_CARDS.map(({ icon, title, desc }) => (
                <div
                  key={title}
                  className="p-5 glass rounded-xl text-center hover:border-white/20 hover:bg-white/[0.07] transition group"
                >
                  <div className="text-3xl mb-3" aria-hidden>{icon}</div>
                  <h3 className="font-semibold text-white/90 text-sm mb-1 group-hover:text-gm-pink transition">{title}</h3>
                  <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* Science section */}
            <section className="space-y-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">
                  The Science Behind <span className="gm-text">Gene-Maps</span>
                </h2>
                <p className="text-white/45 text-sm max-w-2xl mx-auto">
                  Understanding why 3D genome architecture changes how we find drug targets.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    icon: '🧬',
                    title: 'Your DNA is 3D, Not Linear',
                    body: [
                      'The 3 billion base pairs of human DNA are folded into the nucleus of every cell — a space just 6 microns across. This folding is not random. DNA is organized into loops, compartments, and Topologically Associating Domains (TADs): ~1 Mb regions where genes and their regulatory enhancers are physically close to each other.',
                      'The Hi-C technique maps these 3D contacts genome-wide by cross-linking DNA strands that are spatially close, then sequencing the ligation junctions. Gene-Maps uses pre-computed Hi-C contact frequencies to build the spatial interaction network you see in the Network tab.',
                    ],
                  },
                  {
                    icon: '📐',
                    title: 'TADs and CTCF Insulators',
                    body: [
                      'TAD boundaries are anchored by CTCF, a zinc-finger protein that acts as a genomic insulator. CTCF sites are loaded at boundaries to prevent enhancers inside one TAD from activating genes in an adjacent TAD.',
                      'The CRISPR Safety tab uses UCSC ENCODE CTCF occupancy data to estimate how many CTCF binding sites are near your proposed edit position. Dense CTCF clustering signals a TAD boundary — editing there carries higher disruption risk.',
                    ],
                  },
                  {
                    icon: '💊',
                    title: 'Why 3D Genome = Better Drug Targets',
                    body: [
                      'Traditional druggability screens look at protein structure in isolation. But a gene\'s position in 3D chromatin space tells you much more: genes at the center of spatial interaction networks (spatial hubs) tend to be master regulators, expressed broadly, and under strong evolutionary constraint — all hallmarks of high-quality drug targets.',
                      'Finan et al. (2017, Sci Transl Med) showed that targets with genetic evidence from human disease loci — which cluster in active TADs — have a 2× higher clinical success rate.',
                    ],
                  },
                ].map(({ icon, title, body }) => (
                  <div key={title} className="glass rounded-xl p-6 space-y-3 hover:border-white/20 transition">
                    <div className="text-3xl">{icon}</div>
                    <h3 className="font-semibold text-white">{title}</h3>
                    {body.map((para, i) => (
                      <p key={i} className="text-sm text-white/60 leading-relaxed">{para}</p>
                    ))}
                  </div>
                ))}
              </div>

              {/* Data flow */}
              <div className="glass rounded-xl p-6 space-y-4 border-gm-pink/20">
                <h3 className="font-semibold text-white text-center">How Gene-Maps Calculates Scores</h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center text-xs text-center">
                  {[
                    { label: 'ENSEMBL\nOrthologs',   sub: 'Conservation score',                     c: 'bg-gm-pink/15 text-gm-pink border border-gm-pink/20' },
                    { label: 'UCSC\nPhyloP100',      sub: 'Accessibility + CRISPR',                  c: 'bg-purple-500/15 text-purple-300 border border-purple-500/20' },
                    { label: 'STRING DB\nPPI',        sub: 'Network centrality',                      c: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' },
                    { label: 'Hi-C\nContacts',        sub: 'Interaction strength',                    c: 'bg-amber-500/15 text-amber-300 border border-amber-500/20' },
                    { label: 'GTEx\nExpression',      sub: 'Expression breadth',                      c: 'bg-red-500/15 text-red-300 border border-red-500/20' },
                  ].map(({ label, sub, c }) => (
                    <div key={label} className={`${c} rounded-lg px-3 py-2.5 space-y-1`}>
                      <div className="font-semibold whitespace-pre-line leading-tight">{label}</div>
                      <div className="opacity-70 leading-tight">{sub}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-center text-white/40">
                  <strong className="text-white/60">Spatial Score:</strong>{' '}
                  0.25 × conservation + 0.20 × accessibility + 0.25 × centrality + 0.20 × Hi-C + 0.10 × expression
                </p>
              </div>

              {/* Glossary */}
              <div className="glass rounded-xl p-6">
                <h3 className="font-semibold text-white mb-4">Glossary</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  {[
                    ['TAD',       'Topologically Associating Domain — a self-interacting chromatin region (~1 Mb) defined by Hi-C data.'],
                    ['CTCF',      'CCCTC-binding factor — zinc-finger protein that marks TAD boundaries and acts as a chromatin insulator.'],
                    ['Hi-C',      'Genome-wide 3D chromatin conformation capture technique measuring physical proximity of DNA loci.'],
                    ['PhyloP',    'Per-base conservation score from alignment of 100 vertebrate genomes. Positive = conserved.'],
                    ['Ortholog',  'A gene in another species that evolved from the same ancestral gene. Percent identity = amino acid similarity.'],
                    ['STRING DB', 'Database of known and predicted protein-protein interactions, scored by experimental and computational evidence.'],
                    ['GTEx',      'Genotype-Tissue Expression project — gene expression levels across 54 human tissues.'],
                    ['Druggability', 'Likelihood that a protein can be modulated by a small molecule or biologic with therapeutic effect.'],
                  ].map(([term, def]) => (
                    <div key={term} className="flex gap-2">
                      <dt className="font-semibold text-gm-pink shrink-0 w-24">{term}</dt>
                      <dd className="text-white/50 leading-relaxed">{def}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <p className="text-center text-xs text-white/25 font-mono">
              ENSEMBL REST API · UCSC PhyloP100way · STRING DB · GTEx v8 · Hi-C (pre-computed)
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
