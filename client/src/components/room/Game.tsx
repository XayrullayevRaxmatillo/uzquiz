import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Clock, Pause, Play, Users, X, XCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Avatar } from '../ui/Avatar'
import { useI18n } from '../../i18n'
import { useToast } from '../../context/ToastContext'
import { errorKey } from '../../lib/errors'
import { useCountdown } from '../../hooks/useCountdown'
import type { Conn, Participant, QuestionView, RevealView, RoomState } from '../../hooks/useRoom'

// Quizqi-style answer tiles: red ◆, blue ●, yellow ■, green ▲
const TILES = [
  { color: 'var(--ans-red)', icon: '◆', text: '#fff' },
  { color: 'var(--ans-blue)', icon: '●', text: '#fff' },
  { color: 'var(--ans-yellow)', icon: '■', text: '#1a1300' },
  { color: 'var(--ans-green)', icon: '▲', text: '#03210f' },
]

interface Props {
  state: RoomState
  phase: RoomState['phase']
  question: QuestionView | null
  reveal: RevealView | null
  answerCount: { answered: number; total: number }
  myChoice: number | null
  startingMs: number | null
  clockOffset: number
  conn: Conn
  answer: (c: number) => Promise<unknown>
  send: (event: string, payload?: unknown) => Promise<{ ok: boolean; code?: string }>
}

export function Game({ state, phase, question, reveal, answerCount, myChoice, startingMs, clockOffset, conn, answer, send }: Props) {
  const { t } = useI18n()
  const { push } = useToast()
  const reduce = useReducedMotion()
  const isHost = state.me.isHost
  const msLeft = useCountdown(question?.endsAt ?? null, clockOffset, phase === 'question')
  const totalMs = question ? Math.max(1000, question.endsAt - (question.serverNow || 0)) : 1000
  const secs = Math.ceil(msLeft / 1000)
  const names = new Map(state.participants.map((p) => [p.id, p]))
  const me = reveal?.players[state.me.id]

  const call = async (event: string) => {
    const r = await send(event)
    if (!r.ok) push('error', t(errorKey(r.code ?? '')))
  }

  // Keyboard shortcuts 1–4 for answering.
  const answerRef = useRef(answer)
  answerRef.current = answer
  useEffect(() => {
    if (phase !== 'question' || myChoice !== null) return
    const on = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= (question?.options.length ?? 0) && !(e.target instanceof HTMLInputElement)) void answerRef.current(n - 1)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [phase, myChoice, question?.options.length])

  const progress = question ? ((question.index + (phase === 'reveal' ? 1 : 0)) / question.total) * 100 : 0

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-4 sm:px-6">
      {/* top progress line (as in the reference) */}
      <div className="mb-4 h-1 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <motion.div className="h-full bg-gradient-to-r from-brand to-pink" animate={{ width: `${progress}%` }} transition={{ duration: reduce ? 0 : 0.5 }} />
      </div>

      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-surface2 font-display text-xl font-bold tabular-nums" aria-live="off">{state.participants.find((p) => p.id === state.me.id)?.score ?? 0}</span>
          <div className="text-xs leading-tight text-muted">
            <p>{t('room.question')}</p>
            <p className="font-semibold text-fg">{question ? t('room.ofTotal', { n: question.index + 1, total: question.total }) : '—'}</p>
          </div>
        </div>
        {conn !== 'online' && <span role="status" className="rounded-full bg-warn/15 px-3 py-1 text-xs font-semibold text-warn">{conn === 'connecting' ? t('room.reconnecting') : t('room.disconnected')}</span>}
        {isHost && (
          <div className="flex gap-2">
            {phase === 'paused' ? (
              <Button size="sm" variant="secondary" onClick={() => call('host:resume')}><Play className="size-3.5" aria-hidden />{t('room.resume')}</Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => call('host:pause')}><Pause className="size-3.5" aria-hidden />{t('room.pause')}</Button>
            )}
            <Button size="sm" variant="danger" onClick={() => confirm(t('room.endConfirm')) && call('host:end')}><XCircle className="size-3.5" aria-hidden />{t('room.end')}</Button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {phase === 'countdown' && (
          <motion.div key="cd" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="grid min-h-[50vh] place-items-center text-center" role="status">
            <div>
              <p className="gradient-text font-display text-6xl font-bold">{t('room.starting')}</p>
              {startingMs ? <p className="mt-3 text-muted">{state.quiz.title}</p> : null}
            </div>
          </motion.div>
        )}

        {(phase === 'question' || phase === 'paused' || phase === 'reveal') && question && (
          <motion.div key={`q${question.index}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <h2 className="mx-auto max-w-3xl text-center font-display text-2xl font-bold sm:text-3xl">{question.text}</h2>

            <div className="mt-4 flex items-center justify-center gap-3 text-sm text-muted" aria-live="polite">
              {phase === 'paused' ? (
                <span className="rounded-full bg-warn/15 px-3 py-1.5 font-semibold text-warn">{t('room.paused')}</span>
              ) : phase === 'question' ? (
                <>
                  <span className="rounded-full bg-surface2 px-3 py-1.5">{myChoice !== null ? t('room.locked') : t('room.waitingAnswers')}</span>
                  <span className="flex items-center gap-1.5 rounded-full bg-surface2 px-3 py-1.5"><Users className="size-3.5" aria-hidden />{answerCount.answered}/{answerCount.total || state.participants.filter((p) => p.connected).length}</span>
                  <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold tabular-nums ${secs <= 5 ? 'bg-bad/15 text-bad' : 'bg-surface2'}`}><Clock className="size-3.5" aria-hidden />{t('room.timeLeft', { s: secs })}</span>
                </>
              ) : (
                <span className={`rounded-full px-3 py-1.5 font-semibold ${me?.correct ? 'bg-ok/15 text-ok' : me?.answered ? 'bg-bad/15 text-bad' : 'bg-surface2'}`}>
                  {me?.correct ? `${t('room.correct')} ${t('room.points', { n: me.points })}` : me?.answered ? t('room.wrong') : t('room.noAnswer')}
                </span>
              )}
            </div>

            {phase === 'question' && (
              <div className="mx-auto mt-4 h-1.5 max-w-md overflow-hidden rounded-full bg-surface2" aria-hidden>
                <div className="h-full rounded-full bg-gradient-to-r from-cyan to-brand transition-[width] duration-100 ease-linear" style={{ width: `${Math.min(100, (msLeft / totalMs) * 100)}%` }} />
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2" role="group" aria-label={question.text}>
              {question.options.map((opt, i) => {
                const tile = TILES[i % 4]
                const isCorrect = phase === 'reveal' && reveal?.correctIndex === i
                const isWrongPick = phase === 'reveal' && myChoice === i && reveal?.correctIndex !== i
                const dim = phase === 'reveal' && !isCorrect
                const picked = myChoice === i
                const locked = myChoice !== null || phase !== 'question'
                return (
                  <motion.button
                    key={i}
                    type="button"
                    disabled={locked}
                    onClick={() => void answer(i)}
                    whileHover={locked || reduce ? undefined : { y: -3, scale: 1.01 }}
                    whileTap={locked || reduce ? undefined : { scale: 0.97 }}
                    animate={isWrongPick && !reduce ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                    transition={{ duration: 0.35 }}
                    aria-pressed={picked}
                    className={`relative flex min-h-[4.5rem] items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-semibold shadow-lg outline-none transition-[opacity,box-shadow,filter] focus-visible:ring-4 focus-visible:ring-white/60 sm:min-h-[5.5rem] ${picked && phase === 'question' ? 'ring-4 ring-white/70' : ''} ${dim ? 'opacity-35 saturate-50' : ''} ${isCorrect ? 'ring-4 ring-white' : ''}`}
                    style={{ background: tile.color, color: tile.text }}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/25 text-sm" aria-hidden>{tile.icon}</span>
                    <span className="flex-1">{opt}</span>
                    {phase === 'reveal' && reveal && <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-sm tabular-nums">{reveal.distribution[i] ?? 0}</span>}
                    {isCorrect && <Check className="size-6" aria-label={t('room.correct')} />}
                    {isWrongPick && <X className="size-6" aria-label={t('room.wrong')} />}
                    <kbd className="absolute right-3 top-2 hidden text-[10px] opacity-60 sm:block" aria-hidden>{i + 1}</kbd>
                  </motion.button>
                )
              })}
            </div>

            {phase === 'reveal' && reveal && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-6 grid gap-4 md:grid-cols-[1fr_320px]">
                <div className="glass p-5">
                  {reveal.explanation ? (<><p className="text-[10px] font-bold tracking-widest text-faint">{t('room.explanation').toUpperCase()}</p><p className="mt-1.5">{reveal.explanation}</p></>) : <p className="text-sm text-muted">{reveal.isLast ? t('room.results') : t('room.question') + ' →'}</p>}
                </div>
                <LiveBoard rows={reveal.leaderboard} names={names} meId={state.me.id} deltas={reveal.players} />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function LiveBoard({ rows, names, meId, deltas }: { rows: RevealView['leaderboard']; names: Map<string, Participant>; meId: string; deltas: RevealView['players'] }) {
  const { t, formatNumber } = useI18n()
  return (
    <div className="glass p-4">
      <h3 className="mb-3 text-[10px] font-bold tracking-widest text-faint">{t('room.leaderboard').toUpperCase()}</h3>
      <ol className="space-y-2">
        {rows.slice(0, 5).map((r, i) => (
          <motion.li layout key={r.id} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm ${i === 0 ? 'bg-gradient-to-r from-brand/70 to-brand2/40' : 'bg-surface2'} ${r.id === meId ? 'ring-1 ring-cyan/60' : ''}`}>
            <span className="w-4 text-xs font-bold text-muted">{r.rank}</span>
            <Avatar name={names.get(r.id)?.name ?? '?'} size="sm" />
            <span className="flex-1 truncate font-medium">{names.get(r.id)?.name ?? '—'}</span>
            {deltas[r.id]?.points ? <span className="text-xs font-semibold text-ok">{t('room.points', { n: deltas[r.id].points })}</span> : null}
            <span className="tabular-nums text-xs text-muted">{formatNumber(r.score)}</span>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}
