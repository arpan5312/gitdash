# GitDash — frontend

Repository intelligence dashboard. React + TypeScript + Tailwind + Framer Motion,
force-directed graph via `react-force-graph-2d`, wired to the GitDash backend
running at `http://localhost:5000`.

## Setup

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173`. Make sure the backend
(`node server.js`) is running on port 5000 first — CORS is already open on
the backend for local development.

## Structure

```
src/
  App.tsx                 stage machine: hero → loading pipeline → dashboard
  api.ts                  fetch wrappers for /api/analyze and /api/metrics
  theme.ts                component-type colors, behavior labels, risk scale
  types.ts                shared types mirroring the backend response shape
  utils/insights.ts        client-side "insights engine" over nodes + links
  components/
    Hero.tsx              landing page, URL input
    LoadingPipeline.tsx    animated analysis steps
    Dashboard.tsx          composes KPI cards, graph, side panel, insights
    KPICards.tsx           top-row summary metrics
    GraphView.tsx          react-force-graph-2d canvas rendering + interactions
    SidePanel.tsx          clicked-node detail panel
    InsightsFeed.tsx       right-rail insight list
    HudFrame.tsx           ambient corner-bracket / scanline framing device
```

## Notes on the graph

- Node **size** encodes `structural_risk_index`, node **glow** encodes
  `knowledge_concentration`, node **color** encodes `component_type`.
- Edge **thickness** and **opacity** both encode `weight` (co-change
  frequency).
- Labels only render on hover, on the selected node, or once you've zoomed
  in past ~3.2×. On a 300+ file repo this keeps the graph legible instead
  of turning into label spaghetti — zoom into a cluster to read it.
- `react-force-graph-2d`'s public API shifts a little between versions;
  if a prop name in `GraphView.tsx` (e.g. `onZoom`, `enablePanInteraction`)
  doesn't match your installed version, check that package's README —
  the rendering logic (`nodeCanvasObject`/`linkCanvasObject`) is the part
  that matters and is stable across versions.

## Design tokens

- Background: near-black graphite (`#07080B` → `#0A0C10`), not pure black.
- Accent: teal-cyan (`#38D9C4`) for interactive chrome — kept separate from
  the node palette so UI and data don't compete.
- Type: Space Grotesk (display), IBM Plex Mono (data/labels/timestamps),
  Inter (body/insight copy).
- Component colors are fixed by the data contract: source → red,
  docs → blue, testing → green, infra → orange, pipeline → purple.
