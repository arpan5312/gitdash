import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const STEPS = [
  'Cloning repository...',
  'Extracting commit history...',
  'Mapping contributor ownership...',
  'Computing coupling graph...',
  'Scoring architectural risk...',
  'Rendering intelligence model...'
];

interface LoadingPipelineProps {
  /** resolves once the caller's real work (analyze + metrics fetch) is done */
  done: boolean;
}

export default function LoadingPipeline({ done }: LoadingPipelineProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (done) {
      setActiveIndex(STEPS.length);
      return;
    }
    // step through the pipeline on a steady cadence while the real request
    // is in flight; if the request finishes first we still let the last
    // step or two breathe so it never feels instantaneous or fake
    if (activeIndex >= STEPS.length - 1) return;
    const t = setTimeout(() => setActiveIndex((i) => i + 1), 900);
    return () => clearTimeout(t);
  }, [activeIndex, done]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2 font-mono text-[11px] tracking-widest text-ink-500">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-blink" />
          ANALYZING
        </div>

        <ul className="space-y-4">
          {STEPS.map((step, i) => {
            const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
            return (
              <li key={step} className="flex items-center gap-3 font-mono text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <AnimatePresence mode="wait" initial={false}>
                    {state === 'done' ? (
                      <motion.span
                        key="done"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-accent"
                      >
                        ✓
                      </motion.span>
                    ) : state === 'active' ? (
                      <motion.span
                        key="active"
                        className="h-2 w-2 rounded-full bg-accent"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ repeat: Infinity, duration: 1.1 }}
                      />
                    ) : (
                      <span key="pending" className="h-1.5 w-1.5 rounded-full bg-ink-700" />
                    )}
                  </AnimatePresence>
                </span>
                <span
                  className={
                    state === 'pending'
                      ? 'text-ink-700'
                      : state === 'active'
                      ? 'text-ink-100'
                      : 'text-ink-500'
                  }
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
