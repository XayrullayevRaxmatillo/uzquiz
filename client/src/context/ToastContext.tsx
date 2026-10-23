import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, XCircle } from 'lucide-react'

type Kind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: Kind
  text: string
}
interface ToastValue {
  push: (kind: Kind, text: string) => void
}
const Ctx = createContext<ToastValue | null>(null)
let counter = 0

const ICONS = { success: CheckCircle2, error: XCircle, info: Info } as const
const COLORS = { success: 'text-ok', error: 'text-bad', info: 'text-cyan' } as const

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: Kind, text: string) => {
    const id = ++counter
    setToasts((t) => [...t, { id, kind, text }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICONS[t.kind]
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                className="glass pointer-events-auto flex max-w-md items-center gap-3 px-4 py-3 text-sm"
              >
                <Icon className={`size-5 shrink-0 ${COLORS[t.kind]}`} aria-hidden />
                <span>{t.text}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastValue {
  const c = useContext(Ctx)
  if (!c) throw new Error('useToast must be used inside <ToastProvider>')
  return c
}
