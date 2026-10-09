import './pages.css'

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useI18n } from '../i18n'
import { LOCALES } from '../i18n'
import type { Locale } from '../i18n'
import { env } from '../config/env'
import { getHealth } from '../lib/api/endpoints/health'
import {
  Button,
  Card,
  CardBody,
  CardRow,
  CardTitle,
  Select,
  useToast,
} from '../components/ui'

type HealthState = 'idle' | 'ok' | 'fail'

export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n()
  const toast = useToast()
  const [health, setHealth] = useState<HealthState>('idle')

  const healthCheck = useMutation({
    mutationFn: () => getHealth(),
    onSuccess: () => {
      setHealth('ok')
      toast.push(t('settings.apiOk'), { variant: 'success' })
    },
    onError: () => {
      setHealth('fail')
      toast.push(t('settings.apiFail'), { variant: 'error' })
    },
  })

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">{t('settings.title')}</h1>
      </header>

      <div className="settings-grid">
        <Card className="settings-card">
          <CardTitle>{t('settings.language')}</CardTitle>
          <CardBody>
            <Select
              id="settings-language"
              label={t('settings.language')}
              hint={t('settings.languageHelp')}
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              options={LOCALES.map((code) => ({
                value: code,
                label: t(`language.${code}` as `language.${Locale}`),
              }))}
            />
          </CardBody>
        </Card>

        <Card className="settings-card">
          <CardTitle>{t('settings.api')}</CardTitle>
          <CardBody>
            <CardRow label={t('settings.apiUrlLabel')}>
              <code>{env.apiBaseUrl}</code>
            </CardRow>
          </CardBody>
          <div className="settings-card__footer">
            <Button
              variant="secondary"
              onClick={() => healthCheck.mutate()}
              loading={healthCheck.isPending}
            >
              {t('settings.apiCheck')}
            </Button>
            {health === 'ok' ? (
              <span className="settings-card__status settings-card__status--ok">
                {t('settings.apiOk')}
              </span>
            ) : null}
            {health === 'fail' ? (
              <span className="settings-card__status settings-card__status--fail">
                {t('settings.apiFail')}
              </span>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  )
}
