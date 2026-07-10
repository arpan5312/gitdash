import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STAGES = [
  'Cloning repository...',
  'Extracting commit history...',
  'Mapping contributor ownership...',
  'Computing coupling graph...',
  'Scoring architectural risk...',
  'Generating AI insights...',
  'Rendering intelligence model...'
];

// Purely cosmetic pacing — advances while the single /api/analyze request
// is in flight. No stage here implies a separate network call.
export default function LoadingSequence() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 1100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
      <div className="relative mb-8 h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-base-600" />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-signal-blue"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      <div className="h-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="font-mono text-sm text-ink-300"
          >
            {STAGES[index]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-6 h-1 w-64 overflow-hidden rounded-full bg-base-700">
        <motion.div
          className="h-full bg-signal-blue"
          initial={{ width: '0%' }}
          animate={{ width: `${((index + 1) / STAGES.length) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
