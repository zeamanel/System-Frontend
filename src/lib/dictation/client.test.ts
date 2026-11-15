import { describe, expect, it, vi } from 'vitest'
import { ApiError, RateLimitError } from '../api'
import { DictationError, transcribeRecording } from './client'

const wav = new Blob([new Uint8Array([82, 73, 70, 70, 1, 2, 3])], { type: 'audio/wav' })

describe('transcribeRecording', () => {
  it('sends the recording as base64 with the document language as a hint', async () => {
    const post = vi.fn().mockResolvedValue({ text: ' ኪራዩ በወር 15 ሺህ ብር ነው። ', language: 'am' })
    const result = await transcribeRecording(wav, { language: 'am', client: { post } as never })
    expect(result).toEqual({ text: 'ኪራዩ በወር 15 ሺህ ብር ነው።', language: 'am' })
    expect(post).toHaveBeenCalledWith(
      '/ai/transcribe',
      { audio: btoa(String.fromCharCode(82, 73, 70, 70, 1, 2, 3)), mimeType: 'audio/wav', language: 'am' },
      { auth: 'required' },
    )
  })

  it('leaves out a language the service does not take', async () => {
    const post = vi.fn().mockResolvedValue({ text: 'Bonjour', language: 'fr' })
    await transcribeRecording(wav, { language: 'fr', client: { post } as never })
    expect(post.mock.calls[0][1]).not.toHaveProperty('language')
  })

  it('says why it failed', async () => {
    const fail = (error: unknown) => transcribeRecording(wav, { client: { post: vi.fn().mockRejectedValue(error) } as never })
    await expect(fail(new ApiError(422, 'No speech'))).rejects.toMatchObject({ reason: 'no-speech' })
    await expect(fail(new ApiError(400, 'Too long'))).rejects.toMatchObject({ reason: 'unreadable' })
    await expect(fail(new RateLimitError('slow down', 'QUOTA_EXCEEDED'))).rejects.toMatchObject({ reason: 'quota' })
    await expect(fail(new ApiError(503, 'down'))).rejects.toMatchObject({ reason: 'failed' })
    const empty = transcribeRecording(wav, { client: { post: vi.fn().mockResolvedValue({ text: '  ' }) } as never })
    await expect(empty).rejects.toMatchObject({ reason: 'no-speech' })
  })

  it('says demo mode has no dictation instead of pretending', async () => {
    await expect(transcribeRecording(wav, { dataSource: 'fixtures' })).rejects.toBeInstanceOf(DictationError)
    await expect(transcribeRecording(wav, { dataSource: 'fixtures' })).rejects.toMatchObject({ reason: 'offline' })
  })
})
