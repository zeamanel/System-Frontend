import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { PreferencesProvider } from '../../preferences'
import { saveReusableAnswers } from '../../lib/saved-answers/party-memory'
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

  it('offers Ethiopian legal smart-input suggestions while answering questions', () => {
    const smartTemplate: TemplateDetail = {
      ...mockTemplate,
      id: 'leave-request',
      questionCount: 2,
      questions: [
        { id: 'dates', label: 'From which date to which date?', required: true },
        { id: 'rent', label: 'Monthly rent amount?', required: false },
      ],
    }
    renderWizard(smartTemplate)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    // Date: 16/10/26 → legal Gregorian wording with the ዓ.ም. hint on hover.
    const dateField = screen.getByLabelText('From which date to which date?')
    fireEvent.change(dateField, { target: { value: '16/10/26' } })
    const dateChip = screen.getByRole('button', { name: /16 October 2026/i })
    expect(dateChip).toHaveAttribute('title', '16 October 2026 (ጥቅምት 6 ቀን 2019 ዓ.ም.)')
    fireEvent.click(dateChip)
    expect((dateField as HTMLInputElement).value).toBe('16 October 2026')

    // Currency: 150000 → tamper-proof Birr words in parentheses.
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    const rentField = screen.getByLabelText('Monthly rent amount?')
    fireEvent.change(rentField, { target: { value: '150000' } })
    fireEvent.click(screen.getByRole('button', { name: /ETB 150,000/i }))
    expect((rentField as HTMLInputElement).value).toBe(
      'ETB 150,000 (One Hundred Fifty Thousand Birr)',
    )
  })

  it('quick-fill mode shows every question on one screen and generates directly', async () => {
    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: /next/i })) // setup → questions

    fireEvent.click(screen.getByRole('button', { name: /all questions \(2\)/i }))

    // All template questions render on a single screen.
    expect(screen.getByLabelText(/who is this for\?/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/what is the subject\?/i)).toBeInTheDocument()

    // Required validation fires for every missing required field at once.
    fireEvent.click(screen.getByRole('button', { name: /generate document draft/i }))
    expect(screen.getAllByText('Required').length).toBeGreaterThanOrEqual(2)

    // Fill the required field and generate — straight to the generating
    // step with zero per-question Next clicks.
    fireEvent.change(screen.getByLabelText(/who is this for\?/i), {
      target: { value: 'Ministry of Trade' },
    })
    fireEvent.click(screen.getByRole('button', { name: /generate document draft/i }))
    await waitFor(() => {
      expect(screen.getByText(/ai document generator/i)).toBeInTheDocument()
    })
  })

  it('surfaces previously saved party details as one-click quick-fill chips', () => {
    saveReusableAnswers({ 'employer-name': 'Sunshine PLC' })
    const partyTemplate: TemplateDetail = {
      ...mockTemplate,
      id: 'employment-contract',
      questionCount: 1,
      questions: [{ id: 'employer-name', label: 'Employer name?', required: true }],
    }
    renderWizard(partyTemplate)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))

    const field = screen.getByLabelText('Employer name?')
    fireEvent.click(screen.getByRole('button', { name: /recent: sunshine plc/i }))
    expect((field as HTMLInputElement).value).toBe('Sunshine PLC')
  })
})