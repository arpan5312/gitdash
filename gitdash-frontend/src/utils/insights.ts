import type { RepositorySummaryResponse } from '../types';

export interface Insight {
  id: string;
  icon: string;
  text: string;
}

/**
 * Derives readable insight strings strictly from fields already present in the
 * /api/repository-summary response. No values are invented.
 */
export function buildInsights(summary: RepositorySummaryResponse): Insight[] {
  const insights: Insight[] = [];

  summary.hotspots.forEach((h) => {
    insights.push({
      id: `hotspot-${h.file}`,
      icon: '⚠',
      text: `${h.file} is a structural hotspot (risk ${Math.round(h.risk * 100)}%).`
    });
  });

  summary.ownership_risks.forEach((o) => {
    insights.push({
      id: `owner-${o.file}`,
      icon: '👤',
      text: `${o.file} is owned almost entirely by ${o.owner} — a single point of failure.`
    });
  });

  summary.volatile_configs.forEach((v) => {
    insights.push({
      id: `config-${v.file}`,
      icon: '🏗',
      text: `${v.file} behaves as core infrastructure.`
    });
  });

  summary.strongest_relationships.slice(0, 5).forEach((r) => {
    insights.push({
      id: `rel-${r.source}-${r.target}`,
      icon: '🔗',
      text: `${r.source} and ${r.target} exhibit strong coupling (weight ${r.weight}).`
    });
  });

  summary.bottlenecks.slice(0, 3).forEach((b) => {
    insights.push({
      id: `bottleneck-${b.file}`,
      icon: '🧭',
      text: `${b.file} is a coupling bottleneck, entangled with ${b.coupling} other files.`
    });
  });

  return insights;
}
