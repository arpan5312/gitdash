import { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';
import LoadingSequence from './LoadingSequence';

interface HeroProps {
  onAnalyze: (url: string) => void;
  isAnalyzing: boolean;
  error: string | null;
}

const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/;

export default function Hero({ onAnalyze, isAnalyzing, error }: HeroProps) {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!GITHUB_URL_PATTERN.test(trimmed)) {
      setValidationError('Enter a full GitHub repository URL, e.g. https://github.com/owner/repo');
      return;
    }
    setValidationError(null);
    onAnalyze(trimmed);
  };

  return (
    <motion.div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6"
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      <BackgroundGrid />

      {!isAnalyzing ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-2xl text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-base-600 bg-base-800/60 px-3 py-1 text-xs font-mono uppercase tracking-widest text-ink-500">
            <span className="h-1.5 w-1.5 rounded-full bg-signal-green animate-pulse-slow" />
            Behavioral analysis engine
          </div>

          <h1 className="text-6xl font-semibold tracking-tight text-ink-100 sm:text-7xl">
            GitDash
          </h1>
          <p className="mt-4 text-lg text-ink-500">
            Repository intelligence through behavioral analysis.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-base-600 bg-base-800/80 px-4 py-3 font-mono text-sm text-ink-300 shadow-inner focus-within:border-signal-blue/60 transition-colors">
              <span className="text-ink-700 select-none">$</span>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repository"
                className="w-full bg-transparent outline-none placeholder:text-ink-700"
                autoFocus
              />
            </div>

            {(validationError || error) && (
              <p className="text-left text-sm text-signal-red">{validationError ?? error}</p>
            )}

            <button
              type="submit"
              className="mt-2 rounded-lg bg-ink-100 px-5 py-3 font-medium text-base-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Analyze repository
            </button>
          </form>

          <p className="mt-6 text-xs font-mono text-ink-700">
            Reads commit history, ownership, and structural coupling — nothing is sent anywhere else.
          </p>
        </motion.div>
      ) : (
        <LoadingSequence />
      )}
    </motion.div>
  );
}

function BackgroundGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.06]"
      style={{
        backgroundImage:
          'linear-gradient(to right, #5B8DEF 1px, transparent 1px), linear-gradient(to bottom, #5B8DEF 1px, transparent 1px)',
        backgroundSize: '48px 48px'
      }}
    />
  );
}
