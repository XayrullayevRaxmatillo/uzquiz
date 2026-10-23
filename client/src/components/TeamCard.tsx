import { Link } from 'react-router-dom'
import { Crown, Globe2, Lock, Users } from 'lucide-react'
import { Avatar } from './ui/Avatar'
import { Chip } from './ui/misc'
import { Button } from './ui/Button'
import { useI18n, type TKey } from '../i18n'
import { useCategories } from '../lib/useCategories'
import type { TeamData } from '../lib/types2'

const SKILL: Record<TeamData['skillLevel'], TKey> = { beginner: 'teams.beginner', intermediate: 'teams.intermediate', advanced: 'teams.advanced' }
const STYLE: Record<TeamData['playStyle'], TKey> = { casual: 'teams.casual', competitive: 'teams.competitive' }

interface Props {
  team: TeamData
  busy?: boolean
  onJoin?: (t: TeamData) => void
  onRequest?: (t: TeamData) => void
  onCancel?: (t: TeamData) => void
  matchScore?: number
}

export function TeamCard({ team, busy, onJoin, onRequest, onCancel, matchScore }: Props) {
  const { t } = useI18n()
  const cats = useCategories()
  const pct = Math.round((team.memberCount / team.capacity) * 100)

  let action
  if (team.isMember) action = <Link to={`/teams/${team.id}`} className="inline-flex h-9 items-center rounded-xl bg-surface2 px-3.5 text-sm font-semibold hover:border-line-strong">{t('teams.myTeam')}</Link>
  else if (team.full) action = <Button size="sm" variant="secondary" disabled>{t('teams.full')}</Button>
  else if (team.visibility === 'public') action = <Button size="sm" loading={busy} onClick={() => onJoin?.(team)}>{t('teams.join')}</Button>
  else if (team.hasRequested) action = <Button size="sm" variant="secondary" loading={busy} onClick={() => onCancel?.(team)}>{t('teams.cancelRequest')}</Button>
  else action = <Button size="sm" loading={busy} onClick={() => onRequest?.(team)}>{t('teams.requestJoin')}</Button>

  return (
    <article className="glass flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-line-strong">
      <div className="flex items-start gap-3">
        <Avatar name={team.name} src={team.avatar} size="lg" online={team.online} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-semibold"><Link to={`/teams/${team.id}`} className="hover:underline">{team.name}</Link></h3>
          <p className="flex items-center gap-1 text-xs text-muted">
            <Crown className="size-3 text-warn" aria-hidden />{t('teams.leader')}: {team.leader?.name ?? '—'}
          </p>
          <p className={`mt-0.5 text-xs font-medium ${team.online ? 'text-ok' : 'text-faint'}`}>{team.online ? `${t('teams.online')} · ${team.onlineCount}` : t('teams.offline')}</p>
        </div>
        {matchScore !== undefined && <span className="rounded-full bg-brand/20 px-2.5 py-1 text-xs font-bold text-brand2">{t('teams.matchScore', { score: matchScore })}</span>}
      </div>
      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-muted">{team.description || '—'}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip color={cats.color(team.category)}>{cats.name(team.category)}</Chip>
        <Chip>{t(SKILL[team.skillLevel])}</Chip>
        <Chip>{t(STYLE[team.playStyle])}</Chip>
        <Chip><Globe2 className="size-3" aria-hidden />{team.language.toUpperCase()}</Chip>
        <Chip>{team.visibility === 'private' ? <><Lock className="size-3" aria-hidden />{t('teams.private')}</> : t('teams.public')}</Chip>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-muted"><Users className="size-3.5" aria-hidden />{team.memberCount}/{team.capacity} {t('teams.members')}</div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={team.memberCount} aria-valuemin={0} aria-valuemax={team.capacity}>
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-pink" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {action}
      </div>
    </article>
  )
}
