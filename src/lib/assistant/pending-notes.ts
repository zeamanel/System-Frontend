import type { AssistantNotes } from './types'

/**
 * Hand-off of post-generation assistant notes from the generation
 * repository (which sees the finished job) to the editor (which shows them).
 * Kept in sessionStorage under the `docuA4.` prefix, so sign-out wipes it.
 */

const PREFIX = 'docuA4.assistant.pending.'

interface PendingNotes {
  jobId: string
  notes: AssistantNotes
}

export function hasNoteContent(notes: AssistantNotes | null | undefined): notes is AssistantNotes {
  return Boolean(
    notes &&
      (notes.summary?.trim() ||
        notes.questions?.length ||
        notes.assumptions?.length ||
        notes.warnings?.length),
  )
}

export function stashPendingNotes(documentId: string, jobId: string, notes: AssistantNotes): void {
  if (!hasNoteContent(notes)) return
  try {
    globalThis.sessionStorage?.setItem(PREFIX + documentId, JSON.stringify({ jobId, notes }))
  } catch {
    // Non-fatal: the notes are a convenience, the document is already saved.
  }
}

/** Returns and removes the notes waiting for this document, if any. */
export function consumePendingNotes(documentId: string): PendingNotes | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(PREFIX + documentId)
    if (!raw) return null
    globalThis.sessionStorage?.removeItem(PREFIX + documentId)
    const parsed = JSON.parse(raw) as Partial<PendingNotes>
    if (!parsed.jobId || !hasNoteContent(parsed.notes)) return null
    return {
      jobId: parsed.jobId,
      notes: {
        summary: parsed.notes.summary ?? '',
        questions: parsed.notes.questions ?? [],
        assumptions: parsed.notes.assumptions ?? [],
        warnings: parsed.notes.warnings ?? [],
      },
    }
  } catch {
    return null
  }
}
