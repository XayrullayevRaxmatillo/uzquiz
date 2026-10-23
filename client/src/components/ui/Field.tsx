import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useI18n } from '../../i18n'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: ReactNode
}

const inputCls =
  'h-12 w-full rounded-xl border border-line bg-surface2 px-4 text-[15px] text-fg placeholder:text-faint outline-none transition focus:border-line-strong focus:ring-2 focus:ring-brand/40 aria-[invalid=true]:border-bad'

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, error, hint, className = '', ...rest }, ref) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">
        {label}
      </label>
      <input ref={ref} id={id} className={inputCls} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
      {hint && !error && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs text-bad">
          {error}
        </p>
      )}
    </div>
  )
})

export function scorePassword(pw: string): 0 | 1 | 2 | 3 {
  let s = 0
  if (pw.length >= 8) s++
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) s++
  if (pw.length >= 12 || /[^a-zA-Z0-9]/.test(pw)) s++
  return Math.min(s, 3) as 0 | 1 | 2 | 3
}

export const PasswordField = forwardRef<HTMLInputElement, FieldProps & { showStrength?: boolean; value?: string }>(
  function PasswordField({ label, error, showStrength, className = '', ...rest }, ref) {
    const id = useId()
    const [show, setShow] = useState(false)
    const { t } = useI18n()
    const value = typeof rest.value === 'string' ? rest.value : ''
    const score = scorePassword(value)
    const labels = ['auth.strengthWeak', 'auth.strengthFair', 'auth.strengthGood', 'auth.strengthStrong'] as const
    const colours = ['bg-bad', 'bg-warn', 'bg-cyan', 'bg-ok']
    return (
      <div className={className}>
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={show ? 'text' : 'password'}
            className={`${inputCls} pr-12`}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-err` : undefined}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-faint hover:text-fg"
            aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
            aria-pressed={show}
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        {showStrength && value.length > 0 && (
          <div className="mt-2" aria-live="polite">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? colours[score] : 'bg-surface2'}`} />
              ))}
            </div>
            <p className="mt-1 text-xs text-faint">
              {t('auth.strength')}: {t(labels[score])}
            </p>
          </div>
        )}
        {error && (
          <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs text-bad">
            {error}
          </p>
        )}
      </div>
    )
  },
)
