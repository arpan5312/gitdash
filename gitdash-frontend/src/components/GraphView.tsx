import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { forceCollide } from 'd3-force';
import type { RepoLink, RepoNode } from '../types';
import { COMPONENT_COLOR } from '../theme';

interface GraphViewProps {
  nodes: RepoNode[];
  links: RepoLink[];
  onSelectNode: (node: RepoNode) => void;
  selectedId: string | null;
}

// Zoom level above which we start drawing labels for all visible nodes,
// not just the hovered one. Keeps dense repos (300+ files) from turning
// into a bowl of spaghetti.
const LABEL_ZOOM_THRESHOLD = 3.2;

const MIN_NODE_R = 4;
const MAX_NODE_R = 15;

function nodeId(n: string | RepoNode | NodeObject): string {
  return typeof n === 'string' ? n : (n as RepoNode).id;
}

/**
 * Backend risk/ownership scores are percentile-relative to the analyzed
 * repo. On a small or single-author repo that means most files tie near
 * the top and every node looks maxed out. We re-normalize locally (min-max
 * across the currently loaded graph) purely for the *visual encoding*, so
 * size/glow still show relative differences even when the underlying repo
 * doesn't have enough history for the backend's percentiles to spread out.
 * The raw numbers in the side panel are left untouched — this only affects
 * how big/bright a node is drawn.
 */
function useLocalScale(nodes: RepoNode[], key: keyof RepoNode) {
  return useMemo(() => {
    const values = nodes.map((n) => Number(n[key]) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const map = new Map<string, number>();
    nodes.forEach((n) => map.set(n.id, ((Number(n[key]) || 0) - min) / span));
    return map;
  }, [nodes, key]);
}

export default function GraphView({ nodes, links, onSelectNode, selectedId }: GraphViewProps) {
  const fgRef = useRef<ForceGraphMethods<NodeObject, LinkObject> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverNode, setHoverNode] = useState<RepoNode | null>(null);
  const [zoom, setZoom] = useState(1);

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l }))
    }),
    [nodes, links]
  );

  const riskScale = useLocalScale(nodes, 'structural_risk_index');
  const ownershipScale = useLocalScale(nodes, 'knowledge_concentration');

  const radiusFor = useCallback(
    (n: RepoNode) => {
      const t = riskScale.get(n.id) ?? 0;
      return MIN_NODE_R + t * (MAX_NODE_R - MIN_NODE_R);
    },
    [riskScale]
  );

  // Tune the physics once per dataset: real collision so nodes can never
  // overlap, stronger repulsion so dense/small repos still spread out, and
  // link distance that reacts to weight without letting anything collapse
  // to zero.
  useEffect(() => {
    const fg = fgRef.current as any;
    if (!fg) return;

    fg.d3Force('charge')?.strength(-260).distanceMax(600);
    fg.d3Force('link')?.distance((l: any) => {
      const w = l.weight ?? 1;
      return Math.max(70, 160 - w * 3);
    });
    fg.d3Force(
      'collide',
      forceCollide((n: any) => radiusFor(n as RepoNode) + 18).strength(1)
    );
    fg.d3ReheatSimulation?.();
  }, [graphData, radiusFor]);

  const drawNode = useCallback(
    (node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as unknown as RepoNode;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const r = radiusFor(n);
      const color = COMPONENT_COLOR[n.component_type] ?? '#8890A0';
      const isHovered = hoverNode?.id === n.id;
      const isSelected = selectedId === n.id;

      // glow proportional to (locally-scaled) knowledge concentration — the
      // more one person "owns" a file relative to the rest of this repo,
      // the more it visually radiates. Kept modest so dense graphs don't
      // turn into one solid wash of color.
      const glowStrength = ownershipScale.get(n.id) ?? 0;
      if (glowStrength > 0.08) {
        const glowR = r * (1.25 + glowStrength * 0.9);
        const gradient = ctx.createRadialGradient(x, y, r * 0.5, x, y, glowR);
        gradient.addColorStop(0, `${color}40`);
        gradient.addColorStop(1, `${color}00`);
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(x, y, glowR, 0, 2 * Math.PI);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.globalAlpha = 1;

      if (isHovered || isSelected) {
        ctx.lineWidth = 1.5 / globalScale;
        ctx.strokeStyle = isSelected ? '#38D9C4' : '#E7EAF0';
        ctx.stroke();
      }

      const showLabel = isHovered || isSelected || globalScale > LABEL_ZOOM_THRESHOLD;
      if (showLabel) {
        const fontSize = 11 / globalScale;
        ctx.font = `${fontSize}px "IBM Plex Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const label = n.id.length > 42 ? `…${n.id.slice(-40)}` : n.id;
        const textY = y + r + 3;
        const metrics = ctx.measureText(label);
        const padX = 4 / globalScale;
        ctx.fillStyle = 'rgba(7,8,11,0.82)';
        ctx.fillRect(
          x - metrics.width / 2 - padX,
          textY - 1,
          metrics.width + padX * 2,
          fontSize + 3
        );
        ctx.fillStyle = isHovered || isSelected ? '#E7EAF0' : '#AAB2C2';
        ctx.fillText(label, x, textY);
      }
    },
    [hoverNode, selectedId, radiusFor, ownershipScale]
  );

  const drawLink = useCallback((link: LinkObject, ctx: CanvasRenderingContext2D) => {
    const l = link as unknown as RepoLink & { source: RepoNode; target: RepoNode };
    const s = l.source;
    const t = l.target;
    if (!s || !t || s.x === undefined || t.x === undefined) return;

    const weight = l.weight ?? 1;
    const width = Math.min(0.4 + weight * 0.1, 4.5);
    const opacity = Math.min(0.06 + weight * 0.02, 0.6);

    ctx.beginPath();
    ctx.moveTo(s.x!, s.y!);
    ctx.lineTo(t.x!, t.y!);
    ctx.strokeStyle = `rgba(150, 165, 190, ${opacity})`;
    ctx.lineWidth = width;
    ctx.stroke();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-lg border border-base-border bg-base-950/60"
    >
      <ForceGraph2D
        ref={fgRef as any}
        graphData={graphData}
        backgroundColor="transparent"
        nodeId="id"
        nodeRelSize={1}
        nodeVal={(n) => radiusFor(n as unknown as RepoNode)}
        nodeCanvasObject={drawNode}
        nodeCanvasObjectMode={() => 'replace'}
        linkCanvasObject={drawLink}
        linkCanvasObjectMode={() => 'replace'}
        cooldownTicks={300}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.28}
        onNodeHover={(n) => setHoverNode((n as unknown as RepoNode) ?? null)}
        onNodeClick={(n) => onSelectNode(n as unknown as RepoNode)}
        onZoom={(t) => setZoom(t.k)}
        onZoomEnd={(t) => setZoom(t.k)}
        onEngineStop={() => fgRef.current?.zoomToFit(500, 60)}
        enableNodeDrag={true}
        enablePanInteraction={true}
        enableZoomInteraction={true}
        linkDirectionalParticles={0}
      />

      {/* legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-base-900/70 px-3 py-2 font-mono text-[10px] text-ink-500 backdrop-blur-sm">
        {Object.entries(COMPONENT_COLOR).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {type.replace('_', ' ')}
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-base-900/70 px-2.5 py-1 font-mono text-[10px] text-ink-700 backdrop-blur-sm">
        zoom {zoom.toFixed(1)}×{zoom <= LABEL_ZOOM_THRESHOLD ? ' · labels on hover' : ' · labels visible'}
      </div>
    </div>
  );
}
