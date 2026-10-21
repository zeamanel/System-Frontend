import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '../client'
import {
  __resetTelegramBridgeFixtures,
  __setFixtureSession,
  createTelegramBridgeSession,
  getTelegramBridgeSessionStatus,
  pingTelegramQalId,
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

    it('supports custom session simulation via __setFixtureSession', async () => {
      __setFixtureSession('custom_sess_1', {
        status: 'completed',
        profile: {
          fullName: 'Chala Dejene',
          phone: '+251922334455',
          address: 'Hawassa',
        },
        text: 'Custom text agreement',
      })

      const status = await getTelegramBridgeSessionStatus('custom_sess_1', {
        dataSource: 'fixtures',
      })
      expect(status.status).toBe('completed')
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
        status: 'pending',
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

      await getTelegramBridgeSessionStatus('qal_remote_1', { client, dataSource: 'http' })
      expect(mockGet).toHaveBeenCalledWith('/telegram-bridge/sessions/qal_remote_1', {
        auth: 'optional',
      })
    })
  })
})
