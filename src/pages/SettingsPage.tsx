import './pages.css'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { LOCALES } from '../i18n'
import type { Locale } from '../i18n'
import { COUNTRIES, usePreferences } from '../preferences'
import type { CountryCode } from '../preferences'
import {
  DOCUMENT_LANGUAGES,
  LANGUAGES,
  type DocumentLanguage,
  type LanguageCode,
} from '../lib/languages'
import { regionsForCountry, regionDisplayName } from '../lib/geo'
import { OCCUPATIONS } from '../lib/onboarding/occupations'
import { formatDate } from '../lib/datetime'
import { getBillingOverview } from '../lib/billing/client'
import { CUSTOMER_COUNT_LIMIT } from '../lib/customers/client'
import { ApiError } from '../lib/api/client'
import { resetTips } from '../lib/tips'
import { useSession } from '../session'
import { useAiCredits } from '../hooks/use-ai-credits'
import { useAllCustomers, useDeleteAllCustomers } from '../hooks/use-customers'
import { AiCreditsToday } from '../components/usage/AiCreditsToday'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardRow,
  CardTitle,
  Dialog,
  Input,
  PageHeader,
  Select,
  useToast,
} from '../components/ui'

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
    occupation,
    setOccupation,
    retrySave,
  } = usePreferences()
  const toast = useToast()
  const { user, signOut } = useSession()
  const credits = useAiCredits()
  const billing = useQuery({ queryKey: ['billing'], queryFn: () => getBillingOverview() })
  const customers = useAllCustomers()
  const deleteAll = useDeleteAllCustomers()
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  const availableRegions = country === 'ET' ? regionsForCountry('ET') : []
  const customerCount = customers.data?.length ?? 0

  const planLabel = (): string | null => {
    const data = billing.data
    if (!data) return null
    const current = data.current ? data.plans.find((plan) => plan.id === data.current?.planId) : undefined
    const name = current?.name ?? data.free.name
    return name[locale] || name.en
  }

  const forgetAllCustomers = () => {
    deleteAll.mutate(undefined, {
      onSuccess: () => {
        setConfirmDeleteAll(false)
        toast.push(t('settings.customersDeleted'), { variant: 'success' })
      },
      onError: (error) => {
        setConfirmDeleteAll(false)
        const memberOnly = error instanceof ApiError && error.status === 403
        toast.push(t(memberOnly ? 'settings.customersMemberOnly' : 'settings.customersDeleteFailed'), { variant: 'error' })
      },
    })
  }

  return (
    <div className="page">
      <PageHeader title={t('settings.title')} />

      <div className="settings-layout">
        {/* Who is signed in, and the way out. */}
        <Card className="settings-card" data-testid="settings-account">
          <CardTitle>{t('settings.account')}</CardTitle>
          <CardBody>
            <CardRow label={t('settings.accountName')}>{user?.name || '—'}</CardRow>
            <CardRow label={t('settings.accountEmail')}>{user?.email || '—'}</CardRow>
          </CardBody>
          <div className="settings-card__footer">
            <Button variant="secondary" onClick={() => void signOut()}>
              {t('profile.signOut')}
            </Button>
          </div>
        </Card>

        <Card className="settings-card settings-card--main">
          <div className="settings-card__head">
            <CardTitle>{t('settings.preferencesTitle')}</CardTitle>
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
              id="settings-occupation"
              label={t('settings.occupation')}
              hint={t('settings.occupationHelp')}
              value={occupation ?? ''}
              onChange={(event) => void setOccupation(event.target.value || null)}
              options={[
                { value: '', label: t('settings.occupationNone') },
                ...OCCUPATIONS.map((item) => ({ value: item.id, label: t(item.labelKey) })),
              ]}
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
            <p className="settings-preview" data-testid="settings-date-preview">
              {t('settings.dateFormatPreview', { date: formatDate(new Date(), locale, formatting) })}
            </p>

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

        {/* What the plan gives, and what is left today. */}
        <Card className="settings-card" data-testid="settings-plan">
          <CardTitle>{t('settings.plan')}</CardTitle>
          <CardBody>
            {planLabel() ? <CardRow label={t('billing.currentTitle')}>{planLabel()}</CardRow> : null}
            {credits.data ? <AiCreditsToday credits={credits.data} /> : null}
          </CardBody>
          <div className="settings-card__footer">
            <Link className="btn btn--secondary btn--md" to="/billing">
              {t('nav.billing')}
            </Link>
          </div>
        </Card>

        {/* What SenedDesk keeps about the user's customers and files, and how to remove it. */}
        <Card className="settings-card" data-testid="settings-data">
          <CardTitle>{t('settings.yourData')}</CardTitle>
          <CardBody>
            <CardRow label={t('settings.customersLabel')}>
              {customers.isPending
                ? '…'
                : customerCount === 0
                  ? t('settings.customersNone')
                  : t('settings.customersCount', {
                      count: customerCount >= CUSTOMER_COUNT_LIMIT ? `${CUSTOMER_COUNT_LIMIT}+` : String(customerCount),
                    })}
            </CardRow>
            <p className="panel-note">
              {t('settings.retention')}{' '}
              <Link className="settings-card__link" to="/telegram-files">
                {t('nav.telegramFiles')}
              </Link>
            </p>
          </CardBody>
          <div className="settings-card__footer">
            <Button
              variant="danger"
              disabled={customerCount === 0}
              onClick={() => setConfirmDeleteAll(true)}
              data-testid="settings-delete-customers"
            >
              {t('settings.customersDeleteAll')}
            </Button>
          </div>
        </Card>

        <Card className="settings-card" data-testid="settings-help">
          <CardTitle>{t('settings.help')}</CardTitle>
          <CardBody>
            <nav className="settings-links" aria-label={t('settings.help')}>
              <Link to="/faq">{t('info.nav.faq')}</Link>
              <Link to="/about">{t('info.nav.about')}</Link>
              <Link to="/terms">{t('info.nav.terms')}</Link>
              <Link to="/privacy">{t('info.nav.privacy')}</Link>
            </nav>
            <p className="panel-note">{t('settings.version', { version: __APP_VERSION__ })}</p>
          </CardBody>
          <div className="settings-card__footer">
            <Button
              variant="secondary"
              onClick={() => {
                resetTips()
                toast.push(t('settings.tipsReset'), { variant: 'success' })
              }}
            >
              {t('settings.showTips')}
            </Button>
          </div>
        </Card>

      <Dialog
        open={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
        title={t('settings.customersConfirmTitle')}
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDeleteAll(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={deleteAll.isPending} onClick={forgetAllCustomers} data-testid="settings-delete-customers-confirm">
              {t('settings.customersDeleteAll')}
            </Button>
          </>
        }
      >
        <p>{t('settings.customersConfirmBody')}</p>
      </Dialog>
      </div>
    </div>
  )
}

