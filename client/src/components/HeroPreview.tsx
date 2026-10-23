import { motion, useReducedMotion } from 'framer-motion'
import { Clock, Users, Zap, Trophy } from 'lucide-react'
import { Avatar } from './ui/Avatar'
import { useI18n } from '../i18n'

/** Static DEMO preview (clearly labelled) — no real user data. */
const DEMO_ANSWERS = [
  { label: 'Paris', color: 'var(--ans-red)', icon: '◆' },
  { label: 'Berlin', color: 'var(--ans-blue)', icon: '●' },
  { label: 'London', color: 'var(--ans-yellow)', icon: '■' },
  { label: 'Washington, DC', color: 'var(--ans-green)', icon: '▲' },
]
const DEMO_BOARD = [
  { name: 'Aziza', score: 12450 },
  { name: 'Jasur', score: 11980 },
  { name: 'Madina', score: 10760 },
  { name: 'Bobur', score: 9420 },
]

export function HeroPreview() {
  const { t, formatNumber } = useI18n()
  const reduce = useReducedMotion()
  const float = (d: number) =>
    reduce ? {} : { animate: { y: [0, -8, 0] }, transition: { duration: 6 + d, repeat: Infinity, ease: 'easeInOut' as const } }

  return (
    <div className="relative mx-auto w-full max-w-xl" aria-label={t('hero.previewHint')}>
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(closest-side,var(--glow),transparent)] blur-2xl" aria-hidden />

      <motion.div {...float(0)} className="glass p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between text-xs text-muted">
          <span className="rounded-full bg-surface2 px-2.5 py-1 font-semibold text-brand2">{t('hero.previewHint')}</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Users className="size-3.5" aria-hidden /> 2</span>
            <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> 25s</span>
          </span>
        </div>
        <h3 className="text-center font-display text-lg font-semibold sm:text-xl">{t('hero.previewQuestion')}</h3>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {DEMO_ANSWERS.map((a, i) => (
            <motion.div
              key={a.label}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.08 }}
              className="flex h-14 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-white shadow-lg sm:h-16"
              style={{ background: a.color, color: a.color === 'var(--ans-yellow)' ? '#1a1300' : '#fff' }}
            >
              <span className="grid size-7 place-items-center rounded-md bg-white/25 text-xs" aria-hidden>{a.icon}</span>
              <span className="truncate">{a.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div {...float(1.5)} className="glass absolute -bottom-10 -right-2 hidden w-64 p-4 sm:block lg:-right-8">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Trophy className="size-4 text-warn" aria-hidden /> {t('hero.liveBoard')}
        </div>
        <ol className="space-y-2">
          {DEMO_BOARD.map((p, i) => (
            <li key={p.name} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm ${i === 0 ? 'bg-gradient-to-r from-brand/70 to-brand2/50' : 'bg-surface2'}`}>
              <span className="w-4 text-xs font-bold text-muted">{i + 1}</span>
              <Avatar name={p.name} size="sm" />
              <span className="flex-1 truncate font-medium">{p.name}</span>
              <span className="tabular-nums text-xs text-muted">{formatNumber(p.score)}</span>
            </li>
          ))}
        </ol>
      </motion.div>

      <motion.div {...float(0.8)} className="absolute -left-4 -top-5 hidden size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-pink text-white shadow-glow sm:grid" aria-hidden>
        <Zap className="size-7" />
      </motion.div>
    </div>
  )
}
