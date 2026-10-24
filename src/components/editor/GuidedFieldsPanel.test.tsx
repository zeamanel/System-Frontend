import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n'
import {
  GuidedFieldsPanel,
  ADDITIONAL_INSTRUCTIONS_FIELD_ID,
  isPartyFieldKey,
} from './GuidedFieldsPanel'
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

describe('isPartyFieldKey', () => {
  it('correctly identifies party and entity fields', () => {
    expect(isPartyFieldKey('party_one_name')).toBe(true)
    expect(isPartyFieldKey('party_two_name')).toBe(true)
    expect(isPartyFieldKey('party_a')).toBe(true)
    expect(isPartyFieldKey('party_b')).toBe(true)
    expect(isPartyFieldKey('lessor_name')).toBe(true)
    expect(isPartyFieldKey('lessee_name')).toBe(true)
    expect(isPartyFieldKey('tenant_name')).toBe(true)
    expect(isPartyFieldKey('landlord_name')).toBe(true)
    expect(isPartyFieldKey('buyer_name')).toBe(true)
    expect(isPartyFieldKey('seller_name')).toBe(true)
    expect(isPartyFieldKey('employer_name')).toBe(true)
    expect(isPartyFieldKey('employee_name')).toBe(true)
    expect(isPartyFieldKey('principal_name')).toBe(true)
    expect(isPartyFieldKey('agent_name')).toBe(true)
    expect(isPartyFieldKey('guarantor_name')).toBe(true)
    expect(isPartyFieldKey('applicant_name')).toBe(true)
  })

  it('rejects non-party attributes and metadata fields', () => {
    expect(isPartyFieldKey('property_address')).toBe(false)
    expect(isPartyFieldKey('property_type')).toBe(false)
    expect(isPartyFieldKey('monthly_rent_etb')).toBe(false)
    expect(isPartyFieldKey('effective_date')).toBe(false)
    expect(isPartyFieldKey('lease_duration')).toBe(false)
    expect(isPartyFieldKey('document_title')).toBe(false)
    expect(isPartyFieldKey('bank_name')).toBe(false)
    expect(isPartyFieldKey('')).toBe(false)
  })
})

describe('Inline Telegram ID Mapping & Repeatable Co-Party Slots', () => {
  it('loads connected Telegram profiles on mount and populates the select options', async () => {
    renderPanel()

    const select = await screen.findByTestId('party-telegram-select-tenant_name-0')
    expect(select).toBeInTheDocument()

    // Await profiles loaded from fixture vault
    await waitFor(() => {
      expect(screen.getByText(/Abebe Bikila \(ID: 7392\)/i)).toBeInTheDocument()
      expect(screen.getByText(/Almaz Kebede \(ID: 4815\)/i)).toBeInTheDocument()
    })
  })

  it('selects Telegram ID for primary slot, sets name, displays verified pill and unlinks', async () => {
    const onAnswerChange = vi.fn()
    const { user } = renderPanel({ onAnswerChange })

    const select = await screen.findByTestId('party-telegram-select-tenant_name-0')
    await waitFor(() => {
      expect(screen.getByText(/Abebe Bikila \(ID: 7392\)/i)).toBeInTheDocument()
    })

    // Select Abebe Bikila (7392)
    fireEvent.change(select, { target: { value: '7392' } })

    // Input is updated to Abebe Bikila
    expect(onAnswerChange).toHaveBeenCalledWith('tenant_name', 'Abebe Bikila')

    // Context is serialized into __party_context
    expect(onAnswerChange).toHaveBeenCalledWith('__party_context', expect.stringContaining('"qalId":"7392"'))

    // Verified pill is rendered
    const pill = await screen.findByTestId('party-telegram-pill-tenant_name-0')
    expect(pill).toBeInTheDocument()
    expect(pill).toHaveTextContent(/Abebe Bikila/i)
    expect(pill).toHaveTextContent(/ID: 7392/i)

    // Unlink button clears the profile
    const unlinkBtn = screen.getByTestId('unlink-party-telegram-tenant_name-0')
    await user.click(unlinkBtn)

    expect(screen.queryByTestId('party-telegram-pill-tenant_name-0')).toBeNull()
  })

  it('supports adding repeatable co-parties and combines their names into answers', async () => {
    const onAnswerChange = vi.fn()
    const { user } = renderPanel({
      answers: { tenant_name: 'Abebe Bikila' },
      onAnswerChange,
    })

    // Click [+ Add another party]
    const addBtn = screen.getByTestId('add-co-party-btn-tenant_name')
    await user.click(addBtn)

    // Co-party row #2 appears
    expect(screen.getByText(/Tenant Full Name #2/i)).toBeInTheDocument()
    const coPartyInput = screen.getByTestId('co-party-input-tenant_name-1')
    expect(coPartyInput).toBeInTheDocument()

    // Type in co-party name
    await user.type(coPartyInput, 'Kebede Chala')

    // Combined answer contains primary and co-party
    expect(onAnswerChange).toHaveBeenCalledWith('tenant_name', expect.stringContaining('Abebe Bikila, Kebede Chala'))

    // Remove co-party
    const removeBtn = screen.getByTestId('remove-co-party-btn-tenant_name-1')
    await user.click(removeBtn)

    expect(screen.queryByTestId('co-party-input-tenant_name-1')).toBeNull()
    expect(onAnswerChange).toHaveBeenCalledWith('tenant_name', 'Abebe Bikila')
  })

  it('serializes bound party profiles into __party_context when submitting onGenerate', async () => {
    const onGenerate = vi.fn()
    const { user } = renderPanel({
      answers: { tenant_name: 'Abebe Bikila' },
      onGenerate,
    })

    const select = await screen.findByTestId('party-telegram-select-tenant_name-0')
    await waitFor(() => {
      expect(screen.getByText(/Abebe Bikila \(ID: 7392\)/i)).toBeInTheDocument()
    })

    // Link Abebe Bikila to tenant_name
    fireEvent.change(select, { target: { value: '7392' } })

    const generateBtn = screen.getByRole('button', { name: /generate content/i })
    await user.click(generateBtn)

    expect(onGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_name: 'Abebe Bikila',
        __party_context: expect.stringContaining('"qalId":"7392"'),
      }),
    )
  })
})
