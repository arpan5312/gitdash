import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { MetricsResponse, RepoNode } from '../types';
import KPICards from './KPICards';
import GraphView from './GraphView';
import SidePanel from './SidePanel';
import InsightsFeed from './InsightsFeed';
import { generateInsights } from '../utils/insights';

interface DashboardProps {
  data: MetricsResponse;
  repoUrl: string;
  onReset: () => void;
}

export default function Dashboard({ data, repoUrl, onReset }: DashboardProps) {
  const [selected, setSelected] = useState<RepoNode | null>(null);
  const insights = useMemo(() => generateInsights(data.nodes, data.links), [data]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex h-screen flex-col gap-4 p-4 md:p-6"
    >
      <header className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-700">
            Repository
          </div>
          <h1 className="font-display text-lg font-semibold text-ink-100">
            {repoUrl.replace('https://github.com/', '')}
          </h1>
        </div>
        <button
          onClick={onReset}
          className="rounded-md border border-base-border px-3 py-1.5 font-mono text-xs text-ink-500 transition hover:border-accent/50 hover:text-accent"
        >
          ← analyze another repo
        </button>
      </header>

      <KPICards nodes={data.nodes} links={data.links} />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
        <GraphView
          nodes={data.nodes}
          links={data.links}
          onSelectNode={setSelected}
          selectedId={selected?.id ?? null}
        />

        <div className="grid min-h-0 grid-rows-[1fr] gap-4 md:grid-rows-[1fr_1fr]">
          {selected ? (
            <SidePanel node={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="hidden items-center justify-center rounded-lg border border-dashed border-base-border p-6 text-center font-mono text-xs text-ink-700 md:flex">
              Select a node to inspect its file profile.
            </div>
          )}
          <InsightsFeed insights={insights} />
        </div>
      </div>
    </motion.div>
  );
}
