# gitdash
# GitDash

**Repository intelligence through behavioral analysis.**

GitDash analyzes a Git repository's commit history and turns it into an interactive intelligence map — surfacing structural risk, ownership concentration, coupling bottlenecks, and an AI-generated architecture review, all derived from actual commit behavior rather than static code analysis.

---

## What it does

Point GitDash at any public GitHub repository and it will:

1. **Clone and mine commit history** — extracting per-file churn, author diversity, and co-change coupling (files that keep changing together across commits, a strong signal of hidden architectural dependencies).
2. **Score structural risk** for every file using a robust statistical model (median/MAD-based z-scores, weighted through a sigmoid) that blends churn, coupling density, author concentration, and change stability.
3. **Classify behavior** — tagging files as things like `refactor_decay_hotspot`, `shared_bottleneck`, `volatile_config_bottleneck`, or `stable_component` based on their type and risk profile.
4. **Visualize it** as a force-directed "intelligence map" — node size encodes risk, glow encodes ownership concentration, edge weight encodes coupling strength, with collision/repulsion tuning so nothing overlaps even on large repos.
5. **Generate a plain-language architecture review** via an LLM, synthesizing the same structured metrics into actionable engineering insight.

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Node.js (built-in `http`, no framework), Git CLI, Google Gemini API (`@google/genai`) |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Framer Motion, `react-force-graph-2d`, `d3-force` |

No backend logic runs in the frontend and no data is mocked — everything rendered comes directly from the four backend endpoints below.

---

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/analyze` | Clone a GitHub repo, return a `repo_id` |
| `GET` | `/api/metrics?id=<repo_id>` | Pruned graph nodes + links for visualization |
| `GET` | `/api/repository-summary?id=<repo_id>` | Aggregated hotspots, ownership risks, bottlenecks, repo health score |
| `GET` | `/api/ai-summary?id=<repo_id>` | LLM-generated architecture review |

---

## Setup

### 1. Backend

```bash
npm install
```

Create a `.env` file in the project root:
```
GEMINI_API_KEY=your_gemini_api_key_here
```
Get a key from [Google AI Studio](https://aistudio.google.com/apikey). **Never commit this file** — it's already covered by `.gitignore`.

Start the server:
```bash
node server.js
```
It listens on `http://localhost:5000`.

### 2. Frontend

```bash
cd gitdash-frontend
npm install
npm run dev
```
Open the printed local URL (default `http://localhost:5173`). Make sure the backend is running first — the frontend does not proxy or mock any data.

---

## Project structure

```
.
├── server.js                 # backend: clone, metrics, scoring, AI summary
├── repos/                    # cloned repositories (gitignored)
├── .env                      # GEMINI_API_KEY (gitignored, never commit)
└── gitdash-frontend/
    └── src/
        ├── api/client.ts       # isolated fetch wrappers for the 4 endpoints
        ├── types/index.ts      # TypeScript types mirroring the backend data model
        ├── utils/
        │   ├── visualMap.ts    # component/risk color + label mappings
        │   └── insights.ts     # derives Insights panel bullets from summary data
        └── components/
            ├── Hero/           # landing page, URL input, staged loading animation
            ├── Dashboard/      # page shell + KPI cards
            ├── Graph/          # force-directed graph, tooltip, click side-panel
            ├── Insights/       # insights list panel
            └── AIReport/       # collapsible AI Architecture Review panel
```

---

## Notes on the graph

- Collision (`forceCollide`), repulsion (`forceManyBody`), and link forces (`forceLink`) are tuned in `components/Graph/graphConfig.ts`.
- Node radius encodes `structural_risk_index`; glow strength encodes `knowledge_concentration`.
- Labels are hidden by default and only render on hover, on selection, or once the camera is zoomed in past a threshold — keeps dense repos readable.
- The camera auto-fits once the force simulation's first cooldown completes.

---

## Known limitations

- Coupling is based on **co-commit frequency**, not actual code dependencies (imports/calls) — a behavioral proxy, not ground truth.
- The risk-scoring weights are a heuristic first pass, not validated against real incident/outage data.
- Large repositories may hit the backend's 45-second command timeout on `git log`.
- The AI architecture review depends on Gemini API availability and a valid, correctly-scoped API key.

---

## License

Add your license of choice here.
