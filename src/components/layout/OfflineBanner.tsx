import { useI18n } from '../../i18n'
import { useOffline } from '../../lib/offline/connection'
import { CloudOffIcon } from '../icons'

/**
 * Shown under the top bar while the server cannot be reached: what still
 * works (documents opened before, edits kept on this device) and that they
 * sync by themselves. One line, so the editor's page keeps its height.
 */
export function OfflineBanner() {
  const { t } = useI18n()
  const offline = useOffline()
  if (!offline) return null
  return (
    <div className="offline-banner" role="status" title={t('offline.bannerDetail')} data-testid="offline-banner">
      <CloudOffIcon size={14} />
      <span>{t('offline.banner')}</span>
    </div>
  )
}
