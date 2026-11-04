import type { DocumentCheckResult } from '../document-check/check'
import type { TrackedChange } from '../editor/tracked-change'

/** What the assistant says right after it drafts a document (backend contract). */
export interface AssistantNotes {
  summary: string
  questions: AssistantQuestion[]
  assumptions: string[]
  warnings: string[]
}

export interface AssistantQuestion {
  /** Guided-field id the answer belongs to, when one applies. */
  fieldId?: string
  question: string
}

/** A block-scoped change the assistant proposes; applied only on Accept. */
export interface AssistantProposal {
  /** "replace" rewrites `blockId`; "insert" adds a new paragraph after `afterBlockId`. */
  kind: 'replace' | 'insert'
  blockId: string
  /** Replace only: the list item or table cell of `blockId` it rewrites (absent = the whole paragraph). */
  partId?: string
  /** Insert only: the block the new clause goes after ('' = at the end). */
  afterBlockId?: string
  newText: string
  reason: string
  /** Block (or part) text when the assistant saw it; differs from now → edited since. */
  baseText: string
  status: 'pending' | 'accepted' | 'rejected' | 'undone'
  /** Set once accepted, so the change can be undone. */
  change?: TrackedChange
  /** Client time of acceptance (to report "saved" honestly). */
  appliedAt?: number
}

export interface AssistantFieldUpdate {
  fieldId: string
  value: string
  reason: string
}

interface MessageBase {
  id: string
  createdAt: number
}

export type AssistantMessage =
  | (MessageBase & { role: 'user'; kind: 'text'; text: string })
  | (MessageBase & {
      role: 'assistant'
      kind: 'reply'
      text: string
      questions: AssistantQuestion[]
      proposals: AssistantProposal[]
      fieldUpdates: AssistantFieldUpdate[]
      /** Set when the AI was not reached and this is the offline check. */
      offline?: AssistantOfflineInfo
    })
  | (MessageBase & { role: 'assistant'; kind: 'generation-notes'; notes: AssistantNotes })
  | (MessageBase & {
      role: 'system'
      kind: 'field-sync'
      questionId: string
      from: string
      to: string
      places: number
      change: TrackedChange
      status: 'applied' | 'undone'
    })
  | (MessageBase & { role: 'system'; kind: 'notice'; text: string; tone: 'info' | 'error' })
  | (MessageBase & { role: 'assistant'; kind: 'check'; result: DocumentCheckResult })

/** Plain-text projection of one block, as sent to the assistant. */
export interface AssistantContextBlock {
  id: string
  type: string
  text: string
  /** Parts of a list or table the assistant may rewrite: list items and description cells. */
  parts?: Array<{ id: string; text: string }>
}

/** What the assistant works on: the whole document, the page with the cursor, or the selected block. */
export type AssistantScope = 'document' | 'page' | 'block'

export interface AssistantRequestInput {
  documentId: string
  message: string
  selectedBlockId?: string
  scope?: AssistantScope
  /** Page scope: the blocks on that page. */
  scopeBlockIds?: string[]
  blocks: AssistantContextBlock[]
  answers: Record<string, string>
  history: Array<{ role: 'user' | 'assistant'; text: string }>
  /** This client can apply new-clause (insert) proposals. */
  allowInsert?: boolean
}

/** Why the AI was not reached, plus what the offline check found. */
export interface AssistantOfflineInfo {
  reason: 'demo' | 'unavailable' | 'quota' | 'rate-limit'
  emptyRequired: Array<{ fieldId: string; label: string }>
  placeholders: Array<{ blockId: string; text: string; context: string }>
}

export interface AssistantReply {
  reply: string
  questions: AssistantQuestion[]
  proposals: Array<{
    kind?: 'replace' | 'insert'
    blockId: string
    partId?: string
    afterBlockId?: string
    newText: string
    reason: string
  }>
  fieldUpdates: AssistantFieldUpdate[]
  offline?: AssistantOfflineInfo
}
