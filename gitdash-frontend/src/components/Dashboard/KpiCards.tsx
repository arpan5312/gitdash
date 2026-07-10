import { motion } from 'framer-motion';
import type { GraphNode, RepositorySummaryResponse } from '../../types';
import { truncatePath } from '../../utils/visualMap';

interface KpiCardsProps {
  summary: RepositorySummaryResponse | null;
  nodes: GraphNode[] | null;
}

interface KpiDatum {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}

function computeKpis(summary: RepositorySummaryResponse | null, nodes: GraphNode[] | null): KpiDatum[] {
  const highestRisk = nodes ? [...nodes].sort((a, b) => b.structural_risk_index - a.structural_risk_index)[0] : null;
  const mostCoupled = summary?.bottlenecks?.[0] ?? null;
  const highestOwnership = nodes
    ? [...nodes].sort((a, b) => b.knowledge_concentration - a.knowledge_concentration)[0]
    : null;
  const largestDocHotspot = summary?.hotspots?.find((h) => h.tag === 'documentation_hotspot') ?? null;

  return [
    {
      label: 'Highest-risk component',
      value: highestRisk ? truncatePath(highestRisk.id, 22) : '—',
      sub: highestRisk ? `${Math.round(highestRisk.structural_risk_index * 100)}% risk` : undefined,
      accent: 'text-signal-red'
    },
    {
      label: 'Most coupled subsystem',
      value: mostCoupled ? truncatePath(mostCoupled.file, 22) : '—',
      sub: mostCoupled ? `${mostCoupled.coupling} co-changes` : undefined,
      accent: 'text-signal-blue'
    },
    {
      label: 'Highest ownership concentration',
      value: highestOwnership ? truncatePath(highestOwnership.id, 22) : '—',
      sub: highestOwnership ? highestOwnership.knowledge_owner : undefined,
      accent: 'text-signal-purple'
    },
    {
      label: 'Largest documentation hotspot',
      value: largestDocHotspot ? truncatePath(largestDocHotspot.file, 22) : 'None detected',
      sub: largestDocHotspot ? `${Math.round(largestDocHotspot.risk * 100)}% churn risk` : undefined,
      accent: 'text-signal-orange'
    },
    {
      label: 'Repository health',
      value: summary ? `${summary.repository_health}` : '—',
      sub: summary ? healthLabel(summary.repository_health) : undefined,
      accent: 'text-signal-green'
    }
  ];
}

function healthLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Watch';
  if (score >= 40) return 'At risk';
  return 'Critical';
}

export default function KpiCards({ summary, nodes }: KpiCardsProps) {
  const kpis = computeKpis(summary, nodes);
  const isLoading = !summary || !nodes;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06 }}
          className="rounded-xl border border-base-600 bg-base-800/60 p-4"
        >
          <p className="text-[11px] font-mono uppercase tracking-wide text-ink-700">{kpi.label}</p>
          {isLoading ? (
            <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-base-600" />
          ) : (
            <>
              <p className={`mt-2 truncate font-mono text-lg font-medium ${kpi.accent}`}>{kpi.value}</p>
              {kpi.sub && <p className="mt-0.5 truncate text-xs text-ink-500">{kpi.sub}</p>}
            </>
          )}
        </motion.div>
      ))}
    </div>
  );
}
