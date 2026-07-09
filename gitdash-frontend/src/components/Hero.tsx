import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';

interface HeroProps {
  onAnalyze: (url: string) => void;
  error?: string | null;
}

const EXAMPLE = 'https://github.com/arzzen/git-quick-stats';

export default function Hero({ onAnalyze, error }: HeroProps) {
  const [url, setUrl] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) onAnalyze(trimmed);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center text-center"
      >
        <div className="mb-6 flex items-center gap-2 rounded-full border border-base-border bg-base-800/60 px-3 py-1 font-mono text-[11px] tracking-widest text-ink-500">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-blink" />
          BEHAVIORAL ANALYSIS ENGINE
        </div>

        <h1 className="font-display text-6xl font-semibold tracking-tight text-ink-100 md:text-8xl">
          GitDash
        </h1>

        <p className="mt-5 max-w-lg font-mono text-sm text-ink-500 md:text-base">
          Repository intelligence through behavioral analysis.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-12 flex w-full max-w-xl flex-col gap-3 sm:flex-row"
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="text"
            inputMode="url"
            placeholder={EXAMPLE}
            className="flex-1 rounded-md border border-base-border bg-base-800/80 px-4 py-3 font-mono text-sm text-ink-100 placeholder:text-ink-700 outline-none transition focus:border-accent/60 focus:ring-1 focus:ring-accent/40"
          />
          <button
            type="submit"
            className="whitespace-nowrap rounded-md bg-accent px-6 py-3 font-display text-sm font-semibold text-base-950 transition hover:bg-accent-glow active:scale-[0.98]"
          >
            Analyze Repository
          </button>
        </form>

        {error && (
          <p className="mt-4 font-mono text-xs text-risk-critical">{error}</p>
        )}

        <p className="mt-6 font-mono text-[11px] text-ink-700">
          Paste any public GitHub URL — ownership, coupling, and risk surface in seconds.
        </p>
      </motion.div>
    </div>
  );
}
