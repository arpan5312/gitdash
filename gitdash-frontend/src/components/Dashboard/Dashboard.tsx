import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { MetricsResponse, RepositorySummaryResponse, GraphNode } from '../../types';
import { getGraphMetrics, getRepositorySummary, ApiError } from '../../api/client';
import KpiCards from './KpiCards';
import GraphView from '../Graph/GraphView';
import NodeSidePanel from '../Graph/NodeSidePanel';
import InsightsPanel from '../Insights/InsightsPanel';
import AIArchitectureReport from '../AIReport/AIArchitectureReport';

interface DashboardProps {
  repoId: string;
  repoUrl: string;
  onReset: () => void;
}

export default function Dashboard({ repoId, repoUrl, onReset }: DashboardProps) {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [summary, setSummary] = useState<RepositorySummaryResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [metricsRes, summaryRes] = await Promise.all([
          getGraphMetrics(repoId),
          getRepositorySummary(repoId)
        ]);
        if (cancelled) return;
        setMetrics(metricsRes);
        setSummary(summaryRes);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load repository intelligence.');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [repoId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto min-h-screen max-w-[1600px] px-6 py-6 lg:px-10"
    >
      <header className="mb-8 flex items-center justify-between">
        <div>
          <button
            onClick={onReset}
            className="font-mono text-sm text-ink-500 transition-colors hover:text-ink-100"
          >
            ← GitDash
          </button>
          <p className="mt-1 truncate text-xs font-mono text-ink-700">{repoUrl}</p>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-base-600 bg-base-800/60 px-3 py-1 text-xs font-mono text-ink-500 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-green" />
          repo_id · {repoId}
        </div>
      </header>

      {loadError && (
        <div className="mb-6 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-3 text-sm text-signal-red">
          {loadError}
        </div>
      )}

      <KpiCards summary={summary} nodes={metrics?.nodes ?? null} />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <GraphView
          nodes={metrics?.nodes ?? []}
          links={metrics?.links ?? []}
          isLoading={!metrics}
          onSelectNode={setSelectedNode}
          selectedNodeId={selectedNode?.id ?? null}
        />
        <InsightsPanel summary={summary} />
      </div>

      <div className="mt-6">
        <AIArchitectureReport repoId={repoId} />
      </div>

      <NodeSidePanel node={selectedNode} onClose={() => setSelectedNode(null)} />
    </motion.div>
  );
}
