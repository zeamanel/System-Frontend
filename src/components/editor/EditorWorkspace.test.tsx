import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    expect(printSpy).toHaveBeenCalled()
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
})

