import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Award, Crown, Repeat, Share2, Star, Trophy } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Button, LinkButton } from '../ui/Button'
import { Confetti } from './Confetti'
import { useI18n, type TKey } from '../../i18n'
import { useToast } from '../../context/ToastContext'
import { api } from '../../lib/api'
import { errorKey } from '../../lib/errors'
import type { EndedPayload, RoomState } from '../../hooks/useRoom'

/** Counts up from 0 → value (skipped for reduced motion via CSS duration clamp in index.css). */
function CountUp({ value }: { value: number }) {
  const { formatNumber } = useI18n()
  const [v, setV] = useState(0)
  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 900)
      setV(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{formatNumber(v)}</>
}

interface Props {
  state: RoomState
  ended: EndedPayload
  send: (event: string, payload?: unknown) => Promise<{ ok: boolean; code?: string }>
}

export function Results({ state, ended, send }: Props) {
  const { t } = useI18n()
  const { push } = useToast()
  const meId = state.me.id
  const names = new Map(state.participants.map((p) => [p.id, p.name]))
  const mine = ended.ranking.find((r) => r.id === meId)
  const winner = ended.ranking.find((r) => r.id === ended.winnerId)
  const iWon = !!mine && mine.id === ended.winnerId
  const top = ended.ranking.slice(0, 3)
  const [rated, setRated] = useState(0)

  const podium = [top[1], top[0], top[2]] // 2nd · 1st · 3rd like the reference
  const heights = ['h-28', 'h-40', 'h-20']
  const places = [2, 1, 3]

  const share = async () => {
    const url = `${window.location.origin}/s/${state.code}`
    const text = `${state.quiz.title} — ${winner ? `${t('room.winner')}: ${winner.name}` : ''}`
    try {
      if (navigator.share) await navigator.share({ title: 'UZQUIZ', text, url })
      else {
        await navigator.clipboard.writeText(url)
        push('success', t('room.shared'))
      }
    } catch {
      /* user cancelled the share sheet */
    }
  }

  const rate = async (n: number) => {
    setRated(n)
    try {
      await api(`/quizzes/${state.quiz.id}/rate`, { method: 'POST', body: { value: n } })
      push('success', t('quiz.rated'))
    } catch (e) {
      setRated(0)
      push('error', t(errorKey(e)))
    }
  }

  const playAgain = async () => {
    const r = await send('host:rematch')
    if (!r.ok) push('error', t(errorKey(r.code ?? '')))
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {iWon && <Confetti />}
      {ended.me && ended.me.achievements.length > 0 && <Confetti count={30} />}

      <h1 className="text-center font-display text-4xl font-bold">{t('room.results')}</h1>
      {winner && (
        <p className="mt-2 flex items-center justify-center gap-2 text-center text-muted"><Trophy className="size-4 text-warn" aria-hidden />{t('room.winner')}: <strong className="text-fg">{winner.name}</strong></p>
      )}

      {/* Podium */}
      <div className="mx-auto mt-10 flex max-w-lg items-end justify-center gap-3" aria-label={t('room.leaderboard')}>
        {podium.map((p, i) => (
          <div key={places[i]} className="flex flex-1 flex-col items-center">
            {p ? (
              <>
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.15 }} className="mb-2 flex flex-col items-center gap-1">
                  <Avatar name={p.name} size={places[i] === 1 ? 'lg' : 'md'} crown={places[i] === 1} />
                  <p className="max-w-[6rem] truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs tabular-nums text-muted"><CountUp value={p.score} /></p>
                </motion.div>
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} transition={{ delay: 0.1 * i, duration: 0.6 }} className={`${heights[i]} grid w-full place-items-start rounded-t-2xl bg-gradient-to-b from-brand to-[#3b1d8f] pt-3 text-center shadow-glow`}>
                  <span className="w-full font-display text-3xl font-bold">{places[i]}</span>
                </motion.div>
              </>
            ) : <div className={`${heights[i]} w-full rounded-t-2xl bg-surface2 opacity-40`} />}
          </div>
        ))}
      </div>

      {/* Personal stats */}
      {mine && (
        <section className="glass mt-10 p-5" aria-labelledby="me-h">
          <h2 id="me-h" className="mb-4 font-display text-lg font-bold">{t('room.you')} · {t('room.rank')} #{mine.rank}</h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [t('room.score'), <CountUp key="s" value={mine.score} />],
              [t('room.correctAnswers'), `${mine.correct}/${mine.total}`],
              [t('room.accuracy'), `${mine.accuracy}%`],
              [t('room.avgTime'), mine.avgResponseMs ? `${(mine.avgResponseMs / 1000).toFixed(1)}s` : '—'],
            ].map(([l, v], i) => (
              <div key={i} className="rounded-2xl bg-surface2 p-4"><dd className="font-display text-2xl font-bold">{v}</dd><dt className="text-xs text-muted">{l}</dt></div>
            ))}
          </dl>
          {ended.me && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              {ended.me.xp > 0 && <span className="rounded-full bg-brand/20 px-3 py-1 font-semibold text-brand2">{t('room.xpEarned', { n: ended.me.xp })}</span>}
              <span className="rounded-full bg-surface2 px-3 py-1">{t('room.levelUp', { n: ended.me.level })}</span>
              {ended.me.achievements.map((a, i) => (
                <motion.span key={a} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 + i * 0.15, type: 'spring' }} className="flex items-center gap-1.5 rounded-full bg-warn/15 px-3 py-1 font-semibold text-warn">
                  <Award className="size-4" aria-hidden />{t('room.achievement')} {t(`dash.a_${a}` as TKey)}
                </motion.span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Team scores */}
      {state.teamMode && ended.teams.length > 0 && (
        <section className="glass mt-6 p-5" aria-labelledby="team-h">
          <h2 id="team-h" className="mb-3 font-display text-lg font-bold">{t('room.teamScores')}</h2>
          <ol className="space-y-2">
            {ended.teams.map((tm) => (
              <li key={tm.teamId} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${tm.rank === 1 ? 'bg-gradient-to-r from-brand/60 to-brand2/30' : 'bg-surface2'}`}>
                <span className="w-5 font-bold text-muted">{tm.rank}</span>
                <span className="flex-1 truncate font-medium">{tm.name} <span className="text-xs text-muted">({tm.members})</span></span>
                {tm.rank === 1 && <Crown className="size-4 text-warn" aria-label={t('room.winnerTeam')} />}
                <span className="tabular-nums">{tm.score}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Full ranking */}
      <section className="glass mt-6 p-5" aria-labelledby="rank-h">
        <h2 id="rank-h" className="mb-3 font-display text-lg font-bold">{t('room.leaderboard')}</h2>
        <ol className="space-y-2">
          {ended.ranking.map((r) => (
            <li key={r.id} className={`flex items-center gap-3 rounded-xl bg-surface2 px-3 py-2.5 ${r.id === meId ? 'ring-1 ring-cyan/60' : ''}`}>
              <span className="w-6 text-sm font-bold text-muted">{r.rank}</span>
              <Avatar name={names.get(r.id) ?? r.name} size="sm" />
              <span className="flex-1 truncate font-medium">{r.name}{r.id === meId && <span className="text-faint"> · {t('room.you')}</span>}</span>
              <span className="hidden text-xs text-muted sm:inline">{r.correct}/{r.total} · {r.accuracy}%</span>
              <span className="tabular-nums">{r.score}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Rate */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-1" role="group" aria-label={t('room.rateQuiz')}>
        <span className="mr-2 text-sm text-muted">{t('room.rateQuiz')}</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => void rate(n)} aria-label={`${n}`} className="grid size-9 place-items-center rounded-lg hover:bg-surface2"><Star className={`size-5 ${rated >= n ? 'fill-warn text-warn' : 'text-faint'}`} /></button>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {state.me.isHost && <Button size="lg" onClick={playAgain}><Repeat className="size-4" aria-hidden />{t('room.playAgain')}</Button>}
        <Button size="lg" variant="secondary" onClick={share}><Share2 className="size-4" aria-hidden />{t('room.share')}</Button>
        <LinkButton to={`/results/${state.code}`} size="lg" variant="ghost">{t('room.viewResults')}</LinkButton>
        <LinkButton to="/dashboard" size="lg" variant="ghost">{t('room.backHome')}</LinkButton>
      </div>
    </div>
  )
}
