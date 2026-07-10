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

export interface GraphNode {
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
  // fields injected at runtime by the force simulation (react-force-graph-2d)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
}

export interface AnalyzeResponse {
  status: 'success';
  repo_id: string;
}

export interface MetricsResponse {
  status: 'success';
  repo_id: string;
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Hotspot {
  file: string;
  risk: number;
  tag: BehavioralTag;
}

export interface OwnershipRisk {
  file: string;
  owner: string;
}

export interface Bottleneck {
  file: string;
  coupling: number;
}

export interface VolatileConfig {
  file: string;
}

export interface StrongRelationship extends GraphLink {}

export interface RepositorySummaryResponse {
  status: 'success';
  repo_id: string;
  repository_health: number;
  hotspots: Hotspot[];
  ownership_risks: OwnershipRisk[];
  bottlenecks: Bottleneck[];
  volatile_configs: VolatileConfig[];
  strongest_relationships: StrongRelationship[];
}

export interface AiSummaryResponse {
  status: 'success';
  analysis: string;
}

export interface ApiErrorBody {
  error: string;
  details?: string;
}

export type LoadingStage =
  | 'idle'
  | 'cloning'
  | 'history'
  | 'ownership'
  | 'coupling'
  | 'risk'
  | 'ai'
  | 'rendering'
  | 'done';
