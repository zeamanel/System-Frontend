import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getRepositories } from '../lib/repositories'
import { SessionContext } from '../session/context'
import type {
  FormattingPreferences,
  UpdateUserPreferencesInput,
  UserPreferences,
} from '../types/api'
import { isCountryCode, type CountryCode } from '../lib/geo'
import {
  isLanguageCode,
  type DocumentLanguage,
  type LanguageCode,
} from '../lib/languages'
import {
  DEFAULT_PREFERENCES,
  PreferencesContext,
  type PreferencesSaveStatus,
} from './context'

const STORAGE_KEY = 'docuA4.preferences'

function detectInitialPreferences(): UserPreferences {
  const base: UserPreferences = { ...DEFAULT_PREFERENCES }
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (raw) return { ...base, ...JSON.parse(raw) }
    const c = globalThis.localStorage?.getItem('docuA4.country')
    if (isCountryCode(c)) base.countryCode = c
    const l = globalThis.localStorage?.getItem('docuA4.locale')
    if (isLanguageCode(l)) {
      base.preferredLanguage = l
      base.defaultDocumentLanguage = l
    }
  } catch {
    // Non-fatal
  }
  return base
}

function persistLocal(prefs: UserPreferences): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(prefs))
    globalThis.localStorage?.setItem('docuA4.country', prefs.countryCode)
    globalThis.localStorage?.setItem('docuA4.locale', prefs.preferredLanguage)
  } catch {
    // Non-fatal
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const session = useContext(SessionContext)
  const [preferences, setPreferences] = useState<UserPreferences>(detectInitialPreferences)
  const [saveStatus, setSaveStatus] = useState<PreferencesSaveStatus>('idle')
  const [lastError, setLastError] = useState<string | null>(null)
  const lastPendingPatch = useRef<UpdateUserPreferencesInput | null>(null)

  const isAuthenticated = session?.state?.status === 'authenticated'

  useEffect(() => {
    document.documentElement.dataset.country = preferences.countryCode
  }, [preferences.countryCode])

  useEffect(() => {
    if (!isAuthenticated) return

    let cancelled = false
    setSaveStatus('saving')

    getRepositories()
      .preferences.sync(preferences)
      .then((remote) => {
        if (cancelled) return
        setPreferences(remote)
        persistLocal(remote)
        setSaveStatus('saved')
        setLastError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setSaveStatus('error')
        setLastError(err instanceof Error ? err.message : 'Failed to sync preferences.')
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const executeUpdate = useCallback(
    async (patch: UpdateUserPreferencesInput) => {
      lastPendingPatch.current = patch
      setPreferences((prev) => {
        const next: UserPreferences = {
          ...prev,
          ...patch,
          formatting: { ...prev.formatting, ...(patch.formatting ?? {}) },
        } as UserPreferences
        persistLocal(next)
        return next
      })

      if (!isAuthenticated) {
        setSaveStatus('saved')
        setLastError(null)
        lastPendingPatch.current = null
        return
      }

      setSaveStatus('saving')
      setLastError(null)

      try {
        const updated = await getRepositories().preferences.update(patch)
        setPreferences(updated)
        persistLocal(updated)
        setSaveStatus('saved')
        setLastError(null)
        lastPendingPatch.current = null
      } catch (err) {
        setSaveStatus('error')
        setLastError(err instanceof Error ? err.message : 'Failed to save preferences.')
      }
    },
    [isAuthenticated],
  )

  const retrySave = useCallback(async () => {
    if (lastPendingPatch.current) {
      await executeUpdate(lastPendingPatch.current)
    } else {
      await executeUpdate(preferences)
    }
  }, [executeUpdate, preferences])

  const value = useMemo(
    () => ({
      preferences,
      country: preferences.countryCode as CountryCode,
      preferredLanguage: preferences.preferredLanguage as LanguageCode,
      defaultDocumentLanguage: preferences.defaultDocumentLanguage as DocumentLanguage,
      regionCode: preferences.regionCode ?? null,
      city: preferences.city ?? null,
      formatting: preferences.formatting,
      saveStatus,
      lastError,
      setCountry: (code: CountryCode) => executeUpdate({ countryCode: code }),
      setPreferredLanguage: (lang: LanguageCode) => executeUpdate({ preferredLanguage: lang }),
      setDefaultDocumentLanguage: (lang: DocumentLanguage) =>
        executeUpdate({ defaultDocumentLanguage: lang }),
      setRegion: (region: string | null) => executeUpdate({ regionCode: region }),
      setCity: (city: string | null) => executeUpdate({ city }),
      setFormatting: (formatting: FormattingPreferences) => executeUpdate({ formatting }),
      updatePreferences: executeUpdate,
      retrySave,
    }),
    [preferences, saveStatus, lastError, executeUpdate, retrySave],
  )

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  )
}

