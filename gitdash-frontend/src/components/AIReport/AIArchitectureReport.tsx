import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { getAiSummary, ApiError } from '../../api/client';

interface AIArchitectureReportProps {
  repoId: string;
}

type Status = 'loading' | 'ready' | 'error';

export default function AIArchitectureReport({ repoId }: AIArchitectureReportProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [analysis, setAnalysis] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    getAiSummary(repoId)
      .then((res) => {
        if (cancelled) return;
        setAnalysis(res.analysis);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof ApiError ? err.message : 'The AI architect could not be reached.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [repoId]);

  return (
    <div className="overflow-hidden rounded-xl border border-base-600 bg-gradient-to-b from-base-800/60 to-base-800/20">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-signal-blue animate-pulse-slow" />
          <div>
            <h2 className="text-base font-medium text-ink-100">AI Architecture Review</h2>
            <p className="text-xs text-ink-700">A senior-architect pass over this codebase's behavior</p>
          </div>
        </div>
        <motion.span
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-ink-500"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-base-600 px-5 py-5">
              {status === 'loading' && <ReportSkeleton />}
              {status === 'error' && (
                <p className="text-sm text-signal-red">{errorMessage}</p>
              )}
              {status === 'ready' && (
                <div className="prose prose-invert prose-sm max-w-none font-mono prose-headings:font-sans prose-headings:font-medium prose-headings:text-ink-100 prose-p:text-ink-300 prose-li:text-ink-300 prose-strong:text-ink-100 prose-code:text-signal-blue">
                  <ReactMarkdown>{analysis}</ReactMarkdown>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-3">
      {[100, 92, 96, 60, 88, 72].map((w, i) => (
        <div key={i} className="h-3 animate-pulse rounded bg-base-700/60" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}
