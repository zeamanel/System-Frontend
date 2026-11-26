import type { MessageKey } from '../../i18n'
import type { GoogleFailure } from '../../lib/google/client'
import type { SheetPick } from '../../lib/google/sheets'

/** What to tell the person when a Google step did not work. */
export function googleErrorKey(reason: GoogleFailure | Exclude<Extract<SheetPick, { ok: false }>['reason'], 'cancelled'>): MessageKey {
  switch (reason) {
    case 'not-configured':
      return 'google.error.notConfigured'
    case 'not-allowed':
      return 'google.error.notAllowed'
    case 'not-connected':
      return 'google.error.notConnected'
    case 'reconnect':
      return 'google.error.reconnect'
    case 'file-not-available':
      return 'google.error.fileNotAvailable'
    case 'rate-limit':
      return 'google.error.rateLimit'
    case 'picker':
      return 'google.error.picker'
    case 'empty':
      return 'google.error.empty'
    default:
      return 'google.error.failed'
  }
}

/** How "Connect Google" came back (`?google=` on the settings page). */
export const OUTCOME_KEYS: Record<string, { key: MessageKey; ok: boolean }> = {
  connected: { key: 'google.outcome.connected', ok: true },
  denied: { key: 'google.outcome.denied', ok: false },
  expired: { key: 'google.outcome.expired', ok: false },
  scope: { key: 'google.outcome.scope', ok: false },
  not_allowed: { key: 'google.outcome.notAllowed', ok: false },
  failed: { key: 'google.outcome.failed', ok: false },
}
