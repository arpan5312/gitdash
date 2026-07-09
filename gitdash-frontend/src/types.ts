export type ComponentType =
  | 'source_code'
  | 'documentation'
  | 'testing'
  | 'infrastructure'
  | 'pipeline';

export type BehavioralTag =
  | 'documentation_hotspot'
  | 'stable_docs'
  | 'refactor_decay_hotspot'
  | 'shared_bottleneck'
  | 'active_feature_growth'
  | 'high_test_churn'
  | 'stable_test_suite'
  | 'stable_environment'
  | 'volatile_config_bottleneck'
  | 'stable_component';

export interface RepoNode {
  id: string;
  component_type: ComponentType;
  lines_of_code: number;
  commit_frequency: number;
  author_count: number;
  historical_coupling_score: number;
  knowledge_owner: string;
  bus_factor: number;
  knowledge_concentration: number;
  behavioral_tag: BehavioralTag;
  structural_risk_index: number;
  // fields injected client-side by the force graph engine
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface RepoLink {
  source: string | RepoNode;
  target: string | RepoNode;
  weight: number;
}

export interface MetricsResponse {
  status: string;
  repo_id: string;
  nodes: RepoNode[];
  links: RepoLink[];
}

export interface AnalyzeResponse {
  status: string;
  repo_id: string;
}

export interface Insight {
  id: string;
  icon: string;
  text: string;
  severity: 'info' | 'warning' | 'critical';
}
