import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { PreferencesProvider } from '../../preferences'
import { GuidedFlowWizard } from './GuidedFlowWizard'
import type { TemplateDetail } from '../../lib/repositories'

const mockTemplate: TemplateDetail = {
  id: 'letter',
  documentTypeId: 'letter',
  title: 'Formal Letter',
  description: 'Write formal letters',
  category: 'business_finance',
  iconKey: 'document',
  questionCount: 2,
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
  preview: { summary: 'Write formal letters' },
  popularity: 80,
  questions: [
    { id: 'recipient', label: 'Who is this for?', required: true },
    { id: 'subject', label: 'What is the subject?', required: false },
  ],
}

function renderWizard(template = mockTemplate) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const onCancel = vi.fn()
  const onComplete = vi.fn()

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <PreferencesProvider>
          <MemoryRouter>
            <GuidedFlowWizard
              template={template}
              onCancel={onCancel}
              onComplete={onComplete}
            />
          </MemoryRouter>
        </PreferencesProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )

  return { onCancel, onComplete, ...utils }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('GuidedFlowWizard', () => {
  it('renders setup step and navigates to questions', () => {
    renderWizard()
    expect(screen.getByRole('heading', { name: 'Setup' })).toBeInTheDocument()
    expect(screen.getByLabelText(/document title/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Who is this for?')).toBeInTheDocument()
  })

  it('validates required questions before proceeding', () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText('Who is this for?')).toBeInTheDocument()

    // Try to advance without filling required answer
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getAllByText('Required').length).toBeGreaterThanOrEqual(2)

    // Fill answer and advance to second question
    const input = screen.getByLabelText('Who is this for?')
    fireEvent.change(input, { target: { value: 'Addis Ababa University' } })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText('What is the subject?')).toBeInTheDocument()
  })

  it('advances through review step to generation', async () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Answer Q1
    fireEvent.change(screen.getByLabelText('Who is this for?'), {
      target: { value: 'Ministry of Innovation' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Answer Q2 (finish questions)
    fireEvent.change(screen.getByLabelText('What is the subject?'), {
      target: { value: 'Grant Proposal' },
    })
    fireEvent.click(screen.getByRole('button', { name: /review answers/i }))

    // Verify Review step
    expect(screen.getByText(/review your information/i)).toBeInTheDocument()
    expect(screen.getByText('Ministry of Innovation')).toBeInTheDocument()
    expect(screen.getByText('Grant Proposal')).toBeInTheDocument()

    // Start generation
    const generateBtn = screen.getByRole('button', { name: /generate document draft/i })
    fireEvent.click(generateBtn)

    // Generation screen displayed
    await waitFor(() => {
      expect(screen.getByText(/ai document generator/i)).toBeInTheDocument()
    })
  })
})