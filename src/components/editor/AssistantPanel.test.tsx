import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import type { DocumentDetailRecord, TemplateDetail } from '../../lib/repositories'
import { stashPendingNotes } from '../../lib/assistant/pending-notes'
import type { AssistantReply } from '../../lib/assistant/types'
import { addReviewComment, createReview, decideReview } from '../../lib/reviews/client'
import { EditorWorkspace } from './EditorWorkspace'

// The real client answers offline in fixture mode; tests swap in AI replies.
const askAssistantMock = vi.hoisted(() => vi.fn())
const translateSideMock = vi.hoisted(() => vi.fn())
vi.mock('../../lib/assistant/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/assistant/client')>()
  askAssistantMock.mockImplementation(actual.askAssistant)
  translateSideMock.mockImplementation(actual.translateSide)
  return { ...actual, askAssistant: askAssistantMock, translateSide: translateSideMock }
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

  it('inserts a proposed new clause after its block, and Undo removes it', async () => {
    const { doc, template } = await createRentalDocument('The tenant will pay rent.')
    renderWorkspace(doc, template)
    fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
    const blockId = firstParagraphId()
    const NEW_CLAUSE = 'Either party may end this agreement with 30 days written notice.'
    // Top-level blocks only (a block's editing surface carries the id too).
    const blockIds = () =>
      [...document.querySelectorAll('[data-block-id]')]
        .filter((el) => !el.parentElement?.closest('[data-block-id]'))
        .map((el) => el.getAttribute('data-block-id'))
    const before = blockIds()

    askAssistantMock.mockResolvedValueOnce({
      reply: 'The agreement has no termination clause.',
      questions: [],
      proposals: [
        { kind: 'insert', blockId: '', afterBlockId: blockId, newText: NEW_CLAUSE, reason: 'Missing termination clause.' },
      ],
      fieldUpdates: [],
    } satisfies AssistantReply)
    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Add a termination clause' } })
    fireEvent.click(screen.getByTestId('assistant-send'))

    const proposal = await screen.findByTestId('assistant-proposal')
    expect(proposal).toHaveTextContent('Proposed new clause')
    expect(within(proposal).getByTestId('assistant-proposal-where')).toHaveTextContent('Goes after: “The tenant will pay rent.”')
    expect(askAssistantMock.mock.calls.at(-1)?.[0]).toMatchObject({ allowInsert: true })
    // Proposed, not inserted.
    expect(blockIds()).toEqual(before)

    fireEvent.click(within(proposal).getByTestId('assistant-proposal-accept'))
    await waitFor(() => expect(blockIds()).toHaveLength(before.length + 1))
    const ids = blockIds()
    const insertedId = ids[ids.indexOf(blockId) + 1]
    expect(document.querySelector(`[data-block-id="${insertedId}"]`)).toHaveTextContent(NEW_CLAUSE)
    // The original paragraph is untouched.
    expect(document.querySelector(`[data-block-id="${blockId}"]`)).toHaveTextContent('The tenant will pay rent.')

    fireEvent.click(within(proposal).getByTestId('assistant-proposal-undo'))
    await waitFor(() => expect(blockIds()).toEqual(before))
  })

  it('removes and moves blocks on Apply all, and Undo puts each back', async () => {
    const { doc, template } = await createRentalDocument('First clause.\n\nSecond clause.\n\nThird clause.')
    renderWorkspace(doc, template)
    fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
    const blockIds = () =>
      [...document.querySelectorAll('[data-block-id]')]
        .filter((el) => !el.parentElement?.closest('[data-block-id]'))
        .map((el) => el.getAttribute('data-block-id') as string)
    await waitFor(() => expect(blockIds()).toHaveLength(3))
    const [first, second, third] = blockIds()

    askAssistantMock.mockResolvedValueOnce({
      reply: 'Clause two repeats; clause three belongs first.',
      questions: [],
      proposals: [
        { kind: 'delete', blockId: second, newText: '', reason: 'It repeats clause one.' },
        { kind: 'move', blockId: third, afterBlockId: '', newText: '', reason: 'It should come first.' },
        { kind: 'insert', blockId: '', afterBlockId: first, blockType: 'heading', newText: 'Payment', reason: 'A heading.' },
      ],
      fieldUpdates: [],
    } satisfies AssistantReply)
    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Tidy the structure' } })
    fireEvent.click(screen.getByTestId('assistant-send'))

    const cards = await screen.findAllByTestId('assistant-proposal')
    expect(cards[0]).toHaveTextContent('Proposed removal')
    expect(cards[0]).toHaveTextContent('Second clause.')
    expect(cards[1]).toHaveTextContent('Proposed move')
    expect(within(cards[1]).getByTestId('assistant-proposal-where')).toHaveTextContent('Moves to the start of the document')
    expect(cards[2]).toHaveTextContent('Proposed new heading')
    expect(askAssistantMock.mock.calls.at(-1)?.[0]).toMatchObject({ allowStructure: true })
    // Nothing changes before Apply.
    expect(blockIds()).toEqual([first, second, third])

    fireEvent.click(screen.getByTestId('assistant-accept-all'))
    await waitFor(() => expect(blockIds()).toHaveLength(3))
    const after = blockIds()
    expect(after[0]).toBe(third)
    expect(after[1]).toBe(first)
    expect(after).not.toContain(second)
    expect(document.querySelector(`[data-block-id="${after[2]}"]`)).toHaveTextContent('Payment')

    // Undo the removal: the clause is back where it was when it went (after the new heading).
    const heading = after[2]
    fireEvent.click(within(cards[0]).getByTestId('assistant-proposal-undo'))
    await waitFor(() => expect(blockIds()).toContain(second))
    expect(blockIds().indexOf(second)).toBe(blockIds().indexOf(heading) + 1)
    // Undo the move: the third clause goes back to its place.
    fireEvent.click(within(cards[1]).getByTestId('assistant-proposal-undo'))
    await waitFor(() => expect(blockIds()[0]).toBe(first))
    expect(blockIds().at(-1)).toBe(third)
  })

  it('hands a reviewer’s comment to the assistant for the whole document', async () => {
    const { doc, template } = await createRentalDocument('The tenant will pay rent.')
    const { token } = await createReview(doc.id, { reviewerName: 'Dawit Haile', expiresInDays: 14 })
    await addReviewComment(token, { name: 'Dawit Haile', body: 'Please add the plate number.' })
    await decideReview(token, { name: 'Dawit Haile', decision: 'request_changes', note: 'The rent is 30,000, not 35,000.' })
    renderWorkspace(doc, template)
    askAssistantMock.mockResolvedValue({ reply: 'Here is the change.', questions: [], proposals: [], fieldUpdates: [] } satisfies AssistantReply)

    fireEvent.click(await screen.findByRole('button', { name: /Export/ }))
    fireEvent.click(await screen.findByTestId('editor-send-review'))
    const buttons = await screen.findAllByTestId('review-work-on')
    // The change request, then the comment.
    expect(buttons).toHaveLength(2)
    fireEvent.click(buttons[0])

    await waitFor(() => expect(askAssistantMock).toHaveBeenCalled())
    const request = askAssistantMock.mock.calls.at(-1)?.[0]
    expect(request).toMatchObject({ scope: 'document' })
    expect(request.message).toBe('Dawit Haile reviewed this document and wrote: “The rent is 30,000, not 35,000.” Propose the changes to the document that this asks for.')
    // The dialog closed and the assistant shows the request.
    expect(screen.getByTestId('send-for-review').closest('dialog')).not.toHaveAttribute('open')
    expect(await screen.findByText('Here is the change.')).toBeInTheDocument()
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

  it('works on the selection, the page or the whole document, and × goes back to the whole document', async () => {
    const { doc, template } = await createRentalDocument('The tenant will pay rent.')
    renderWorkspace(doc, template)
    fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
    const blockId = firstParagraphId()
    const context = () => screen.getByTestId('assistant-context')
    const sent = async () => {
      askAssistantMock.mockResolvedValueOnce({ reply: 'ok', questions: [], proposals: [], fieldUpdates: [] })
      const calls = askAssistantMock.mock.calls.length
      fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Hello' } })
      fireEvent.click(screen.getByTestId('assistant-send'))
      await waitFor(() => expect(askAssistantMock.mock.calls.length).toBe(calls + 1))
      await waitFor(() => expect(screen.queryByTestId('assistant-thinking')).toBeNull())
      return askAssistantMock.mock.calls.at(-1)?.[0] as { scope: string; selectedBlockId?: string; scopeBlockIds?: string[] }
    }

    // Nothing selected: the whole document; the page and the selection need the cursor.
    expect(context()).toHaveTextContent('Working on: the whole document')
    expect(screen.getByTestId('assistant-scope-block')).toBeDisabled()
    expect(screen.getByTestId('assistant-scope-page')).toBeDisabled()
    expect((await sent()).scope).toBe('document')

    // Clicking into a paragraph selects it.
    const outer = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`)
    const surface = outer?.querySelector<HTMLElement>('[data-block-id]') ?? outer
    surface?.focus()
    await waitFor(() => expect(context()).toHaveTextContent('Working on: “The tenant will pay rent.”'))
    expect(screen.getByTestId('assistant-scope-block')).toHaveAttribute('aria-checked', 'true')
    expect(await sent()).toMatchObject({ scope: 'block', selectedBlockId: blockId })

    // × goes back to the whole document, and stays there while the cursor is in the page.
    fireEvent.click(screen.getByTestId('assistant-scope-clear'))
    expect(context()).toHaveTextContent('Working on: the whole document')
    expect(screen.queryByTestId('assistant-scope-clear')).toBeNull()
    expect((await sent()).scope).toBe('document')

    // The page with the cursor.
    fireEvent.click(screen.getByTestId('assistant-scope-page'))
    expect(screen.getByTestId('assistant-scope-page')).toHaveTextContent('Page 1')
    expect(context()).toHaveTextContent('Working on: page 1 only')
    const page = await sent()
    expect(page.scope).toBe('page')
    expect(page.scopeBlockIds).toContain(blockId)

    fireEvent.click(screen.getByTestId('assistant-scope-block'))
    expect(context()).toHaveTextContent('Working on: “The tenant will pay rent.”')
  })

  it('changes list items and description cells, and Apply all applies every change', async () => {
    const content = JSON.stringify({
      blocks: [
        { type: 'paragraph', text: 'The tenant will pay rent.' },
        { type: 'list', ordered: false, items: ['Keep the house clean', 'Pay the bills'] },
        { type: 'table', headers: ['Item', 'Price'], rows: [['Desk', '5,000']] },
      ],
    })
    const { doc, template } = await createRentalDocument(content)
    renderWorkspace(doc, template)
    fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
    askAssistantMock.mockResolvedValueOnce({ reply: 'ok', questions: [], proposals: [], fieldUpdates: [] })
    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Make it formal' } })
    fireEvent.click(screen.getByTestId('assistant-send'))
    await screen.findByTestId('assistant-reply')

    type Sent = { blocks: Array<{ id: string; type: string; parts?: Array<{ id: string; text: string }> }> }
    const { blocks } = askAssistantMock.mock.calls.at(-1)?.[0] as Sent
    const paragraph = blocks.find((b) => b.type === 'paragraph')
    const list = blocks.find((b) => b.type === 'list')
    const table = blocks.find((b) => b.type === 'table')
    expect(list?.parts?.map((p) => p.text)).toEqual(['Keep the house clean', 'Pay the bills'])
    // Amounts are never offered.
    expect(table?.parts?.map((p) => p.text)).toEqual(['Item', 'Price', 'Desk'])
    if (!paragraph || !list?.parts || !table?.parts) throw new Error('missing blocks')

    askAssistantMock.mockResolvedValueOnce({
      reply: 'I made the whole document formal.',
      questions: [],
      proposals: [
        { blockId: paragraph.id, newText: 'The Tenant shall pay the rent.', reason: 'Formal.' },
        { blockId: list.id, partId: list.parts[0].id, newText: 'Keep the premises clean', reason: 'Formal.' },
        { blockId: table.id, partId: table.parts[2].id, newText: 'Office desk', reason: 'Clearer.' },
      ],
      fieldUpdates: [],
    } satisfies AssistantReply)
    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Make the whole document formal' } })
    fireEvent.click(screen.getByTestId('assistant-send'))

    const bulk = await screen.findByTestId('assistant-bulk')
    expect(within(bulk).getByTestId('assistant-accept-all')).toHaveTextContent('Apply all (3)')
    const cards = screen.getAllByTestId('assistant-proposal')
    expect(within(cards[1]).getByTestId('assistant-proposal-part')).toHaveTextContent('In a list item')
    expect(within(cards[2]).getByTestId('assistant-proposal-part')).toHaveTextContent('In a table cell')

    fireEvent.click(within(bulk).getByTestId('assistant-accept-all'))
    await waitFor(() => expect(document.querySelector(`[data-block-id="${paragraph.id}"]`)).toHaveTextContent('The Tenant shall pay the rent.'))
    const listEl = document.querySelector(`[data-block-id="${list.id}"]`)
    expect(listEl).toHaveTextContent('Keep the premises clean')
    expect(listEl).toHaveTextContent('Pay the bills')
    const tableEl = document.querySelector(`[data-block-id="${table.id}"]`)
    expect(tableEl).toHaveTextContent('Office desk')
    expect(tableEl).toHaveTextContent('5,000')
    expect(screen.queryByTestId('assistant-bulk')).toBeNull()
    expect(screen.getAllByTestId('assistant-proposal-undo')).toHaveLength(3)

    // Each change still undoes on its own.
    fireEvent.click(within(screen.getAllByTestId('assistant-proposal')[1]).getByTestId('assistant-proposal-undo'))
    await waitFor(() => expect(document.querySelector(`[data-block-id="${list.id}"]`)).toHaveTextContent('Keep the house clean'))
    expect(document.querySelector(`[data-block-id="${paragraph.id}"]`)).toHaveTextContent('The Tenant shall pay the rent.')
  })

  it('Apply all leaves changes to edited text for the user, and Dismiss all dismisses the rest', async () => {
    const content = JSON.stringify({ blocks: [{ type: 'paragraph', text: 'First clause.' }, { type: 'paragraph', text: 'Second clause.' }] })
    const { doc, template } = await createRentalDocument(content)
    renderWorkspace(doc, template)
    fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
    const ids = [...document.querySelectorAll('[data-block-id]')]
      .filter((el) => !el.parentElement?.closest('[data-block-id]'))
      .map((el) => el.getAttribute('data-block-id') ?? '')
    askAssistantMock.mockResolvedValueOnce({
      reply: 'ok',
      questions: [],
      proposals: [
        { blockId: ids[0], newText: 'First clause, rewritten.', reason: 'r' },
        { blockId: ids[1], newText: 'Second clause, rewritten.', reason: 'r' },
      ],
      fieldUpdates: [],
    } satisfies AssistantReply)
    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Rewrite' } })
    fireEvent.click(screen.getByTestId('assistant-send'))
    await screen.findByTestId('assistant-bulk')

    // The user edits the second paragraph before accepting.
    const outer = document.querySelector<HTMLElement>(`[data-block-id="${ids[1]}"]`)
    const surface = outer?.querySelector<HTMLElement>('[data-block-id]') ?? outer
    if (!surface) throw new Error('no surface')
    surface.focus()
    fireEvent.input(surface, { target: { innerHTML: 'Second clause, edited by me.' } })

    fireEvent.click(screen.getByTestId('assistant-accept-all'))
    await waitFor(() => expect(document.querySelector(`[data-block-id="${ids[0]}"]`)).toHaveTextContent('First clause, rewritten.'))
    expect(document.querySelector(`[data-block-id="${ids[1]}"]`)).toHaveTextContent('Second clause, edited by me.')
    expect(screen.getByTestId('assistant-thread')).toHaveTextContent('1 change(s) were not applied')

    const second = screen.getAllByTestId('assistant-proposal')[1]
    expect(within(second).getByTestId('assistant-proposal-accept')).toHaveTextContent(/apply anyway/i)
    fireEvent.click(within(second).getByText('Dismiss'))
    expect(second).toHaveTextContent(/dismissed/i)
  })

  it('shows a streamed answer as it is written; its changes can be applied once it is complete', async () => {
    const { doc, template } = await createRentalDocument('The tenant will pay rent.')
    renderWorkspace(doc, template)
    fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
    const blockId = firstParagraphId()
    const proposal = { kind: 'replace' as const, blockId, newText: 'The Tenant shall pay the rent.', reason: 'More formal.' }

    let finish: () => void = () => undefined
    const finished = new Promise<void>((resolve) => {
      finish = resolve
    })
    let partial: ((p: { reply: string; proposals: AssistantReply['proposals'] }) => void) | undefined
    askAssistantMock.mockImplementationOnce(async (_input: unknown, options: { onPartial?: typeof partial }) => {
      partial = options.onPartial
      await finished
      return { reply: 'I propose a more formal clause.', questions: [], proposals: [proposal], fieldUpdates: [] } satisfies AssistantReply
    })

    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Make it formal' } })
    fireEvent.click(screen.getByTestId('assistant-send'))
    // Before the first words: "working on it".
    await screen.findByTestId('assistant-thinking')
    await waitFor(() => expect(partial).toBeDefined())

    act(() => partial?.({ reply: 'I propose', proposals: [] }))
    expect(await screen.findByTestId('assistant-streaming')).toHaveTextContent('I propose')
    expect(screen.queryByTestId('assistant-thinking')).toBeNull()

    act(() => partial?.({ reply: 'I propose a more formal clause.', proposals: [proposal] }))
    const card = await screen.findByTestId('assistant-proposal')
    expect(card).toHaveTextContent('More formal.')
    // Readable, not yet applicable.
    expect(within(card).getByTestId('assistant-proposal-accept')).toBeDisabled()
    expect(screen.getAllByTestId('assistant-reply')).toHaveLength(1)

    await act(async () => finish())
    await waitFor(() => expect(screen.queryByTestId('assistant-streaming')).toBeNull())
    expect(screen.getAllByTestId('assistant-reply')).toHaveLength(1)
    const ready = screen.getByTestId('assistant-proposal')
    expect(within(ready).getByTestId('assistant-proposal-accept')).not.toBeDisabled()
    fireEvent.click(within(ready).getByTestId('assistant-proposal-accept'))
    await waitFor(() =>
      expect(document.querySelector(`[data-block-id="${blockId}"]`)).toHaveTextContent('The Tenant shall pay the rent.'),
    )
  })

  it('a reply still streaming when the page was left comes back finished (or not at all if empty)', async () => {
    const { doc, template } = await createRentalDocument('Clause.')
    const base = { role: 'assistant', kind: 'reply', questions: [], proposals: [], fieldUpdates: [], streaming: true }
    window.sessionStorage.setItem(
      `docuA4.assistant.thread.${doc.id}`,
      JSON.stringify([
        { ...base, id: 'm1', createdAt: 1, text: 'Half an answer' },
        { ...base, id: 'm2', createdAt: 2, text: '' },
      ]),
    )
    renderWorkspace(doc, template)
    fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
    expect(await screen.findByText('Half an answer')).toBeInTheDocument()
    expect(screen.queryByTestId('assistant-streaming')).toBeNull()
    expect(screen.getAllByTestId('assistant-reply')).toHaveLength(1)
  })

  describe('bilingual side column', () => {
    const paragraph = (id: string, html: string, secondaryHtml?: string) => ({
      id,
      type: 'paragraph',
      html,
      align: 'left',
      indent: 0,
      spacing: 'normal',
      ...(secondaryHtml !== undefined ? { secondaryHtml } : {}),
    })
    async function createBilingual(
      blocks: unknown[],
      bilingual = true,
    ): Promise<{ doc: DocumentDetailRecord; template: TemplateDetail | null }> {
      const content = JSON.stringify({
        schema: 'docuA4.document',
        version: 1,
        language: 'en',
        font: 'sans',
        fontSize: 11,
        page: {
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
          headerEnabled: false,
          headerHtml: '',
          footerEnabled: false,
          footerHtml: '',
          ...(bilingual ? { bilingual: true } : {}),
        },
        blocks,
      })
      const created = await repos.documents.create({ title: 'Side column', templateId: 'rental-agreement', language: 'en', answers: {}, content })
      const doc = await repos.documents.get(created.id)
      if (!doc) throw new Error('missing document')
      const template = doc.templateId ? await repos.templates.get(doc.templateId, 'en') : null
      return { doc, template }
    }
    const sideText = (blockId: string) =>
      document.querySelector(`[data-block-id="${blockId}"] [data-bilingual-secondary="true"]`)?.textContent ?? null
    const translations = (...items: Array<[string, string]>) => ({
      ok: true as const,
      translations: items.map(([id, text]) => ({ id, text })),
      missingIds: [] as string[],
    })

    beforeEach(() => {
      translateSideMock.mockClear()
    })

    it('offers to translate the side column only while bilingual is on', async () => {
      const off = await createBilingual([paragraph('b1', 'The tenant will pay rent.')], false)
      const { unmount } = renderWorkspace(off.doc, off.template)
      fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
      expect(screen.queryByTestId('assistant-side')).toBeNull()
      unmount()

      const on = await createBilingual([paragraph('b1', 'The tenant will pay rent.')])
      renderWorkspace(on.doc, on.template)
      fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
      expect(await screen.findByTestId('assistant-side')).toBeInTheDocument()
      expect(screen.getByTestId('assistant-side-hint')).toHaveTextContent('1 paragraph has no side translation yet.')
    })

    it('Translate the side column proposes a translation per paragraph, applies nothing until accepted, and can be undone', async () => {
      const { doc, template } = await createBilingual([
        paragraph('b1', 'The tenant will pay rent.'),
        paragraph('b2', 'The landlord will keep the house in repair.'),
        paragraph('b3', 'Already translated.', 'ቀድሞ ተተርጉሟል።'),
      ])
      renderWorkspace(doc, template)
      fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
      // Only the two paragraphs without a translation count.
      expect(screen.getByTestId('assistant-side-hint')).toHaveTextContent('2 paragraphs have no side translation yet.')
      translateSideMock.mockResolvedValueOnce(translations(['b1', 'ተከራዩ ኪራይ ይከፍላል።'], ['b2', 'አከራዩ ቤቱን ይጠግናል።']))

      fireEvent.click(screen.getByTestId('assistant-side-translate'))

      await waitFor(() => expect(screen.getAllByTestId('assistant-proposal')).toHaveLength(2))
      // An English document gets an Amharic side column; only the empty cells were sent.
      expect(translateSideMock).toHaveBeenCalledTimes(1)
      expect(translateSideMock.mock.calls[0][0]).toMatchObject({
        documentId: doc.id,
        target: 'am',
        blocks: [
          { id: 'b1', text: 'The tenant will pay rent.' },
          { id: 'b2', text: 'The landlord will keep the house in repair.' },
        ],
      })
      expect(screen.getAllByTestId('assistant-reply')[0]).toHaveTextContent('I translated 2 paragraphs into Amharic');
      // Proposed, not applied.
      expect(sideText('b1')).toBe('')
      expect(sideText('b3')).toBe('ቀድሞ ተተርጉሟል።')

      fireEvent.click(screen.getByTestId('assistant-accept-all'))
      await waitFor(() => expect(sideText('b1')).toBe('ተከራዩ ኪራይ ይከፍላል።'))
      expect(sideText('b2')).toBe('አከራዩ ቤቱን ይጠግናል።')
      // The translation that was already there is untouched.
      expect(sideText('b3')).toBe('ቀድሞ ተተርጉሟል።')

      // Each is its own change: undoing one leaves the other.
      fireEvent.click(screen.getAllByTestId('assistant-proposal-undo')[0])
      await waitFor(() => expect(sideText('b1')).toBe(''))
      expect(sideText('b2')).toBe('አከራዩ ቤቱን ይጠግናል።')
    })

    it('translates only the selected block when the work is limited to it', async () => {
      const { doc, template } = await createBilingual([paragraph('b1', 'First clause.'), paragraph('b2', 'Second clause.')])
      renderWorkspace(doc, template)
      fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
      // Put the cursor in the second paragraph, then work on the block.
      const editable = document.querySelector('[data-block-id="b2"] [contenteditable="true"]') as HTMLElement
      fireEvent.focus(editable)
      await waitFor(() => expect(screen.getByTestId('assistant-scope-block')).not.toBeDisabled())
      fireEvent.click(screen.getByTestId('assistant-scope-block'))
      expect(screen.getByTestId('assistant-side-hint')).toHaveTextContent('1 paragraph has no side translation yet.')
      translateSideMock.mockResolvedValueOnce(translations(['b2', 'ሁለተኛ አንቀጽ።']))

      fireEvent.click(screen.getByTestId('assistant-side-translate'))
      await waitFor(() => expect(screen.getAllByTestId('assistant-proposal')).toHaveLength(1))
      expect(translateSideMock.mock.calls[0][0].blocks).toEqual([{ id: 'b2', text: 'Second clause.' }])
    })

    it('says so, and changes nothing, when the translation cannot be made', async () => {
      const { doc, template } = await createBilingual([paragraph('b1', 'The tenant will pay rent.')])
      renderWorkspace(doc, template)
      fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
      translateSideMock.mockResolvedValueOnce({ ok: false, reason: 'quota' })

      fireEvent.click(screen.getByTestId('assistant-side-translate'))

      expect(await screen.findByRole('alert')).toHaveTextContent("Today's AI limit has been reached. Nothing was changed.")
      expect(screen.queryByTestId('assistant-proposal')).toBeNull()
      expect(sideText('b1')).toBe('')
    })

    it('has nothing to translate when every paragraph already has a side translation', async () => {
      const { doc, template } = await createBilingual([paragraph('b1', 'Rent.', 'ኪራይ።')])
      renderWorkspace(doc, template)
      fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
      expect(screen.getByTestId('assistant-side-hint')).toHaveTextContent('Every paragraph here already has a side translation.')
      expect(screen.getByTestId('assistant-side-translate')).toBeDisabled()
    })

    it('after an accepted rewrite, offers to update that paragraph\'s translation', async () => {
      const { doc, template } = await createBilingual([paragraph('b1', 'The tenant will pay rent.', 'ተከራዩ ኪራይ ይከፍላል።')])
      renderWorkspace(doc, template)
      fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
      askAssistantMock.mockResolvedValueOnce({
        reply: 'I propose a more formal rent clause.',
        questions: [],
        proposals: [{ blockId: 'b1', newText: 'The Tenant shall pay the monthly rent.', reason: 'More formal wording.' }],
        fieldUpdates: [],
      } satisfies AssistantReply)
      fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Make it formal' } })
      fireEvent.click(screen.getByTestId('assistant-send'))
      const proposal = await screen.findByTestId('assistant-proposal')
      // No offer before the rewrite is accepted.
      expect(screen.queryByTestId('assistant-side-stale')).toBeNull()

      fireEvent.click(within(proposal).getByTestId('assistant-proposal-accept'))
      const offer = await screen.findByTestId('assistant-side-stale')
      expect(offer).toHaveTextContent('You changed a paragraph that has a side translation')

      translateSideMock.mockResolvedValueOnce(translations(['b1', 'ተከራዩ ወርሃዊ ኪራዩን ይከፍላል።']))
      fireEvent.click(within(offer).getByTestId('assistant-side-update'))

      await waitFor(() => expect(screen.getAllByTestId('assistant-proposal')).toHaveLength(2))
      // The new text of the paragraph is what gets translated.
      expect(translateSideMock.mock.calls[0][0].blocks).toEqual([{ id: 'b1', text: 'The Tenant shall pay the monthly rent.' }])
      // Still the old translation until the new one is accepted.
      expect(sideText('b1')).toBe('ተከራዩ ኪራይ ይከፍላል።')
      const translation = screen.getAllByTestId('assistant-proposal')[1]
      fireEvent.click(within(translation).getByTestId('assistant-proposal-accept'))
      await waitFor(() => expect(sideText('b1')).toBe('ተከራዩ ወርሃዊ ኪራዩን ይከፍላል።'))
      expect(offer).toHaveTextContent('The updated translations are in the thread')
    })

    it('gathers several accepted rewrites into one offer, and Keep as they are asks nothing of the AI', async () => {
      const { doc, template } = await createBilingual([
        paragraph('b1', 'First clause.', 'የመጀመሪያ።'),
        paragraph('b2', 'Second clause.', 'ሁለተኛ።'),
        paragraph('b3', 'Third clause, no translation.'),
      ])
      renderWorkspace(doc, template)
      fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
      askAssistantMock.mockResolvedValueOnce({
        reply: 'I propose changes.',
        questions: [],
        proposals: [
          { blockId: 'b1', newText: 'First clause, revised.', reason: 'a' },
          { blockId: 'b2', newText: 'Second clause, revised.', reason: 'b' },
          { blockId: 'b3', newText: 'Third clause, revised.', reason: 'c' },
        ],
        fieldUpdates: [],
      } satisfies AssistantReply)
      fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Revise them' } })
      fireEvent.click(screen.getByTestId('assistant-send'))
      await screen.findAllByTestId('assistant-proposal')

      // One by one: the offer collects them instead of repeating.
      fireEvent.click(within(screen.getAllByTestId('assistant-proposal')[0]).getByTestId('assistant-proposal-accept'))
      await screen.findByTestId('assistant-side-stale')
      fireEvent.click(within(screen.getAllByTestId('assistant-proposal')[1]).getByTestId('assistant-proposal-accept'))
      await waitFor(() => expect(screen.getByTestId('assistant-side-stale')).toHaveTextContent('You changed 2 paragraphs'))
      // A paragraph with no translation is not part of it.
      fireEvent.click(within(screen.getAllByTestId('assistant-proposal')[2]).getByTestId('assistant-proposal-accept'))
      await waitFor(() =>
        expect(document.querySelector('[data-block-id="b3"]')).toHaveTextContent('Third clause, revised.'),
      )
      expect(screen.getAllByTestId('assistant-side-stale')).toHaveLength(1)
      expect(screen.getByTestId('assistant-side-stale')).toHaveTextContent('You changed 2 paragraphs')

      fireEvent.click(screen.getByTestId('assistant-side-keep'))
      expect(screen.getByTestId('assistant-side-stale')).toHaveTextContent('kept as they are')
      expect(translateSideMock).not.toHaveBeenCalled()
      expect(sideText('b1')).toBe('የመጀመሪያ።')
    })

    it('skips paragraphs whose side box was removed: not counted, not translated, and no update offer', async () => {
      const removed = { ...paragraph('b2', 'The landlord will keep the house in repair.', 'አከራዩ ቤቱን ይጠግናል።'), sideHidden: true }
      const { doc, template } = await createBilingual([paragraph('b1', 'The tenant will pay rent.'), removed])
      renderWorkspace(doc, template)
      fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
      // Only b1 counts.
      expect(screen.getByTestId('assistant-side-hint')).toHaveTextContent('1 paragraph has no side translation yet.')
      translateSideMock.mockResolvedValueOnce(translations(['b1', 'ተከራዩ ኪራይ ይከፍላል።']))
      fireEvent.click(screen.getByTestId('assistant-side-translate'))
      await waitFor(() => expect(screen.getAllByTestId('assistant-proposal')).toHaveLength(1))
      expect(translateSideMock.mock.calls[0][0].blocks).toEqual([{ id: 'b1', text: 'The tenant will pay rent.' }])

      // Rewriting the paragraph whose box was removed leaves its hidden translation alone, with no offer.
      askAssistantMock.mockResolvedValueOnce({
        reply: 'ok',
        questions: [],
        proposals: [{ blockId: 'b2', newText: 'The Landlord shall keep the house in repair.', reason: 'x' }],
        fieldUpdates: [],
      } satisfies AssistantReply)
      fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Make it formal' } })
      fireEvent.click(screen.getByTestId('assistant-send'))
      await waitFor(() => expect(screen.getAllByTestId('assistant-proposal')).toHaveLength(2))
      fireEvent.click(within(screen.getAllByTestId('assistant-proposal')[1]).getByTestId('assistant-proposal-accept'))
      await waitFor(() =>
        expect(document.querySelector('[data-block-id="b2"]')).toHaveTextContent('The Landlord shall keep the house in repair.'),
      )
      expect(screen.queryByTestId('assistant-side-stale')).toBeNull()
    })

    it('makes no offer when bilingual is off, or the paragraph has no translation', async () => {
      const { doc, template } = await createBilingual([paragraph('b1', 'The tenant will pay rent.', 'ተከራዩ ኪራይ ይከፍላል።')], false)
      renderWorkspace(doc, template)
      fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
      askAssistantMock.mockResolvedValueOnce({
        reply: 'ok',
        questions: [],
        proposals: [{ blockId: 'b1', newText: 'The Tenant shall pay the monthly rent.', reason: 'x' }],
        fieldUpdates: [],
      } satisfies AssistantReply)
      fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Make it formal' } })
      fireEvent.click(screen.getByTestId('assistant-send'))
      fireEvent.click(within(await screen.findByTestId('assistant-proposal')).getByTestId('assistant-proposal-accept'))
      await waitFor(() =>
        expect(document.querySelector('[data-block-id="b1"]')).toHaveTextContent('The Tenant shall pay the monthly rent.'),
      )
      expect(screen.queryByTestId('assistant-side-stale')).toBeNull()
    })
  })
})
