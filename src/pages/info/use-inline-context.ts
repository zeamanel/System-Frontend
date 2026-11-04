import { useMemo } from 'react'
import { env } from '../../config/env'
import { REFUND_POLICY } from '../../content/info/meta'
import type { InlineContext } from '../../content/info/inline'
import { useI18n } from '../../i18n'

/** What the content needs to turn [[tokens]] into business details and links, in the reader's language. */
export function useInlineContext(options?: { newTab?: boolean }): InlineContext {
  const { t } = useI18n()
  const newTab = options?.newTab
  return useMemo(
    () => ({
      appName: env.appName,
      operator: env.operator,
      refundPolicy: REFUND_POLICY,
      linkLabels: {
        about: t('info.nav.about'),
        faq: t('info.nav.faq'),
        terms: t('info.nav.terms'),
        privacy: t('info.nav.privacy'),
      },
      newTab,
    }),
    [t, newTab],
  )
}
