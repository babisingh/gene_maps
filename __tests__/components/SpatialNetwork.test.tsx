// ============================================================
// Tests for SpatialNetworkVisualization component
// ============================================================

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SpatialNetworkVisualization } from '@/components/SpatialNetworkVisualization';
import type { NetworkData } from '@/types';

// D3 does heavy DOM manipulation — mock SVG APIs
Object.defineProperty(global.SVGElement.prototype, 'getBBox', {
  writable: true,
  value: () => ({ x: 0, y: 0, width: 100, height: 100 }),
});

const mockNetworkData: NetworkData = {
  nodes: [
    { id: 'GCG',  group: 1, score: 0.87 },
    { id: 'INS',  group: 2, score: 0.72 },
    { id: 'POMC', group: 2, score: 0.58 },
  ],
  links: [
    { source: 'GCG', target: 'INS',  value: 15.2, confidence: 0.88 },
    { source: 'GCG', target: 'POMC', value: 8.4,  confidence: 0.75 },
  ],
};

describe('SpatialNetworkVisualization', () => {
  it('renders without crashing', () => {
    render(<SpatialNetworkVisualization data={mockNetworkData} />);
  });

  it('renders an SVG element', () => {
    render(<SpatialNetworkVisualization data={mockNetworkData} />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders the legend', () => {
    render(<SpatialNetworkVisualization data={mockNetworkData} />);
    expect(screen.getByText('Center gene')).toBeInTheDocument();
    expect(screen.getByText('Neighbor')).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    const emptyData: NetworkData = { nodes: [], links: [] };
    // Should not throw
    expect(() => {
      render(<SpatialNetworkVisualization data={emptyData} />);
    }).not.toThrow();
  });

  it('handles single-node data (isolated gene)', () => {
    const singleNode: NetworkData = {
      nodes: [{ id: 'GCG', group: 1, score: 0.87 }],
      links: [],
    };
    render(<SpatialNetworkVisualization data={singleNode} />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('accepts custom height prop', () => {
    const { container } = render(
      <SpatialNetworkVisualization data={mockNetworkData} height={400} />
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('height', '400');
  });
});
