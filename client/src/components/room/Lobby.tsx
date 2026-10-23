import { motion } from 'framer-motion'
import { Check, Copy, Crown, Play, UserX } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Chip } from '../ui/misc'
import { useI18n } from '../../i18n'
import { useToast } from '../../context/ToastContext'
import { errorKey } from '../../lib/errors'
import type { RoomState } from '../../hooks/useRoom'

interface Props {
  state: RoomState
  send: (event: string, payload?: unknown) => Promise<{ ok: boolean; code?: string }>
  onLeft: () => void
}

/** Lobby styled after the "Host's Room" reference: player tiles on the left, code + rules + start on the right. */
export function Lobby({ state, send, onLeft }: Props) {
  const { t } = useI18n()
  const { push } = useToast()
  const isHost = state.me.isHost
  const me = state.participants.find((p) => p.id === state.me.id)
  const ready = state.participants.filter((p) => p.ready).length
  const total = state.participants.length
  const slots = Math.max(state.settings.maxPlayers, total)
  const shown = Math.min(slots, 12)
  const empty = Math.max(0, shown - total)
  const link = `${window.location.origin}/join/${state.code}`

  const call = async (event: string, payload?: unknown) => {
    const r = await send(event, payload)
    if (!r.ok) push('error', t(errorKey(r.code ?? '')))
    return r
  }
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => push('success', t('teams.copied')))

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px]">
      <section aria-labelledby="room-title">
        <h1 id="room-title" className="font-display text-4xl font-bold sm:text-5xl">{state.host.name ? `${state.host.name}${state.host.name.endsWith('s') ? '’' : '’s'} Room` : 'Room'}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip>{state.settings.visibility === 'private' ? t('teams.private') : t('teams.public')}</Chip>
          <Chip>{total}/{state.settings.maxPlayers} {t('common.players')}</Chip>
          <Chip>{state.teamMode ? t('room.team') : t('room.solo')}</Chip>
          <Chip>{state.quiz.title}</Chip>
        </div>

        <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label={t('room.players')}>
          {state.participants.map((p, i) => (
            <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
              className={`glass relative flex flex-col items-center gap-2 px-3 py-5 ${p.id === state.host.id ? 'border-line-strong shadow-glow' : ''}`}>
              <Avatar name={p.name} size="lg" online={p.connected} crown={p.id === state.host.id} />
              <p className="max-w-full truncate text-sm font-semibold">{p.name}{p.id === state.me.id && <span className="text-faint"> · {t('room.you')}</span>}</p>
              <p className={`text-[10px] font-bold tracking-widest ${p.ready ? 'text-ok' : 'text-faint'}`}>{p.ready ? t('room.ready').toUpperCase() : t('room.notReady').toUpperCase()}</p>
              {isHost && p.id !== state.me.id && (
                <button type="button" onClick={() => call('host:kick', { userId: p.id })} className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg text-faint hover:bg-bad/10 hover:text-bad" aria-label={`${t('room.kick')}: ${p.name}`}><UserX className="size-4" /></button>
              )}
            </motion.li>
          ))}
          {Array.from({ length: empty }).map((_, i) => (
            <li key={`e${i}`} className="grid place-items-center rounded-[1.25rem] border border-dashed border-line px-3 py-8 text-xs italic text-faint">{t('room.waiting')}</li>
          ))}
        </ul>
      </section>

      <aside className="space-y-4 lg:pt-2">
        <div className="glass flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-faint">{t('room.code')}</p>
            <p className="font-display text-3xl font-bold tracking-[0.2em]" aria-label={`${t('room.code')} ${state.code.split('').join(' ')}`}>{state.code}</p>
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => copy(state.code)} className="grid size-10 place-items-center rounded-xl bg-surface2 hover:text-brand2" aria-label={t('room.copyCode')} title={t('room.copyCode')}><Copy className="size-4" /></button>
            <button type="button" onClick={() => copy(link)} className="grid size-10 place-items-center rounded-xl bg-surface2 text-xs font-bold hover:text-brand2" aria-label={t('room.copyLink')} title={t('room.copyLink')}>URL</button>
          </div>
        </div>

        <div className="glass p-5">
          <div className="rounded-xl bg-surface2 p-3.5">
            <p className="text-[10px] font-bold tracking-widest text-faint">{t('room.rules')}</p>
            <p className="mt-1.5 text-sm text-muted">{t('room.rulesText')}</p>
            {state.teamMode && <p className="mt-1.5 text-sm text-muted">{t('room.rulesTeam')}</p>}
            <p className="mt-2 text-xs text-faint">{state.settings.questionCount} {t('explore.questions')}{state.settings.timeLimit ? ` · ${state.settings.timeLimit}s` : ''}</p>
          </div>
          <div className="my-5 text-center" aria-live="polite">
            <p className="font-display text-4xl font-bold text-ok">{ready}/{total}</p>
            <p className="text-[10px] font-bold tracking-widest text-faint">{t('room.playersReady')}</p>
          </div>
          <Button variant={me?.ready ? 'secondary' : 'primary'} className="w-full" size="lg" onClick={() => call('room:ready', { ready: !me?.ready })}>
            <Check className="size-4" aria-hidden />{me?.ready ? t('room.ready') : t('room.notReady')}
          </Button>
          {isHost ? (
            <>
              <Button className="mt-3 w-full uppercase tracking-wide" size="lg" onClick={() => call('host:start')} disabled={total < 1}>
                <Play className="size-4 fill-current" aria-hidden />{t('room.start')}
              </Button>
              <p className="mt-2 text-center text-[10px] font-bold tracking-widest text-ok/80">{t('room.startHint').toUpperCase()}</p>
              {total < 2 && <p className="mt-2 text-center text-xs text-faint">{t('room.soloNote')}</p>}
              <Button variant="ghost" className="mt-2 w-full" onClick={() => confirm(t('room.endConfirm')) && call('host:end')}>{t('room.closeRoom')}</Button>
            </>
          ) : (
            <p className="mt-4 text-center text-sm text-muted">{t('room.waitHost')}</p>
          )}
          <Button variant="ghost" className="mt-1 w-full" onClick={async () => { await send('room:leave'); onLeft() }}>{t('room.leave')}</Button>
        </div>
        {isHost && <p className="flex items-center justify-center gap-1.5 text-xs text-faint"><Crown className="size-3.5 text-warn" aria-hidden />{t('room.hostBadge')}</p>}
      </aside>
    </div>
  )
}
