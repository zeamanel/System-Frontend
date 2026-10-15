/**
 * Idempotency keys for unsafe backend operations (POST /documents,
 * POST /ai/generate). The backend replays the original response when the same
 * key is re-sent with the same payload, so a retry after a network failure
 * can never create a duplicate.
 *
 * Rule: one key per USER ACTION, not per attempt. Generate when the user
 * commits the action and reuse it for retries of that same action.
 */

/** Fresh RFC-4122 v4 UUID (with a defensive fallback for old runtimes). */
export function generateKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * Deterministic key for the implicit document creation that follows a
 * completed generation job. Derived from the job id so concurrent polls or
 * replays can never create the document twice.
 */
export function generationDocumentKey(jobId: string): string {
  return `generation-doc-${jobId}`
}
