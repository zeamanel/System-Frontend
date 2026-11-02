import './OnboardingScreen.css'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { env } from '../../config/env'
import { LOCALES, useI18n } from '../../i18n'
import type { Locale } from '../../i18n'
import { LANGUAGES, type LanguageCode } from '../../lib/languages'
import { OCCUPATIONS } from '../../lib/onboarding/occupations'
import { usePreferences } from '../../preferences'
import { Logo } from '../layout/Logo'
import { Button } from '../ui'

const STEPS = 2

/**
 * The welcome questions a new account answers once: the platform language,
 * then what they do for work. The language is saved as both the interface
 * language and the default language for new documents; the occupation puts
 * the templates they need first. Both can be changed later in Settings, and
 * "Skip for now" keeps the language chosen so far and asks no more.
 *
 * Nothing is saved until the end, so abandoning the screen asks again next time.
 */
export function OnboardingScreen() {
  const { t, locale, setLocale } = useI18n()
  const { preferences, updatePreferences } = usePreferences()
  const [step, setStep] = useState<1 | 2>(1)
  // What the user picked. The interface follows once that language's text has loaded,
  // so the radio and what is saved must not wait for `locale`.
  const [language, setLanguage] = useState<Locale>(locale)
  const [occupation, setOccupation] = useState<string | null>(preferences.occupation ?? null)
  const [saving, setSaving] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const questionId = useId()

  // The rest of the app is out of reach (for keyboard and screen readers) while this is open.
  useEffect(() => {
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    return () => root?.removeAttribute('inert')
  }, [])

  // Each step starts at its question, for screen readers and keyboard users.
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  const finish = async (answers: { occupation: string | null }): Promise<void> => {
    setSaving(true)
    try {
      await updatePreferences({
        preferredLanguage: language,
        defaultDocumentLanguage: language,
        ...(answers.occupation ? { occupation: answers.occupation } : {}),
        onboarded: true,
      })
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="onboarding">
      <div className="onboarding__card">
        <div className="onboarding__logo">
          <Logo />
        </div>
        <p className="onboarding__step" aria-live="polite">
          <span className="onboarding__dots" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, index) => (
              <span key={index} className={index < step ? 'onboarding__dot onboarding__dot--on' : 'onboarding__dot'} />
            ))}
          </span>
          {t('onboarding.step', { current: String(step), total: String(STEPS) })}
        </p>
        <h1 id={titleId} className="onboarding__title">
          {t('onboarding.title', { app: env.appName })}
        </h1>

        {step === 1 ? (
          <section aria-labelledby={questionId}>
            <h2 id={questionId} className="onboarding__question" tabIndex={-1} ref={headingRef}>
              {t('onboarding.languageTitle')}
            </h2>
            <p className="onboarding__help">{t('onboarding.languageHelp', { app: env.appName })}</p>
            <div className="onboarding__options onboarding__options--languages" role="radiogroup" aria-labelledby={questionId}>
              {LOCALES.map((code: Locale) => {
                const info = LANGUAGES[code as LanguageCode]
                const label = t(`language.${code}` as `language.${Locale}`)
                const partial = info && !info.uiTranslated
                return (
                  <label key={code} className="onboarding__option">
                    <input
                      type="radio"
                      name="onboarding-language"
                      value={code}
                      checked={language === code}
                      onChange={() => {
                        setLanguage(code)
                        setLocale(code)
                      }}
                    />
                    <span className="onboarding__option-text">
                      <span className="onboarding__option-label">{label}</span>
                      {partial ? (
                        <span className="onboarding__option-note">
                          {language === code ? t('language.partialNotice', { language: label }) : t('language.fallbackHint')}
                        </span>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        ) : (
          <section aria-labelledby={questionId}>
            <h2 id={questionId} className="onboarding__question" tabIndex={-1} ref={headingRef}>
              {t('onboarding.occupationTitle')}
            </h2>
            <p className="onboarding__help">{t('onboarding.occupationHelp')}</p>
            <div className="onboarding__options onboarding__options--occupations" role="radiogroup" aria-labelledby={questionId}>
              {OCCUPATIONS.map((item) => (
                <label key={item.id} className="onboarding__option">
                  <input
                    type="radio"
                    name="onboarding-occupation"
                    value={item.id}
                    checked={occupation === item.id}
                    onChange={() => setOccupation(item.id)}
                  />
                  <span className="onboarding__option-text">
                    <span className="onboarding__option-label">{t(item.labelKey)}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        )}

        <div className="onboarding__actions">
          {step === 1 ? (
            <Button variant="primary" onClick={() => setStep(2)} disabled={saving}>
              {t('onboarding.next')}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
                {t('onboarding.back')}
              </Button>
              <Button variant="primary" loading={saving} disabled={!occupation || saving} onClick={() => void finish({ occupation })}>
                {t('onboarding.finish')}
              </Button>
            </>
          )}
        </div>
        <button type="button" className="onboarding__skip" disabled={saving} onClick={() => void finish({ occupation: null })}>
          {t('onboarding.skip')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
