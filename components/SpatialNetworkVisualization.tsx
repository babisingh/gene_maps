'use client';

// ============================================================
// SpatialNetworkVisualization — D3.js force-directed graph.
// Renders gene spatial interaction network interactively.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Info, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { NetworkData, NetworkNode, NetworkLink } from '@/types';

interface Props {
  data: NetworkData;
  width?: number;
  height?: number;
  className?: string;
}

// Color palette for gene groups / pathways
const GROUP_COLORS = [
  '#3b82f6', // blue - center gene
  '#8b5cf6', // purple - direct neighbors
  '#10b981', // emerald - secondary
  '#f59e0b', // amber
  '#ef4444', // red
];

const GROUP_LABELS = [
  'Query gene',
  'Direct spatial neighbor',
  'Secondary neighbor',
  'Tertiary neighbor',
  'Distant neighbor',
];

interface SelectedNode {
  node: NetworkNode;
  x: number;
  y: number;
}

export function SpatialNetworkVisualization({
  data,
  width = 800,
  height = 560,
  className = '',
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const svgSelRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: NetworkNode } | null>(null);
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svgSelRef.current = svg;
    svg.selectAll('*').remove();

    // Arrow marker for directed edges
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#94a3b8');

    // Deep-clone nodes/links to avoid mutating props (D3 modifies in place)
    const nodes: (NetworkNode & d3.SimulationNodeDatum)[] = data.nodes.map((n) => ({ ...n }));
    const links: (NetworkLink & d3.SimulationLinkDatum<NetworkNode & d3.SimulationNodeDatum>)[] =
      data.links.map((l) => ({ ...l }));

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d) => (d as NetworkNode).id)
          .distance(80)
          .strength(0.5)
      )
      .force('charge', d3.forceManyBody().strength(-250))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Zoom + pan
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 3]).on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
    zoomRef.current = zoom;
    svg.call(zoom);

    const g = svg.append('g');

    // Links
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'rgba(255,255,255,0.18)')
      .attr('stroke-opacity', 0.7)
      .attr('stroke-width', (d) => Math.max(1, Math.sqrt((d as NetworkLink).value ?? 1)));

    // Node circles
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d) => 8 + (d as NetworkNode).score * 14)
      .attr('fill', (d) => GROUP_COLORS[(d as NetworkNode).group % GROUP_COLORS.length] ?? GROUP_COLORS[0])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(d3.drag<any, any>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('mouseover', (event, d) => {
        setTooltip({ x: event.offsetX, y: event.offsetY, node: d as NetworkNode });
      })
      .on('mouseout', () => setTooltip(null))
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelected({ node: d as NetworkNode, x: event.offsetX, y: event.offsetY });
      });

    // Labels
    g
      .append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text((d) => (d as NetworkNode).id)
      .attr('font-size', '11px')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('fill', 'rgba(255,255,255,0.75)')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => -(10 + (d as NetworkNode).score * 14 + 4))
      .attr('pointer-events', 'none');

    // Dismiss selected node on canvas click
    svg.on('click', () => setSelected(null));

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as d3.SimulationNodeDatum).x ?? 0)
        .attr('y1', (d) => (d.source as d3.SimulationNodeDatum).y ?? 0)
        .attr('x2', (d) => (d.target as d3.SimulationNodeDatum).x ?? 0)
        .attr('y2', (d) => (d.target as d3.SimulationNodeDatum).y ?? 0);

      node
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0);

      g.selectAll<SVGTextElement, NetworkNode & d3.SimulationNodeDatum>('.labels text')
        .attr('x', (d) => d.x ?? 0)
        .attr('y', (d) => d.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [data, width, height]);

  const handleZoom = (factor: number) => {
    if (!svgSelRef.current || !zoomRef.current) return;
    svgSelRef.current.transition().duration(300).call(zoomRef.current.scaleBy, factor);
  };

  const handleReset = () => {
    if (!svgSelRef.current || !zoomRef.current) return;
    svgSelRef.current.transition().duration(400).call(zoomRef.current.transform, d3.zoomIdentity);
  };

  return (
    <div className="space-y-3">
      {/* ── About this network ─────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gm-pink" />
          <div className="space-y-1">
            <p className="font-semibold">About this network</p>
            <p className="leading-relaxed text-white/65">
              Each <strong>node</strong> is a gene. The <strong>query gene</strong> (blue) is surrounded
              by its top spatial neighbors — genes whose chromosomal loci are physically close in 3D
              nuclear space, as detected by{' '}
              <abbr title="Hi-C: genome-wide chromosome conformation capture — maps DNA contacts across the entire genome by crosslinking, cutting, and sequencing pairs of genomic regions found in close proximity in the nucleus">
                Hi-C
              </abbr>
              . Edges connect genes whose loci contact each other in the nucleus.{' '}
              <strong>Node size</strong> = Spatial Genome Score.{' '}
              <strong>Edge thickness</strong> = Hi-C contact frequency.{' '}
              <strong>Click any node</strong> to see its details.
            </p>
            <button
              className="mt-1 text-xs font-medium text-gm-pink underline underline-offset-2 hover:text-white transition"
              onClick={() => setShowAbout((v) => !v)}
            >
              {showAbout ? 'Hide methodology ↑' : 'Show methodology ↓'}
            </button>
            {showAbout && (
              <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white/60 leading-relaxed space-y-1.5">
                <p>
                  <strong>Data source:</strong> Hi-C contact data stored in a Neo4j graph database,
                  sourced from published chromosome conformation capture experiments (genome assembly
                  GRCh38/hg38).
                </p>
                <p>
                  <strong>Edges (lines):</strong> Each edge represents a Hi-C contact between two gene
                  loci. Thicker lines = higher contact frequency = the two genes are more often found
                  in the same topologically associating domain (TAD) or chromatin loop in the nucleus.
                </p>
                <p>
                  <strong>Node color:</strong> Cluster group. Blue = query gene. Purple = direct
                  first-degree spatial neighbors. Green / amber = more distant neighbors in the
                  interaction graph.
                </p>
                <p>
                  <strong>Node size:</strong> Proportional to Spatial Genome Score (0–10). A larger
                  node means the gene scores higher across conservation, chromatin accessibility,
                  network centrality, Hi-C interaction strength, and expression plasticity.
                </p>
                <p>
                  <strong>Layout:</strong> D3 force-directed simulation. Nodes repel each other; edges
                  attract connected nodes. The final layout clusters frequently-interacting genes
                  together, mirroring their spatial proximity in the nucleus.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Graph canvas ─────────────────────────────────────────── */}
      <div className={`relative rounded-xl overflow-hidden border border-white/10 ${className}`} style={{ background: 'rgba(10,22,40,0.6)' }}>
        {/* Legend */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55 rounded-lg px-3 py-2" style={{ background: 'rgba(15,7,38,0.75)', backdropFilter: 'blur(8px)' }}>
          {GROUP_COLORS.slice(0, 3).map((color, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
                style={{ background: color }}
              />
              {GROUP_LABELS[i]}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-gray-400">
            <span className="inline-block w-5 rounded" style={{ borderTop: '2px solid #cbd5e1' }} />
            Hi-C contact
          </span>
        </div>

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
          <button
            onClick={() => handleZoom(1.4)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 hover:border-gm-pink/40 hover:text-gm-pink transition"
            style={{ background: 'rgba(15,7,38,0.75)' }}
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5 text-white/60" />
          </button>
          <button
            onClick={() => handleZoom(1 / 1.4)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 hover:border-gm-pink/40 hover:text-gm-pink transition"
            style={{ background: 'rgba(15,7,38,0.75)' }}
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5 text-white/60" />
          </button>
          <button
            onClick={handleReset}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 hover:border-gm-pink/40 hover:text-gm-pink transition"
            style={{ background: 'rgba(15,7,38,0.75)' }}
            title="Reset view"
          >
            <RotateCcw className="h-3.5 w-3.5 text-white/60" />
          </button>
        </div>

        <svg
          ref={svgRef}
          width="100%"
          height={height}
          role="img"
          aria-label="Spatial interaction network"
          className="w-full"
        />

        {/* Hover tooltip (only when nothing is selected) */}
        {tooltip && !selected && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-white/15 px-3 py-2 text-xs shadow-lg"
            style={{ background: 'rgba(15,7,38,0.92)', backdropFilter: 'blur(12px)', left: tooltip.x + 12, top: tooltip.y - 10 }}
          >
            <div className="font-semibold text-white font-mono">{tooltip.node.id}</div>
            <div className="text-white/55">
              Spatial score: {(tooltip.node.score * 10).toFixed(1)} / 10
            </div>
            <div className="mt-0.5 text-white/35">Click for details</div>
          </div>
        )}

        {/* Click-selected node panel */}
        {selected && (
          <div
            className="absolute z-20 w-60 rounded-xl border border-white/15 shadow-2xl text-sm"
            style={{
              background: 'rgba(15,7,38,0.96)', backdropFilter: 'blur(16px)',
              left: Math.min(selected.x + 16, (svgRef.current?.clientWidth ?? 800) - 256),
              top: Math.min(selected.y - 10, height - 230),
            }}
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
              <span
                className="inline-block h-3 w-3 rounded-full border border-white/30 shadow-sm shrink-0"
                style={{
                  background: GROUP_COLORS[selected.node.group % GROUP_COLORS.length],
                }}
              />
              <span className="font-semibold text-white flex-1 font-mono">{selected.node.id}</span>
              <button
                onClick={() => setSelected(null)}
                className="text-white/30 hover:text-white transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="px-3 py-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Spatial Genome Score</span>
                <span className="font-mono font-bold text-gm-pink">
                  {(selected.node.score * 10).toFixed(1)}&thinsp;/&thinsp;10
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Network role</span>
                <span className="text-white/75">
                  {GROUP_LABELS[selected.node.group % GROUP_LABELS.length] ?? 'Neighbor'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Cluster group</span>
                <span className="font-mono text-white/75">{selected.node.group}</span>
              </div>
              <div className="pt-2 border-t border-white/10 text-xs text-white/35 leading-relaxed">
                This gene&apos;s chromosomal locus makes frequent Hi-C contacts with the query gene,
                indicating they share a topological domain or chromatin loop in the nucleus.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer summary ─────────────────────────────────────── */}
      <p className="text-xs text-white/30 text-right font-mono">
        {data.nodes.length} genes &middot; {data.links.length} Hi-C contacts &middot; Scroll to zoom &middot; Drag to pan &middot; Click node for details
      </p>
    </div>
  );
}
