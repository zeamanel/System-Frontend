import { env } from '../../config/env'
import { apiClient, ApiError, RateLimitError } from '../api'

/**
 * Google Connections over /google/*: a person's own Google account, used to
 * save documents to their Drive and read spreadsheets they pick. Off in demo
 * mode and until the server has its Google keys; in an organization, off
 * until an owner or admin turns it on.
 */

export interface GoogleConnection {
  /** The server has its Google keys. */
  configured: boolean
  /** Spreadsheets can be picked (the Google picker is set up). */
  sheetsConfigured: boolean
  /** May be used now: set up, and the organization allows it. */
  allowed: boolean
  /** The person's organization: its switch, and whether they may change it. */
  organization: { enabled: boolean; canChange: boolean } | null
  connected: boolean
  email: string | null
  connectedAt: string | null
}

export const GOOGLE_OFF: GoogleConnection = {
  configured: false,
  sheetsConfigured: false,
  allowed: false,
  organization: null,
  connected: false,
  email: null,
  connectedAt: null,
}

export type GoogleFailure = 'not-configured' | 'not-allowed' | 'not-connected' | 'reconnect' | 'file-not-available' | 'rate-limit' | 'failed'

export class GoogleError extends Error {
  readonly reason: GoogleFailure
  constructor(reason: GoogleFailure) {
    super(`Google: ${reason}`)
    this.name = 'GoogleError'
    this.reason = reason
  }
}

const CODES: Record<string, GoogleFailure> = {
  GOOGLE_NOT_CONFIGURED: 'not-configured',
  GOOGLE_NOT_ALLOWED: 'not-allowed',
  GOOGLE_NOT_CONNECTED: 'not-connected',
  GOOGLE_RECONNECT: 'reconnect',
  GOOGLE_FILE_NOT_AVAILABLE: 'file-not-available',
}

function asGoogleError(error: unknown): GoogleError {
  if (error instanceof GoogleError) return error
  if (error instanceof RateLimitError) return new GoogleError('rate-limit')
  if (error instanceof ApiError && error.code && CODES[error.code]) return new GoogleError(CODES[error.code])
  return new GoogleError('failed')
}

const online = (): boolean => env.dataSource === 'http'

/** Where the person stands; everything off in demo mode or with an older server. */
export async function getGoogleConnection(): Promise<GoogleConnection> {
  if (!online()) return GOOGLE_OFF
  try {
    const raw = await apiClient.get<Partial<GoogleConnection>>('/google/connection', { auth: 'required' })
    return {
      configured: raw.configured === true,
      sheetsConfigured: raw.sheetsConfigured === true,
      allowed: raw.allowed === true,
      organization:
        raw.organization && typeof raw.organization === 'object'
          ? { enabled: raw.organization.enabled === true, canChange: raw.organization.canChange === true }
          : null,
      connected: raw.connected === true,
      email: typeof raw.email === 'string' ? raw.email : null,
      connectedAt: typeof raw.connectedAt === 'string' ? raw.connectedAt : null,
    }
  } catch {
    return GOOGLE_OFF
  }
}

/** The Google consent address to send the browser to. */
export async function startGoogleConnect(): Promise<string> {
  try {
    const { url } = await apiClient.post<{ url?: unknown }>('/google/connect', {}, { auth: 'required' })
    if (typeof url !== 'string' || !url.startsWith('https://accounts.google.com/')) throw new GoogleError('failed')
    return url
  } catch (error) {
    throw asGoogleError(error)
  }
}

export async function disconnectGoogle(): Promise<void> {
  try {
    await apiClient.delete<void>('/google/connection', { auth: 'required' })
  } catch (error) {
    throw asGoogleError(error)
  }
}

/** Owners and admins: allow or stop Drive and Sheets for everyone in the organization. */
export async function setOrganizationGoogle(enabled: boolean): Promise<void> {
  await apiClient.patch('/organization', { google: { enabled } }, { auth: 'required' })
}

export interface DriveFile {
  fileId: string
  name: string
  webViewLink: string | null
}

/** The document as saved now, into the SenedDesk folder of the person's Drive. */
export async function saveToDrive(documentId: string, format: 'pdf' | 'docx' = 'pdf'): Promise<DriveFile> {
  try {
    const file = await apiClient.post<Partial<DriveFile>>('/google/drive/save', { documentId, format }, { auth: 'required' })
    if (typeof file.fileId !== 'string') throw new GoogleError('failed')
    return {
      fileId: file.fileId,
      name: typeof file.name === 'string' ? file.name : '',
      webViewLink: typeof file.webViewLink === 'string' && file.webViewLink.startsWith('https://') ? file.webViewLink : null,
    }
  } catch (error) {
    throw asGoogleError(error)
  }
}

export interface PickerSession {
  accessToken: string
  apiKey: string
  appId: string
}

export async function getPickerSession(): Promise<PickerSession> {
  try {
    const session = await apiClient.post<Partial<PickerSession>>('/google/picker-session', {}, { auth: 'required' })
    if (typeof session.accessToken !== 'string' || typeof session.apiKey !== 'string' || typeof session.appId !== 'string') {
      throw new GoogleError('failed')
    }
    return { accessToken: session.accessToken, apiKey: session.apiKey, appId: session.appId }
  } catch (error) {
    throw asGoogleError(error)
  }
}

export interface SheetRows {
  rows: string[][]
  title: string
  sheet: string
  totalRows: number
}

/** A picked spreadsheet's first (or named) tab as rows of text. */
export async function readGoogleSheet(spreadsheetId: string, sheet?: string): Promise<SheetRows> {
  try {
    const read = await apiClient.post<{ rows?: unknown; title?: unknown; sheet?: unknown; totalRows?: unknown }>(
      '/google/sheets/read',
      sheet ? { spreadsheetId, sheet } : { spreadsheetId },
      { auth: 'required' },
    )
    const rows = Array.isArray(read.rows)
      ? read.rows.map((row) => (Array.isArray(row) ? row.map((cell) => (typeof cell === 'string' ? cell : '')) : []))
      : []
    return {
      rows,
      title: typeof read.title === 'string' ? read.title : '',
      sheet: typeof read.sheet === 'string' ? read.sheet : '',
      totalRows: typeof read.totalRows === 'number' ? read.totalRows : rows.length,
    }
  } catch (error) {
    throw asGoogleError(error)
  }
}
