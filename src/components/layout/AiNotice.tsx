import './AiNotice.css'

import { env } from '../../config/env'
import { useI18n } from '../../i18n'

/** Small print reminding people that AI-made documents need a human check before use. */
export function AiNotice({ className }: { className?: string }) {
  const { t } = useI18n()
  return (
    <p className={['ai-notice', className].filter(Boolean).join(' ')} data-testid="ai-notice">
      {t('app.aiNotice', { app: env.appName })}
    </p>
  )
}
