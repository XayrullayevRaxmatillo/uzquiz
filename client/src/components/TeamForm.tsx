import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../lib/api'
import { errorKey } from '../lib/errors'
import { useI18n } from '../i18n'
import { useToast } from '../context/ToastContext'
import { useCategories } from '../lib/useCategories'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field } from './ui/Field'
import { Select, TextArea } from './ui/misc'
import type { TeamData } from '../lib/types2'
import type { Lang } from '../i18n/types'

export function CreateTeamModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (t: TeamData) => void }) {
  const { t, lang } = useI18n()
  const { push } = useToast()
  const cats = useCategories()
  const [f, setF] = useState({ name: '', description: '', category: 'it', language: lang as Lang, skillLevel: 'beginner', playStyle: 'casual', capacity: 5, visibility: 'public' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (f.name.trim().length < 3) return setErr(t('teams.nameShort'))
    setErr('')
    setBusy(true)
    try {
      const r = await api<{ team: TeamData }>('/teams', { method: 'POST', body: { ...f, name: f.name.trim(), description: f.description.trim(), avatar: '' } })
      push('success', t('teams.created'))
      onCreated(r.team)
    } catch (e2) {
      setErr(t(e2 instanceof ApiError && e2.fields?.name === 'TEAM_NAME_TAKEN' ? 'errors.TEAM_NAME_TAKEN' : errorKey(e2)))
    } finally {
      setBusy(false)
    }
  }
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  return (
    <Modal open={open} onClose={onClose} title={t('teams.create')} wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field className="sm:col-span-2" label={t('teams.name')} value={f.name} maxLength={40} onChange={(e) => set('name', e.target.value)} />
        <TextArea className="sm:col-span-2" label={t('teams.description')} placeholder={t('teams.desc')} value={f.description} maxLength={300} onChange={(e) => set('description', e.target.value)} />
        <Select label={t('teams.category')} value={f.category} onChange={(e) => set('category', e.target.value)}>
          {cats.items.map((c) => <option key={c.slug} value={c.slug}>{cats.name(c.slug)}</option>)}
        </Select>
        <Select label={t('teams.language')} value={f.language} onChange={(e) => set('language', e.target.value as Lang)}>
          <option value="uz">O‘zbekcha</option><option value="ru">Русский</option><option value="en">English</option>
        </Select>
        <Select label={t('teams.level')} value={f.skillLevel} onChange={(e) => set('skillLevel', e.target.value)}>
          <option value="beginner">{t('teams.beginner')}</option><option value="intermediate">{t('teams.intermediate')}</option><option value="advanced">{t('teams.advanced')}</option>
        </Select>
        <Select label={t('teams.style')} value={f.playStyle} onChange={(e) => set('playStyle', e.target.value)}>
          <option value="casual">{t('teams.casual')}</option><option value="competitive">{t('teams.competitive')}</option>
        </Select>
        <Field label={t('teams.capacity')} type="number" min={2} max={20} value={f.capacity} onChange={(e) => set('capacity', Math.min(20, Math.max(2, Number(e.target.value) || 2)))} />
        <Select label={t('teams.visibility')} value={f.visibility} onChange={(e) => set('visibility', e.target.value)}>
          <option value="public">{t('teams.public')}</option><option value="private">{t('teams.private')}</option>
        </Select>
        {err && <p role="alert" className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad sm:col-span-2">{err}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" loading={busy}>{t('teams.create')}</Button>
        </div>
      </form>
    </Modal>
  )
}
