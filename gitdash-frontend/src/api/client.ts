import type {
  AnalyzeResponse,
  MetricsResponse,
  RepositorySummaryResponse,
  AiSummaryResponse,
  ApiErrorBody
} from '../types';

const BASE_URL = 'http://localhost:5000';

class ApiError extends Error {
  details?: string;
  constructor(message: string, details?: string) {
    super(message);
    this.name = 'ApiError';
    this.details = details;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = await res.json();
    } catch {
      // response had no JSON body
    }
    throw new ApiError(body?.error ?? `Request failed with status ${res.status}`, body?.details);
  }
  return res.json() as Promise<T>;
}

export async function analyzeRepository(url: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  return handle<AnalyzeResponse>(res);
}

export async function getGraphMetrics(repoId: string): Promise<MetricsResponse> {
  const res = await fetch(`${BASE_URL}/api/metrics?id=${encodeURIComponent(repoId)}`);
  return handle<MetricsResponse>(res);
}

export async function getRepositorySummary(repoId: string): Promise<RepositorySummaryResponse> {
  const res = await fetch(`${BASE_URL}/api/repository-summary?id=${encodeURIComponent(repoId)}`);
  return handle<RepositorySummaryResponse>(res);
}

export async function getAiSummary(repoId: string): Promise<AiSummaryResponse> {
  const res = await fetch(`${BASE_URL}/api/ai-summary?id=${encodeURIComponent(repoId)}`);
  return handle<AiSummaryResponse>(res);
}

export { ApiError };
