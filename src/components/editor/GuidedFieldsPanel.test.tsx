import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
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
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <I18nProvider>
          <ToastProvider>
          <GuidedFieldsPanel {...defaultProps} />
          </ToastProvider>
        </I18nProvider>
      </QueryClientProvider>,
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
      <QueryClientProvider client={new QueryClient()}>
      <I18nProvider>
        <ToastProvider>
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
        </ToastProvider>
      </I18nProvider>
      </QueryClientProvider>,
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

    // Click [+ Add Party] in header
    const addBtn = screen.getByTestId('header-add-party-btn')
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

  it('toggles role dropdown menu on header add party button when multiple party roles exist', async () => {
    const multiPartyTemplate: TemplateDetail = {
      ...mockTemplate,
      id: 'multi-party-template',
      questions: [
        { id: 'seller_name', label: 'Seller Full Name', type: 'text', required: true },
        { id: 'buyer_name', label: 'Buyer Full Name', type: 'text', required: true },
        { id: 'price_amount', label: 'Total Price', type: 'text', required: false },
      ],
    }

    const onAnswerChange = vi.fn()
    const { user } = renderPanel({
      template: multiPartyTemplate,
      answers: { seller_name: 'Abebe Bikila', buyer_name: 'Chala Desta' },
      onAnswerChange,
    })

    const headerAddBtn = screen.getByTestId('header-add-party-btn')
    expect(headerAddBtn).toBeInTheDocument()

    // Dropdown is not visible initially
    expect(screen.queryByTestId('header-add-party-menu')).toBeNull()

    // Click header add button to open dropdown
    await user.click(headerAddBtn)

    const menu = screen.getByTestId('header-add-party-menu')
    expect(menu).toBeInTheDocument()

    // Select Seller from dropdown
    const addSellerBtn = screen.getByTestId('add-co-party-btn-seller_name')
    expect(addSellerBtn).toHaveTextContent(/Seller Full Name/i)
    await user.click(addSellerBtn)

    // Co-seller row #2 appears
    expect(screen.getByText(/Seller Full Name #2/i)).toBeInTheDocument()
    expect(screen.getByTestId('co-party-input-seller_name-1')).toBeInTheDocument()

    // Menu closes after selection
    expect(screen.queryByTestId('header-add-party-menu')).toBeNull()
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

  it('renders a compact single-line header without hint and edge Map dropdown inside input container', async () => {
    renderPanel()

    // Header has title and refresh button, but no subtitle hint
    const header = screen.getByTestId('guided-fields-header')
    expect(header).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /document fields/i })).toBeInTheDocument()
    expect(screen.getByTestId('refresh-telegram-vault-btn')).toBeInTheDocument()
    expect(screen.queryByText(/answers drive generation/i)).toBeNull()

    // Select dropdown is positioned inside input container with 'Map' placeholder
    const select = await screen.findByTestId('party-telegram-select-tenant_name-0')
    expect(select.closest('.guided-field__input-with-addon')).not.toBeNull()
    expect(select).toHaveTextContent(/Map/i)
  })

  it('SEC-12: New customer starts a fresh document and never clears the open one', async () => {
    const onAnswerChange = vi.fn()
    const onNewCustomer = vi.fn()
    window.localStorage.setItem('docuA4.partyMemory.v1', '{"employer":["Previous Customer PLC"]}')
    const { user } = renderPanel({
      answers: {
        tenant_name: 'Abebe Bikila',
        rent_amount: '5000',
        [ADDITIONAL_INSTRUCTIONS_FIELD_ID]: 'Add stamp',
      },
      onAnswerChange,
      onNewCustomer,
    })

    await user.click(screen.getByTestId('new-customer-reset-btn'))

    expect(onNewCustomer).toHaveBeenCalledTimes(1)
    // The open (saved) document's answers are left intact.
    expect(onAnswerChange).not.toHaveBeenCalled()
    // Previous customer's autocomplete suggestions are forgotten.
    expect(window.localStorage.getItem('docuA4.partyMemory.v1')).toBeNull()
  })

  it('offers the organization name on organization fields, filled only on tap', async () => {
    window.localStorage.clear()
    const onAnswerChange = vi.fn()
    renderPanel({
      onAnswerChange,
      template: {
        ...mockTemplate,
        questions: [{ id: 'employer_name', label: 'Employer', type: 'text', required: true }],
      },
    })
    const chip = await screen.findByRole('button', { name: /from your organization: tadesse print works$/i })
    expect(onAnswerChange).not.toHaveBeenCalled()
    fireEvent.click(chip)
    expect(onAnswerChange).toHaveBeenCalledWith('employer_name', 'Tadesse Print Works')
  })

  describe('saved customers', () => {
    const saleTemplate: TemplateDetail = {
      ...mockTemplate,
      questions: [
        { id: 'seller_name', label: 'Seller', type: 'text', required: true },
        { id: 'buyer_name', label: 'Buyer', type: 'text', required: true },
        {
          id: 'buyer_phone',
          label: 'Buyer phone',
          type: 'text',
          required: false,
        },
      ],
    };

    it('saves a customer only on request, then fills it into the chosen party', async () => {
      window.localStorage.clear();
      const onAnswerChange = vi.fn();
      const { rerender, user } = renderPanel({
        template: saleTemplate,
        onAnswerChange,
        answers: { buyer_name: 'Dawit Haile', buyer_phone: '0911223344' },
      });

      // Nothing is saved until the user asks.
      expect(
        JSON.parse(
          window.localStorage.getItem('docuA4.fixture.customers') ?? '[]',
        ),
      ).toEqual([]);
      const saveButtons = await screen.findAllByTestId('save-customer');
      expect(saveButtons).toHaveLength(1);
      await user.click(saveButtons[0]);
      await waitFor(() => {
        const saved = JSON.parse(
          window.localStorage.getItem('docuA4.fixture.customers') ?? '[]',
        ) as Array<{ name: string; phone: string }>;
        expect(saved).toMatchObject([
          { name: 'Dawit Haile', phone: '0911223344' },
        ]);
      });
      // Already saved, nothing new to offer.
      await waitFor(() =>
        expect(screen.queryByTestId('save-customer')).not.toBeInTheDocument(),
      );

      // Use it for the seller on a fresh form.
      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <I18nProvider>
            <ToastProvider>
              <GuidedFieldsPanel
                template={saleTemplate}
                answers={{}}
                onAnswerChange={onAnswerChange}
                language='en'
                onLanguageChange={vi.fn()}
                hasContent={false}
                generationPending={false}
                generationFailed={false}
                onGenerate={vi.fn()}
                outline={[]}
                onOutlineSelect={vi.fn()}
              />
            </ToastProvider>
          </I18nProvider>
        </QueryClientProvider>,
      );
      await user.click(
        screen.getByRole('button', { name: /saved customers/i }),
      );
      const row = await screen.findByTestId('customer-row');
      expect(row).toHaveTextContent('Dawit Haile');
      await user.selectOptions(
        screen.getByTestId('customer-target'),
        'buyer_name',
      );
      onAnswerChange.mockClear();
      await user.click(screen.getByRole('button', { name: 'Use' }));
      expect(onAnswerChange).toHaveBeenCalledWith('buyer_name', 'Dawit Haile');
      expect(onAnswerChange).toHaveBeenCalledWith('buyer_phone', '0911223344');
      expect(onAnswerChange).not.toHaveBeenCalledWith(
        'seller_name',
        expect.anything(),
      );
    });

    it('searches and forgets after confirmation', async () => {
      window.localStorage.setItem(
        'docuA4.fixture.customers',
        JSON.stringify(
          ['Abebe Kebede', 'Sara Haile'].map((name, index) => ({
            id: `c${index}`,
            name,
            tin: '',
            phone: '',
            email: '',
            address: '',
            shared: false,
            lastUsedAt: new Date(2026, 9, 26 - index).toISOString(),
            expiresAt: new Date(2027, 9, 26).toISOString(),
          })),
        ),
      );
      const { user } = renderPanel({ template: saleTemplate });
      await user.click(
        screen.getByRole('button', { name: /saved customers/i }),
      );
      expect(await screen.findAllByTestId('customer-row')).toHaveLength(2);

      await user.type(screen.getByTestId('customer-search'), 'sara');
      await waitFor(() =>
        expect(screen.getAllByTestId('customer-row')).toHaveLength(1),
      );
      expect(screen.getByTestId('customer-row')).toHaveTextContent(
        'Sara Haile',
      );

      await user.click(screen.getByRole('button', { name: 'Forget' }));
      expect(screen.getByText('Forget Sara Haile?')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Keep' }));
      expect(
        JSON.parse(
          window.localStorage.getItem('docuA4.fixture.customers') ?? '[]',
        ),
      ).toHaveLength(2);

      await user.click(screen.getByRole('button', { name: 'Forget' }));
      await user.click(screen.getAllByRole('button', { name: 'Forget' })[0]);
      await waitFor(() => {
        const left = JSON.parse(
          window.localStorage.getItem('docuA4.fixture.customers') ?? '[]',
        ) as Array<{ name: string }>;
        expect(left.map((c) => c.name)).toEqual(['Abebe Kebede']);
      });
    });

    it('adds the customer to the instructions for prompt-only documents', async () => {
      window.localStorage.setItem(
        'docuA4.fixture.customers',
        JSON.stringify([
          {
            id: 'c1',
            name: 'Abebe Kebede',
            tin: '0012',
            phone: '0911',
            email: '',
            address: 'Bole',
            shared: false,
            lastUsedAt: new Date().toISOString(),
            expiresAt: new Date(2027, 9, 26).toISOString(),
          },
        ]),
      );
      const onAnswerChange = vi.fn();
      const { user } = renderPanel({
        template: { ...mockTemplate, questions: [] },
        onAnswerChange,
        answers: { additional_instructions: 'Make it formal.' },
      });
      await user.click(
        screen.getByRole('button', { name: /saved customers/i }),
      );
      await user.click(
        await screen.findByRole('button', { name: 'Add to instructions' }),
      );
      expect(onAnswerChange).toHaveBeenCalledWith(
        ADDITIONAL_INSTRUCTIONS_FIELD_ID,
        'Make it formal.\nCustomer: Abebe Kebede, TIN 0012, 0911, Bole',
      );
    });
  });
})
