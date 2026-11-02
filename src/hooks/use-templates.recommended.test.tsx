import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n'
import { PreferencesContext } from '../preferences/context'
import type { PreferencesContextValue } from '../preferences/context'
import { useRecommendedTemplates } from './use-templates'

function wrapper(occupation: string | null | undefined) {
  const value = occupation === undefined
    ? null
    : ({ preferences: { occupation } } as unknown as PreferencesContextValue)
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PreferencesContext.Provider value={value}>
          <I18nProvider>{children}</I18nProvider>
        </PreferencesContext.Provider>
      </QueryClientProvider>
    )
  }
}

async function types(occupation: string | null | undefined): Promise<string[]> {
  const { result } = renderHook(() => useRecommendedTemplates(), { wrapper: wrapper(occupation) })
  await waitFor(() => expect(result.current.data).toBeDefined())
  return (result.current.data ?? []).map((template) => template.documentTypeId)
}

describe('useRecommendedTemplates', () => {
  it('shows the same four to everyone who has not said what they do, with or without the preferences provider', async () => {
    const withProvider = await types(null)
    expect(withProvider).toHaveLength(4)
    expect(await types(undefined)).toEqual(withProvider)
    expect(await types('other')).toEqual(withProvider)
  })

  it('puts the templates for the occupation first', async () => {
    const accountant = await types('accountant')
    expect(accountant).toHaveLength(4)
    expect(accountant.slice(0, 2).sort()).toEqual(['vat_monthly_report', 'vat_return_worksheet'])
    expect(accountant).not.toEqual(await types(null))

    const lawyer = await types('lawyer')
    expect(lawyer).toContain('power_of_attorney')
    expect(lawyer).not.toEqual(accountant)
  })
})
