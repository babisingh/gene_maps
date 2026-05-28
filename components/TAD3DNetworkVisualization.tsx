'use client';

// ============================================================
// TAD3DNetworkVisualization — Three.js/R3F 3D scaffold
//
// Renders the spatial gene network inside a translucent nucleus
// sphere. Each gene is a glowing bead; Hi-C contacts are Bezier
// arcs; TAD domains are semi-transparent convex hulls; CTCF
// boundary sites appear as glowing rings.
//
// Required packages (not yet in package.json):
//   npm install three @react-three/fiber @react-three/drei
//   npm install -D @types/three
//
// Data flow:
//   NetworkData  (existing)  → nodes + links
//   TADDomain[]  (new type)  → hull + boundary overlays
//
// 3D positions: Fibonacci sphere placement scaled by distance_3d.
// When Hi-C-derived xyz coords become available (e.g. from Orca /
// PASTIS), drop them into NetworkNode3D.x3d/y3d/z3d and this
// component will use them automatically.
// ============================================================

import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { X } from 'lucide-react';
import type { NetworkData, NetworkNode, NetworkLink, TADDomain, NetworkNode3D } from '@/types';

// ── Props ─────────────────────────────────────────────────────

interface Props {
  /** Existing NetworkData from /api/spatial/network/:gene */
  data: NetworkData;
  /** Optional TAD domains from /api/crispr/safety or a dedicated endpoint */
  tads?: TADDomain[];
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────

// Index matches the `group` value from the API (query=1, neighbors=2, secondary=3…)
const GROUP_COLORS = [
  '#22d3ee', // 0 unused in current seed data
  '#f472b6', // 1 query gene → hot pink (distinctive centre)
  '#818cf8', // 2 direct neighbor → indigo
  '#34d399', // 3 secondary → green
  '#fbbf24', // 4 distant → amber
];

const TAD_PALETTE = ['#6366f1', '#06b6d4', '#f472b6', '#34d399', '#fbbf24'];

// Approximate GRCh38 genomic start positions for seed genes.
// Used to sort nodes in linear genomic order for the backbone thread.
// Key insight: two genes far apart here can be spatially proximal (TAD looping).
const GENE_POSITIONS: Record<string, { chr: string; start: number }> = {
  GCG:     { chr: '2',  start: 162_148_788 },
  POMC:    { chr: '2',  start: 25_160_858  },
  ALK:     { chr: '2',  start: 29_192_774  },
  IDH1:    { chr: '2',  start: 208_236_227 },
  CTLA4:   { chr: '2',  start: 203_867_773 },
  INS:     { chr: '11', start: 2_159_779   },
  CCND1:   { chr: '11', start: 69_641_156  },
  INSR:    { chr: '19', start: 7_112_321   },
  LDLR:    { chr: '19', start: 11_089_463  },
  APOE:    { chr: '19', start: 44_905_796  },
  LEP:     { chr: '7',  start: 127_881_598 },
  EGFR:    { chr: '7',  start: 55_019_032  },
  BRAF:    { chr: '7',  start: 140_719_327 },
  IL6:     { chr: '7',  start: 22_725_886  },
  CFTR:    { chr: '7',  start: 117_480_025 },
  PPARG:   { chr: '3',  start: 12_287_366  },
  PIK3CA:  { chr: '3',  start: 179_148_114 },
  VHL:     { chr: '3',  start: 10_141_778  },
  SORT1:   { chr: '1',  start: 109_817_999 },
  PSEN2:   { chr: '1',  start: 226_880_879 },
  TP53:    { chr: '17', start: 7_668_421   },
  BRCA1:   { chr: '17', start: 43_044_295  },
  ERBB2:   { chr: '17', start: 39_687_914  },
  NF1:     { chr: '17', start: 31_094_013  },
  MAPT:    { chr: '17', start: 45_894_527  },
  MDM2:    { chr: '12', start: 68_808_172  },
  KRAS:    { chr: '12', start: 25_205_246  },
  LRRK2:   { chr: '12', start: 40_224_986  },
  CACNA1C: { chr: '12', start: 1_970_786   },
  RB1:     { chr: '13', start: 48_303_747  },
  BRCA2:   { chr: '13', start: 32_315_508  },
  MYC:     { chr: '8',  start: 127_735_434 },
  CDKN2A:  { chr: '9',  start: 21_967_752  },
  CD274:   { chr: '9',  start: 5_450_503   },
  JAK2:    { chr: '9',  start: 4_985_245   },
  C9orf72: { chr: '9',  start: 27_546_542  },
  FTO:     { chr: '16', start: 53_703_010  },
  FUS:     { chr: '16', start: 31_185_157  },
  PSEN1:   { chr: '14', start: 73_136_418  },
  PTEN:    { chr: '10', start: 89_692_905  },
  APP:     { chr: '21', start: 25_880_550  },
  SOD1:    { chr: '21', start: 31_659_666  },
  SNCA:    { chr: '4',  start: 89_724_099  },
  HTT:     { chr: '4',  start: 3_074_877   },
  TNF:     { chr: '6',  start: 31_575_565  },
  VEGFA:   { chr: '6',  start: 43_770_209  },
  APC:     { chr: '5',  start: 112_707_498 },
  HNF4A:   { chr: '20', start: 44_355_801  },
  COMT:    { chr: '22', start: 19_929_268  },
};

// Normalized expression levels (0–1, approximate GTEx median TPM).
// Used to size gene beads: highly-expressed genes appear larger.
const GENE_EXPRESSION: Record<string, number> = {
  GCG: 0.52, INS: 0.88, POMC: 0.31, LEP: 0.45, INSR: 0.72,
  PPARG: 0.58, FTO: 0.41, LDLR: 0.65, APOE: 0.79, SORT1: 0.55,
  TP53: 0.82, MDM2: 0.48, CDKN2A: 0.35, RB1: 0.61, MYC: 0.74,
  BRCA1: 0.53, BRCA2: 0.49, EGFR: 0.68, ERBB2: 0.44, BRAF: 0.57,
  KRAS: 0.71, PIK3CA: 0.62, PTEN: 0.66, CCND1: 0.59, VHL: 0.43,
  VEGFA: 0.69, APC: 0.54, IDH1: 0.38, NF1: 0.56, CTLA4: 0.29,
  CD274: 0.33, IL6: 0.76, TNF: 0.73, APP: 0.64, PSEN1: 0.47,
  PSEN2: 0.42, MAPT: 0.51, SNCA: 0.46, LRRK2: 0.39, SOD1: 0.67,
  FUS: 0.44, C9orf72: 0.48, CFTR: 0.22, HTT: 0.55, JAK2: 0.58,
  ALK: 0.36, HNF4A: 0.40, COMT: 0.53, CACNA1C: 0.34,
};

// A = active euchromatin, nuclear interior; B = inactive heterochromatin, nuclear periphery.
// Determines radial placement: A genes sit closer to the centre, B genes near the lamina.
const GENE_COMPARTMENTS: Record<string, 'A' | 'B'> = {
  GCG: 'A', INS: 'A', POMC: 'A', LEP: 'B', INSR: 'A',
  PPARG: 'A', FTO: 'B', LDLR: 'A', APOE: 'A', SORT1: 'A',
  TP53: 'A', MDM2: 'A', CDKN2A: 'B', RB1: 'B', MYC: 'A',
  BRCA1: 'A', BRCA2: 'A', EGFR: 'A', ERBB2: 'A', BRAF: 'A',
  KRAS: 'A', PIK3CA: 'A', PTEN: 'B', CCND1: 'A', VHL: 'B',
  VEGFA: 'A', APC: 'B', IDH1: 'A', NF1: 'B', CTLA4: 'A',
  CD274: 'B', IL6: 'A', TNF: 'A', APP: 'B', PSEN1: 'B',
  PSEN2: 'B', MAPT: 'B', SNCA: 'B', LRRK2: 'B', SOD1: 'A',
  FUS: 'A', C9orf72: 'B', CFTR: 'B', HTT: 'B', JAK2: 'A',
  ALK: 'A', HNF4A: 'A', COMT: 'B', CACNA1C: 'B',
};

// ── Geometry helpers ──────────────────────────────────────────

/**
 * Distributes n points evenly over a unit sphere using the
 * Fibonacci / golden-angle method (deterministic, no randomness).
 */
function fibonacciSphere(n: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    pts.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
  }
  return pts;
}

/**
 * Maps each NetworkNode to a THREE.Vector3.
 *
 * Priority order:
 *   1. NetworkNode3D.x3d/y3d/z3d  (real Hi-C derived coords)
 *   2. distance_3d on the link     (scales Fibonacci sphere radius)
 *   3. Fibonacci sphere + score    (fallback, always works)
 *
 * Query gene (group === 1) sits at the origin.
 */
function computePositions(
  nodes: NetworkNode[],
  links: NetworkLink[]
): Map<string, THREE.Vector3> {
  const map = new Map<string, THREE.Vector3>();

  const query = nodes.find((n) => n.group === 1) ?? nodes[0];

  // Honour pre-computed 3D coords if present
  const asNode3D = (n: NetworkNode): NetworkNode3D => n as NetworkNode3D;
  const q3d = asNode3D(query);
  if (q3d.x3d !== undefined && q3d.y3d !== undefined && q3d.z3d !== undefined) {
    map.set(query.id, new THREE.Vector3(q3d.x3d, q3d.y3d, q3d.z3d));
  } else {
    map.set(query.id, new THREE.Vector3(0, 0, 0));
  }

  const others = nodes.filter((n) => n.id !== query.id);
  const sphere = fibonacciSphere(others.length);

  others.forEach((node, i) => {
    const n3 = asNode3D(node);

    // If real 3D coords exist, use them directly
    if (n3.x3d !== undefined && n3.y3d !== undefined && n3.z3d !== undefined) {
      map.set(node.id, new THREE.Vector3(n3.x3d, n3.y3d, n3.z3d));
      return;
    }

    // Otherwise, place on Fibonacci sphere with radius derived from contact distance.
    // distance_3d in seed data is normalized 0–1 (lower = closer spatial contact).
    // Map to scene units: 22 (very close) → 68 (distant), then apply A/B radial bias.
    const link = links.find(
      (l) =>
        (l.source === node.id && l.target === query.id) ||
        (l.target === node.id && l.source === query.id)
    );
    const baseRadius = link?.distance_3d !== undefined
      ? 30 + link.distance_3d * 38          // 0→30, 1→68
      : 32 + (1 - node.score) * 30;

    // A compartment → nuclear interior (subtle pull); B → near lamina (subtle push)
    const compartment = GENE_COMPARTMENTS[node.id];
    const radialBias = compartment === 'A' ? 0.86 : compartment === 'B' ? 1.10 : 1.0;

    map.set(node.id, sphere[i].clone().multiplyScalar(baseRadius * radialBias));
  });

  return map;
}

// ── Sub-components ────────────────────────────────────────────

/**
 * Glowing gene bead. Size ∝ spatial score. Pulses on hover/select.
 */
function GeneBead({
  node,
  position,
  isSelected,
  onSelect,
}: {
  node: NetworkNode;
  position: THREE.Vector3;
  isSelected: boolean;
  onSelect: (n: NetworkNode) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = useMemo(
    () => new THREE.Color(GROUP_COLORS[node.group % GROUP_COLORS.length]),
    [node.group]
  );
  // Size encodes expression level; fall back to spatial score if unknown
  const expressionLevel = GENE_EXPRESSION[node.id] ?? node.score;
  const radius = 1.8 + expressionLevel * 4.2;
  const compartment = GENE_COMPARTMENTS[node.id];
  const active = hovered || isSelected;

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const t = active ? 1.22 : 1.0;
    meshRef.current.scale.lerp(
      new THREE.Vector3(t, t, t),
      Math.min(1, dt * 8)
    );
  });

  return (
    <group position={position}>
      {/* Additive glow halo — wide sphere that brightens everything behind it */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[radius * 3.8, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={active ? 0.20 : 0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Core bead */}
      <mesh
        ref={meshRef}
        castShadow
        onClick={(e) => { e.stopPropagation(); onSelect(node); }}
        onPointerEnter={() => { setHovered(true); (document.body.style as CSSStyleDeclaration).cursor = 'pointer'; }}
        onPointerLeave={() => { setHovered(false); (document.body.style as CSSStyleDeclaration).cursor = 'default'; }}
      >
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 3.5 : 1.6}
          roughness={0.18}
          metalness={0.05}
        />
      </mesh>

      {/* A/B compartment ring — gold for active, slate for peripheral */}
      {compartment && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 1.55, radius * 1.75, 48]} />
          <meshBasicMaterial
            color={compartment === 'A' ? '#fbbf24' : '#64748b'}
            transparent
            opacity={active ? 0.55 : 0.28}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Gene symbol label */}
      <Text
        position={[0, radius + 1.1, 0]}
        fontSize={1.1}
        color="rgba(255,255,255,0.75)"
        anchorX="center"
        anchorY="bottom"
        renderOrder={2}
        depthOffset={-2}
      >
        {node.id}
      </Text>
    </group>
  );
}

/**
 * Hi-C contact arc. Quadratic Bezier curve with an upward midpoint bulge.
 * Thickness ∝ contact frequency; opacity ∝ confidence.
 */
function HiCContactArc({
  source,
  target,
  value,
  confidence,
}: {
  source: THREE.Vector3;
  target: THREE.Vector3;
  value: number;
  confidence: number;
}) {
  const points = useMemo(() => {
    const dist = source.distanceTo(target);
    const dir = target.clone().sub(source).normalize();
    // Pick a perpendicular axis — fall back from Y if arc is nearly vertical
    const up = Math.abs(dir.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const perp = new THREE.Vector3().crossVectors(dir, up).normalize();
    const midpoint = source.clone()
      .add(target)
      .multiplyScalar(0.5)
      .add(perp.multiplyScalar(dist * 0.42));
    return new THREE.QuadraticBezierCurve3(source, midpoint, target).getPoints(64);
  }, [source, target]);

  return (
    <Line
      points={points}
      color="#c4b5fd"
      lineWidth={Math.max(1.2, Math.sqrt(value) * 0.9)}
      transparent
      opacity={0.55 + confidence * 0.4}
    />
  );
}

/**
 * Semi-transparent hull bounding all genes in a TAD.
 * Uses a sphere approximation (centroid + max radius) as a
 * placeholder — swap for ConvexGeometry once you add
 * three/examples/jsm/geometries/ConvexGeometry.
 */
function TADHull({
  positions,
  tad,
  color,
}: {
  positions: THREE.Vector3[];
  tad: TADDomain;
  color: THREE.Color;
}) {
  if (positions.length < 2) return null;

  const centroid = positions
    .reduce((acc, p) => acc.add(p.clone()), new THREE.Vector3())
    .divideScalar(positions.length);

  const radius = Math.max(...positions.map((p) => p.distanceTo(centroid))) + 5;

  return (
    <group position={centroid.toArray()}>
      {/* Additive glow shell — wide, very soft */}
      <mesh>
        <sphereGeometry args={[radius + 4, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.04 + tad.boundary_strength * 0.04}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Solid shell visible from outside — DoubleSide so camera angle doesn't matter */}
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.05 + tad.boundary_strength * 0.06}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * CTCF boundary ring — glowing disc centred on a TAD boundary.
 * Rendered only when boundary_strength > 0.4.
 */
function CTCFRing({
  position,
  strength,
}: {
  position: THREE.Vector3;
  strength: number;
}) {
  const inner = 2 + strength * 1.5;
  const outer = inner + 1.6;
  return (
    <mesh position={position.toArray()} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[inner, outer, 64]} />
      <meshBasicMaterial
        color={0xf0abfc}
        transparent
        opacity={0.22 + strength * 0.48}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Chromosome backbone thread.
 *
 * Groups visible nodes by chromosome, sorts them by linear genomic position,
 * then draws a CatmullRom spline through their 3D positions in that order.
 *
 * This makes the core TAD insight visible: genes that are far apart on the
 * linear chromosome (large Δstart_pos) can be spatially proximal because
 * chromatin loops fold them together. The backbone shows the linear order;
 * the Hi-C arcs show the 3D proximity that "explains" the loop.
 */
function ChromatinBackbone({
  nodes,
  positions,
}: {
  nodes: NetworkNode[];
  positions: Map<string, THREE.Vector3>;
}) {
  const backbones = useMemo(() => {
    const byChrom = new Map<
      string,
      Array<{ id: string; start: number; pos: THREE.Vector3 }>
    >();

    for (const node of nodes) {
      const gp = GENE_POSITIONS[node.id];
      const pos = positions.get(node.id);
      if (!gp || !pos) continue;
      if (!byChrom.has(gp.chr)) byChrom.set(gp.chr, []);
      byChrom.get(gp.chr)!.push({ id: node.id, start: gp.start, pos });
    }

    const result: Array<{
      chr: string;
      spline: THREE.Vector3[];
      genePts: THREE.Vector3[];
      color: string;
    }> = [];

    for (const [chr, entries] of Array.from(byChrom.entries())) {
      if (entries.length < 2) continue;
      entries.sort((a: { start: number }, b: { start: number }) => a.start - b.start);

      const pts = entries.map((e: { pos: THREE.Vector3 }) => e.pos);
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
      const spline = curve.getPoints(Math.max(60, pts.length * 25));

      // Golden-angle hue spread so each chromosome gets a distinct tint
      const chrIdx = parseInt(chr) || 23;
      const hue = Math.round((chrIdx * 137.508) % 360);
      result.push({ chr, spline, genePts: pts, color: `hsl(${hue}, 55%, 70%)` });
    }

    return result;
  }, [nodes, positions]);

  if (!backbones.length) return null;

  return (
    <>
      {backbones.map(({ chr, spline, genePts, color }) => (
        <group key={chr}>
          {/* Wide soft glow trace */}
          <Line points={spline} color={color} lineWidth={4} transparent opacity={0.07} />
          {/* Core backbone thread */}
          <Line points={spline} color={color} lineWidth={1.1} transparent opacity={0.42} />
          {/* Small marker sphere at each gene locus on the backbone */}
          {genePts.map((pos, i) => (
            <mesh key={i} position={pos.toArray()}>
              <sphereGeometry args={[1.0, 8, 8]} />
              <meshBasicMaterial color={color} transparent opacity={0.65} depthWrite={false} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

// ── Scene ─────────────────────────────────────────────────────

function Scene({
  data,
  tads,
  onSelect,
}: {
  data: NetworkData;
  tads: TADDomain[];
  onSelect: (n: NetworkNode | null) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const positions = useMemo(() => computePositions(data.nodes, data.links), [data]);

  const tadColorMap = useMemo(
    () =>
      new Map(
        tads.map((t, i) => [
          t.tad_id,
          new THREE.Color(TAD_PALETTE[i % TAD_PALETTE.length]),
        ])
      ),
    [tads]
  );

  const handleSelect = (node: NetworkNode) => {
    const next = selectedId === node.id ? null : node.id;
    setSelectedId(next);
    onSelect(next ? node : null);
  };

  // Dismiss selection when clicking empty nucleus space
  const handleCanvasClick = () => {
    setSelectedId(null);
    onSelect(null);
  };

  return (
    <>
      {/* Dark scene background — required when Canvas alpha is off */}
      <color attach="background" args={['#050a14']} />

      {/* ── Lighting ─────────────────────────────────────────── */}
      {/* Cool blue ambient mimics diffuse nuclear scatter */}
      <ambientLight intensity={0.45} color={0x8ab4ff} />
      {/* Warm white centre — simulates DNA-staining fluorescence */}
      <pointLight position={[0, 0, 0]} intensity={2.6} color={0xffffff} distance={230} decay={1.5} />
      {/* Accent fills for depth */}
      <pointLight position={[65, 65, -65]} intensity={0.55} color={0xc084fc} />
      <pointLight position={[-65, -40, 75]} intensity={0.35} color={0x67e8f9} />

      {/* ── Nucleus shell — intentionally minimal so gene labels stay readable ── */}
      {/* Thin dark-edge membrane: just enough to show the nuclear boundary */}
      <mesh onClick={handleCanvasClick}>
        <sphereGeometry args={[88, 64, 64]} />
        <meshStandardMaterial
          color={0x0d1530}
          emissive={0x1a2a60}
          emissiveIntensity={0.35}
          transparent
          opacity={0.08}
          roughness={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Wireframe-style edge highlight — makes the sphere boundary legible */}
      <mesh>
        <sphereGeometry args={[88, 24, 24]} />
        <meshBasicMaterial
          color={0x2a4080}
          transparent
          opacity={0.12}
          depthWrite={false}
          wireframe
        />
      </mesh>
      {/* A-compartment zone — very faint warm hint at nuclear interior */}
      <mesh>
        <sphereGeometry args={[50, 24, 24]} />
        <meshBasicMaterial color={0x2d1e08} transparent opacity={0.06} depthWrite={false} />
      </mesh>

      {/* TAD domain hulls shown only when real TAD data is provided */}
      {tads.length > 0 && tads.map((tad, i) => {
        const pts = tad.gene_ids
          .map((id) => positions.get(id))
          .filter((p): p is THREE.Vector3 => !!p);
        const color = tadColorMap.get(tad.tad_id) ?? new THREE.Color(TAD_PALETTE[i % TAD_PALETTE.length]);
        return <TADHull key={tad.tad_id} positions={pts} tad={tad} color={color} />;
      })}

      {/* ── Chromosome backbone threads ──────────────────────── */}
      {/* Shows linear genomic order — distant nodes on same chr are connected */}
      {/* Hi-C arcs then reveal which distant loci loop together in 3D space  */}
      <ChromatinBackbone nodes={data.nodes} positions={positions} />

      {/* ── Hi-C contact arcs ────────────────────────────────── */}
      {data.links.map((link, i) => {
        const srcId =
          typeof link.source === 'string' ? link.source : (link.source as NetworkNode).id;
        const tgtId =
          typeof link.target === 'string' ? link.target : (link.target as NetworkNode).id;
        const src = positions.get(srcId);
        const tgt = positions.get(tgtId);
        if (!src || !tgt) return null;
        return (
          <HiCContactArc
            key={i}
            source={src}
            target={tgt}
            value={link.value}
            confidence={link.confidence}
          />
        );
      })}

      {/* ── Gene beads ───────────────────────────────────────── */}
      {data.nodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        return (
          <GeneBead
            key={node.id}
            node={node}
            position={pos}
            isSelected={selectedId === node.id}
            onSelect={handleSelect}
          />
        );
      })}

      {/* ── CTCF boundary rings ──────────────────────────────── */}
      {tads
        .filter((t) => t.boundary_strength > 0.4)
        .map((tad) => {
          const pts = tad.gene_ids
            .map((id) => positions.get(id))
            .filter((p): p is THREE.Vector3 => !!p);
          if (!pts.length) return null;
          const centroid = pts
            .reduce((acc, p) => acc.add(p.clone()), new THREE.Vector3())
            .divideScalar(pts.length);
          return <CTCFRing key={`ctcf-${tad.tad_id}`} position={centroid} strength={tad.boundary_strength} />;
        })}

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.55}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.55}
        zoomSpeed={0.85}
        minDistance={22}
        maxDistance={210}
        makeDefault
      />

      {/* ── Post-processing bloom ────────────────────────────── */}
      {/* EffectComposer captures the HDR frame before the renderer outputs it. */}
      {/* Renderer tone mapping is NoToneMapping; EffectComposer's own output  */}
      {/* pass handles the linear→sRGB conversion after bloom is applied.      */}
      <EffectComposer>
        <Bloom
          mipmapBlur
          intensity={3.2}
          luminanceThreshold={0.08}
          luminanceSmoothing={0.06}
        />
      </EffectComposer>
    </>
  );
}

// ── Public component ──────────────────────────────────────────

export function TAD3DNetworkVisualization({ data, tads = [], className = '' }: Props) {
  const [selected, setSelected] = useState<NetworkNode | null>(null);

  if (!data?.nodes.length) return null;

  return (
    <div className={`relative rounded-xl overflow-hidden border border-white/10 ${className}`}>
      {/* ── Three.js canvas ──────────────────────────────────── */}
      <Canvas
        camera={{ position: [0, 0, 140], fov: 50, near: 0.5, far: 800 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.NoToneMapping }}
        dpr={[1, 2]}
        style={{ height: 560 }}
        shadows
      >
        <Suspense fallback={null}>
          <Scene data={data} tads={tads} onSelect={setSelected} />
        </Suspense>
      </Canvas>

      {/* ── HUD labels ───────────────────────────────────────── */}
      <p className="pointer-events-none absolute top-3 left-3 select-none font-mono text-xs text-white/60">
        3D Spatial Network · Drag to orbit · Scroll to zoom · Click gene to inspect
      </p>

      {/* ── Legend ───────────────────────────────────────────── */}
      <div
        className="absolute bottom-3 right-3 flex flex-col gap-1.5 rounded-lg px-3 py-2 text-xs text-white/55"
        style={{ background: 'rgba(15,7,38,0.82)', backdropFilter: 'blur(8px)' }}
      >
        {[
          { color: GROUP_COLORS[1], label: 'Query gene' },
          { color: GROUP_COLORS[2], label: 'Direct neighbor' },
          { color: GROUP_COLORS[3], label: 'Secondary' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-2 text-purple-300/60">
          <span className="h-2.5 w-2.5 rounded-full border border-purple-300/30" style={{ background: '#f0abfc' }} />
          CTCF boundary
        </span>
        <span className="flex items-center gap-2 text-slate-300/50 mt-0.5 pt-1 border-t border-white/10">
          <span className="h-0.5 w-5 rounded-full" style={{ background: 'hsl(45,55%,70%)' }} />
          Chr. backbone (linear order)
        </span>
        <span className="flex items-center gap-2 text-amber-300/50">
          <span className="h-2.5 w-2.5 rounded-full border border-amber-300/40" style={{ background: 'transparent', outline: '1.5px solid #fbbf24', outlineOffset: '-1px' }} />
          A compartment (active)
        </span>
        <span className="flex items-center gap-2 text-slate-400/50">
          <span className="h-2.5 w-2.5 rounded-full border border-slate-500/40" style={{ background: 'transparent', outline: '1.5px solid #64748b', outlineOffset: '-1px' }} />
          B compartment (peripheral)
        </span>
        <span className="flex items-center gap-2 text-white/35 text-[10px] mt-0.5">
          Node size = expression level
        </span>
      </div>

      {/* ── Selected gene panel ──────────────────────────────── */}
      {selected && (
        <div
          className="absolute bottom-4 left-4 w-56 rounded-xl border border-white/15 shadow-2xl text-sm"
          style={{ background: 'rgba(15,7,38,0.96)', backdropFilter: 'blur(16px)' }}
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-white/30"
              style={{ background: GROUP_COLORS[selected.group % GROUP_COLORS.length] }}
            />
            <span className="flex-1 font-mono font-semibold text-white">{selected.id}</span>
            <button
              onClick={() => setSelected(null)}
              className="text-white/30 transition hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2.5 px-3 py-3">
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Spatial score</span>
              <span className="font-mono font-bold text-gm-pink">
                {(selected.score * 10).toFixed(1)}&thinsp;/&thinsp;10
              </span>
            </div>
            {GENE_EXPRESSION[selected.id] !== undefined && (
              <div className="flex justify-between text-xs">
                <span className="text-white/50">Expression</span>
                <span className="font-mono text-amber-300">
                  {(GENE_EXPRESSION[selected.id] * 100).toFixed(0)}&thinsp;TPM&thinsp;(norm)
                </span>
              </div>
            )}
            {GENE_COMPARTMENTS[selected.id] && (
              <div className="flex justify-between text-xs">
                <span className="text-white/50">Compartment</span>
                <span className={`font-mono font-semibold ${GENE_COMPARTMENTS[selected.id] === 'A' ? 'text-amber-300' : 'text-slate-400'}`}>
                  {GENE_COMPARTMENTS[selected.id] === 'A' ? 'A — active / interior' : 'B — peripheral / silent'}
                </span>
              </div>
            )}
            {selected.chromosome && (
              <div className="flex justify-between text-xs">
                <span className="text-white/50">Chromosome</span>
                <span className="font-mono text-white/75">{selected.chromosome}</span>
              </div>
            )}
            {(selected as NetworkNode3D).tad_id && (
              <div className="flex justify-between text-xs">
                <span className="text-white/50">TAD</span>
                <span className="font-mono text-white/75">{(selected as NetworkNode3D).tad_id}</span>
              </div>
            )}
            {(selected as NetworkNode3D).compartment && (
              <div className="flex justify-between text-xs">
                <span className="text-white/50">Compartment</span>
                <span className="font-mono text-white/75">
                  {(selected as NetworkNode3D).compartment === 'A' ? 'A (active)' : 'B (inactive)'}
                </span>
              </div>
            )}
            <p className="border-t border-white/10 pt-2 text-xs leading-relaxed text-white/35">
              Hi-C contacts indicate this gene shares a topological domain or chromatin loop with
              the query gene.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
