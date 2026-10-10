import { useI18n } from '../../i18n'
import type { Locale } from '../../i18n'
import { LOCALES } from '../../i18n'
import { COUNTRIES, usePreferences } from '../../preferences'
import type { CountryCode } from '../../preferences'
import { LANGUAGES, type LanguageCode } from '../../lib/languages'
import { CheckIcon, GlobeIcon } from '../icons'
import { Popover, Select } from '../ui'

/**
 * Country and language selector in the global header.
 * Changes apply immediately to UI labels and persist to user preferences.
 */
export function RegionMenu() {
  const { t, locale, setLocale } = useI18n()
  const { country, setCountry, setPreferredLanguage, saveStatus, retrySave } =
    usePreferences()

  const handleSelectLanguage = (code: Locale) => {
    setLocale(code)
    void setPreferredLanguage(code as LanguageCode)
  }

  return (
    <Popover
      ariaLabel={t('topbar.region')}
      align="right"
      label={
        <>
          <GlobeIcon size={16} />
          <span className="topbar__control-label">{locale.toUpperCase()}</span>
        </>
      }
    >
      {() => (
        <div className="region-menu">
          <div className="region-menu__group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="region-menu__label">{t('settings.language')}</span>
              {saveStatus === 'saving' ? (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  {t('settings.saving')}
                </span>
              ) : null}
            </div>
            <div
              className="region-menu__options"
              role="radiogroup"
              aria-label={t('settings.language')}
            >
              {LOCALES.map((code: Locale) => {
                const langInfo = LANGUAGES[code as LanguageCode]
                const label = t(`language.${code}` as `language.${Locale}`)
                const isPartial = langInfo && !langInfo.uiTranslated

                return (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={locale === code}
                    className={[
                      'region-menu__option',
                      locale === code ? 'region-menu__option--active' : null,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleSelectLanguage(code)}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span>{label}</span>
                      {isPartial ? (
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-text-muted)',
                            fontWeight: 'normal',
                          }}
                        >
                          {t('language.fallbackHint')}
                        </span>
                      ) : null}
                    </span>
                    {locale === code ? <CheckIcon size={14} /> : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="region-menu__group">
            <label className="region-menu__label" htmlFor="region-menu-country">
              {t('settings.country')}
            </label>
            <Select
              bare
              id="region-menu-country"
              value={country}
              aria-label={t('settings.country')}
              onChange={(event) =>
                void setCountry(event.target.value as CountryCode)
              }
              options={COUNTRIES.map((code) => ({
                value: code,
                label: t(`country.${code}` as `country.${CountryCode}`),
              }))}
            />
          </div>

          {saveStatus === 'error' ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                padding: 'var(--space-2)',
                backgroundColor: 'var(--color-danger-subtle, #fef2f2)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-danger, #b91c1c)',
              }}
              role="alert"
            >
              <span>{t('settings.saveError')}</span>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                style={{ width: '100%', fontSize: 'var(--text-xs)' }}
                onClick={() => void retrySave()}
              >
                {t('common.retry')}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Popover>
  )
}

