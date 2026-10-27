import { useCallback, useEffect, useRef, useState } from 'react'
import { askAssistant } from '../../lib/assistant/client'
import { runDocumentCheck, type DocumentCheckResult } from '../../lib/document-check/check'
import { applyTextProposal, blockPlainText, findPlaceholders, toAssistantBlocks } from '../../lib/assistant/context'
import type {
  AssistantMessage,
  AssistantNotes,
  AssistantQuestion,
} from '../../lib/assistant/types'
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
    return Array.isArray(parsed) ? (parsed as AssistantMessage[]) : []
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
      const blocks = toAssistantBlocks(model)
      const textById = new Map(blocks.map((b) => [b.id, b.text]))
      try {
        const reply = await askAssistant(
          {
            documentId,
            message,
            selectedBlockId: selectedBlockId ?? undefined,
            blocks,
            answers,
            history,
          },
          { model, questions, signal: controller.signal },
        )
        append({
          id: newMessageId(),
          createdAt: Date.now(),
          role: 'assistant',
          kind: 'reply',
          text: reply.reply,
          questions: reply.questions,
          proposals: reply.proposals.map((p) => ({
            ...p,
            baseText: textById.get(p.blockId) ?? '',
            status: 'pending' as const,
          })),
          fieldUpdates: reply.fieldUpdates,
          offline: reply.offline,
        })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          notice(labels.requestFailed, 'error')
        }
      } finally {
        setSending(false)
      }
    },
    [append, documentId, labels.requestFailed, messages, notice, questions, selectedBlockId, sending],
  )

  const acceptProposal = useCallback(
    (messageId: string, index: number): void => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.kind !== 'reply') return
      const proposal = message.proposals[index]
      if (!proposal || proposal.status !== 'pending') return
      const target = editorRef.current.model.blocks.find((b) => b.id === proposal.blockId)
      if (!target || (target.type !== 'paragraph' && target.type !== 'heading')) {
        notice(labels.blockGone, 'error')
        return
      }
      const change = editorRef.current.applyTrackedChange((current) =>
        applyTextProposal(current, proposal.blockId, proposal.newText),
      )
      update(messageId, (m) =>
        m.kind !== 'reply'
          ? m
          : {
              ...m,
              proposals: m.proposals.map((p, i) =>
                i === index ? { ...p, status: 'accepted', change: change ?? undefined, appliedAt: Date.now() } : p,
              ),
            },
      )
    },
    [labels.blockGone, messages, notice, update],
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
    rejectProposal,
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
  }
}

export type AssistantController = ReturnType<typeof useAssistant>
