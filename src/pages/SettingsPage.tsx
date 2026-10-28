import './pages.css'

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useI18n } from '../i18n'
import { LOCALES } from '../i18n'
import type { Locale } from '../i18n'
import { env } from '../config/env'
import { COUNTRIES, usePreferences } from '../preferences'
import type { CountryCode } from '../preferences'
import {
  DOCUMENT_LANGUAGES,
  LANGUAGES,
  type DocumentLanguage,
  type LanguageCode,
} from '../lib/languages'
import { regionsForCountry, regionDisplayName } from '../lib/geo'
import { getHealth } from '../lib/api/endpoints/health'
import { isFixtureDataSource } from '../lib/repositories'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardRow,
  CardTitle,
  Input,
  PageHeader,
  Select,
  useToast,
} from '../components/ui'

type HealthState = 'idle' | 'ok' | 'fail'

export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n()
  const {
    country,
    defaultDocumentLanguage,
    regionCode,
    city,
    formatting,
    saveStatus,
    setCountry,
    setPreferredLanguage,
    setDefaultDocumentLanguage,
    setRegion,
    setCity,
    setFormatting,
    retrySave,
  } = usePreferences()
  const toast = useToast()
  const [health, setHealth] = useState<HealthState>('idle')

  const availableRegions = country === 'ET' ? regionsForCountry('ET') : []

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <CardTitle>{t('settings.language')}</CardTitle>
            {saveStatus === 'saving' ? (
              <Badge variant="neutral">{t('settings.saving')}</Badge>
            ) : saveStatus === 'saved' ? (
              <Badge variant="success">{t('settings.saved')}</Badge>
            ) : saveStatus === 'error' ? (
              <Badge variant="error">{t('settings.saveError')}</Badge>
            ) : null}
          </div>
          <CardBody>
            <Select
              id="settings-language"
              label={t('settings.language')}
              value={locale}
              onChange={(event) => {
                const code = event.target.value as Locale
                setLocale(code)
                void setPreferredLanguage(code as LanguageCode)
              }}
              options={LOCALES.map((code) => {
                const lang = LANGUAGES[code as LanguageCode]
                const label = t(`language.${code}` as `language.${Locale}`)
                return {
                  value: code,
                  label: lang && !lang.uiTranslated ? `${label} (${t('language.fallbackHint')})` : label,
                }
              })}
            />

            <Select
              id="settings-doc-language"
              label={t('settings.defaultDocumentLanguage')}
              hint={t('settings.defaultDocumentLanguageHelp')}
              value={defaultDocumentLanguage}
              onChange={(event) =>
                void setDefaultDocumentLanguage(event.target.value as DocumentLanguage)
              }
              options={DOCUMENT_LANGUAGES.map((code) => {
                const lang = LANGUAGES[code]
                return {
                  value: code,
                  label: `${lang.nativeName} (${lang.englishName})`,
                }
              })}
            />

            <Select
              id="settings-country"
              label={t('settings.country')}
              hint={t('settings.countryHelp')}
              value={country}
              onChange={(event) =>
                void setCountry(event.target.value as CountryCode)
              }
              options={COUNTRIES.map((code) => ({
                value: code,
                label: t(`country.${code}` as `country.${CountryCode}`),
              }))}
            />

            {availableRegions.length > 0 ? (
              <Select
                id="settings-region"
                label={t('settings.region')}
                hint={t('settings.regionHelp')}
                value={regionCode ?? ''}
                onChange={(event) =>
                  void setRegion(event.target.value || null)
                }
                options={[
                  { value: '', label: t('flow.noRegion') },
                  ...availableRegions.map((code) => ({
                    value: code,
                    label: `${regionDisplayName(code, locale)} (${regionDisplayName(code, 'en')})`,
                  })),
                ]}
              />
            ) : null}

            <Input
              id="settings-city"
              label={t('settings.city')}
              hint={t('settings.cityHelp')}
              value={city ?? ''}
              onChange={(event) => void setCity(event.target.value || null)}
              placeholder="e.g. Addis Ababa / Finfinnee"
            />

            <Select
              id="settings-date-format"
              label={t('settings.dateFormat')}
              value={formatting.dateFormat}
              onChange={(event) =>
                void setFormatting({
                  ...formatting,
                  dateFormat: event.target.value as 'gregorian' | 'ethiopian',
                })
              }
              options={[
                { value: 'gregorian', label: t('settings.dateFormat.gregorian') },
                { value: 'ethiopian', label: t('settings.dateFormat.ethiopian') },
              ]}
            />

            <Select
              id="settings-number-format"
              label={t('settings.numberFormat')}
              value={formatting.numberFormat}
              onChange={(event) =>
                void setFormatting({
                  ...formatting,
                  numberFormat: event.target.value as 'latn' | 'ethi',
                })
              }
              options={[
                { value: 'latn', label: t('settings.numberFormat.latn') },
                { value: 'ethi', label: t('settings.numberFormat.ethi') },
              ]}
            />

            {saveStatus === 'error' ? (
              <div style={{ marginTop: 'var(--space-2)' }}>
                <Button variant="secondary" size="sm" onClick={() => void retrySave()}>
                  {t('settings.retry')}
                </Button>
              </div>
            ) : null}
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

