'use client';

// ============================================================
// SpatialNetworkVisualization — D3.js force-directed graph.
// Renders gene spatial interaction network interactively.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
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

export function SpatialNetworkVisualization({
  data,
  width = 800,
  height = 560,
  className = '',
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: NetworkNode } | null>(null);

  useEffect(() => {
    if (!data || !svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
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
    svg.call(zoom);

    const g = svg.append('g');

    // Links
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#cbd5e1')
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
      .on('mouseout', () => setTooltip(null));

    // Labels
    const label = g
      .append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text((d) => (d as NetworkNode).id)
      .attr('font-size', '11px')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('fill', '#374151')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => -(10 + (d as NetworkNode).score * 14 + 4))
      .attr('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as d3.SimulationNodeDatum).x ?? 0)
        .attr('y1', (d) => (d.source as d3.SimulationNodeDatum).y ?? 0)
        .attr('x2', (d) => (d.target as d3.SimulationNodeDatum).x ?? 0)
        .attr('y2', (d) => (d.target as d3.SimulationNodeDatum).y ?? 0);

      node
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0);

      label
        .attr('x', (d) => d.x ?? 0)
        .attr('y', (d) => d.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [data, width, height]);

  return (
    <div className={`relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 ${className}`}>
      {/* Legend */}
      <div className="absolute top-3 left-3 flex gap-3 text-xs text-gray-500 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> Center gene
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-purple-500" /> Neighbor
        </span>
        <span className="flex items-center gap-1">
          <span className="text-gray-400">— </span> Hi-C frequency
        </span>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height={height}
        role="img"
        aria-label={`Spatial interaction network`}
        className="w-full"
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="font-semibold text-gray-900">{tooltip.node.id}</div>
          <div className="text-gray-500">
            Spatial score: {(tooltip.node.score * 10).toFixed(1)}/10
          </div>
          <div className="text-gray-500">Cluster: {tooltip.node.group}</div>
        </div>
      )}
    </div>
  );
}
