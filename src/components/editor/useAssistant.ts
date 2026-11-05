import { useCallback, useEffect, useRef, useState } from 'react'
import { askAssistant, type AssistantPartial } from '../../lib/assistant/client'
import { runDocumentCheck, type DocumentCheckResult } from '../../lib/document-check/check'
import {
  applyTextProposal,
  blockPlainText,
  insertTextProposal,
  findPlaceholders,
  proposalTargetText,
  restrictToPage,
  toAssistantBlocks,
} from '../../lib/assistant/context'
import type {
  AssistantMessage,
  AssistantNotes,
  AssistantProposal,
  AssistantQuestion,
  AssistantReply,
  AssistantScope,
} from '../../lib/assistant/types'
import type { PageSlice } from '../../lib/editor/paginate'
import type { DocumentModel } from '../../lib/editor/types'
import type { RevertResult, TrackedChange } from '../../lib/editor/tracked-change'
import type { FieldSyncEvent } from './useDocumentEditor'

/**
 * State and actions of the editor's assistant panel.
 *
 * The thread is per document and per browser tab (sessionStorage under the
 * `docuA4.` prefix, so sign-out wipes it). The assistant only proposes;
 * every accepted proposal goes through the editor's tracked changes so it
 * can be undone, and a proposal for a paragraph that changed since it was
 * suggested must be confirmed again before it is applied.
 */

const THREAD_PREFIX = 'docuA4.assistant.thread.'
const MAX_MESSAGES = 40
const HISTORY_TURNS = 8

let messageCounter = 0
function newMessageId(): string {
  messageCounter += 1
  return `msg-${Date.now()}-${messageCounter}`
}

function readThread(documentId: string): AssistantMessage[] {
  try {
    const raw = globalThis.sessionStorage?.getItem(THREAD_PREFIX + documentId)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (!Array.isArray(parsed)) return []
    // A reply that was still streaming when the page went away: keep what arrived, or drop it.
    return (parsed as AssistantMessage[]).flatMap((m) => {
      if (m.kind !== 'reply' || !m.streaming) return [m]
      if (!m.text && m.proposals.length === 0) return []
      return [{ ...m, streaming: false }]
    })
  } catch {
    return []
  }
}

function writeThread(documentId: string, messages: AssistantMessage[]): void {
  try {
    globalThis.sessionStorage?.setItem(
      THREAD_PREFIX + documentId,
      JSON.stringify(messages.slice(-MAX_MESSAGES)),
    )
  } catch {
    // Storage full/unavailable: the thread simply isn't restored on reload.
  }
}

export interface AssistantEditorBinding {
  model: DocumentModel
  answers: Record<string, string>
  setAnswer: (questionId: string, value: string) => void
  applyTrackedChange: (updater: (current: DocumentModel) => DocumentModel) => TrackedChange | null
  revertChange: (change: TrackedChange) => RevertResult
}

export interface UseAssistantParams {
  documentId: string
  editor: AssistantEditorBinding
  questions: Array<{ id: string; label: string; required?: boolean }>
  selectedBlockId: string | null
  /** What a message works on; 'block' needs a selected block, 'page' the page from `getPage`. */
  scope: AssistantScope
  /** The page with the cursor, as the canvas laid it out (null when unknown). */
  getPage?: () => readonly PageSlice[] | null
  /** Called for outcomes the user should notice even with the panel closed. */
  onNotice?: (text: string) => void
  labels: {
    blockGone: string
    keptEditedBlocks: (count: number) => string
    requestFailed: string
    answerMessage: (question: string, answer: string) => string
  }
}

export function useAssistant({
  documentId,
  editor,
  questions,
  selectedBlockId,
  scope,
  getPage,
  onNotice,
  labels,
}: UseAssistantParams) {
  const [messages, setMessages] = useState<AssistantMessage[]>(() => readThread(documentId))
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [unread, setUnread] = useState(0)
  const editorRef = useRef(editor)
  editorRef.current = editor
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    writeThread(documentId, messages)
  }, [documentId, messages])

  useEffect(() => () => abortRef.current?.abort(), [])

  const append = useCallback((message: AssistantMessage): void => {
    setMessages((current) => [...current, message].slice(-MAX_MESSAGES))
    if (message.role !== 'user') setUnread((n) => n + 1)
  }, [])

  const update = useCallback(
    (id: string, updater: (message: AssistantMessage) => AssistantMessage): void => {
      setMessages((current) => current.map((m) => (m.id === id ? updater(m) : m)))
    },
    [],
  )

  const notice = useCallback(
    (text: string, tone: 'info' | 'error' = 'info'): void => {
      append({ id: newMessageId(), createdAt: Date.now(), role: 'system', kind: 'notice', text, tone })
    },
    [append],
  )

  /** Drop what the assistant says after generating into the thread. */
  const postGenerationNotes = useCallback(
    (notes: AssistantNotes): void => {
      append({ id: newMessageId(), createdAt: Date.now(), role: 'assistant', kind: 'generation-notes', notes })
    },
    [append],
  )

  /** Report a field edit carried into the text; merges repeated edits of one field. */
  const postFieldSync = useCallback((event: FieldSyncEvent): void => {
    const places = Object.keys(event.change.after).length
    setMessages((current) => {
      const last = current[current.length - 1]
      if (
        last &&
        last.kind === 'field-sync' &&
        last.questionId === event.questionId &&
        last.status === 'applied'
      ) {
        const merged: TrackedChange = {
          id: event.change.id,
          before: { ...event.change.before, ...last.change.before },
          after: { ...last.change.after, ...event.change.after },
        }
        return [
          ...current.slice(0, -1),
          { ...last, to: event.to, change: merged, places: Object.keys(merged.after).length, createdAt: Date.now() },
        ]
      }
      return [
        ...current,
        {
          id: newMessageId(),
          createdAt: Date.now(),
          role: 'system' as const,
          kind: 'field-sync' as const,
          questionId: event.questionId,
          from: event.from,
          to: event.to,
          places,
          change: event.change,
          status: 'applied' as const,
        },
      ].slice(-MAX_MESSAGES)
    })
  }, [])

  const send = useCallback(
    async (text: string): Promise<void> => {
      const message = text.trim()
      if (!message || sending) return
      const history = messages
        .filter(
          (m): m is Extract<AssistantMessage, { kind: 'text' | 'reply' }> =>
            m.kind === 'text' || (m.kind === 'reply' && !m.offline),
        )
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }))

      append({ id: newMessageId(), createdAt: Date.now(), role: 'user', kind: 'text', text: message })
      setSending(true)
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const { model, answers } = editorRef.current
      let blocks = toAssistantBlocks(model)
      let scopeBlockIds: string[] | undefined
      let sentScope: AssistantScope = scope === 'block' && !selectedBlockId ? 'document' : scope
      if (sentScope === 'page') {
        const page = getPage?.()
        if (page?.length) ({ blocks, scopeBlockIds } = restrictToPage(blocks, model, page))
        else sentScope = 'document'
      }
      const textById = new Map(blocks.map((b) => [b.id, b.text]))
      for (const block of blocks) for (const part of block.parts ?? []) textById.set(`${block.id}/${part.id}`, part.text)
      const toProposals = (list: AssistantReply['proposals']): AssistantProposal[] =>
        list.map((p) => {
          const kind = p.kind === 'insert' ? ('insert' as const) : ('replace' as const)
          return {
            ...p,
            kind,
            baseText: kind === 'insert' ? '' : (textById.get(p.partId ? `${p.blockId}/${p.partId}` : p.blockId) ?? ''),
            status: 'pending' as const,
          }
        })
      // The answer streams into one reply message: it appears with the first words and
      // fills in (reply text, then proposals) until the final answer replaces it.
      const replyId = newMessageId()
      let placed = false
      const onPartial = (partial: AssistantPartial): void => {
        const message: AssistantMessage = {
          id: replyId,
          createdAt: Date.now(),
          role: 'assistant',
          kind: 'reply',
          text: partial.reply,
          questions: [],
          proposals: toProposals(partial.proposals),
          fieldUpdates: [],
          streaming: true,
        }
        if (placed) {
          update(replyId, () => message)
        } else {
          placed = true
          append(message)
        }
      }
      try {
        const reply = await askAssistant(
          {
            documentId,
            message,
            selectedBlockId: selectedBlockId ?? undefined,
            scope: sentScope,
            ...(scopeBlockIds ? { scopeBlockIds } : {}),
            blocks,
            answers,
            history,
            allowInsert: true,
          },
          { model, questions, signal: controller.signal, onPartial },
        )
        const final: AssistantMessage = {
          id: replyId,
          createdAt: Date.now(),
          role: 'assistant',
          kind: 'reply',
          text: reply.reply,
          questions: reply.questions,
          proposals: toProposals(reply.proposals),
          fieldUpdates: reply.fieldUpdates,
          offline: reply.offline,
        }
        if (placed) update(replyId, () => final)
        else append(final)
      } catch (error) {
        if (placed) setMessages((current) => current.filter((m) => m.id !== replyId))
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          notice(labels.requestFailed, 'error')
        }
      } finally {
        setSending(false)
      }
    },
    [append, documentId, getPage, labels.requestFailed, messages, notice, questions, scope, selectedBlockId, sending, update],
  )

  /** Applies one proposal as its own tracked change; null when its paragraph (or anchor) is gone. */
  const applyProposal = useCallback((proposal: AssistantProposal) => {
    const blocks = editorRef.current.model.blocks
    if (proposal.kind === 'insert') {
      const after = proposal.afterBlockId ?? ''
      if (after && !blocks.some((b) => b.id === after)) return null
    } else if (proposalTargetText(editorRef.current.model, proposal.blockId, proposal.partId) === null) {
      return null
    }
    const change = editorRef.current.applyTrackedChange((current) =>
      proposal.kind === 'insert'
        ? insertTextProposal(current, proposal.afterBlockId ?? '', proposal.newText)
        : applyTextProposal(current, proposal.blockId, proposal.newText, proposal.partId),
    )
    return { change: change ?? undefined, appliedAt: Date.now() }
  }, [])

  const acceptProposal = useCallback(
    (messageId: string, index: number): void => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.kind !== 'reply') return
      const proposal = message.proposals[index]
      if (!proposal || proposal.status !== 'pending') return
      const applied = applyProposal(proposal)
      if (!applied) {
        notice(labels.blockGone, 'error')
        return
      }
      update(messageId, (m) =>
        m.kind !== 'reply'
          ? m
          : { ...m, proposals: m.proposals.map((p, i) => (i === index ? { ...p, status: 'accepted', ...applied } : p)) },
      )
    },
    [applyProposal, labels.blockGone, messages, notice, update],
  )

  /**
   * Accept every pending proposal of a reply. Each is its own change (Undo on
   * its card, Ctrl+Z one at a time). Proposals for text edited since, or gone,
   * stay pending for the user to decide one by one.
   */
  const acceptAllProposals = useCallback(
    (messageId: string): number => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.kind !== 'reply') return 0
      const model = editorRef.current.model
      const ready = message.proposals
        .map((proposal, index) => ({ proposal, index }))
        .filter(({ proposal }) => {
          if (proposal.status !== 'pending') return false
          if (proposal.kind === 'insert') return true
          return proposalTargetText(model, proposal.blockId, proposal.partId) === proposal.baseText
        })
      // Replacements first, then new clauses back to front, so several after one block keep their order.
      const order = [
        ...ready.filter(({ proposal }) => proposal.kind !== 'insert'),
        ...ready.filter(({ proposal }) => proposal.kind === 'insert').reverse(),
      ]
      const results = new Map<number, NonNullable<ReturnType<typeof applyProposal>>>()
      for (const { proposal, index } of order) {
        const applied = applyProposal(proposal)
        if (applied) results.set(index, applied)
      }
      if (results.size === 0) return 0
      update(messageId, (m) =>
        m.kind !== 'reply'
          ? m
          : {
              ...m,
              proposals: m.proposals.map((p, i) => {
                const applied = results.get(i)
                return applied ? { ...p, status: 'accepted', ...applied } : p
              }),
            },
      )
      return results.size
    },
    [applyProposal, messages, update],
  )

  const rejectProposal = useCallback(
    (messageId: string, index: number): void => {
      update(messageId, (m) =>
        m.kind !== 'reply'
          ? m
          : { ...m, proposals: m.proposals.map((p, i) => (i === index ? { ...p, status: 'rejected' } : p)) },
      )
    },
    [update],
  )

  const rejectAllProposals = useCallback(
    (messageId: string): void => {
      update(messageId, (m) =>
        m.kind !== 'reply'
          ? m
          : { ...m, proposals: m.proposals.map((p) => (p.status === 'pending' ? { ...p, status: 'rejected' } : p)) },
      )
    },
    [update],
  )

  const undo = useCallback(
    (change: TrackedChange): void => {
      const result = editorRef.current.revertChange(change)
      if (result.skipped > 0) {
        const text = labels.keptEditedBlocks(result.skipped)
        notice(text)
        onNotice?.(text)
      }
    },
    [labels, notice, onNotice],
  )

  const undoProposal = useCallback(
    (messageId: string, index: number): void => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.kind !== 'reply') return
      const proposal = message.proposals[index]
      if (!proposal?.change || proposal.status !== 'accepted') return
      undo(proposal.change)
      update(messageId, (m) =>
        m.kind !== 'reply'
          ? m
          : { ...m, proposals: m.proposals.map((p, i) => (i === index ? { ...p, status: 'undone' } : p)) },
      )
    },
    [messages, undo, update],
  )

  const undoFieldSync = useCallback(
    (messageId: string): void => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.kind !== 'field-sync' || message.status !== 'applied') return
      undo(message.change)
      update(messageId, (m) => (m.kind === 'field-sync' ? { ...m, status: 'undone' } : m))
    },
    [messages, undo, update],
  )

  /**
   * Answer an assistant question. A question tied to a guided field fills
   * that field; when the document still has placeholders, the assistant is
   * asked to propose filling them (the user still reviews the proposal).
   */
  const answerQuestion = useCallback(
    (question: AssistantQuestion, answer: string): void => {
      const value = answer.trim()
      if (!value) return
      const knownField = question.fieldId && questions.some((q) => q.id === question.fieldId)
      if (knownField && question.fieldId) {
        editorRef.current.setAnswer(question.fieldId, value)
      }
      const hasPlaceholders = findPlaceholders(editorRef.current.model).length > 0
      if (hasPlaceholders || !knownField) {
        void send(labels.answerMessage(question.question, value))
      }
    },
    [labels, questions, send],
  )

  const applyFieldUpdate = useCallback(
    (messageId: string, index: number): void => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.kind !== 'reply') return
      const updateItem = message.fieldUpdates[index]
      if (!updateItem) return
      editorRef.current.setAnswer(updateItem.fieldId, updateItem.value)
      update(messageId, (m) =>
        m.kind !== 'reply' ? m : { ...m, fieldUpdates: m.fieldUpdates.filter((_, i) => i !== index) },
      )
    },
    [messages, update],
  )

  /**
   * Run the pre-print check on the current (possibly unsaved) document.
   * `post` adds the result to the thread; the print flow posts it only when
   * the user chooses to review the problems.
   */
  const runCheck = useCallback(
    async ({ post = true }: { post?: boolean } = {}): Promise<DocumentCheckResult> => {
      setChecking(true)
      try {
        const { model, answers } = editorRef.current
        const result = await runDocumentCheck({ documentId, model, answers, questions })
        if (post) append({ id: newMessageId(), createdAt: Date.now(), role: 'assistant', kind: 'check', result })
        return result
      } finally {
        setChecking(false)
      }
    },
    [append, documentId, questions],
  )

  const postCheck = useCallback(
    (result: DocumentCheckResult): void => {
      append({ id: newMessageId(), createdAt: Date.now(), role: 'assistant', kind: 'check', result })
    },
    [append],
  )

  const clearThread = useCallback((): void => {
    setMessages([])
    setUnread(0)
  }, [])

  const markRead = useCallback((): void => setUnread(0), [])

  return {
    messages,
    sending,
    checking,
    unread,
    markRead,
    send,
    postGenerationNotes,
    postFieldSync,
    acceptProposal,
    acceptAllProposals,
    rejectProposal,
    rejectAllProposals,
    undoProposal,
    undoFieldSync,
    answerQuestion,
    applyFieldUpdate,
    runCheck,
    postCheck,
    clearThread,
    /** Current plain text of a block (for diffs / stale checks). */
    currentBlockText: (blockId: string): string | null => {
      const block = editorRef.current.model.blocks.find((b) => b.id === blockId)
      return block ? blockPlainText(block) : null
    },
    /** Current text of what a replace proposal rewrites (a paragraph, list item or cell); null when gone. */
    currentTargetText: (blockId: string, partId?: string): string | null =>
      proposalTargetText(editorRef.current.model, blockId, partId),
    blockType: (blockId: string): string | null =>
      editorRef.current.model.blocks.find((b) => b.id === blockId)?.type ?? null,
    /** An informational line in the thread. */
    postNotice: (text: string): void => notice(text),
  }
}

export type AssistantController = ReturnType<typeof useAssistant>
