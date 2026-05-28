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

    // Otherwise, place on Fibonacci sphere with radius derived from contact distance
    const link = links.find(
      (l) =>
        (l.source === node.id && l.target === query.id) ||
        (l.target === node.id && l.source === query.id)
    );
    const radius = link?.distance_3d
      ? Math.max(28, Math.min(70, link.distance_3d / 1.4))
      : 28 + (1 - node.score) * 35;

    map.set(node.id, sphere[i].clone().multiplyScalar(radius));
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
  const radius = 2.2 + node.score * 3.2;
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
    <mesh position={centroid.toArray()}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshStandardMaterial
        color={color}
        transparent
        // Stronger boundary → denser, more opaque hull
        opacity={0.045 + tad.boundary_strength * 0.07}
        roughness={0.9}
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
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

      {/* ── Nucleus shell ────────────────────────────────────── */}
      {/* Outer atmospheric glow — additive so it brightens the edges */}
      <mesh>
        <sphereGeometry args={[97, 32, 32]} />
        <meshBasicMaterial
          color={0x304090}
          transparent
          opacity={0.055}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Nucleus membrane — DoubleSide so it shows from both inside and outside */}
      <mesh onClick={handleCanvasClick}>
        <sphereGeometry args={[88, 64, 64]} />
        <meshStandardMaterial
          color={0x1a2560}
          emissive={0x2040c0}
          emissiveIntensity={0.9}
          transparent
          opacity={0.22}
          roughness={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Inner chromatin haze */}
      <mesh>
        <sphereGeometry args={[82, 32, 32]} />
        <meshBasicMaterial
          color={0x1e3a5f}
          transparent
          opacity={0.13}
          depthWrite={false}
        />
      </mesh>

      {/* ── TAD domain hulls ─────────────────────────────────── */}
      {tads.map((tad) => {
        const pts = tad.gene_ids
          .map((id) => positions.get(id))
          .filter((p): p is THREE.Vector3 => !!p);
        const color = tadColorMap.get(tad.tad_id) ?? new THREE.Color(TAD_PALETTE[0]);
        return <TADHull key={tad.tad_id} positions={pts} tad={tad} color={color} />;
      })}

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
      {/* Adds fluorescence-microscopy-style glow to bright/emissive objects */}
      <EffectComposer>
        <Bloom
          mipmapBlur
          intensity={2.8}
          luminanceThreshold={0.18}
          luminanceSmoothing={0.04}
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
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        dpr={[1, 2]}
        style={{ height: 560 }}
        shadows
      >
        <Suspense fallback={null}>
          <Scene data={data} tads={tads} onSelect={setSelected} />
        </Suspense>
      </Canvas>

      {/* ── HUD labels ───────────────────────────────────────── */}
      <p className="pointer-events-none absolute top-3 left-3 select-none font-mono text-xs text-white/30">
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
