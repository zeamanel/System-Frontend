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

/** What a piece of information in a file is (read when the file reached the bot). */
export type TelegramFileItemKind =
  | 'name'
  | 'phone'
  | 'email'
  | 'address'
  | 'id_number'
  | 'date'
  | 'amount'
  | 'organization'
  | 'clause'
  | 'other'

/** One piece of information found in a file: its label in the file's own words, and its value as written. */
export interface TelegramFileItem {
  label: string
  value: string
  kind: TelegramFileItemKind
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
  /** What is in the file; absent from an older backend. */
  items?: TelegramFileItem[]
  /** 'pending': being read now; 'on_demand': read when the user selects the file; 'none': nothing to list. */
  itemsStatus?: 'ready' | 'pending' | 'on_demand' | 'none'
  /** The list and summary views leave the image out (loadTelegramHubImage reads it); this says there is one. */
  hasImage?: boolean
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
  /** Without images and with shortened text: the fast list for the file picker. */
  summary?: boolean
  /** Without images but with the full text: the Telegram lists (each image loads on its own). */
  withoutImages?: boolean
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
    items: [
      { label: 'Seller', value: 'Abebe Bikila', kind: 'name' },
      { label: 'Buyer', value: 'Kebede Chala', kind: 'name' },
      { label: 'Vehicle', value: 'Toyota Corolla', kind: 'other' },
    ],
    itemsStatus: 'ready',
    hasImage: false,
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
    items: [
      { label: 'Full name', value: 'Almaz Kebede', kind: 'name' },
      { label: 'ID number', value: 'ET-AA-481516', kind: 'id_number' },
      { label: 'Address', value: 'Bole Sub-City, Woreda 03', kind: 'address' },
    ],
    itemsStatus: 'ready',
    hasImage: true,
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
  const params = new URLSearchParams()
  if (sessionIds && sessionIds.length > 0) params.set('sessionIds', sessionIds.join(','))
  if (options?.summary) params.set('view', 'summary')
  else if (options?.withoutImages) params.set('view', 'list')
  const query = params.size > 0 ? `?${params.toString()}` : ''
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
      bot: { id: 789456123, username: 'Qal_copy_bot', first_name: 'SenedDesk Qal Bot' },
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
 * In HTTP mode: POST /api/v1/telegram-bridge/sync-webhook. The backend points
 * the webhook at its own address; the caller never chooses it.
 */
export async function syncTelegramWebhook(
  options?: TelegramBridgeOptions,
): Promise<SyncTelegramWebhookResponse> {
  if (isFixtureMode(options)) {
    return {
      ok: true,
      webhookUrl: 'https://api.docua4.test/admin/telegram/webhook',
      description: 'Webhook synchronized (fixture mode)',
    }
  }

  const client = options?.client ?? apiClient
  return client.post<SyncTelegramWebhookResponse>('/telegram-bridge/sync-webhook', {}, { auth: 'optional' })
}

/** Images already read, by file id (a file's image never changes). Kept for the page's life, newest last. */
const hubImageCache = new Map<string, Promise<Blob>>()
const hubImageUrls = new Map<string, string>()
const HUB_IMAGE_CACHE_SIZE = 60

function hubImageBlob(itemId: string, options?: TelegramBridgeOptions): Promise<Blob> {
  const hit = hubImageCache.get(itemId)
  if (hit) return hit
  const client = options?.client ?? apiClient
  const load = client
    .get<Blob>(`/telegram-bridge/media/${encodeURIComponent(itemId)}/image`, { auth: 'optional', responseType: 'blob' })
    .catch((error: unknown) => {
      // A failed read (offline, expired) is tried again next time.
      hubImageCache.delete(itemId)
      throw error
    })
  hubImageCache.set(itemId, load)
  while (hubImageCache.size > HUB_IMAGE_CACHE_SIZE) {
    const oldest = hubImageCache.keys().next().value as string
    hubImageCache.delete(oldest)
    const url = hubImageUrls.get(oldest)
    if (url) URL.revokeObjectURL(url)
    hubImageUrls.delete(oldest)
  }
  return load
}

/**
 * A hub file's image as a URL to show (lists leave images out). Read once per
 * file; an item that still carries its image (fixtures, the full view) uses it.
 */
export async function loadTelegramHubImage(
  item: Pick<TelegramHubItem, 'id' | 'imageDataUrl'>,
  options?: TelegramBridgeOptions,
): Promise<string> {
  if (item.imageDataUrl) return item.imageDataUrl
  const known = hubImageUrls.get(item.id)
  if (known) return known
  const blob = await hubImageBlob(item.id, options)
  const url = hubImageUrls.get(item.id) ?? URL.createObjectURL(blob)
  hubImageUrls.set(item.id, url)
  return url
}

/** A hub file's image as a data URL, to put into a document (a document keeps its images). */
export async function loadTelegramHubImageDataUrl(
  item: Pick<TelegramHubItem, 'id' | 'imageDataUrl'>,
  options?: TelegramBridgeOptions,
): Promise<string> {
  if (item.imageDataUrl) return item.imageDataUrl
  const blob = await hubImageBlob(item.id, options)
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('The image could not be read'))
    reader.readAsDataURL(blob)
  })
}
