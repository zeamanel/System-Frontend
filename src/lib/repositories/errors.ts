/**
 * Repository-layer errors. Thrown by fixture and HTTP implementations alike
 * so UI code can branch on error identity instead of message parsing.
 */

/**
 * The document changed elsewhere after the editor loaded it (HTTP 409 or a
 * fixture-detected mismatch). The caller decides between reloading the remote
 * version and overwriting.
 */
export class DocumentConflictError extends Error {
  readonly remoteUpdatedAt: string | undefined
  /**
   * The backend's authoritative version number when the conflict response
   * carried one (HTTP 409 VERSION_CONFLICT) — the editor offers to reload
   * this version.
   */
  readonly currentVersion: number | undefined

  constructor(
    message = 'Document was modified by another session.',
    remoteUpdatedAt?: string,
    currentVersion?: number,
  ) {
    super(message)
    this.name = 'DocumentConflictError'
    this.remoteUpdatedAt = remoteUpdatedAt
    this.currentVersion = currentVersion
  }
}

/**
 * The requested export requires a backend rendering service that is not
 * reachable / not configured. Surfaced honestly in the UI — never hidden
 * behind a fake success.
 */
export class ExportUnavailableError extends Error {
  constructor(message = 'Export service is not configured.') {
    super(message)
    this.name = 'ExportUnavailableError'
  }
}
