import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import type { DocumentDetailRecord, TemplateDetail } from '../../lib/repositories'
import { EditorWorkspace } from './EditorWorkspace'

const repos = getRepositories()

function renderWorkspace(doc: DocumentDetailRecord, template: TemplateDetail | null) {
  // Wide viewport so both side panels start expanded (role queries exclude
  // display:none subtrees, and panels auto-collapse below the breakpoints).
  window.innerWidth = 1600
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onBack = vi.fn()
  const refresh = vi.fn(async () => repos.documents.get(doc.id))
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ToastProvider>
          <EditorWorkspace document={doc} template={template} onBack={onBack} refresh={refresh} />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  return { onBack, refresh, ...utils }
}

async function loadDocument(id: string): Promise<{ doc: DocumentDetailRecord; template: TemplateDetail | null }> {
  const doc = await repos.documents.get(id)
  if (!doc) throw new Error(`document ${id} missing`)
  const template = doc.templateId ? await repos.templates.get(doc.templateId, 'en') : null
  return { doc, template }
}

const saveStatus = () => screen.getByTestId('editor-save-status')

async function editFirstParagraph(): Promise<void> {
  const editable = document.querySelector<HTMLElement>('[data-block-id]')
  if (!editable) throw new Error('no editable block')
  const surface = editable.querySelector<HTMLElement>('[data-block-id]') ?? editable
  surface.focus()
  fireEvent.input(surface, { target: { innerHTML: 'Edited by test' } })
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  window.sessionStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('EditorWorkspace', () => {
  it('renders toolbar, guided fields from the template schema and the A4 canvas', async () => {
    const { doc, template } = await loadDocument('doc-fixture-1')
    renderWorkspace(doc, template)

    expect(await screen.findByTestId('editor-title-input')).toHaveValue(doc.title)
    // Guided fields come from the rental-agreement template's schema.
    expect(screen.getByText(/which property is rented/i)).toBeInTheDocument()
    // Legacy plain-text content renders as blocks on the page (also mirrored
    // in the sections outline).
    expect(screen.getAllByText(/residential lease agreement/i).length).toBeGreaterThan(0)
    // Right panel formatting controls.
    expect(screen.getByLabelText(/bold/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Page 1')).toBeInTheDocument()
  })

  it('marks the document unsaved on edit, autosaves, and clears the buffer', async () => {
    vi.useFakeTimers()
    const { doc, template } = await loadDocument('doc-fixture-1')
    renderWorkspace(doc, template)
    // Note: no async findBy* queries under fake timers — render is synchronous.
    expect(screen.getByTestId('editor-title-input')).toHaveValue(doc.title)

    await editFirstParagraph()
    expect(saveStatus().dataset.status).toBe('unsaved')
    expect(window.localStorage.getItem(`docuA4.editor.buffer.${doc.id}`)).toContain(
      'Edited by test',
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1800)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(saveStatus().dataset.status).toBe('saved')
    expect(window.localStorage.getItem(`docuA4.editor.buffer.${doc.id}`)).toBeNull()

    const stored = await repos.documents.get(doc.id)
    expect(stored?.content).toContain('Edited by test')
  })

  it('shows a truthful save failure, keeps the buffer, and recovers on retry', async () => {
    const { doc, template } = await loadDocument('doc-fixture-1')
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')

    window.sessionStorage.setItem('docuA4.test.documentSaveFail', 'true')
    await editFirstParagraph()
    fireEvent.click(screen.getByRole('button', { name: /save|retry save/i }))

    await waitFor(() => expect(saveStatus().dataset.status).toBe('error'))
    expect(screen.getByText('Save failed')).toBeInTheDocument()
    expect(window.localStorage.getItem(`docuA4.editor.buffer.${doc.id}`)).toContain(
      'Edited by test',
    )

    window.sessionStorage.removeItem('docuA4.test.documentSaveFail')
    fireEvent.click(screen.getByRole('button', { name: /retry save/i }))
    await waitFor(() => expect(saveStatus().dataset.status).toBe('saved'))
    expect(window.localStorage.getItem(`docuA4.editor.buffer.${doc.id}`)).toBeNull()
  })

  it('detects concurrent edits as a conflict and can overwrite', async () => {
    const { doc, template } = await loadDocument('doc-fixture-1')
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')

    // Another session saves the same document while the editor is open.
    await repos.documents.update(doc.id, { content: 'conflicting content' })

    await editFirstParagraph()
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(saveStatus().dataset.status).toBe('conflict'))
    expect(screen.getByText('Changed elsewhere')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /overwrite/i }))
    await waitFor(() => expect(saveStatus().dataset.status).toBe('saved'))
    const stored = await repos.documents.get(doc.id)
    expect(stored?.content).toContain('Edited by test')
  })

  it('validates required fields before generation and preserves answers across settings changes', async () => {
    // A document with no content yet: generation starts from the fields.
    const created = await repos.documents.create({
      title: 'Blank letter',
      templateId: 'letter',
      language: 'en',
      content: '',
    })
    const { doc, template } = await loadDocument(created.id)
    renderWorkspace(doc, template)

    const recipientField = await screen.findByLabelText(/letter addressed to/i)
    fireEvent.click(screen.getByRole('button', { name: /generate content/i }))
    expect(screen.getAllByText('This field is required.').length).toBeGreaterThan(0)

    // Fill answers, then change the language — answers must be preserved.
    fireEvent.change(recipientField, { target: { value: 'Ministry of Trade' } })
    const subjectField = screen.getByLabelText(/subject of the letter/i)
    fireEvent.change(subjectField, { target: { value: 'License Inquiry' } })
    const pointsField = screen.getByLabelText(/points should the letter cover/i)
    fireEvent.change(pointsField, { target: { value: '- renew the license' } })
    fireEvent.change(screen.getByLabelText(/document language|የሰነድ ቋንቋ|language/i), {
      target: { value: 'am' },
    })
    expect((recipientField as HTMLInputElement).value).toBe('Ministry of Trade')
    expect((subjectField as HTMLInputElement).value).toBe('License Inquiry')

    // Generation starts once required fields are present.
    fireEvent.click(screen.getByRole('button', { name: /generate content/i }))
    await waitFor(() => expect(screen.getByTestId('editor-generating')).toBeInTheDocument(), {
      timeout: 2500,
    })
    // Completed in-place generation replaces the empty canvas with content.
    await waitFor(
      () => expect(screen.getAllByText(/license inquiry/i).length).toBeGreaterThan(0),
      { timeout: 4000 },
    )
  })

  it('regenerates existing content after an explicit confirmation, keeping answers', async () => {
    const created = await repos.documents.create({
      title: 'Regen letter',
      templateId: 'letter',
      language: 'en',
      answers: {
        recipient: 'Old recipient',
        subject: 'Old subject',
        'key-points': '- old point',
      },
      content: 'Original content that regeneration replaces.',
    })
    const { doc, template } = await loadDocument(created.id)
    renderWorkspace(doc, template)
    expect(
      (await screen.findAllByText('Original content that regeneration replaces.')).length,
    ).toBeGreaterThan(0)

    const recipientField = screen.getByLabelText(/letter addressed to/i)
    fireEvent.change(recipientField, { target: { value: 'New recipient' } })

    fireEvent.click(screen.getByRole('button', { name: /regenerate content/i }))
    // Content exists → explicit confirmation required.
    fireEvent.click(screen.getByRole('button', { name: /yes, regenerate/i }))

    await waitFor(() => expect(screen.getAllByText(/new recipient/i).length).toBeGreaterThan(0), {
      timeout: 4000,
    })
    // Answers stay in the form after regeneration.
    expect((recipientField as HTMLInputElement).value).toBe('New recipient')
  })

  it('flushes the save and opens the browser print workflow', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    const { doc, template } = await loadDocument('doc-fixture-1')
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')

    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    // Print waits one tick so pending field edits render first.
    await waitFor(() => expect(printSpy).toHaveBeenCalled())
  })

  it('reports server PDF export honestly when the backend is missing', async () => {
    const { doc, template } = await loadDocument('doc-fixture-1')
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')

    fireEvent.click(screen.getByRole('button', { name: /^export$/i }))
    fireEvent.click(screen.getByRole('button', { name: /pdf \(server-rendered\)/i }))

    const error = await screen.findByTestId('export-error')
    expect(error.textContent).toMatch(/backend/i)
    // The honest browser path remains available.
    expect(screen.getByRole('button', { name: /print \/ save as pdf/i })).toBeInTheDocument()
  })

  it('recovers unsaved changes from the local buffer on reload', async () => {
    const { doc, template } = await loadDocument('doc-fixture-1')
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')
    await editFirstParagraph()

    // Simulate a reload: fresh editor reading the same stored document.
    const fresh = await repos.documents.get(doc.id)
    renderWorkspace(fresh!, template)
    expect(await screen.findByText(/recovered unsaved changes/i)).toBeInTheDocument()
    expect((await screen.findAllByText('Edited by test')).length).toBeGreaterThan(0)
  })

  it('renders in-paper labels in the document language while the chrome stays in the UI locale', async () => {
    const created = await repos.documents.create({
      title: 'Amharic letter',
      templateId: 'letter',
      language: 'am',
      content: '',
    })
    const { doc, template } = await loadDocument(created.id)
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')

    // The page footer inside the A4 paper follows the document language
    // (am.json: "ገጽ {current} ከ {total}") even though the UI locale is en…
    expect(screen.getByText('ገጽ 1 ከ 1')).toBeInTheDocument()
    // …while the canvas chrome (page aria label, zoom toolbar) stays in the
    // workspace UI locale.
    expect(screen.getByLabelText('Page 1')).toBeInTheDocument()
    expect(screen.getByRole('toolbar', { name: 'Zoom' })).toBeInTheDocument()
  })

  it('syncs an edited guided-field answer onto the A4 canvas once typing pauses, with Undo', async () => {
    const created = await repos.documents.create({
      title: 'Party fix',
      templateId: 'rental-agreement',
      language: 'en',
      answers: { property: 'Bole Tower apartment 4B' },
      content:
        'The landlord rents the premises known as Bole Tower apartment 4B to the tenant for 12 months.',
    })
    const { doc, template } = await loadDocument(created.id)
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')

    expect(screen.getAllByText(/Bole Tower apartment 4B/).length).toBeGreaterThan(0)

    fireEvent.change(screen.getByLabelText(/which property is rented/i), {
      target: { value: 'Bole Tower flat 5C' },
    })

    // Carried into the text after the typing pause — no regeneration involved.
    await waitFor(() => expect(screen.getAllByText(/Bole Tower flat 5C/).length).toBeGreaterThan(0), {
      timeout: 3000,
    })
    expect(screen.queryByText(/Bole Tower apartment 4B/)).not.toBeInTheDocument()

    // The change is reported in the assistant panel and can be undone.
    fireEvent.click(screen.getByTestId('editor-tab-assistant'))
    const report = await screen.findByTestId('assistant-field-sync')
    expect(report).toHaveTextContent('in 1 place')
    fireEvent.click(within(report).getByRole('button', { name: /undo/i }))
    await waitFor(() =>
      expect(screen.getAllByText(/Bole Tower apartment 4B/).length).toBeGreaterThan(0),
    )
  })

  it('select-all-and-retype replaces the whole previous value, not a fragment', async () => {
    const created = await repos.documents.create({
      title: 'Retype',
      templateId: 'rental-agreement',
      language: 'en',
      answers: { property: 'Bole Tower apartment 4B' },
      content: 'The premises known as Bole Tower apartment 4B are rented.',
    })
    const { doc, template } = await loadDocument(created.id)
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')
    const field = screen.getByLabelText(/which property is rented/i)

    // Keystroke by keystroke, as a typist would after selecting the old text.
    for (const value of ['K', 'Ka', 'Kaz', 'Kazanchis house 12']) {
      fireEvent.change(field, { target: { value } })
    }

    await waitFor(() => expect(screen.getAllByText(/Kazanchis house 12/).length).toBeGreaterThan(0), {
      timeout: 3000,
    })
    expect(screen.queryByText(/premises known as K are/)).not.toBeInTheDocument()
  })

  it('offers and applies a legal Ethiopian date suggestion chip', async () => {
    const created = await repos.documents.create({
      title: 'Leave dates',
      templateId: 'leave-request',
      language: 'en',
      content: 'Annual leave request from the employee.',
    })
    const { doc, template } = await loadDocument(created.id)
    renderWorkspace(doc, template)
    const dateField = await screen.findByLabelText(/from which date to which date/i)

    fireEvent.change(dateField, { target: { value: '16/10/26' } })

    const chip = screen.getByRole('button', { name: /16 October 2026/i })
    expect(chip).toHaveAttribute('title', '16 October 2026 (ጥቅምት 6 ቀን 2019 ዓ.ም.)')

    fireEvent.click(chip)

    expect((dateField as HTMLInputElement).value).toBe('16 October 2026')
    // The chip disappears once its suggestion has been applied.
    expect(screen.queryByRole('button', { name: /16 October 2026/i })).not.toBeInTheDocument()
  })

  it('applies density presets and the letterhead margin toggle from the format panel', async () => {
    const { doc, template } = await loadDocument('doc-fixture-1')
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')

    const fontSize = screen.getByTestId('font-size-value')
    const topMargin = screen.getByLabelText('Top') as HTMLInputElement
    expect(fontSize).toHaveTextContent('11pt')
    expect(topMargin.value).toBe('20')

    fireEvent.click(screen.getByRole('button', { name: /compact/i }))
    expect(fontSize).toHaveTextContent('10pt')
    expect(topMargin.value).toBe('15')

    const letterhead = screen.getByRole('button', { name: /letterhead/i })
    expect(letterhead).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(letterhead)
    expect(topMargin.value).toBe('38')
    expect(letterhead).toHaveAttribute('aria-pressed', 'true')
    // Toggling again returns to the standard 20mm top margin.
    fireEvent.click(letterhead)
    expect(topMargin.value).toBe('20')
    expect(letterhead).toHaveAttribute('aria-pressed', 'false')
  })

  it('refines one block surgically with a preview, apply, and discard', async () => {
    const created = await repos.documents.create({
      title: 'Refine target',
      templateId: 'rental-agreement',
      language: 'en',
      content:
        'LEASE TERMS\n\nThe tenant will pay 35,000 birr every month.\n\nThe landlord keeps the deposit safe.',
    })
    const { doc, template } = await loadDocument(created.id)
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')

    // Deterministic blocks: all-caps heading + two paragraphs.
    const blockEls = () => Array.from(document.querySelectorAll('.doc-block[data-block-id]'))
    expect(blockEls().length).toBe(3)
    const before = blockEls().map((el) => el.textContent)

    // Focus the middle paragraph on the A4 canvas.
    const middle = blockEls()[1]
    const surface =
      middle.querySelector<HTMLElement>('[data-block-id]') ?? (middle as HTMLElement)
    fireEvent.focus(surface)

    // Non-destructive preview: the proposal appears, the canvas is untouched.
    fireEvent.click(screen.getByRole('button', { name: /formalize/i }))
    const preview = await screen.findByTestId('editor-refine-preview')
    expect(preview.innerHTML).toContain('shall pay')
    expect(blockEls()[1].textContent).toContain('will pay')

    // Apply: only the focused block changes; siblings stay byte-identical.
    fireEvent.click(screen.getByRole('button', { name: /apply to block/i }))
    await waitFor(() => expect(blockEls()[1].textContent).toContain('shall pay'))
    expect(blockEls()[1].textContent).toContain('35,000')
    expect(blockEls()[1].textContent).not.toContain('will pay')
    const after = blockEls().map((el) => el.textContent)
    expect(after[0]).toBe(before[0])
    expect(after[2]).toBe(before[2])

    // Discard: a second proposal is dismissed without touching the block.
    fireEvent.change(screen.getByPlaceholderText(/add a 5-day notice/i), {
      target: { value: 'add 10% late fee' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^refine block$/i }))
    const secondPreview = await screen.findByTestId('editor-refine-preview')
    expect(secondPreview.innerHTML).toContain('late fee')
    fireEvent.click(screen.getByRole('button', { name: /discard/i }))
    await waitFor(() =>
      expect(screen.queryByTestId('editor-refine-preview')).not.toBeInTheDocument(),
    )
    expect(blockEls()[1].textContent).not.toContain('late fee')
    expect(blockEls()[1].textContent).toContain('shall pay')
  })

  it('toggles bilingual side-by-side mode, edits the secondary column, and fills translation', async () => {
    const { doc, template } = await loadDocument('doc-fixture-1')
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')

    // Initially, canvas blocks are single-column (no bilingual rows).
    expect(document.querySelector('.doc-bilingual-row')).toBeNull()

    // Toggle bilingual parallel view in FormatPanel Page Setup.
    const bilingualToggle = screen.getByLabelText(/bilingual side-by-side/i)
    expect(bilingualToggle).not.toBeChecked()
    fireEvent.click(bilingualToggle)

    // Parallel columns now render across the A4 canvas.
    await waitFor(() => {
      expect(document.querySelector('.doc-bilingual-row')).toBeInTheDocument()
    })
    expect(document.querySelector('.doc-bilingual-col--primary')).toBeInTheDocument()
    const secondaryCol = document.querySelector<HTMLElement>('.doc-bilingual-col--secondary')
    expect(secondaryCol).toBeInTheDocument()

    // Edit the secondary column directly.
    const secondaryEditable = document.querySelector<HTMLElement>(
      '[data-bilingual-secondary="true"]',
    )
    expect(secondaryEditable).toBeInTheDocument()
    if (!secondaryEditable) throw new Error('missing secondary editable surface')

    secondaryEditable.focus()
    fireEvent.input(secondaryEditable, {
      target: { innerHTML: 'Parallel translation entered by user' },
    })
    expect(secondaryEditable.textContent).toContain('Parallel translation entered by user')

    // Refine panel shows the one-click translation fill button when bilingual mode is active.
    const fillButton = screen.getByRole('button', { name: /fill second column translation/i })
    expect(fillButton).toBeInTheDocument()

    fireEvent.click(fillButton)
    await waitFor(() => {
      // refineBlockContent fills secondaryHtml for the active block.
      expect((secondaryEditable.textContent ?? '').length).toBeGreaterThan(0)
    })
  })

  it('renders always-available additional details textarea and includes it in generated content', async () => {
    const created = await repos.documents.create({
      title: 'Additional details target',
      templateId: 'letter',
      language: 'en',
      content: '',
    })
    const { doc, template } = await loadDocument(created.id)
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')

    // Find the additional instructions field
    const additionalField = screen.getByLabelText(/additional details or instructions/i)
    expect(additionalField).toBeInTheDocument()

    // Fill required fields + additional instructions
    fireEvent.change(screen.getByLabelText(/letter addressed to/i), {
      target: { value: 'Revenue Authority' },
    })
    fireEvent.change(screen.getByLabelText(/subject of the letter/i), {
      target: { value: 'Tax Clearance Certificate' },
    })
    fireEvent.change(screen.getByLabelText(/points should the letter cover/i), {
      target: { value: 'All audit reports submitted' },
    })
    fireEvent.change(additionalField, {
      target: { value: 'TIN number 0012345678 and receipt batch #42' },
    })

    // Click generate
    fireEvent.click(screen.getByRole('button', { name: /generate content/i }))
    await waitFor(() => expect(screen.getByTestId('editor-generating')).toBeInTheDocument(), {
      timeout: 2500,
    })

    // The generated document incorporates the additional instructions
    await waitFor(
      () => {
        const matching = screen.getAllByText(/TIN number 0012345678/i)
        expect(matching.length).toBeGreaterThan(0)
      },
      { timeout: 4000 },
    )
  })

  it('drafts and inserts a new clause when no block is selected in BlockRefinePanel', async () => {
    const created = await repos.documents.create({
      title: 'New clause draft',
      templateId: 'rental-agreement',
      language: 'en',
      content:
        'RENTAL TERMS\n\nThe tenant will pay 20,000 birr every month.',
    })
    const { doc, template } = await loadDocument(created.id)
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')

    // Initially no block is selected; the refine panel prompt is available with "Draft clause"
    const input = screen.getByPlaceholderText(/e\.g\. write a late payment penalty clause/i)
    expect(input).toBeInTheDocument()
    const draftButton = screen.getByRole('button', { name: /draft clause/i })
    expect(draftButton).toBeInTheDocument()

    // Type new clause instructions
    fireEvent.change(input, {
      target: { value: 'Security deposit will pay 40,000 birr upon signing' },
    })
    fireEvent.click(draftButton)

    // The proposal appears in the preview
    const preview = await screen.findByTestId('editor-refine-preview')
    expect(preview.innerHTML).toContain('shall pay')

    // Click Apply to insert the new clause into the document
    fireEvent.click(screen.getByRole('button', { name: /apply to block/i }))

    // Canvas now contains the newly inserted clause
    await waitFor(() => {
      expect(screen.getAllByText(/40,000 birr upon signing/i).length).toBeGreaterThan(0)
    })
  })

  it('toggles page orientation between portrait and landscape from the format panel', async () => {
    const { doc, template } = await loadDocument('doc-fixture-1')
    renderWorkspace(doc, template)
    await screen.findByTestId('editor-title-input')

    // Initially portrait
    const sheet = document.querySelector<HTMLElement>('.a4-sheet')
    expect(sheet).toBeInTheDocument()
    expect(sheet?.dataset.orientation).toBe('portrait')
    expect(sheet?.classList.contains('a4-sheet--landscape')).toBe(false)

    // Find and click Landscape button in FormatPanel
    const landscapeButton = screen.getByRole('button', { name: /^Landscape$/i })
    expect(landscapeButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(landscapeButton)

    await waitFor(() => {
      expect(sheet?.dataset.orientation).toBe('landscape')
      expect(sheet?.classList.contains('a4-sheet--landscape')).toBe(true)
    })
    expect(landscapeButton).toHaveAttribute('aria-pressed', 'true')

    // Click Portrait button
    const portraitButton = screen.getByRole('button', { name: /^Portrait$/i })
    fireEvent.click(portraitButton)

    await waitFor(() => {
      expect(sheet?.dataset.orientation).toBe('portrait')
      expect(sheet?.classList.contains('a4-sheet--landscape')).toBe(false)
    })
    expect(portraitButton).toHaveAttribute('aria-pressed', 'true')
  })


  it('opens prompt-only blank document without party inputs and generates content from prompt', async () => {
    const created = await repos.documents.create({
      title: 'Vehicle Sale Agreement',
      templateId: undefined,
      language: 'en',
    })
    const { doc } = await loadDocument(created.id)
    renderWorkspace(doc, null)
    await screen.findByTestId('editor-title-input')

    // Verify there are no fixed party / question fields
    expect(screen.queryByLabelText(/first party/i)).toBeNull()
    expect(screen.queryByLabelText(/second party/i)).toBeNull()

    // The Additional details or instructions textarea is present and 5 rows tall
    const promptInput = screen.getByLabelText(/additional details or instructions/i)
    expect(promptInput).toBeInTheDocument()
    expect(promptInput).toHaveAttribute('rows', '5')

    // Type the prompt into the textarea
    fireEvent.change(promptInput, {
      target: {
        value:
          'Vehicle Sale Agreement\nThis Vehicle Sale Agreement is made between Abebe and Kebede for 900,000 Birr.\nThe vehicle is a 2022 Toyota Corolla.',
      },
    })

    // Click Generate content
    const generateButton = screen.getByRole('button', { name: /generate content/i })
    expect(generateButton).toBeEnabled()
    fireEvent.click(generateButton)

    // The generated document renders onto the canvas
    await waitFor(
      () => {
        expect(screen.getAllByText(/Signatures/i).length).toBeGreaterThan(0)
      },
      { timeout: 4000 },
    )
    const canvas = document.querySelector('.doc-pages')
    expect(canvas?.textContent).toContain('900,000 Birr')
    expect(canvas?.textContent).toContain('2022 Toyota Corolla')
  })

  it('connects to phone via Telegram bridge, applies profile into answers and loads content onto canvas', async () => {
    const created = await repos.documents.create({
      title: 'Blank Document',
      templateId: undefined,
      language: 'en',
    })
    const { doc } = await loadDocument(created.id)
    renderWorkspace(doc, null)
    await screen.findByTestId('editor-title-input')

    // Find and click the Telegram Bridge button
    const bridgeButton = screen.getByTestId('telegram-bridge-button')
    fireEvent.click(bridgeButton)

    // Wait for the modal and 4-digit page code to appear
    const pageCode = await screen.findByTestId('telegram-page-code')
    expect(pageCode).toBeInTheDocument()

    // Type 4-digit Qal ID
    const qalInput = screen.getByTestId('telegram-qal-id-input')
    fireEvent.change(qalInput, { target: { value: '7392' } })

    // Click Request Permission
    const pingBtn = screen.getByTestId('telegram-ping-button')
    fireEvent.click(pingBtn)

    // Verify modal closes and content is loaded onto canvas
    await waitFor(
      () => {
        const canvas = document.querySelector('.doc-pages')
        expect(canvas?.textContent).toContain('Abebe Bikila')
        expect(canvas?.textContent).toContain('Kebede Chala')
      },
      { timeout: 4000 },
    )

    // Verify additional instructions has received the Telegram profile summary
    const instructionsArea = screen.getByLabelText(
      /additional details or instructions/i,
    ) as HTMLTextAreaElement
    expect(instructionsArea.value).toContain('Abebe Bikila')
    expect(instructionsArea.value).toContain('+251911223344')
  })

  it('receives multimodal Telegram ID card scan, shows media tray, and inserts image onto canvas', async () => {
    const created = await repos.documents.create({
      title: 'Blank Document',
      templateId: undefined,
      language: 'en',
    })
    const { doc } = await loadDocument(created.id)
    renderWorkspace(doc, null)
    await screen.findByTestId('editor-title-input')

    // Find and click the Telegram Bridge button
    const bridgeButton = screen.getByTestId('telegram-bridge-button')
    fireEvent.click(bridgeButton)

    await screen.findByTestId('telegram-page-code')

    // Type 4-digit Qal ID 4815 (simulates ID card with image)
    const qalInput = screen.getByTestId('telegram-qal-id-input')
    fireEvent.change(qalInput, { target: { value: '4815' } })

    // Click Request Permission
    const pingBtn = screen.getByTestId('telegram-ping-button')
    fireEvent.click(pingBtn)

    // Verify modal closes and media tray is displayed
    await waitFor(() => {
      expect(screen.getByTestId('telegram-media-tray')).toBeInTheDocument()
      expect(screen.getByTestId('telegram-media-thumbnail')).toBeInTheDocument()
    })

    // Verify additional instructions has received Almaz Kebede
    const instructionsArea = screen.getByLabelText(
      /additional details or instructions/i,
    ) as HTMLTextAreaElement
    expect(instructionsArea.value).toContain('Almaz Kebede')
    expect(instructionsArea.value).toContain('ET-AA-481516')

    // Click Insert Image into Page button
    const insertImageBtn = screen.getByTestId('insert-telegram-image-button')
    fireEvent.click(insertImageBtn)

    // Verify ImageBlock renders onto the canvas
    await waitFor(() => {
      const img = document.querySelector('.doc-pages img.doc-image')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', expect.stringContaining('data:image/png;base64'))
    })
  })
})
