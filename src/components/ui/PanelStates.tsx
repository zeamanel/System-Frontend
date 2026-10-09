import './PanelStates.css'

import { useI18n } from '../../i18n'
import { Button } from './Button'
import { SkeletonText } from './Skeleton'

/** Standard loading body for panels and lists. */
export function PanelLoading() {
  return (
    <div className="panel-state">
      <SkeletonText lines={3} />
    </div>
  )
}

/** Standard error body for panels and lists, with a retry action. */
export function PanelError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useI18n()
  return (
    <div className="panel-state panel-state--error" role="alert">
      <p>{t('common.error')}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  )
}
