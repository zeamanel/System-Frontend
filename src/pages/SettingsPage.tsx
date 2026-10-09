import './pages.css'

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useI18n } from '../i18n'
import { LOCALES } from '../i18n'
import type { Locale } from '../i18n'
import { env } from '../config/env'
import { COUNTRIES, usePreferences } from '../preferences'
import type { CountryCode } from '../preferences'
import { getHealth } from '../lib/api/endpoints/health'
import { isFixtureDataSource } from '../lib/repositories'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardRow,
  CardTitle,
  PageHeader,
  Select,
  useToast,
} from '../components/ui'

type HealthState = 'idle' | 'ok' | 'fail'

export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n()
  const { country, setCountry } = usePreferences()
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
      <PageHeader title={t('settings.title')} />

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
            <Select
              id="settings-country"
              label={t('settings.country')}
              hint={t('settings.countryHelp')}
              value={country}
              onChange={(event) =>
                setCountry(event.target.value as CountryCode)
              }
              options={COUNTRIES.map((code) => ({
                value: code,
                label: t(`country.${code}` as `country.${CountryCode}`),
              }))}
            />
          </CardBody>
        </Card>

        <Card className="settings-card">
          <CardTitle>{t('settings.data')}</CardTitle>
          <CardBody>
            <CardRow label={t('settings.data')}>
              {isFixtureDataSource() ? (
                <Badge variant="warning">
                  {t('settings.dataFixtures')} · {t('dev.badge')}
                </Badge>
              ) : (
                <Badge variant="neutral">{t('settings.dataHttp')}</Badge>
              )}
            </CardRow>
            <p className="panel-note">
              VITE_DATA_SOURCE={env.dataSource}
            </p>
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

