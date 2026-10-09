import { useContext } from 'react'
import { PreferencesContext } from './context'
import type { PreferencesContextValue } from './context'

/** Access and update regional preferences (country). */
export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext)
  if (!value) {
    throw new Error('usePreferences must be used within <PreferencesProvider>.')
  }
  return value
}
