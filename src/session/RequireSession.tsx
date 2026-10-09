import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import { LoadingState } from '../components/ui'
import { useSession } from './use-session'

/**
 * Route guard: renders children only for authenticated users, shows a
 * loading state while the session resolves, and redirects to /login
 * otherwise.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { state } = useSession()
  const { t } = useI18n()

  if (state.status === 'loading') {
    return <LoadingState full label={t('common.loading')} />
  }
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
