import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n'
import { GuidedFieldsPanel, ADDITIONAL_INSTRUCTIONS_FIELD_ID } from './GuidedFieldsPanel'
import type { TemplateDetail } from '../../lib/repositories'

const mockTemplate: TemplateDetail = {
  id: 'template-test-1',
  slug: 'test-agreement',
  title: 'Test Agreement',
  description: 'Test contract description',
  category: 'legal_property',
  documentTypeId: 'agreement',
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
  popularity: 80,
  preview: {
    pageCount: 1,
    sampleSnippet: 'Agreement snippet',
  },
  questions: [
    {
      id: 'tenant_name',
      label: 'Tenant Full Name',
      type: 'text',
      required: true,
    },
    {
      id: 'rent_amount',
      label: 'Monthly Rent in ETB',
      type: 'text',
      required: false,
    },
    {
      id: 'special_terms',
      label: 'Special Additional Contractual Conditions and Clauses',
      type: 'text',
      required: false,
    },
  ],
}

function renderPanel(props: Partial<React.ComponentProps<typeof GuidedFieldsPanel>> = {}) {
  const defaultProps = {
    template: mockTemplate,
    answers: {},
    onAnswerChange: vi.fn(),
    language: 'en',
    onLanguageChange: vi.fn(),
    hasContent: false,
    generationPending: false,
    generationFailed: false,
    onGenerate: vi.fn(),
    outline: [],
    onOutlineSelect: vi.fn(),
    ...props,
  }

  return {
    user: userEvent.setup(),
    ...render(
      <I18nProvider>
        <GuidedFieldsPanel {...defaultProps} />
      </I18nProvider>,
    ),
    props: defaultProps,
  }
}

describe('GuidedFieldsPanel Independent Scroll Locking & Layout', () => {
  it('renders the fixed panel header, scrollable body, and pinned footer containers', () => {
    renderPanel()

    const panel = screen.getByTestId('guided-fields-panel')
    const header = screen.getByTestId('guided-fields-header')
    const body = screen.getByTestId('guided-fields-body')
    const footer = screen.getByTestId('guided-fields-footer')

    expect(panel).toBeInTheDocument()
    expect(header).toBeInTheDocument()
    expect(body).toBeInTheDocument()
    expect(footer).toBeInTheDocument()

    // Header contains the panel title and hint
    expect(header).toHaveTextContent(/DOCUMENT FIELDS/i)

    // Body contains dynamic questions
    expect(body).toHaveTextContent('Tenant Full Name')
    expect(body).toHaveTextContent('Monthly Rent in ETB')
    expect(body).toHaveTextContent('Special Additional Contractual Conditions and Clauses')

    // Footer contains Additional instructions, Language selector, and Action buttons
    expect(footer).toHaveTextContent(/Additional Details or Instructions/i)
    expect(footer).toHaveTextContent(/Language/i)
    expect(footer.querySelector('button')).toHaveTextContent(/Generate content/i)
  })

  it('renders children inside the scrollable body', () => {
    render(
      <I18nProvider>
        <GuidedFieldsPanel
          template={mockTemplate}
          answers={{}}
          onAnswerChange={vi.fn()}
          language="en"
          onLanguageChange={vi.fn()}
          hasContent={false}
          generationPending={false}
          generationFailed={false}
          onGenerate={vi.fn()}
          outline={[]}
          onOutlineSelect={vi.fn()}
        >
          <div data-testid="nested-auxiliary-panel">Auxiliary Refine Panel</div>
        </GuidedFieldsPanel>
      </I18nProvider>,
    )

    const body = screen.getByTestId('guided-fields-body')
    const child = screen.getByTestId('nested-auxiliary-panel')

    expect(body).toContainElement(child)
  })

  it('handles typing in dynamic questions and in the pinned additional instructions textarea', async () => {
    const onAnswerChange = vi.fn()
    const { user } = renderPanel({ onAnswerChange })

    const nameInput = screen.getByLabelText(/Tenant Full Name/i)
    await user.type(nameInput, 'Abebe Bikila')
    expect(onAnswerChange).toHaveBeenCalledWith('tenant_name', expect.stringContaining('A'))

    const instructions = screen.getByLabelText(/additional details or instructions/i)
    await user.type(instructions, 'Please include dual date headers')
    expect(onAnswerChange).toHaveBeenCalledWith(ADDITIONAL_INSTRUCTIONS_FIELD_ID, expect.stringContaining('P'))
  })

  it('validates required fields in the scrollable body before calling onGenerate in the pinned footer', async () => {
    const onGenerate = vi.fn()
    const { user } = renderPanel({ answers: {}, onGenerate })

    const generateBtn = screen.getByRole('button', { name: /generate content/i })
    await user.click(generateBtn)

    // Required field validation error is displayed
    expect(screen.getByText(/This field is required/i)).toBeInTheDocument()
    expect(onGenerate).not.toHaveBeenCalled()
  })

  it('allows generation when required fields are satisfied and triggers onGenerate', async () => {
    const onGenerate = vi.fn()
    const { user } = renderPanel({
      answers: { tenant_name: 'Almaz Ayana' },
      onGenerate,
    })

    const generateBtn = screen.getByRole('button', { name: /generate content/i })
    await user.click(generateBtn)

    expect(onGenerate).toHaveBeenCalledWith({ tenant_name: 'Almaz Ayana' })
  })
})
