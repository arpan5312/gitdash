import { AnimatePresence, motion } from 'framer-motion';
import type { RepoNode } from '../types';
import { BEHAVIOR_LABEL, COMPONENT_COLOR, COMPONENT_LABEL, riskColor, riskLabel } from '../theme';

interface SidePanelProps {
  node: RepoNode | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-base-border/60 py-2.5">
      <span className="font-mono text-[11px] uppercase tracking-wide text-ink-700">{label}</span>
      <span className="font-mono text-sm text-ink-100">{value}</span>
    </div>
  );
}

export default function SidePanel({ node, onClose }: SidePanelProps) {
  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          initial={{ x: 32, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 32, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="flex h-full w-full flex-col rounded-lg border border-base-border bg-base-800/80 backdrop-blur-md"
        >
          <div className="flex items-start justify-between gap-3 border-b border-base-border p-4">
            <div className="min-w-0">
              <div
                className="font-mono text-[10px] uppercase tracking-widest"
                style={{ color: COMPONENT_COLOR[node.component_type] }}
              >
                {COMPONENT_LABEL[node.component_type]}
              </div>
              <div className="mt-1 truncate font-display text-base font-semibold text-ink-100">
                {node.id}
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-md border border-base-border px-2 py-1 font-mono text-xs text-ink-500 transition hover:border-accent/50 hover:text-accent"
            >
              close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4">
            <div className="my-3 rounded-md border border-base-border bg-base-900/60 p-3">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink-700">
                Behavioral classification
              </div>
              <div className="font-display text-sm font-medium text-ink-100">
                {BEHAVIOR_LABEL[node.behavioral_tag]}
              </div>
            </div>

            <Row label="Primary contributor" value={node.knowledge_owner} />
            <Row
              label="Ownership concentration"
              value={`${Math.round(node.knowledge_concentration * 100)}%`}
            />
            <Row label="Bus factor" value={node.bus_factor} />
            <Row label="Commit frequency" value={node.commit_frequency} />
            <Row label="Lines of code" value={node.lines_of_code.toLocaleString()} />
            <Row label="Coupling score" value={node.historical_coupling_score} />
            <Row label="Authors" value={node.author_count} />

            <div className="flex items-center justify-between py-3">
              <span className="font-mono text-[11px] uppercase tracking-wide text-ink-700">
                Structural risk
              </span>
              <span
                className="rounded px-2 py-0.5 font-mono text-xs font-semibold"
                style={{
                  color: riskColor(node.structural_risk_index),
                  backgroundColor: `${riskColor(node.structural_risk_index)}1A`
                }}
              >
                {node.structural_risk_index.toFixed(2)} · {riskLabel(node.structural_risk_index)}
              </span>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
