import { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import Hero from './components/Hero/Hero';
import Dashboard from './components/Dashboard/Dashboard';
import { analyzeRepository, ApiError } from './api/client';

type Screen = 'hero' | 'dashboard';

export default function App() {
  const [screen, setScreen] = useState<Screen>('hero');
  const [repoId, setRepoId] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = useCallback(async (url: string) => {
    setError(null);
    setIsAnalyzing(true);
    setRepoUrl(url);
    try {
      const result = await analyzeRepository(url);
      setRepoId(result.repo_id);
      setScreen('dashboard');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to reach the analysis engine.';
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setScreen('hero');
    setRepoId(null);
    setRepoUrl('');
    setError(null);
  }, []);

  return (
    <div className="min-h-screen w-full">
      <AnimatePresence mode="wait">
        {screen === 'hero' && (
          <Hero
            key="hero"
            onAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            error={error}
          />
        )}
        {screen === 'dashboard' && repoId && (
          <Dashboard key="dashboard" repoId={repoId} repoUrl={repoUrl} onReset={handleReset} />
        )}
      </AnimatePresence>
    </div>
  );
}
