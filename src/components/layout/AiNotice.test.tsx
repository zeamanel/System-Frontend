import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider, useI18n } from '../../i18n'
import { AiNotice } from './AiNotice'

function LocaleSwitch({ to }: { to: 'am' | 'om' }) {
  const { setLocale } = useI18n()
  return (
    <button type="button" onClick={() => setLocale(to)}>
      {to}
    </button>
  )
}

describe('AiNotice', () => {
  it('reminds people to check documents, with the app name filled in', () => {
    render(
      <I18nProvider>
        <AiNotice />
      </I18nProvider>,
    )
    expect(screen.getByTestId('ai-notice')).toHaveTextContent('SenedDesk can make mistakes. Check documents carefully before you use them.')
  })

  it.each([
    ['am', 'SenedDesk ስህተት ሊሠራ ይችላል።'],
    ['om', 'SenedDesk dogoggora hojjechuu danda’a.'],
  ] as const)('is translated (%s)', async (locale, start) => {
    render(
      <I18nProvider>
        <LocaleSwitch to={locale} />
        <AiNotice />
      </I18nProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: locale }))
    await waitFor(() => expect(screen.getByTestId('ai-notice').textContent).toMatch(new RegExp(`^${start}`)))
    expect(screen.getByTestId('ai-notice').textContent).not.toContain('{app}')
  })
})
