import { AnimatePresence, motion } from 'framer-motion';
import type { GraphNode } from '../../types';
import { COMPONENT_LABEL, TAG_LABEL, TAG_ICON, riskColor, riskLabel } from '../../utils/visualMap';

interface NodeSidePanelProps {
  node: GraphNode | null;
  onClose: () => void;
}

export default function NodeSidePanel({ node, onClose }: NodeSidePanelProps) {
  return (
    <AnimatePresence>
      {node && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-30 bg-black/40"
          />
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-40 h-full w-full max-w-md overflow-y-auto border-l border-base-600 bg-base-900 p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="break-words font-mono text-sm text-ink-100">{node.id}</p>
                <span className="mt-2 inline-block rounded-full border border-base-600 px-2.5 py-0.5 text-[11px] font-mono text-ink-500">
                  {COMPONENT_LABEL[node.component_type]}
                </span>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-md border border-base-600 px-2 py-1 text-xs text-ink-500 transition-colors hover:text-ink-100"
              >
                Close
              </button>
            </div>

            <div className="mt-6 rounded-lg border border-base-600 bg-base-800/60 p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-xs uppercase tracking-wide text-ink-700">Structural risk</p>
                <p className="font-mono text-2xl font-semibold" style={{ color: riskColor(node.structural_risk_index) }}>
                  {Math.round(node.structural_risk_index * 100)}%
                </p>
              </div>
              <p className="mt-1 text-xs text-ink-500">{riskLabel(node.structural_risk_index)}</p>
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-lg border border-base-600 bg-base-800/40 p-3 text-sm text-ink-300">
              <span>{TAG_ICON[node.behavioral_tag]}</span>
              <span>{TAG_LABEL[node.behavioral_tag]}</span>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4">
              <Detail label="Knowledge owner" value={node.knowledge_owner} />
              <Detail label="Bus factor" value={String(node.bus_factor)} />
              <Detail label="Lines of code" value={node.lines_of_code.toLocaleString()} />
              <Detail label="Commit frequency" value={String(node.commit_frequency)} />
              <Detail label="Author count" value={String(node.author_count)} />
              <Detail label="Coupling score" value={String(node.historical_coupling_score)} />
              <Detail
                label="Ownership concentration"
                value={`${Math.round(node.knowledge_concentration * 100)}%`}
              />
            </dl>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-700">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-ink-100">{value}</dd>
    </div>
  );
}
