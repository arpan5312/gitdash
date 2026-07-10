import type { CSSProperties } from 'react';
import type { GraphNode } from '../../types';
import { COMPONENT_LABEL, TAG_LABEL, TAG_ICON, riskColor, riskLabel } from '../../utils/visualMap';

interface NodeTooltipProps {
  node: GraphNode;
  x: number;
  y: number;
}

export default function NodeTooltip({ node, x, y }: NodeTooltipProps) {
  return (
    <div
      className="pointer-events-none absolute z-20 w-72 rounded-lg border border-base-600 bg-base-900/95 p-3 shadow-2xl backdrop-blur-sm"
      style={{ left: x + 16, top: y + 16 }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-mono text-xs text-ink-100">{node.id}</p>
        <span className="shrink-0 rounded-full border border-base-600 px-2 py-0.5 text-[10px] font-mono text-ink-500">
          {COMPONENT_LABEL[node.component_type]}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <Field label="Owner" value={node.knowledge_owner} />
        <Field label="Bus factor" value={String(node.bus_factor)} />
        <Field label="LOC" value={node.lines_of_code.toLocaleString()} />
        <Field label="Commits" value={String(node.commit_frequency)} />
        <Field label="Coupling" value={String(node.historical_coupling_score)} />
        <Field
          label="Risk"
          value={`${Math.round(node.structural_risk_index * 100)}%`}
          valueClassName=""
          valueStyle={{ color: riskColor(node.structural_risk_index) }}
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-base-700 pt-2 text-xs text-ink-300">
        <span>{TAG_ICON[node.behavioral_tag]}</span>
        <span>{TAG_LABEL[node.behavioral_tag]}</span>
        <span className="ml-auto text-[10px] font-mono text-ink-700">{riskLabel(node.structural_risk_index)}</span>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  valueClassName = 'text-ink-100',
  valueStyle
}: {
  label: string;
  value: string;
  valueClassName?: string;
  valueStyle?: CSSProperties;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-ink-700">{label}</p>
      <p className={`font-mono ${valueClassName}`} style={valueStyle}>
        {value}
      </p>
    </div>
  );
}
