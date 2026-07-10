import type { ComponentType, BehavioralTag } from '../types';

// Deep, desaturated hues per component type — legible on a near-black canvas
// without tipping into rainbow/crypto territory.
export const COMPONENT_COLOR: Record<ComponentType, string> = {
  source_code: '#C74B44', // deep red
  documentation: '#4C7FD6', // blue
  testing: '#4FAE7E', // green
  infrastructure: '#D98A3D', // orange
  pipeline: '#8E6FD9' // purple
};

export const COMPONENT_LABEL: Record<ComponentType, string> = {
  source_code: 'Source',
  documentation: 'Docs',
  testing: 'Tests',
  infrastructure: 'Infra',
  pipeline: 'Pipeline'
};

export const TAG_LABEL: Record<BehavioralTag, string> = {
  documentation_hotspot: 'Documentation hotspot',
  stable_docs: 'Stable docs',
  refactor_decay_hotspot: 'Refactor decay hotspot',
  shared_bottleneck: 'Shared bottleneck',
  active_feature_growth: 'Active feature growth',
  high_test_churn: 'High test churn',
  stable_test_suite: 'Stable test suite',
  stable_environment: 'Stable environment',
  volatile_config_bottleneck: 'Volatile config bottleneck',
  stable_component: 'Stable component'
};

export const TAG_ICON: Record<BehavioralTag, string> = {
  documentation_hotspot: '📚',
  stable_docs: '📗',
  refactor_decay_hotspot: '⚠',
  shared_bottleneck: '🔗',
  active_feature_growth: '🌱',
  high_test_churn: '🧪',
  stable_test_suite: '✔',
  stable_environment: '🏗',
  volatile_config_bottleneck: '⚙',
  stable_component: '●'
};

export function riskColor(risk: number): string {
  if (risk > 0.8) return '#E5484D';
  if (risk > 0.6) return '#D9564F';
  if (risk > 0.4) return '#D98A3D';
  return '#4FAE7E';
}

export function riskLabel(risk: number): string {
  if (risk > 0.8) return 'Critical';
  if (risk > 0.6) return 'Elevated';
  if (risk > 0.4) return 'Moderate';
  return 'Stable';
}

export function truncatePath(filePath: string, maxLen = 28): string {
  if (filePath.length <= maxLen) return filePath;
  const parts = filePath.split('/');
  const fileName = parts[parts.length - 1];
  if (fileName.length >= maxLen - 4) {
    return `…${fileName.slice(-(maxLen - 1))}`;
  }
  return `…/${fileName}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
