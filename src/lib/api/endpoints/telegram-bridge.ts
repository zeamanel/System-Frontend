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
  | 'expired'
  | 'revoked'
  | 'dismissed'

export type TelegramImageKind = 'id_card' | 'document_text' | 'media_photo'

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
  imageDataUrl?: string | null
  mimeType?: string | null
  imageKind?: TelegramImageKind | null
}

export interface PingTelegramQalIdInput {
  qalId: string
}

export interface PingTelegramQalIdResponse {
  ok: boolean
  status: 'pinged'
  qalId: string
}

export interface TelegramHubItem {
  id: string
  sessionId: string
  qalId: string
  accountLabel: string
  fullName?: string
  filename: string
  mimeType: string
  imageKind?: TelegramImageKind | null
  imageDataUrl?: string | null
  text: string
  profile: TelegramProfile
  createdAt: string
}

export interface TelegramHubAccount {
  qalId: string
  accountLabel: string
  fullName?: string
  itemCount: number
}

export interface TelegramHubMediaResponse {
  items: TelegramHubItem[]
  accounts: TelegramHubAccount[]
}

export interface TelegramBotHealthResponse {
  ok: boolean
  configured: boolean
  status: 'ready' | 'missing_token' | 'error'
  bot?: { id: number; username?: string; first_name?: string }
  webhook?: { url?: string; has_custom_certificate?: boolean; pending_update_count?: number }
  registeredAdminChatId?: string | null
  message?: string
}

export interface SyncTelegramWebhookResponse {
  ok: boolean
  webhookUrl: string
  description?: string
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
  imageDataUrl?: string | null
  mimeType?: string | null
  imageKind?: TelegramImageKind | null
}

const fixtureSessions = new Map<string, FixtureSessionState>()
let fixtureSessionCounter = 1000

let fixtureHubItems: TelegramHubItem[] = [
  {
    id: 'evt_fixture_1',
    sessionId: 'qal_hub_1',
    qalId: '7392',
    accountLabel: '@abebe_k (Qal ID: 7392)',
    fullName: 'Abebe Bikila',
    filename: 'Vehicle_Sale_Agreement.txt',
    mimeType: 'text/plain',
    imageKind: null,
    imageDataUrl: null,
    text: 'Vehicle Sale Agreement between Abebe Bikila (Seller) and Kebede Chala (Buyer) for Toyota Corolla.',
    profile: {
      fullName: 'Abebe Bikila',
      phone: '+251911223344',
      address: 'Addis Ababa, Kirkos Sub-City, Woreda 03',
      idNumber: 'ET-AA-2024-98765',
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'evt_fixture_2',
    sessionId: 'qal_hub_2',
    qalId: '4815',
    accountLabel: '@almaz_k (Qal ID: 4815)',
    fullName: 'Almaz Kebede',
    filename: 'almaz-id-card.png',
    mimeType: 'image/png',
    imageKind: 'id_card',
    imageDataUrl:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    text: 'Ethiopian Resident ID Card: Almaz Kebede, Bole Sub-City, Woreda 03, ID: ET-AA-481516',
    profile: {
      fullName: 'Almaz Kebede',
      phone: '+251911445566',
      address: 'Bole Sub-City, Woreda 03',
      idNumber: 'ET-AA-481516',
    },
    createdAt: new Date().toISOString(),
  },
]

export function __resetTelegramBridgeFixtures(): void {
  fixtureSessions.clear()
  fixtureSessionCounter = 1000
  fixtureHubItems = [
    {
      id: 'evt_fixture_1',
      sessionId: 'qal_hub_1',
      qalId: '7392',
      accountLabel: '@abebe_k (Qal ID: 7392)',
      fullName: 'Abebe Bikila',
      filename: 'Vehicle_Sale_Agreement.txt',
      mimeType: 'text/plain',
      imageKind: null,
      imageDataUrl: null,
      text: 'Vehicle Sale Agreement between Abebe Bikila (Seller) and Kebede Chala (Buyer) for Toyota Corolla.',
      profile: {
        fullName: 'Abebe Bikila',
        phone: '+251911223344',
        address: 'Addis Ababa, Kirkos Sub-City, Woreda 03',
        idNumber: 'ET-AA-2024-98765',
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'evt_fixture_2',
      sessionId: 'qal_hub_2',
      qalId: '4815',
      accountLabel: '@almaz_k (Qal ID: 4815)',
      fullName: 'Almaz Kebede',
      filename: 'almaz-id-card.png',
      mimeType: 'image/png',
      imageKind: 'id_card',
      imageDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      text: 'Ethiopian Resident ID Card: Almaz Kebede, Bole Sub-City, Woreda 03, ID: ET-AA-481516',
      profile: {
        fullName: 'Almaz Kebede',
        phone: '+251911445566',
        address: 'Bole Sub-City, Woreda 03',
        idNumber: 'ET-AA-481516',
      },
      createdAt: new Date().toISOString(),
    },
  ]
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

      if (session.qalId === '4815') {
        // ID card / OCR photo simulation
        session.imageDataUrl =
          session.imageDataUrl ??
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        session.mimeType = session.mimeType ?? 'image/png'
        session.imageKind = session.imageKind ?? 'id_card'
        session.profile = session.profile ?? {
          fullName: 'Almaz Kebede',
          phone: '+251911445566',
          address: 'Bole Sub-City, Woreda 03',
          idNumber: 'ET-AA-481516',
          extraInfo: 'ID Card verified via Telegram OCR',
        }
        session.filename = session.filename ?? 'almaz-id-card.png'
        session.text =
          session.text ??
          'ID Card OCR Text: Almaz Kebede, Bole Sub-City, Woreda 03, ID: ET-AA-481516'
        session.completedAt = session.completedAt ?? new Date().toISOString()
      } else {
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
    }

    return {
      sessionId: session.sessionId,
      pageCode: session.pageCode,
      status: session.status,
      profile: session.profile,
      filename: session.filename,
      text: session.text,
      completedAt: session.completedAt,
      imageDataUrl: session.imageDataUrl ?? null,
      mimeType: session.mimeType ?? null,
      imageKind: session.imageKind ?? null,
    }
  }

  const client = options?.client ?? apiClient
  return client.get<TelegramBridgeStatusRecord>(
    `/telegram-bridge/sessions/${encodeURIComponent(sessionId)}`,
    { auth: 'optional' },
  )
}

/**
 * Retrieves the aggregated multi-account Telegram media and files hub.
 * In HTTP mode: GET /api/v1/telegram-bridge/media(?sessionIds=...)
 * In Fixture mode: returns deterministic fixture media items and accounts.
 */
export async function getTelegramHubMedia(
  sessionIds?: string[],
  options?: TelegramBridgeOptions,
): Promise<TelegramHubMediaResponse> {
  if (isFixtureMode(options)) {
    const items =
      sessionIds && sessionIds.length > 0
        ? fixtureHubItems.filter((i) => sessionIds.includes(i.sessionId))
        : [...fixtureHubItems]

    const accountMap = new Map<string, TelegramHubAccount>()
    for (const item of items) {
      const existing = accountMap.get(item.qalId)
      if (existing) {
        existing.itemCount += 1
      } else {
        accountMap.set(item.qalId, {
          qalId: item.qalId,
          accountLabel: item.accountLabel,
          fullName: item.fullName,
          itemCount: 1,
        })
      }
    }

    return {
      items,
      accounts: Array.from(accountMap.values()),
    }
  }

  const client = options?.client ?? apiClient
  const query =
    sessionIds && sessionIds.length > 0
      ? `?sessionIds=${encodeURIComponent(sessionIds.join(','))}`
      : ''
  return client.get<TelegramHubMediaResponse>(`/telegram-bridge/media${query}`, {
    auth: 'optional',
  })
}

export interface TelegramVaultProfile {
  qalId: string
  accountLabel: string
  fullName?: string
  phone?: string
  address?: string
  idNumber?: string
  text?: string
}

/**
 * Retrieves connected Telegram profiles from the media vault,
 * deduplicated by `qalId`, returning their full profile details.
 */
export async function listTelegramMediaVault(
  options?: TelegramBridgeOptions,
): Promise<TelegramVaultProfile[]> {
  const hub = await getTelegramHubMedia(undefined, options)
  const map = new Map<string, TelegramVaultProfile>()

  for (const item of hub.items) {
    if (!item.qalId) continue
    const existing = map.get(item.qalId)
    const profile: TelegramVaultProfile = {
      qalId: item.qalId,
      accountLabel: item.accountLabel || `@user_${item.qalId}`,
      fullName: item.fullName || item.profile?.fullName || existing?.fullName || '',
      phone: item.profile?.phone || existing?.phone || '',
      address: item.profile?.address || existing?.address || '',
      idNumber: item.profile?.idNumber || existing?.idNumber || '',
      text: item.text || existing?.text || '',
    }
    map.set(item.qalId, profile)
  }

  for (const acc of hub.accounts) {
    if (!map.has(acc.qalId)) {
      map.set(acc.qalId, {
        qalId: acc.qalId,
        accountLabel: acc.accountLabel,
        fullName: acc.fullName || '',
      })
    }
  }

  return Array.from(map.values())
}

/**
 * Dismisses an item from the webpage hub list only (does NOT wipe the user's phone vault).
 * In HTTP mode: DELETE /api/v1/telegram-bridge/media/:id
 * In Fixture mode: removes the item from the in-memory list.
 */
export async function dismissTelegramHubItem(
  id: string,
  options?: TelegramBridgeOptions,
): Promise<{ ok: boolean; status: string }> {
  if (isFixtureMode(options)) {
    fixtureHubItems = fixtureHubItems.filter((i) => i.id !== id && i.sessionId !== id)
    return { ok: true, status: 'dismissed' }
  }

  const client = options?.client ?? apiClient
  return client.delete<{ ok: boolean; status: string }>(
    `/telegram-bridge/media/${encodeURIComponent(id)}`,
    { auth: 'optional' },
  )
}

/**
 * Retrieves diagnostics for the Telegram bot connection.
 * In HTTP mode: GET /api/v1/telegram-bridge/health
 * In Fixture mode: returns simulated healthy status.
 */
export async function getTelegramBotHealth(
  options?: TelegramBridgeOptions,
): Promise<TelegramBotHealthResponse> {
  if (isFixtureMode(options)) {
    return {
      ok: true,
      configured: true,
      status: 'ready',
      bot: { id: 789456123, username: 'Qal_copy_bot', first_name: 'DocuA4 Qal Bot' },
      webhook: {
        url: 'https://docua4.test/admin/telegram/webhook',
        has_custom_certificate: false,
        pending_update_count: 0,
      },
    }
  }

  const client = options?.client ?? apiClient
  return client.get<TelegramBotHealthResponse>('/telegram-bridge/health', {
    auth: 'optional',
  })
}

/**
 * Synchronizes or heals the Telegram bot webhook.
 * In HTTP mode: POST /api/v1/telegram-bridge/sync-webhook
 */
export async function syncTelegramWebhook(
  publicBaseUrl?: string,
  options?: TelegramBridgeOptions,
): Promise<SyncTelegramWebhookResponse> {
  if (isFixtureMode(options)) {
    return {
      ok: true,
      webhookUrl: `${publicBaseUrl ?? 'https://docua4.test'}/admin/telegram/webhook`,
      description: 'Webhook synchronized (fixture mode)',
    }
  }

  const client = options?.client ?? apiClient
  return client.post<SyncTelegramWebhookResponse>(
    '/telegram-bridge/sync-webhook',
    { publicBaseUrl },
    { auth: 'optional' },
  )
}
