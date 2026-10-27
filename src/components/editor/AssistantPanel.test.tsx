import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import type { DocumentDetailRecord, TemplateDetail } from '../../lib/repositories'
import { stashPendingNotes } from '../../lib/assistant/pending-notes'
import type { AssistantReply } from '../../lib/assistant/types'
import { EditorWorkspace } from './EditorWorkspace'

// The real client answers offline in fixture mode; tests swap in AI replies.
const askAssistantMock = vi.hoisted(() => vi.fn())
vi.mock('../../lib/assistant/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/assistant/client')>()
  askAssistantMock.mockImplementation(actual.askAssistant)
  return { ...actual, askAssistant: askAssistantMock }
})

const repos = getRepositories()

function renderWorkspace(doc: DocumentDetailRecord, template: TemplateDetail | null) {
  window.innerWidth = 1600
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ToastProvider>
          <EditorWorkspace
            document={doc}
            template={template}
            onBack={vi.fn()}
            refresh={vi.fn(async () => repos.documents.get(doc.id))}
          />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

async function createRentalDocument(content: string): Promise<{ doc: DocumentDetailRecord; template: TemplateDetail | null }> {
  const created = await repos.documents.create({
    title: 'Assistant test',
    templateId: 'rental-agreement',
    language: 'en',
    answers: { property: 'Bole Tower apartment 4B' },
    content,
  })
  const doc = await repos.documents.get(created.id)
  if (!doc) throw new Error('missing document')
  const template = doc.templateId ? await repos.templates.get(doc.templateId, 'en') : null
  return { doc, template }
}

function firstParagraphId(): string {
  const id = document.querySelector('[data-block-id]')?.getAttribute('data-block-id')
  if (!id) throw new Error('no block')
  return id
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  window.sessionStorage.clear()
})

describe('Assistant panel', () => {
  it('drops the post-generation notes into the assistant panel and opens it', async () => {
    const { doc, template } = await createRentalDocument('Rent is payable by [payment deadline].')
    stashPendingNotes(doc.id, 'job-1', {
      summary: 'I drafted the rental agreement from your answers.',
      questions: [{ question: 'What is the agreed payment deadline?' }],
      assumptions: ['Rent is paid in Ethiopian Birr.'],
      warnings: ['1 place in the document still needs information (shown in [brackets]).'],
    })

    renderWorkspace(doc, template)

    const notes = await screen.findByTestId('assistant-generation-notes')
    expect(screen.getByTestId('editor-tab-assistant')).toHaveAttribute('aria-selected', 'true')
    expect(notes).toHaveTextContent('I drafted the rental agreement')
    expect(notes).toHaveTextContent('What is the agreed payment deadline?')
    expect(notes).toHaveTextContent('Rent is paid in Ethiopian Birr.')
    expect(notes).toHaveTextContent('still needs information')
    // Shown once: the hand-off is consumed.
    expect(window.sessionStorage.getItem(`docuA4.assistant.pending.${doc.id}`)).toBeNull()
  })

  it('says honestly that the AI is unavailable offline and shows the local check instead', async () => {
    const { doc, template } = await createRentalDocument('Deposit: ______ Birr.')
    renderWorkspace(doc, template)
    fireEvent.click(await screen.findByTestId('editor-tab-assistant'))

    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Is anything missing?' } })
    fireEvent.click(screen.getByTestId('assistant-send'))

    const offline = await screen.findByTestId('assistant-offline')
    expect(offline).toHaveTextContent(/not available in demo mode/i)
    expect(offline).toHaveTextContent(/nothing was changed/i)
    expect(offline).toHaveTextContent('______')
    // Nothing on the page changed.
    expect(screen.getAllByText(/Deposit: ______ Birr\./).length).toBeGreaterThan(0)
  })

  it('"Check for problems" runs the document check, without the AI', async () => {
    const { doc, template } = await createRentalDocument('Rent is payable by [payment deadline]. Deposit: ______ Birr.')
    renderWorkspace(doc, template)
    fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
    askAssistantMock.mockClear()

    fireEvent.click(screen.getByTestId('assistant-check'))

    const result = await screen.findByTestId('assistant-check-result')
    expect(result).toHaveTextContent(/quick check only/i)
    expect(result).toHaveTextContent('“[payment deadline]” still needs to be filled in.')
    expect(result).toHaveTextContent(/blank line/i)
    expect(askAssistantMock).not.toHaveBeenCalled()
  })

  it('applies a proposal only on Apply, reports the save state, and undoes it', async () => {
    const { doc, template } = await createRentalDocument('The tenant will pay rent.')
    renderWorkspace(doc, template)
    fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
    const blockId = firstParagraphId()

    const reply: AssistantReply = {
      reply: 'I propose a more formal rent clause.',
      questions: [],
      proposals: [{ blockId, newText: 'The Tenant shall pay the monthly rent.', reason: 'More formal wording.' }],
      fieldUpdates: [],
    }
    askAssistantMock.mockResolvedValueOnce(reply)

    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Make it formal' } })
    fireEvent.click(screen.getByTestId('assistant-send'))

    const proposal = await screen.findByTestId('assistant-proposal')
    expect(proposal).toHaveTextContent('More formal wording.')
    // Proposed, not applied.
    expect(screen.getAllByText('The tenant will pay rent.').length).toBeGreaterThan(0)
    expect(screen.queryByText('The Tenant shall pay the monthly rent.', { selector: '[data-block-id] *, [data-block-id]' })).toBeNull()

    fireEvent.click(within(proposal).getByTestId('assistant-proposal-accept'))
    await waitFor(() =>
      expect(document.querySelector(`[data-block-id="${blockId}"]`)).toHaveTextContent('The Tenant shall pay the monthly rent.'),
    )
    // Completion is reported from the real save state.
    await waitFor(
      () => expect(within(proposal).getByTestId('assistant-proposal-state')).toHaveTextContent(/applied and saved/i),
      { timeout: 4000 },
    )

    fireEvent.click(within(proposal).getByTestId('assistant-proposal-undo'))
    await waitFor(() =>
      expect(document.querySelector(`[data-block-id="${blockId}"]`)).toHaveTextContent('The tenant will pay rent.'),
    )
  })

  it('asks for confirmation when the paragraph changed after the suggestion', async () => {
    const { doc, template } = await createRentalDocument('Original clause text.')
    renderWorkspace(doc, template)
    fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
    const blockId = firstParagraphId()

    askAssistantMock.mockResolvedValueOnce({
      reply: 'Proposal ready.',
      questions: [],
      proposals: [{ blockId, newText: 'Rewritten clause.', reason: 'Clearer.' }],
      fieldUpdates: [],
    } satisfies AssistantReply)
    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Rewrite' } })
    fireEvent.click(screen.getByTestId('assistant-send'))
    const proposal = await screen.findByTestId('assistant-proposal')

    // The user edits the same paragraph before accepting.
    const outer = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`)
    const surface = outer?.querySelector<HTMLElement>('[data-block-id]') ?? outer
    if (!surface) throw new Error('no surface')
    surface.focus()
    fireEvent.input(surface, { target: { innerHTML: 'User edited clause.' } })

    await waitFor(() => expect(proposal).toHaveTextContent(/edited after the suggestion/i))
    expect(within(proposal).getByTestId('assistant-proposal-accept')).toHaveTextContent(/apply anyway/i)
  })

  it('sends only the document context, never images, and the selected block id', async () => {
    const { doc, template } = await createRentalDocument('Clause one.')
    renderWorkspace(doc, template)
    fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
    askAssistantMock.mockResolvedValueOnce({ reply: 'ok', questions: [], proposals: [], fieldUpdates: [] })

    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByTestId('assistant-send'))
    await screen.findByTestId('assistant-reply')

    const [input] = askAssistantMock.mock.calls.at(-1) as [{ documentId: string; blocks: Array<{ text: string }>; message: string }]
    expect(input.documentId).toBe(doc.id)
    expect(input.message).toBe('Hello')
    expect(input.blocks.some((b) => b.text.includes('Clause one.'))).toBe(true)
  })
})
