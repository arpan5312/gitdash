// Central tuning knobs for the force simulation and render thresholds.
// Kept separate from GraphView so the "why" behind each number is easy to find.

export const FORCE_CONFIG = {
  // forceManyBody — negative = repulsion. Strong enough that unrelated
  // files push apart into legible clusters instead of collapsing to a ball.
  chargeStrength: -220,
  chargeDistanceMax: 900,

  // forceCollide — hard radius floor so nodes can never visually overlap,
  // scaled per-node by risk size at call time.
  collidePadding: 10,

  // forceLink — longer distance + lower strength than defaults so coupled
  // files pull together without dragging the whole graph into a knot.
  linkDistance: 90,
  linkStrength: 0.25,

  // Gentle centering so the graph settles near the viewport center
  // rather than drifting to a corner.
  centerStrength: 0.02
};

export const NODE_SIZE = {
  min: 4,
  max: 16
};

// Labels only render past this camera zoom level, or on hover/selection.
export const LABEL_ZOOM_THRESHOLD = 2.2;

export function nodeRadius(structuralRiskIndex: number): number {
  const clamped = Math.max(0, Math.min(1, structuralRiskIndex));
  return NODE_SIZE.min + clamped * (NODE_SIZE.max - NODE_SIZE.min);
}

export function linkWidth(weight: number, maxWeight: number): number {
  if (maxWeight <= 0) return 0.6;
  const ratio = weight / maxWeight;
  return 0.5 + ratio * 2.5;
}

export function linkOpacity(weight: number, maxWeight: number): number {
  if (maxWeight <= 0) return 0.15;
  const ratio = weight / maxWeight;
  return 0.12 + ratio * 0.55;
}
