import { apiClient } from '../client'
import type { ApiClient } from '../client'
import { env } from '../../../config/env'
import type { DataSource } from '../../../config/env'

export interface CreateTelegramSessionInput {
  documentId?: string
  locale?: string
  requestedScope?: ('profile' | 'file')[]
}

export interface TelegramBridgeSessionRecord {
  sessionId: string
  pageCode: string
  botUsername: string
  deepLink: string
  expiresInSeconds: number
}

export type TelegramBridgeStatus =
  | 'pending'
  | 'pinged'
  | 'awaiting_file'
  | 'completed'
  | 'denied'

export interface TelegramProfile {
  fullName?: string
  phone?: string
  address?: string
  idNumber?: string
  extraInfo?: string
}

export interface TelegramBridgeStatusRecord {
  sessionId: string
  pageCode: string
  status: TelegramBridgeStatus
  profile?: TelegramProfile
  filename?: string
  text?: string
  completedAt?: string
}

export interface PingTelegramQalIdInput {
  qalId: string
}

export interface PingTelegramQalIdResponse {
  ok: boolean
  status: 'pinged'
  qalId: string
}

export interface TelegramBridgeOptions {
  client?: ApiClient
  dataSource?: DataSource
}

// ---------- Deterministic in-memory simulation for fixture mode ----------

interface FixtureSessionState {
  sessionId: string
  pageCode: string
  botUsername: string
  deepLink: string
  expiresInSeconds: number
  status: TelegramBridgeStatus
  profile?: TelegramProfile
  filename?: string
  text?: string
  completedAt?: string
  qalId?: string
}

const fixtureSessions = new Map<string, FixtureSessionState>()
let fixtureSessionCounter = 1000

export function __resetTelegramBridgeFixtures(): void {
  fixtureSessions.clear()
  fixtureSessionCounter = 1000
}

export function __setFixtureSession(
  sessionId: string,
  patch: Partial<FixtureSessionState>,
): void {
  const existing = fixtureSessions.get(sessionId)
  if (existing) {
    Object.assign(existing, patch)
  } else {
    fixtureSessions.set(sessionId, {
      sessionId,
      pageCode: '4815',
      botUsername: 'Qal_copy_bot',
      deepLink: 'https://t.me/Qal_copy_bot?start=code_4815',
      expiresInSeconds: 900,
      status: 'pending',
      ...patch,
    })
  }
}

function isFixtureMode(options?: TelegramBridgeOptions): boolean {
  if (options?.client) return false
  return (options?.dataSource ?? env.dataSource) === 'fixtures'
}

/**
 * Creates a new Telegram Bridge session.
 * In HTTP mode: POST /api/v1/telegram-bridge/sessions
 * In Fixture mode: returns deterministic session with 4-digit pageCode.
 */
export async function createTelegramBridgeSession(
  input: CreateTelegramSessionInput = {},
  options?: TelegramBridgeOptions,
): Promise<TelegramBridgeSessionRecord> {
  if (isFixtureMode(options)) {
    fixtureSessionCounter += 1
    const sessionId = `qal_sess_${fixtureSessionCounter}`
    const pageCode = '4815'
    const record: TelegramBridgeSessionRecord = {
      sessionId,
      pageCode,
      botUsername: 'Qal_copy_bot',
      deepLink: `https://t.me/Qal_copy_bot?start=code_${pageCode}`,
      expiresInSeconds: 900,
    }
    fixtureSessions.set(sessionId, {
      ...record,
      status: 'pending',
    })
    return record
  }

  const client = options?.client ?? apiClient
  return client.post<TelegramBridgeSessionRecord>(
    '/telegram-bridge/sessions',
    input,
    { auth: 'optional' },
  )
}

/**
 * Sends a permission ping from the webpage to the Telegram user with the given 4-digit Qal ID.
 * In HTTP mode: POST /api/v1/telegram-bridge/sessions/:id/ping
 * In Fixture mode: marks session as 'pinged' (or 'denied' if 9999, or 404 if 0000).
 */
export async function pingTelegramQalId(
  sessionId: string,
  input: PingTelegramQalIdInput,
  options?: TelegramBridgeOptions,
): Promise<PingTelegramQalIdResponse> {
  if (isFixtureMode(options)) {
    const trimmed = input.qalId.trim()
    if (!/^\d{4}$/.test(trimmed)) {
      const err = new Error('Invalid 4-digit Qal ID')
      ;(err as unknown as { status: number }).status = 400
      throw err
    }
    if (trimmed === '0000') {
      const err = new Error('No Telegram user registered with this 4-digit Qal ID.')
      ;(err as unknown as { status: number }).status = 404
      throw err
    }

    const session = fixtureSessions.get(sessionId)
    if (!session) {
      const err = new Error('Session not found')
      ;(err as unknown as { status: number }).status = 404
      throw err
    }

    session.qalId = trimmed
    if (trimmed === '9999') {
      session.status = 'denied'
    } else {
      session.status = 'pinged'
    }

    return {
      ok: true,
      status: 'pinged',
      qalId: trimmed,
    }
  }

  const client = options?.client ?? apiClient
  return client.post<PingTelegramQalIdResponse>(
    `/telegram-bridge/sessions/${encodeURIComponent(sessionId)}/ping`,
    input,
    { auth: 'optional' },
  )
}

/**
 * Retrieves the current status of a Telegram Bridge session.
 * In HTTP mode: GET /api/v1/telegram-bridge/sessions/:id
 * In Fixture mode: returns current status, automatically transitioning 'pinged' to 'completed'.
 */
export async function getTelegramBridgeSessionStatus(
  sessionId: string,
  options?: TelegramBridgeOptions,
): Promise<TelegramBridgeStatusRecord> {
  if (isFixtureMode(options)) {
    const session = fixtureSessions.get(sessionId)
    if (!session) {
      const err = new Error('Session not found')
      ;(err as unknown as { status: number }).status = 404
      throw err
    }

    // When status was pinged, simulate the user tapping [Allow] and sending data
    if (session.status === 'pinged') {
      session.status = 'completed'
      session.profile = session.profile ?? {
        fullName: 'Abebe Bikila',
        phone: '+251911223344',
        address: 'Addis Ababa, Kirkos Sub-City, Woreda 03',
        idNumber: 'ET-AA-2024-98765',
        extraInfo: 'Authorized representative for property transaction',
      }
      session.filename = session.filename ?? 'Vehicle_Sale_Agreement.txt'
      session.text =
        session.text ??
        'Vehicle Sale Agreement\n\nThis agreement is made between Abebe Bikila (Seller) and Kebede Chala (Buyer) for the sale of a 2022 Toyota Corolla for 900,000 Birr.\n\nPayment to be completed in full before vehicle handover.'
      session.completedAt = session.completedAt ?? new Date().toISOString()
    }

    return {
      sessionId: session.sessionId,
      pageCode: session.pageCode,
      status: session.status,
      profile: session.profile,
      filename: session.filename,
      text: session.text,
      completedAt: session.completedAt,
    }
  }

  const client = options?.client ?? apiClient
  return client.get<TelegramBridgeStatusRecord>(
    `/telegram-bridge/sessions/${encodeURIComponent(sessionId)}`,
    { auth: 'optional' },
  )
}
