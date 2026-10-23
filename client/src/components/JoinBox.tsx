import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from './ui/Button'
import { useI18n } from '../i18n'

export function JoinBox() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(c)) {
      setError(t('join.invalid'))
      return
    }
    setError('')
    navigate(`/join/${c}`)
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md" noValidate>
      <label htmlFor="join-code" className="sr-only">{t('join.title')}</label>
      <div className="glass flex items-center gap-2 p-2 pl-4">
        <input
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder={t('join.placeholder')}
          inputMode="text"
          autoComplete="off"
          maxLength={6}
          aria-invalid={!!error}
          className="min-w-0 flex-1 bg-transparent font-display text-lg font-semibold tracking-[0.25em] text-fg outline-none placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-faint"
        />
        <Button type="submit" size="md">
          {t('join.button')} <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
    </form>
  )
}
