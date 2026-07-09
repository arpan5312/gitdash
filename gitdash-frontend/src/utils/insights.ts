import type { Insight, RepoLink, RepoNode } from '../types';

function nodeId(n: string | RepoNode): string {
  return typeof n === 'string' ? n : n.id;
}

export function generateInsights(nodes: RepoNode[], links: RepoLink[]): Insight[] {
  const insights: Insight[] = [];
  if (nodes.length === 0) return insights;

  const byRisk = [...nodes].sort((a, b) => b.structural_risk_index - a.structural_risk_index);
  const topRisk = byRisk[0];
  if (topRisk && topRisk.structural_risk_index >= 0.7) {
    insights.push({
      id: `risk-${topRisk.id}`,
      icon: '⚠',
      severity: 'critical',
      text: `${topRisk.id} is a structural hotspot with unusually high churn.`
    });
  }

  const docHotspot = nodes.find((n) => n.behavioral_tag === 'documentation_hotspot');
  if (docHotspot) {
    insights.push({
      id: `doc-${docHotspot.id}`,
      icon: '📚',
      severity: 'info',
      text: `${docHotspot.id} acts as a documentation hotspot.`
    });
  }

  const testChurn = nodes
    .filter((n) => n.behavioral_tag === 'high_test_churn')
    .sort((a, b) => b.structural_risk_index - a.structural_risk_index)[0];
  if (testChurn) {
    insights.push({
      id: `test-${testChurn.id}`,
      icon: '🧪',
      severity: 'warning',
      text: `${testChurn.id} experiences heavy test churn.`
    });
  }

  const stableInfra = nodes.find(
    (n) => n.component_type === 'infrastructure' && n.behavioral_tag === 'stable_environment'
  );
  if (stableInfra) {
    insights.push({
      id: `infra-${stableInfra.id}`,
      icon: '🏗',
      severity: 'info',
      text: `${stableInfra.id} behaves as stable infrastructure.`
    });
  }

  const bottleneck = nodes.find((n) => n.behavioral_tag === 'shared_bottleneck');
  if (bottleneck) {
    insights.push({
      id: `bottleneck-${bottleneck.id}`,
      icon: '🧩',
      severity: 'warning',
      text: `${bottleneck.id} is a shared bottleneck touched across many workflows.`
    });
  }

  const topLink = [...links].sort((a, b) => b.weight - a.weight)[0];
  if (topLink && topLink.weight >= 10) {
    insights.push({
      id: `coupling-${nodeId(topLink.source)}-${nodeId(topLink.target)}`,
      icon: '🔗',
      severity: 'warning',
      text: `${nodeId(topLink.source)} and ${nodeId(topLink.target)} exhibit strong historical coupling.`
    });
  }

  const singleOwner = nodes
    .filter((n) => n.bus_factor === 1 && n.commit_frequency > 5)
    .sort((a, b) => b.commit_frequency - a.commit_frequency)[0];
  if (singleOwner) {
    insights.push({
      id: `owner-${singleOwner.id}`,
      icon: '👤',
      severity: 'critical',
      text: `${singleOwner.id} has a bus factor of 1 — only ${singleOwner.knowledge_owner} maintains it.`
    });
  }

  return insights;
}
