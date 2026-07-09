import { useEffect, useState } from 'react';

/**
 * Signature ambient device: faint corner brackets, a slow scanline drift,
 * and a ticking monospace coordinate readout. Reused on the hero and the
 * dashboard so the whole product reads as one instrument rather than a
 * stack of separate screens.
 */
export default function HudFrame() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const coord = `${(37.7 + Math.sin(tick / 12) * 0.4).toFixed(4)}° / ${(122.4 + Math.cos(tick / 9) * 0.4).toFixed(4)}°`;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* corner brackets */}
      <div className="absolute left-4 top-4 h-8 w-8 border-l border-t border-ink-700/60" />
      <div className="absolute right-4 top-4 h-8 w-8 border-r border-t border-ink-700/60" />
      <div className="absolute bottom-4 left-4 h-8 w-8 border-b border-l border-ink-700/60" />
      <div className="absolute bottom-4 right-4 h-8 w-8 border-b border-r border-ink-700/60" />

      {/* scanline */}
      <div
        className="absolute inset-x-0 top-0 h-full opacity-[0.03] animate-scan-drift"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, #38D9C4 0px, #38D9C4 1px, transparent 1px, transparent 3px)'
        }}
      />

      {/* readout */}
      <div className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 items-center gap-2 font-mono text-[10px] tracking-widest text-ink-700 md:flex">
        <span className="h-1.5 w-1.5 animate-blink rounded-full bg-accent/70" />
        <span>{coord}</span>
        <span className="text-ink-700/60">·</span>
        <span>GITDASH-ENGINE</span>
      </div>
    </div>
  );
}
