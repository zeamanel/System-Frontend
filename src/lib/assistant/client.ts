import { env } from '../../config/env'
import { apiClient, RateLimitError } from '../api'
import type { DocumentModel } from '../editor/types'
import { findPlaceholders } from './context'
import type {
  AssistantOfflineInfo,
  AssistantReply,
  AssistantRequestInput,
} from './types'

/**
 * Document assistant client (POST /api/v1/ai/assistant).
 *
 * The assistant only ever PROPOSES changes; the editor applies them after
 * the user accepts. When the AI cannot be reached (demo/fixture mode,
 * network error, quota or rate limit) the client never pretends: it returns
 * an `offline` reply carrying a deterministic local check (empty required
 * fields, leftover placeholders) and the reason, which the UI states.
 */

export interface AskAssistantOptions {
  model: DocumentModel
  questions: Array<{ id: string; label: string; required?: boolean }>
  signal?: AbortSignal
  /** Test seam; defaults to the live API client. */
  client?: { post: <T>(path: string, body?: unknown, options?: { signal?: AbortSignal; auth?: 'required' | 'optional' }) => Promise<T> }
  dataSource?: 'fixtures' | 'http'
}

export function localDocumentCheck(
  model: DocumentModel,
  questions: AskAssistantOptions['questions'],
  answers: Record<string, string>,
  reason: AssistantOfflineInfo['reason'],
): AssistantOfflineInfo {
  return {
    reason,
    emptyRequired: questions
      .filter((q) => q.required && !(answers[q.id] ?? '').trim())
      .map((q) => ({ fieldId: q.id, label: q.label })),
    placeholders: findPlaceholders(model).slice(0, 20),
  }
}

function offlineReply(info: AssistantOfflineInfo): AssistantReply {
  return {
    reply: '',
    questions: info.emptyRequired.map((field) => ({ fieldId: field.fieldId, question: field.label })),
    proposals: [],
    fieldUpdates: [],
    offline: info,
  }
}

export async function askAssistant(
  input: AssistantRequestInput,
  options: AskAssistantOptions,
): Promise<AssistantReply> {
  const dataSource = options.dataSource ?? env.dataSource
  if (dataSource !== 'http' && !options.client) {
    return offlineReply(localDocumentCheck(options.model, options.questions, input.answers, 'demo'))
  }

  const client = options.client ?? apiClient
  try {
    const response = await client.post<Partial<AssistantReply>>('/ai/assistant', input, {
      signal: options.signal,
      auth: 'required',
    })
    return {
      reply: typeof response.reply === 'string' ? response.reply : '',
      questions: Array.isArray(response.questions) ? response.questions : [],
      proposals: Array.isArray(response.proposals) ? response.proposals : [],
      fieldUpdates: Array.isArray(response.fieldUpdates) ? response.fieldUpdates : [],
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    const reason: AssistantOfflineInfo['reason'] =
      error instanceof RateLimitError
        ? error.code === 'QUOTA_EXCEEDED'
          ? 'quota'
          : 'rate-limit'
        : 'unavailable'
    return offlineReply(localDocumentCheck(options.model, options.questions, input.answers, reason))
  }
}
