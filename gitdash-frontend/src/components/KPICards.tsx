import type { RepoLink, RepoNode } from '../types';
import { riskColor } from '../theme';

interface KPICardsProps {
  nodes: RepoNode[];
  links: RepoLink[];
}

function nodeId(n: string | RepoNode): string {
  return typeof n === 'string' ? n : n.id;
}

export default function KPICards({ nodes, links }: KPICardsProps) {
  if (nodes.length === 0) return null;

  const highestRisk = [...nodes].sort(
    (a, b) => b.structural_risk_index - a.structural_risk_index
  )[0];

  const linkWeightByFile = new Map<string, number>();
  links.forEach((l) => {
    const s = nodeId(l.source);
    const t = nodeId(l.target);
    linkWeightByFile.set(s, (linkWeightByFile.get(s) ?? 0) + l.weight);
    linkWeightByFile.set(t, (linkWeightByFile.get(t) ?? 0) + l.weight);
  });
  let mostCoupled = nodes[0];
  let mostCoupledWeight = -1;
  nodes.forEach((n) => {
    const w = linkWeightByFile.get(n.id) ?? 0;
    if (w > mostCoupledWeight) {
      mostCoupledWeight = w;
      mostCoupled = n;
    }
  });

  const highestOwnership = [...nodes].sort(
    (a, b) => b.knowledge_concentration - a.knowledge_concentration
  )[0];

  const docs = nodes.filter((n) => n.component_type === 'documentation');
  const largestDoc = docs.length
    ? [...docs].sort((a, b) => b.lines_of_code - a.lines_of_code)[0]
    : null;

  const avgRisk = nodes.reduce((sum, n) => sum + n.structural_risk_index, 0) / nodes.length;
  const healthScore = Math.round((1 - avgRisk) * 100);

  const cards = [
    {
      label: 'Highest-risk component',
      value: highestRisk.id,
      sub: `risk ${highestRisk.structural_risk_index.toFixed(2)}`,
      accent: riskColor(highestRisk.structural_risk_index)
    },
    {
      label: 'Most coupled subsystem',
      value: mostCoupled.id,
      sub: `${mostCoupledWeight} co-changes`,
      accent: '#38D9C4'
    },
    {
      label: 'Highest ownership concentration',
      value: highestOwnership.id,
      sub: `${Math.round(highestOwnership.knowledge_concentration * 100)}% · ${highestOwnership.knowledge_owner}`,
      accent: '#9B6BFF'
    },
    {
      label: 'Largest documentation hotspot',
      value: largestDoc ? largestDoc.id : '—',
      sub: largestDoc ? `${largestDoc.lines_of_code.toLocaleString()} lines` : 'none detected',
      accent: '#4C8DFF'
    },
    {
      label: 'Repository health score',
      value: `${healthScore}`,
      sub: healthScore >= 70 ? 'stable' : healthScore >= 40 ? 'watch' : 'at risk',
      accent: riskColor(1 - healthScore / 100)
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-base-border bg-base-800/60 p-4 backdrop-blur-sm"
        >
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-ink-700">
            {c.label}
          </div>
          <div
            className="truncate font-display text-lg font-semibold"
            style={{ color: c.accent }}
            title={c.value}
          >
            {c.value}
          </div>
          <div className="mt-1 font-mono text-[11px] text-ink-500">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
