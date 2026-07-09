import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Hero from './components/Hero';
import LoadingPipeline from './components/LoadingPipeline';
import Dashboard from './components/Dashboard';
import HudFrame from './components/HudFrame';
import { analyzeRepository, ApiError, fetchMetrics } from './api';
import type { MetricsResponse } from './types';

type Stage = 'hero' | 'loading' | 'dashboard';

export default function App() {
  const [stage, setStage] = useState<Stage>('hero');
  const [repoUrl, setRepoUrl] = useState('');
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestDone, setRequestDone] = useState(false);

  async function handleAnalyze(url: string) {
    setError(null);
    setRepoUrl(url);
    setRequestDone(false);
    setStage('loading');

    try {
      const { repo_id } = await analyzeRepository(url);
      const metrics = await fetchMetrics(repo_id);
      setData(metrics);
      setRequestDone(true);
      // let the last pipeline step land before revealing the dashboard
      setTimeout(() => setStage('dashboard'), 700);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Something went wrong. Try again.';
      setError(message);
      setStage('hero');
    }
  }

  function handleReset() {
    setStage('hero');
    setData(null);
    setRepoUrl('');
    setRequestDone(false);
  }

  return (
    <div className="min-h-screen">
      <HudFrame />
      <AnimatePresence mode="wait">
        {stage === 'hero' && <Hero key="hero" onAnalyze={handleAnalyze} error={error} />}
        {stage === 'loading' && <LoadingPipeline key="loading" done={requestDone} />}
        {stage === 'dashboard' && data && (
          <Dashboard key="dashboard" data={data} repoUrl={repoUrl} onReset={handleReset} />
        )}
      </AnimatePresence>
    </div>
  );
}
