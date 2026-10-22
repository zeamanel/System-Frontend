import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../client'
import {
  __resetTelegramBridgeFixtures,
  __setFixtureSession,
  createTelegramBridgeSession,
  dismissTelegramHubItem,
  getTelegramBotHealth,
  getTelegramBridgeSessionStatus,
  getTelegramHubMedia,
  pingTelegramQalId,
  syncTelegramWebhook,
} from './telegram-bridge'

describe('telegram-bridge endpoint client', () => {
  beforeEach(() => {
    __resetTelegramBridgeFixtures()
  })

  describe('fixture mode', () => {
    it('creates a deterministic bridge session with a 4-digit page code', async () => {
      const session = await createTelegramBridgeSession(
        { locale: 'en' },
        { dataSource: 'fixtures' },
      )

      expect(session.sessionId).toMatch(/^qal_sess_\d+$/)
      expect(session.pageCode).toBe('4815')
      expect(session.botUsername).toBe('Qal_copy_bot')
      expect(session.deepLink).toContain('start=code_4815')
      expect(session.expiresInSeconds).toBe(900)

      const status = await getTelegramBridgeSessionStatus(session.sessionId, {
        dataSource: 'fixtures',
      })
      expect(status.status).toBe('pending')
      expect(status.pageCode).toBe('4815')
    })

    it('rejects invalid 4-digit Qal IDs', async () => {
      const session = await createTelegramBridgeSession({}, { dataSource: 'fixtures' })

      await expect(
        pingTelegramQalId(session.sessionId, { qalId: '12' }, { dataSource: 'fixtures' }),
      ).rejects.toThrow(/invalid 4-digit qal id/i)

      await expect(
        pingTelegramQalId(session.sessionId, { qalId: 'abcd' }, { dataSource: 'fixtures' }),
      ).rejects.toThrow(/invalid 4-digit qal id/i)
    })

    it('simulates 404 when Qal ID is 0000', async () => {
      const session = await createTelegramBridgeSession({}, { dataSource: 'fixtures' })

      await expect(
        pingTelegramQalId(session.sessionId, { qalId: '0000' }, { dataSource: 'fixtures' }),
      ).rejects.toThrow(/no telegram user registered/i)
    })

    it('simulates denial when Qal ID is 9999', async () => {
      const session = await createTelegramBridgeSession({}, { dataSource: 'fixtures' })

      await pingTelegramQalId(session.sessionId, { qalId: '9999' }, { dataSource: 'fixtures' })

      const status = await getTelegramBridgeSessionStatus(session.sessionId, {
        dataSource: 'fixtures',
      })
      expect(status.status).toBe('denied')
    })

    it('simulates approval and completes session with profile and text when pinged with 7392', async () => {
      const session = await createTelegramBridgeSession({}, { dataSource: 'fixtures' })

      const pingRes = await pingTelegramQalId(
        session.sessionId,
        { qalId: '7392' },
        { dataSource: 'fixtures' },
      )
      expect(pingRes.ok).toBe(true)
      expect(pingRes.status).toBe('pinged')
      expect(pingRes.qalId).toBe('7392')

      const status = await getTelegramBridgeSessionStatus(session.sessionId, {
        dataSource: 'fixtures',
      })
      expect(status.status).toBe('completed')
      expect(status.profile?.fullName).toBe('Abebe Bikila')
      expect(status.profile?.phone).toBe('+251911223344')
      expect(status.text).toContain('Vehicle Sale Agreement')
    })

    it('simulates multimodal ID card scan with photo and OCR when pinged with 4815', async () => {
      const session = await createTelegramBridgeSession({}, { dataSource: 'fixtures' })

      const pingRes = await pingTelegramQalId(
        session.sessionId,
        { qalId: '4815' },
        { dataSource: 'fixtures' },
      )
      expect(pingRes.ok).toBe(true)
      expect(pingRes.status).toBe('pinged')

      const status = await getTelegramBridgeSessionStatus(session.sessionId, {
        dataSource: 'fixtures',
      })
      expect(status.status).toBe('completed')
      expect(status.imageKind).toBe('id_card')
      expect(status.mimeType).toBe('image/png')
      expect(status.imageDataUrl).toMatch(/^data:image\/png;base64,/)
      expect(status.profile?.fullName).toBe('Almaz Kebede')
      expect(status.profile?.idNumber).toBe('ET-AA-481516')
      expect(status.text).toContain('ID Card OCR Text')
    })

    it('supports custom session simulation via __setFixtureSession with image', async () => {
      __setFixtureSession('custom_sess_img', {
        status: 'completed',
        imageKind: 'media_photo',
        mimeType: 'image/jpeg',
        imageDataUrl: 'data:image/jpeg;base64,1234',
        profile: {
          fullName: 'Chala Dejene',
          phone: '+251922334455',
          address: 'Hawassa',
        },
        text: 'Custom text agreement',
      })

      const status = await getTelegramBridgeSessionStatus('custom_sess_img', {
        dataSource: 'fixtures',
      })
      expect(status.status).toBe('completed')
      expect(status.imageKind).toBe('media_photo')
      expect(status.imageDataUrl).toBe('data:image/jpeg;base64,1234')
      expect(status.profile?.fullName).toBe('Chala Dejene')
      expect(status.text).toBe('Custom text agreement')
    })
  })

  describe('http mode', () => {
    it('dispatches HTTP calls via apiClient when configured', async () => {
      const mockPost = vi.fn().mockResolvedValue({
        sessionId: 'qal_remote_1',
        pageCode: '1234',
        botUsername: 'Qal_copy_bot',
        deepLink: 'https://t.me/Qal_copy_bot?start=code_1234',
        expiresInSeconds: 900,
      })
      const mockGet = vi.fn().mockResolvedValue({
        sessionId: 'qal_remote_1',
        pageCode: '1234',
        status: 'completed',
        imageKind: 'id_card',
        mimeType: 'image/png',
        imageDataUrl: 'data:image/png;base64,abc',
      })

      const client = {
        get: mockGet,
        post: mockPost,
      } as unknown as ApiClient

      const session = await createTelegramBridgeSession(
        { documentId: 'doc_1', locale: 'am' },
        { client, dataSource: 'http' },
      )

      expect(mockPost).toHaveBeenCalledWith(
        '/telegram-bridge/sessions',
        { documentId: 'doc_1', locale: 'am' },
        { auth: 'optional' },
      )
      expect(session.sessionId).toBe('qal_remote_1')

      await pingTelegramQalId('qal_remote_1', { qalId: '5678' }, { client, dataSource: 'http' })
      expect(mockPost).toHaveBeenCalledWith(
        '/telegram-bridge/sessions/qal_remote_1/ping',
        { qalId: '5678' },
        { auth: 'optional' },
      )

      const status = await getTelegramBridgeSessionStatus('qal_remote_1', { client, dataSource: 'http' })
      expect(mockGet).toHaveBeenCalledWith('/telegram-bridge/sessions/qal_remote_1', {
        auth: 'optional',
      })
      expect(status.imageKind).toBe('id_card')
      expect(status.imageDataUrl).toBe('data:image/png;base64,abc')
    })

    it('dispatches getTelegramHubMedia and dismissTelegramHubItem', async () => {
      const mockGet = vi.fn().mockResolvedValue({ items: [], accounts: [] })
      const mockDelete = vi.fn().mockResolvedValue({ ok: true, status: 'dismissed' })
      const client = { get: mockGet, delete: mockDelete } as unknown as ApiClient

      await getTelegramHubMedia(['s1', 's2'], { client, dataSource: 'http' })
      expect(mockGet).toHaveBeenCalledWith('/telegram-bridge/media?sessionIds=s1%2Cs2', {
        auth: 'optional',
      })

      await dismissTelegramHubItem('item_1', { client, dataSource: 'http' })
      expect(mockDelete).toHaveBeenCalledWith('/telegram-bridge/media/item_1', {
        auth: 'optional',
      })
    })

    it('dispatches getTelegramBotHealth and syncTelegramWebhook', async () => {
      const mockGet = vi.fn().mockResolvedValue({ ok: true, status: 'ready' })
      const mockPost = vi.fn().mockResolvedValue({ ok: true, webhookUrl: 'https://test/admin/telegram/webhook' })
      const client = { get: mockGet, post: mockPost } as unknown as ApiClient

      await getTelegramBotHealth({ client, dataSource: 'http' })
      expect(mockGet).toHaveBeenCalledWith('/telegram-bridge/health', { auth: 'optional' })

      await syncTelegramWebhook('https://test', { client, dataSource: 'http' })
      expect(mockPost).toHaveBeenCalledWith(
        '/telegram-bridge/sync-webhook',
        { publicBaseUrl: 'https://test' },
        { auth: 'optional' },
      )
    })
  })

  describe('hub fixture operations', () => {
    it('returns fixture hub media and dismisses items', async () => {
      const hub = await getTelegramHubMedia(undefined, { dataSource: 'fixtures' })
      expect(hub.items.length).toBe(2)
      expect(hub.accounts.length).toBe(2)

      const dismissRes = await dismissTelegramHubItem('evt_fixture_1', { dataSource: 'fixtures' })
      expect(dismissRes.ok).toBe(true)

      const hubAfter = await getTelegramHubMedia(undefined, { dataSource: 'fixtures' })
      expect(hubAfter.items.length).toBe(1)
      expect(hubAfter.items[0].id).toBe('evt_fixture_2')
    })
  })
})
