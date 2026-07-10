import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import type { MouseEvent } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide, forceManyBody, forceLink } from 'd3-force';
import type { GraphNode, GraphLink } from '../../types';
import { COMPONENT_COLOR } from '../../utils/visualMap';
import { FORCE_CONFIG, nodeRadius, linkWidth, linkOpacity, LABEL_ZOOM_THRESHOLD } from './graphConfig';
import NodeTooltip from './NodeTooltip';

// react-force-graph-2d's published type definitions are loosely typed and
// vary across versions, so the graph instance ref and per-node/link canvas
// callbacks intentionally use `any` at the boundary rather than fighting
// generics that don't match the runtime API. Everything past that boundary
// (paintNode, force config, etc.) is fully typed against our own GraphNode
// and GraphLink types.
type ForceGraphInstance = any;

interface GraphViewProps {
  nodes: GraphNode[];
  links: GraphLink[];
  isLoading: boolean;
  onSelectNode: (node: GraphNode | null) => void;
  selectedNodeId: string | null;
}

export default function GraphView({ nodes, links, isLoading, onSelectNode, selectedNodeId }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphInstance>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 560 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hasStabilized, setHasStabilized] = useState(false);

  // Graph data is cloned per-load so the force simulation can freely mutate
  // x/y/vx/vy on these objects without touching the props/parent state.
  const graphData = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l }))
    }),
    [nodes, links]
  );

  const maxWeight = useMemo(() => links.reduce((max, l) => Math.max(max, l.weight), 0), [links]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({ width: entry.contentRect.width, height: Math.max(560, entry.contentRect.height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setHasStabilized(false);
  }, [nodes, links]);

  // Requirement: nodes must not overlap. Collision radius tracks each
  // node's visual size (driven by structural_risk_index) plus padding.
  const configureForces = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;

    fg.d3Force(
      'charge',
      forceManyBody()
        .strength(FORCE_CONFIG.chargeStrength)
        .distanceMax(FORCE_CONFIG.chargeDistanceMax)
    );

    fg.d3Force(
      'collide',
      forceCollide<GraphNode>()
        .radius((n) => nodeRadius(n.structural_risk_index) + FORCE_CONFIG.collidePadding)
        .strength(1)
        .iterations(2)
    );

    fg.d3Force(
      'link',
      forceLink<GraphNode, GraphLink>()
        .id((n) => n.id)
        .distance(FORCE_CONFIG.linkDistance)
        .strength(FORCE_CONFIG.linkStrength)
    );
  }, []);

  useEffect(() => {
    configureForces();
  }, [configureForces, graphData]);

  const handleEngineStop = useCallback(() => {
    if (!hasStabilized) {
      fgRef.current?.zoomToFit(600, 60);
      setHasStabilized(true);
    }
  }, [hasStabilized]);

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode & { x: number; y: number };
      const radius = nodeRadius(n.structural_risk_index);
      const color = COMPONENT_COLOR[n.component_type];
      const isSelected = n.id === selectedNodeId;
      const isHovered = n.id === hoveredNode?.id;

      // Glow strength driven by knowledge_concentration — files owned by
      // one author read as "hotter" in the intelligence map.
      const glowStrength = 4 + n.knowledge_concentration * 14;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected || isHovered ? glowStrength * 1.8 : glowStrength;

      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = isSelected || isHovered ? 1 : 0.88;
      ctx.fill();
      ctx.restore();

      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + 2.5, 0, 2 * Math.PI);
        ctx.strokeStyle = '#EDEEF0';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      const showLabel = isSelected || isHovered || globalScale >= LABEL_ZOOM_THRESHOLD;
      if (showLabel) {
        const label = shortLabel(n.id);
        // Keep label at a constant on-screen size regardless of zoom level.
        const fontSize = 11 / globalScale;
        ctx.font = `${fontSize}px "IBM Plex Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(8,9,11,0.75)';
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(n.x - textWidth / 2 - 3, n.y + radius + 3, textWidth + 6, fontSize + 4);
        ctx.fillStyle = '#EDEEF0';
        ctx.fillText(label, n.x, n.y + radius + 5);
      }
    },
    [hoveredNode, selectedNodeId]
  );

  const paintPointerArea = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const n = node as GraphNode & { x: number; y: number };
    const radius = nodeRadius(n.structural_risk_index) + 4;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div className="relative rounded-xl border border-base-600 bg-base-800/40">
      <div className="flex items-center justify-between border-b border-base-600 px-4 py-3">
        <div>
          <h2 className="text-sm font-medium text-ink-100">Coupling intelligence map</h2>
          <p className="text-xs text-ink-700">{nodes.length} components · {links.length} relationships</p>
        </div>
        <Legend />
      </div>

      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative h-[560px] w-full overflow-hidden rounded-b-xl"
      >
        {isLoading ? (
          <GraphSkeleton />
        ) : nodes.length === 0 ? (
          <EmptyGraphState />
        ) : (
          <>
            <ForceGraph2D
              ref={fgRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={graphData}
              backgroundColor="rgba(0,0,0,0)"
              nodeRelSize={1}
              nodeVal={(n) => nodeRadius((n as GraphNode).structural_risk_index)}
              nodeCanvasObject={paintNode as any}
              nodePointerAreaPaint={paintPointerArea as any}
              linkWidth={(l) => linkWidth((l as unknown as GraphLink).weight, maxWeight)}
              linkColor={(l) => `rgba(139, 144, 154, ${linkOpacity((l as unknown as GraphLink).weight, maxWeight)})`}
              linkDirectionalParticles={0}
              cooldownTicks={120}
              onEngineStop={handleEngineStop}
              onZoom={(t) => setZoomLevel(t.k)}
              onNodeHover={(n) => setHoveredNode(n as GraphNode | null)}
              onNodeClick={(n) => onSelectNode(n as GraphNode)}
              onBackgroundClick={() => onSelectNode(null)}
              enableNodeDrag
              enableZoomInteraction
              enablePanInteraction
              autoPauseRedraw={false}
            />
            {hoveredNode && (
              <NodeTooltip node={hoveredNode} x={mousePos.x} y={mousePos.y} />
            )}
            <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-base-600 bg-base-900/70 px-2 py-1 font-mono text-[10px] text-ink-700">
              zoom {zoomLevel.toFixed(1)}x
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function shortLabel(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

function Legend() {
  const entries = Object.entries(COMPONENT_COLOR);
  return (
    <div className="hidden items-center gap-3 sm:flex">
      {entries.map(([type, color]) => (
        <div key={type} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[10px] font-mono capitalize text-ink-700">{type.replace('_', ' ')}</span>
        </div>
      ))}
    </div>
  );
}

function GraphSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-base-600 border-t-signal-blue" />
        <p className="font-mono text-xs text-ink-700">Building coupling graph...</p>
      </div>
    </div>
  );
}

function EmptyGraphState() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <p className="font-mono text-xs text-ink-700">No structural relationships were found for this repository.</p>
    </div>
  );
}
