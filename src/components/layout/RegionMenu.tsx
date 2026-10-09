import { useI18n } from '../../i18n'
import type { Locale } from '../../i18n'
import { LOCALES } from '../../i18n'
import { COUNTRIES, usePreferences } from '../../preferences'
import type { CountryCode } from '../../preferences'
import { CheckIcon, GlobeIcon } from '../icons'
import { Popover, Select } from '../ui'

/**
 * Country and language selector. The language applies immediately; the
 * country is a stored regional preference for document formats.
 */
export function RegionMenu() {
  const { t, locale, setLocale } = useI18n()
  const { country, setCountry } = usePreferences()

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
            <span className="region-menu__label">{t('settings.language')}</span>
            <div
              className="region-menu__options"
              role="radiogroup"
              aria-label={t('settings.language')}
            >
              {LOCALES.map((code: Locale) => (
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
                  onClick={() => setLocale(code)}
                >
                  <span>{t(`language.${code}` as `language.${Locale}`)}</span>
                  {locale === code ? <CheckIcon size={14} /> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="region-menu__group">
            <label
              className="region-menu__label"
              htmlFor="region-menu-country"
            >
              {t('settings.country')}
            </label>
            <Select
              bare
              id="region-menu-country"
              value={country}
              aria-label={t('settings.country')}
              onChange={(event) =>
                setCountry(event.target.value as CountryCode)
              }
              options={COUNTRIES.map((code) => ({
                value: code,
                label: t(`country.${code}` as `country.${CountryCode}`),
              }))}
            />
          </div>
        </div>
      )}
    </Popover>
  )
}
