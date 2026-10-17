import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider, tForLocale, useI18n } from './index'

function Harness() {
  const { locale, setLocale, t } = useI18n()
  return (
    <div>
      <p>{t('nav.home')}</p>
      <p>{t('common.welcomeUser', { name: 'Sara' })}</p>
      <p>{locale}</p>
      <button type="button" onClick={() => setLocale('am')}>
        switch
      </button>
      <button type="button" onClick={() => setLocale('om')}>
        switch-om
      </button>
    </div>
  )
}

describe('I18nProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('translates in English by default and interpolates variables', () => {
    render(
      <I18nProvider>
        <Harness />
      </I18nProvider>,
    )
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Welcome, Sara')).toBeInTheDocument()
  })

  it('switches locales reactively', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <Harness />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'switch' }))

    expect(screen.getByText('መነሻ')).toBeInTheDocument()
    expect(screen.getByText(/Sara/)).toBeInTheDocument()
  })

  it('serves English placeholder strings without crashing when om is active', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <Harness />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'switch-om' }))

    expect(screen.getByText('om')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Welcome, Sara')).toBeInTheDocument()
  })
})

describe('tForLocale', () => {
  it('translates against an explicit locale with interpolation', () => {
    expect(tForLocale('am', 'editor.pageOf', { current: '1', total: '2' })).toBe('ገጽ 1 ከ 2')
    expect(tForLocale('en', 'editor.pageOf', { current: '1', total: '2' })).toBe('Page 1 of 2')
  })

  it('falls back to English for unknown locale codes', () => {
    expect(tForLocale('fr', 'editor.signatureCaption')).toBe('Signatory')
  })
})
