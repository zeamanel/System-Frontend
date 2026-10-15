import { useEffect } from 'react'
import { useI18n } from '../i18n'
import { useToast } from '../components/ui'
import { onSessionExpired } from '../lib/api'

/**
 * Surfaces unrecoverable authentication failures (raised by the API client)
 * as a toast. The actual sign-out and route redirect happen through the
 * session context / RequireSession guard; this component only reports.
 * Rendered once, inside the ToastProvider.
 */
export function SessionExpiredNotifier() {
  const { t } = useI18n()
  const toast = useToast()

  useEffect(
    () =>
      onSessionExpired(() => {
        toast.push(t('session.expired'), { variant: 'error' })
      }),
    [toast, t],
  )

  return null
}
