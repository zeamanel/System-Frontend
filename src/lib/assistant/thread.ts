import { env } from '../../config/env'
import { apiClient } from '../api'
import type { AssistantMessage } from './types'

/**
 * The assistant's conversation kept with the document
 * (GET/PUT /documents/:id/assistant-thread), so it is there after closing
 * the tab and on another device. Demo mode keeps it in this browser.
 *
 * What is kept: the messages, without the undo data of applied changes
 * (undo only works in the session that applied them) and without
 * field-sync notes (they are about this session's edits).
 */

const DEMO_KEY = 'docuA4.fixture.assistantThreads'
const isHttp = (): boolean => env.dataSource === 'http'

const KINDS = new Set(['text', 'reply', 'generation-notes', 'notice', 'side-stale', 'check'])

/** The messages as kept: no undo data, no field-sync notes, nothing still streaming. */
export function toStoredThread(messages: readonly AssistantMessage[]): AssistantMessage[] {
  return messages.flatMap((message): AssistantMessage[] => {
    if (message.kind === 'field-sync') return []
    if (message.kind !== 'reply') return [message]
    if (message.streaming) return []
    return [
      {
        ...message,
        proposals: message.proposals.map(({ change: _change, appliedAt: _appliedAt, ...proposal }) => proposal),
      },
    ]
  })
}

/** Messages read back from storage: only well-formed ones of known kinds. */
export function fromStoredThread(value: unknown): AssistantMessage[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is AssistantMessage => {
    if (!item || typeof item !== 'object') return false
    const message = item as Partial<AssistantMessage>
    if (typeof message.id !== 'string' || typeof message.kind !== 'string' || !KINDS.has(message.kind)) return false
    if (message.kind === 'reply') {
      const reply = message as { text?: unknown; proposals?: unknown; questions?: unknown; fieldUpdates?: unknown }
      return typeof reply.text === 'string' && Array.isArray(reply.proposals) && Array.isArray(reply.questions) && Array.isArray(reply.fieldUpdates)
    }
    if (message.kind === 'text' || message.kind === 'notice') return typeof (message as { text?: unknown }).text === 'string'
    return true
  })
}

function readDemo(): Record<string, unknown[]> {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(DEMO_KEY) ?? '{}') as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown[]>) : {}
  } catch {
    return {}
  }
}

export async function loadAssistantThread(documentId: string, signal?: AbortSignal): Promise<AssistantMessage[]> {
  if (!isHttp()) return fromStoredThread(readDemo()[documentId])
  const response = await apiClient.get<{ messages?: unknown }>(`/documents/${encodeURIComponent(documentId)}/assistant-thread`, {
    signal,
    auth: 'required',
  })
  return fromStoredThread(response?.messages)
}

export async function saveAssistantThread(documentId: string, messages: readonly AssistantMessage[]): Promise<void> {
  const stored = toStoredThread(messages)
  if (!isHttp()) {
    try {
      globalThis.localStorage?.setItem(DEMO_KEY, JSON.stringify({ ...readDemo(), [documentId]: stored }))
    } catch {
      // Not kept in this browser.
    }
    return
  }
  await apiClient.put(`/documents/${encodeURIComponent(documentId)}/assistant-thread`, { messages: stored }, { auth: 'required' })
}
