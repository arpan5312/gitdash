import { motion } from 'framer-motion';
import type { Insight } from '../types';

interface InsightsFeedProps {
  insights: Insight[];
}

const SEVERITY_BORDER: Record<Insight['severity'], string> = {
  info: 'border-l-node-docs',
  warning: 'border-l-risk-mid',
  critical: 'border-l-risk-critical'
};

export default function InsightsFeed({ insights }: InsightsFeedProps) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-base-border bg-base-800/60">
      <div className="border-b border-base-border px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-ink-700">
        Insights engine
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {insights.length === 0 && (
          <p className="p-2 font-mono text-xs text-ink-700">No notable patterns detected.</p>
        )}
        {insights.map((insight, i) => (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            className={`rounded-md border-l-2 bg-base-900/60 px-3 py-2.5 text-sm text-ink-300 ${SEVERITY_BORDER[insight.severity]}`}
          >
            <span className="mr-2">{insight.icon}</span>
            {insight.text}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
