import { env } from '../../config/env'
import { ApiError, apiClient, RateLimitError } from '../api'
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
  client?: {
    post: <T>(
      path: string,
      body?: unknown,
      options?: {
        signal?: AbortSignal
        auth?: 'required' | 'optional'
        responseType?: 'json' | 'response'
        headers?: Record<string, string>
      },
    ) => Promise<T>
  }
  dataSource?: 'fixtures' | 'http'
  /**
   * Streams the answer: called with the reply text so far and the proposals
   * that are complete, as they arrive. The returned reply is the final one.
   */
  onPartial?: (partial: AssistantPartial) => void
}

export interface AssistantPartial {
  reply: string
  proposals: AssistantReply['proposals']
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
    const response = options.onPartial
      ? await readStreamedAnswer(
          await client.post<Response | Partial<AssistantReply>>('/ai/assistant', input, {
            signal: options.signal,
            auth: 'required',
            responseType: 'response',
            headers: { Accept: 'application/x-ndjson, application/json' },
          }),
          options.onPartial,
        )
      : await client.post<Partial<AssistantReply>>('/ai/assistant', input, {
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

type StreamEvent =
  | { type: 'reply'; text: string }
  | { type: 'proposal'; proposal: AssistantReply['proposals'][number] }
  | { type: 'done'; response: Partial<AssistantReply> }
  | { type: 'error'; code?: string; message?: string }

function isResponse(value: unknown): value is Response {
  return (
    typeof value === 'object' &&
    value !== null &&
    'headers' in value &&
    typeof (value as Response).headers?.get === 'function'
  )
}

/**
 * Reads a streamed answer (one JSON event per line), reporting the reply and
 * proposals as they arrive. A backend that does not stream answers with
 * plain JSON, which is returned as it is.
 */
async function readStreamedAnswer(
  result: Response | Partial<AssistantReply>,
  onPartial: (partial: AssistantPartial) => void,
): Promise<Partial<AssistantReply>> {
  if (!isResponse(result)) return result
  if (!result.headers.get('content-type')?.includes('application/x-ndjson') || !result.body) {
    return (await result.json()) as Partial<AssistantReply>
  }
  const reader = result.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let reply = ''
  const proposals: AssistantReply['proposals'] = []

  const handle = (line: string): Partial<AssistantReply> | null => {
    if (!line.trim()) return null
    const event = JSON.parse(line) as StreamEvent
    switch (event.type) {
      case 'reply':
        reply = event.text
        onPartial({ reply, proposals: [...proposals] })
        return null
      case 'proposal':
        proposals.push(event.proposal)
        onPartial({ reply, proposals: [...proposals] })
        return null
      case 'done':
        return event.response
      case 'error':
        throw new ApiError(503, event.message ?? 'The assistant could not answer.', event.code)
      default:
        return null
    }
  }

  for (;;) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split('\n')
    buffer = done ? '' : (lines.pop() ?? '')
    for (const line of lines) {
      const final = handle(line)
      if (final) {
        void reader.cancel().catch(() => undefined)
        return final
      }
    }
    if (done) break
  }
  throw new ApiError(0, 'The answer was cut off. Check your connection and try again.')
}
