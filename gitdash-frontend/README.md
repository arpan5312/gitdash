# GitDash Frontend

Repository-intelligence dashboard: React + TypeScript + Tailwind + Framer Motion + react-force-graph-2d.

Talks to the existing backend at `http://localhost:5000` (see `src/api/client.ts` for the exact endpoints
used — `/api/analyze`, `/api/metrics`, `/api/repository-summary`, `/api/ai-summary`. No endpoints were
invented and no backend logic was touched).

## Setup

```bash
npm install
npm run dev
```

Then open the printed local URL (default `http://localhost:5173`). Make sure the backend server is
already running on port 5000 (`node server.js` or however you start it) — the frontend does not proxy
or mock any data.

## Structure

```
src/
  api/client.ts              -> isolated fetch wrappers for the 4 backend endpoints
  types/index.ts              -> TypeScript types mirroring the backend data model exactly
  utils/visualMap.ts          -> component/risk color + label mappings
  utils/insights.ts           -> derives the Insights panel bullets from repository-summary fields
  components/
    Hero/                      -> landing page, URL input, staged loading animation
    Dashboard/                 -> page shell + KPI cards
    Graph/                     -> the force-directed graph, tooltip, and click side-panel
    Insights/                  -> insights list panel
    AIReport/                  -> collapsible AI Architecture Review panel (markdown)
```

## Notes on the graph

- Collision (`forceCollide`), repulsion (`forceManyBody`), and link forces (`forceLink`) are tuned in
  `components/Graph/graphConfig.ts` — adjust `FORCE_CONFIG` there if a given repo still feels cramped.
- Node radius encodes `structural_risk_index`; glow strength encodes `knowledge_concentration`.
- Labels are suppressed by default and only drawn on hover, on selection, or once the camera is zoomed
  in past `LABEL_ZOOM_THRESHOLD`, so dense repos stay legible.
- The camera auto-fits once the simulation's first cooldown completes (`onEngineStop`).
