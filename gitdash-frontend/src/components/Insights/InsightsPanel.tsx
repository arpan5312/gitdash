import { motion } from 'framer-motion';
import type { RepositorySummaryResponse } from '../../types';
import { buildInsights } from '../../utils/insights';

interface InsightsPanelProps {
  summary: RepositorySummaryResponse | null;
}

export default function InsightsPanel({ summary }: InsightsPanelProps) {
  const insights = summary ? buildInsights(summary) : [];

  return (
    <div className="flex h-full flex-col rounded-xl border border-base-600 bg-base-800/40">
      <div className="border-b border-base-600 px-4 py-3">
        <h2 className="text-sm font-medium text-ink-100">Insights</h2>
        <p className="text-xs text-ink-700">Derived directly from repository behavior</p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {!summary &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-base-700/60" />
          ))}

        {summary && insights.length === 0 && (
          <p className="p-3 text-xs text-ink-700">No notable behavioral patterns were detected.</p>
        )}

        {insights.map((insight, i) => (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.03 }}
            className="rounded-lg border border-base-600 bg-base-800/60 p-3 text-sm text-ink-300"
          >
            <span className="mr-2">{insight.icon}</span>
            {insight.text}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
