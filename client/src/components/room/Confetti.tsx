import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const COLORS = ['#8b5cf6', '#ec4899', '#22d3ee', '#f5c400', '#12d65c', '#ef2b2d']

/** Lightweight confetti (no canvas). Skipped entirely when the user prefers reduced motion. */
export function Confetti({ count = 60 }: { count?: number }) {
  const reduce = useReducedMotion()
  const pieces = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ id: i, x: Math.random() * 100, delay: Math.random() * 0.6, dur: 2.2 + Math.random() * 1.8, rot: Math.random() * 720 - 360, color: COLORS[i % COLORS.length], size: 6 + Math.random() * 6 })),
    [count],
  )
  if (reduce) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span key={p.id} className="absolute top-0 block rounded-[2px]" style={{ left: `${p.x}%`, width: p.size, height: p.size * 1.6, background: p.color }}
          initial={{ y: -20, opacity: 1, rotate: 0 }} animate={{ y: '105vh', opacity: [1, 1, 0], rotate: p.rot }} transition={{ delay: p.delay, duration: p.dur, ease: 'easeIn' }} />
      ))}
    </div>
  )
}
