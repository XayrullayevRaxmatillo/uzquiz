import { useEffect, useState } from 'react'

/** Milliseconds remaining until a SERVER timestamp, corrected for client/server clock skew. */
export function useCountdown(endsAt: number | null, clockOffset: number, active: boolean): number {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    if (!endsAt || !active) return
    const tick = () => setMs(Math.max(0, endsAt - (Date.now() + clockOffset)))
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [endsAt, clockOffset, active])
  return endsAt && active ? ms : 0
}
