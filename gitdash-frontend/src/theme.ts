import type { BehavioralTag, ComponentType } from './types';

export const COMPONENT_COLOR: Record<ComponentType, string> = {
  source_code: '#DC4545',
  documentation: '#4C8DFF',
  testing: '#3ECF8E',
  infrastructure: '#F2994A',
  pipeline: '#9B6BFF'
};

export const COMPONENT_LABEL: Record<ComponentType, string> = {
  source_code: 'Source code',
  documentation: 'Documentation',
  testing: 'Testing',
  infrastructure: 'Infrastructure',
  pipeline: 'Pipeline'
};

export const BEHAVIOR_LABEL: Record<BehavioralTag, string> = {
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

export function riskColor(risk: number): string {
  if (risk >= 0.85) return '#E0524C';
  if (risk >= 0.7) return '#F2994A';
  if (risk >= 0.45) return '#F2C94A';
  return '#3ECF8E';
}

export function riskLabel(risk: number): string {
  if (risk >= 0.85) return 'Critical';
  if (risk >= 0.7) return 'High';
  if (risk >= 0.45) return 'Moderate';
  return 'Low';
}
