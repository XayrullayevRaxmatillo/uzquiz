import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useI18n } from '../../i18n'

const ctl = 'w-full rounded-xl border border-line bg-surface2 px-4 text-[15px] text-fg outline-none transition focus:border-line-strong focus:ring-2 focus:ring-brand/40 aria-[invalid=true]:border-bad'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label: string }>(function Select({ label, className = '', children, ...rest }, ref) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">{label}</label>
      <select ref={ref} id={id} className={`${ctl} h-12`} {...rest}>{children}</select>
    </div>
  )
})

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }>(function TextArea({ label, error, className = '', ...rest }, ref) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">{label}</label>
      <textarea ref={ref} id={id} rows={3} className={`${ctl} py-3`} aria-invalid={!!error} {...rest} />
      {error && <p role="alert" className="mt-1.5 text-xs text-bad">{error}</p>}
    </div>
  )
})

export function Chip({ children, color, className = '' }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-line bg-surface2 px-2.5 py-1 text-xs font-medium text-muted ${className}`} style={color ? { color, borderColor: `${color}55` } : undefined}>
      {children}
    </span>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function EmptyState({ icon, title, hint, children }: { icon?: ReactNode; title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="glass grid place-items-center px-6 py-14 text-center">
      {icon && <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-surface2 text-brand2">{icon}</div>}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {hint && <p className="mt-1 max-w-md text-sm text-muted">{hint}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n()
  return (
    <div className="glass px-6 py-10 text-center" role="alert">
      <p className="text-bad">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:border-line-strong">
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  const { t } = useI18n()
  if (pages <= 1) return null
  const b = 'rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:border-line-strong disabled:opacity-40 disabled:pointer-events-none'
  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
      <button className={b} disabled={page <= 1} onClick={() => onChange(page - 1)}>{t('explore.prev')}</button>
      <span className="text-sm text-muted">{t('explore.page', { page, pages })}</span>
      <button className={b} disabled={page >= pages} onClick={() => onChange(page + 1)}>{t('explore.next')}</button>
    </nav>
  )
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export const Page = ({ children, narrow }: { children: ReactNode; narrow?: boolean }) => (
  <div className={`mx-auto px-4 pb-8 pt-8 sm:px-6 ${narrow ? 'max-w-3xl' : 'max-w-7xl'}`}>{children}</div>
)
