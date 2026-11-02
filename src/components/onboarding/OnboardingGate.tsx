import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../../i18n'
import { isLocale } from '../../i18n/locales'
import { usePreferences } from '../../preferences'
import { OnboardingScreen } from './OnboardingScreen'

/**
 * Inside the signed-in app:
 *  - a new account (the backend says `onboarded: false`) answers the welcome
 *    questions before anything else. Nothing is asked until this sign-in has
 *    synced with the backend, so a stale local copy cannot show them to an
 *    existing user, and nothing is asked when the backend does not say.
 *  - an onboarded user gets their saved language on every device: a laptop
 *    that is still on its default language switches to the one chosen on the phone.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { locale, setLocale } = useI18n()
  const { preferences, onboarded, synced } = usePreferences()
  const saved = preferences.preferredLanguage

  useEffect(() => {
    if (synced && onboarded === true && isLocale(saved) && saved !== locale) setLocale(saved)
  }, [synced, onboarded, saved, locale, setLocale])

  return (
    <>
      {children}
      {synced && onboarded === false ? <OnboardingScreen /> : null}
    </>
  )
}
