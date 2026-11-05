import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { TemplateCard } from './TemplateCard'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import type { TemplateSummary } from '../../lib/repositories'

const template: TemplateSummary = {
  id: 'letter',
  documentTypeId: 'letter',
  title: 'Letter',
  description: 'Formal letters',
  category: 'business_finance',
  iconKey: 'document',
  questionCount: 3,
  country: 'ET',
  language: 'en',
  supportedLanguages: ['en', 'am'],
  displayLanguage: 'en',
  metadataLanguage: 'en',
  generatedDocumentLanguage: 'en',
  htmlTemplateVersion: 'html5-a4-v1.0',
  version: '1.0',
  status: 'available',
  canUse: true,
  preview: { summary: 'Formal letters' },
  popularity: 80,
}

function renderCard(overrides: Partial<Parameters<typeof TemplateCard>[0]> = {}) {
  const onToggleFavorite = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TemplateCard
          template={template}
          favorited={false}
          onToggleFavorite={onToggleFavorite}
          favoriteAddLabel="Add to favorites"
          favoriteRemoveLabel="Remove from favorites"
          categoryLabel="Business"
          {...overrides}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { onToggleFavorite, ...utils }
}

describe('TemplateCard', () => {
  it('renders the template and links to its detail page', () => {
    renderCard()
    const link = screen.getByRole('link', { name: /letter/i })
    expect(link).toHaveAttribute('href', '/templates/letter')
    expect(screen.getByText('Business')).toBeInTheDocument()
  })

  it('toggles favorites with an accessible pressed state', () => {
    const { onToggleFavorite } = renderCard()
    const star = screen.getByRole('button', { name: 'Add to favorites' })
    expect(star).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(star)
    expect(onToggleFavorite).toHaveBeenCalledWith('letter')
  })

  it('reflects the favorited state', () => {
    renderCard({ favorited: true })
    expect(
      screen.getByRole('button', { name: 'Remove from favorites' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('triggers onPreview when the preview button is clicked', () => {
    const onPreview = vi.fn()
    renderCard({ onPreview })
    const previewBtn = screen.getByRole('button', { name: 'Preview' })
    fireEvent.click(previewBtn)
    expect(onPreview).toHaveBeenCalledWith('letter')
  })

  it('triggers onUseTemplate when Use Template is clicked', () => {
    const onUseTemplate = vi.fn()
    renderCard({ onUseTemplate })
    const useBtn = screen.getByRole('button', { name: /use template/i })
    fireEvent.click(useBtn)
    expect(onUseTemplate).toHaveBeenCalledWith(template)
  })

  it('says so when the document cannot be created, instead of doing nothing', async () => {
    const create = vi.spyOn(getRepositories().documents, 'create').mockRejectedValue(new Error('Template letter not found'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ToastProvider>
            <MemoryRouter>
              <TemplateCard template={template} categoryLabel="Business" useTemplateLabel="Use Template" favoriteAddLabel="Add" favoriteRemoveLabel="Remove" />
            </MemoryRouter>
          </ToastProvider>
        </I18nProvider>
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /use template/i }))
    expect(await screen.findByText(/could not open this template/i)).toBeInTheDocument()
    create.mockRestore()
  })
})
