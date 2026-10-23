import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useI18n } from '../../i18n'
import type { Role } from '../../lib/types'

/** Client-side guard for UX only. The server enforces every permission independently. */
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth()
  const { t } = useI18n()
  const loc = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-muted" role="status">
        {t('common.loading')}
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search, reason: 'mustLogin' }} />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}
