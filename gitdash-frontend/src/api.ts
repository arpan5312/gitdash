import type { AnalyzeResponse, MetricsResponse } from './types';

const API_BASE = 'http://localhost:5000';

export class ApiError extends Error {}

export async function analyzeRepository(url: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data?.error ?? 'Failed to analyze repository.');
  }
  return data as AnalyzeResponse;
}

export async function fetchMetrics(repoId: string): Promise<MetricsResponse> {
  const res = await fetch(`${API_BASE}/api/metrics?id=${encodeURIComponent(repoId)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data?.error ?? 'Failed to load repository metrics.');
  }
  return data as MetricsResponse;
}
