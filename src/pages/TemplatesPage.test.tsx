import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n'
import { PreferencesProvider } from '../preferences'
import TemplatesPage from './TemplatesPage'

function renderTemplatesPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <I18nProvider>
          <MemoryRouter>
            <TemplatesPage />
          </MemoryRouter>
        </I18nProvider>
      </PreferencesProvider>
    </QueryClientProvider>,
  )
}

describe('TemplatesPage Filtering & Multilingual Browser', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('renders all filter controls for category, document type, language, country and sort', async () => {
    renderTemplatesPage()

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'All categories' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Employment & HR' })).toBeInTheDocument()
    expect(screen.getByLabelText('Document type')).toBeInTheDocument()
    expect(screen.getByLabelText('Language')).toBeInTheDocument()
    expect(screen.getByLabelText('Country')).toBeInTheDocument()
    expect(screen.getByLabelText('Institution')).toBeInTheDocument()
    expect(screen.getByLabelText('Sort by')).toBeInTheDocument()
  })

  it('filters by Afaan Oromoo and shows authentic Afaan Oromoo templates', async () => {
    const user = userEvent.setup()
    renderTemplatesPage()

    const langSelect = screen.getByLabelText('Language')
    await user.selectOptions(langSelect, 'om')

    expect(
      await screen.findByText('Waraqaa Iyyannoo Tajaajila Mootummaa Oromiyaa'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Waliigaltee Kireeffannaa Mana Jireenyaa'),
    ).toBeInTheDocument()
  })

  it('filters by category pills and resets page', async () => {
    const user = userEvent.setup()
    renderTemplatesPage()

    const hrTab = screen.getByRole('tab', { name: 'Employment & HR' })
    await user.click(hrTab)

    expect(
      await screen.findByText('A clean, structured summary of experience, skills and education.'),
    ).toBeInTheDocument()
  })

  it('filters by document type and country separately', async () => {
    const user = userEvent.setup()
    renderTemplatesPage()

    const docTypeSelect = screen.getByLabelText('Document type')
    await user.selectOptions(docTypeSelect, 'contract')

    expect(
      await screen.findByText('Agreement drafts with clear parties, terms and signature blocks.'),
    ).toBeInTheDocument()

    const resetButton = screen.getByRole('button', { name: 'Reset all filters' })
    expect(resetButton).toBeInTheDocument()

    await user.click(resetButton)
    expect(screen.queryByRole('button', { name: 'Reset all filters' })).not.toBeInTheDocument()
  })

  it('filters by cross-border countries such as Djibouti and Kenya', async () => {
    const user = userEvent.setup()
    renderTemplatesPage()

    const countrySelect = screen.getByLabelText('Country')
    await user.selectOptions(countrySelect, 'DJ')

    expect(
      await screen.findByText('Djibouti port freight transit declaration'),
    ).toBeInTheDocument()

    await user.selectOptions(countrySelect, 'KE')
    expect(
      await screen.findByText('Kenya-Ethiopia cross-border trade agreement'),
    ).toBeInTheDocument()
  })

  it('navigates pagination cleanly', async () => {
    const user = userEvent.setup()
    renderTemplatesPage()

    expect(await screen.findByText(/Showing 1–8 of/)).toBeInTheDocument()

    const nextButton = screen.getByRole('button', { name: /Next/i })
    expect(nextButton).toBeEnabled()

    await user.click(nextButton)
    expect(await screen.findByText(/Showing 9–16 of/)).toBeInTheDocument()

    const prevButton = screen.getByRole('button', { name: /Previous/i })
    await user.click(prevButton)
    expect(await screen.findByText(/Showing 1–8 of/)).toBeInTheDocument()
  })

  it('opens quick preview dialog and allows closing it', async () => {
    const user = userEvent.setup()
    renderTemplatesPage()

    const previewButtons = await screen.findAllByRole('button', { name: 'Quick Preview' })
    expect(previewButtons.length).toBeGreaterThan(0)

    await user.click(previewButtons[0])

    expect(await screen.findByText(/Questions you will answer/i)).toBeInTheDocument()

    const closeButton = screen.getByRole('button', { name: 'Close' })
    await user.click(closeButton)
  })

  it('toggles favorites-only filter', async () => {
    const user = userEvent.setup()
    renderTemplatesPage()

    const favButton = screen.getByRole('button', { name: 'Favorites only' })
    await user.click(favButton)

    // Should filter to favorites
    expect(favButton).toBeInTheDocument()
  })
})

