import { env } from '../../config/env'
import { apiClient } from '../api'

/**
 * Optional link between the account and the person's own Telegram chat
 * (backend docs/API.md "Telegram linking"). Without a link the bot works as a
 * standalone Qal profile; a link adds /ask, /files, /workspace and
 * notifications. Needs the server (demo mode has no bot).
 */

export interface TelegramLinkStatus {
  linked: boolean
  chatName?: string | null
  workspace?: { organizationId: string | null; name: string | null }
  linkedAt?: string
}

export interface TelegramLinkCode {
  code: string
  expiresAt: string
  organizationId: string | null
  url: string | null
  botUsername: string | null
}

export const telegramLinkAvailable = (): boolean => env.dataSource === 'http'

export async function getTelegramLink(signal?: AbortSignal): Promise<TelegramLinkStatus> {
  if (!telegramLinkAvailable()) return { linked: false }
  return apiClient.get<TelegramLinkStatus>('/telegram-link', { signal, auth: 'required' })
}

export async function createTelegramLinkCode(): Promise<TelegramLinkCode> {
  return apiClient.post<TelegramLinkCode>('/telegram-link/code', {}, { auth: 'required' })
}

export async function unlinkTelegram(): Promise<void> {
  await apiClient.delete<void>('/telegram-link', { auth: 'required' })
}
