import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useI18n, type TKey } from '../../i18n'
import { useClickAway } from '../../hooks/useClickAway'

interface N { id: string; type: string; data: Record<string, string>; read: boolean; createdAt: string }
const KNOWN = ['team_request', 'team_accepted', 'team_rejected', 'team_available']

export function NotificationBell() {
  const { t, formatDate } = useI18n()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useClickAway<HTMLDivElement>(open, () => setOpen(false))
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ unread: number; items: N[] }>('/notifications'), refetchInterval: 60_000 })
  const read = useMutation({ mutationFn: () => api('/notifications/read', { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })
  const unread = q.data?.unread ?? 0
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open} aria-label={`${t('teams.notifications')}${unread ? ` (${unread})` : ''}`} className="relative grid size-10 place-items-center rounded-xl hover:bg-surface2">
        <Bell className="size-5" aria-hidden />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-pink px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="glass absolute right-0 z-50 mt-2 w-80 max-w-[90vw] p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-sm font-semibold">{t('teams.notifications')}</p>
            {unread > 0 && <button type="button" onClick={() => read.mutate()} className="text-xs text-brand2 hover:underline">{t('teams.markRead')}</button>}
          </div>
          <ul className="max-h-80 overflow-auto">
            {(q.data?.items ?? []).filter((n) => KNOWN.includes(n.type)).length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{t('teams.noNotifications')}</li>}
            {(q.data?.items ?? []).filter((n) => KNOWN.includes(n.type)).map((n) => (
              <li key={n.id}>
                <Link to={n.data.teamId ? `/teams/${n.data.teamId}` : '/teams'} onClick={() => setOpen(false)} className={`block rounded-lg px-3 py-2 text-sm hover:bg-surface2 ${n.read ? 'text-muted' : 'text-fg'}`}>
                  {t(`teams.n_${n.type}` as TKey, { name: n.data.name ?? '', teamName: n.data.teamName ?? '' })}
                  <span className="mt-0.5 block text-xs text-faint">{formatDate(n.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
