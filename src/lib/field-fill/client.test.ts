import { describe, expect, it, vi } from 'vitest'
import { ApiError, RateLimitError } from '../api'
import { extractFieldFromFile, FieldFillError, MAX_FIELD_FILE_BYTES, uploadSource, readFileText } from './client'

const input = { fieldLabel: 'Tenant name', fieldId: 'tenant_name', language: 'en', source: { kind: 'telegram' as const, itemId: 'evt_1' } }

describe('extractFieldFromFile', () => {
  it('says it is offline in demo mode instead of pretending', async () => {
    await expect(extractFieldFromFile(input, { dataSource: 'fixtures' })).rejects.toMatchObject({ reason: 'offline' })
  })

  it('posts the field and source, and returns the proposal', async () => {
    const post = vi.fn().mockResolvedValue({ value: 'Almaz Kebede', evidence: 'Tenant: Almaz Kebede', confidence: 'high', evidenceVerified: true, sourceName: 'lease.txt' })
    const result = await extractFieldFromFile(input, { client: { post } })
    expect(post).toHaveBeenCalledWith('/ai/extract-field', input, { auth: 'required' })
    expect(result).toEqual({ value: 'Almaz Kebede', evidence: 'Tenant: Almaz Kebede', confidence: 'high', evidenceVerified: true, sourceName: 'lease.txt' })
  })

  it('turns failures into reasons the dialog can explain', async () => {
    const reasonFor = async (error: unknown) => {
      const post = vi.fn().mockRejectedValue(error)
      return extractFieldFromFile(input, { client: { post } }).catch((e: FieldFillError) => e.reason)
    }
    expect(await reasonFor(new RateLimitError('quota', 'QUOTA_EXCEEDED'))).toBe('quota')
    expect(await reasonFor(new RateLimitError('slow down'))).toBe('rate-limit')
    expect(await reasonFor(new ApiError(404, 'gone'))).toBe('not-found')
    expect(await reasonFor(new ApiError(413, 'big'))).toBe('too-large')
    expect(await reasonFor(new ApiError(415, 'type'))).toBe('unsupported')
    expect(await reasonFor(new Error('network'))).toBe('failed')
  })
})

describe('uploadSource', () => {
  it('encodes a file as base64 and refuses large ones', async () => {
    const file = new File(['Tenant: Almaz'], 'lease.txt', { type: 'text/plain' })
    expect(await uploadSource(file)).toEqual({ kind: 'upload', filename: 'lease.txt', mimeType: 'text/plain', dataBase64: btoa('Tenant: Almaz') })
    const big = new File([new Uint8Array(MAX_FIELD_FILE_BYTES + 1)], 'big.pdf')
    await expect(uploadSource(big)).rejects.toMatchObject({ reason: 'too-large' })
  })
})

describe('readFileText', () => {
  const source = { kind: 'upload' as const, filename: 'lease.pdf', mimeType: 'application/pdf', dataBase64: 'AAAA' }

  it('reads the whole file through the backend and maps its answer', async () => {
    const post = vi.fn().mockResolvedValue({ text: 'የኪራይ ውል', sourceName: 'lease.pdf', method: 'transcribed', illegible: true, truncated: false, language: 'Amharic' })
    expect(await readFileText(source, { client: { post } })).toEqual({
      text: 'የኪራይ ውል',
      sourceName: 'lease.pdf',
      method: 'transcribed',
      illegible: true,
      truncated: false,
      language: 'Amharic',
    })
    expect(post).toHaveBeenCalledWith('/ai/read-file', { source }, { auth: 'required' })
  })

  it('says it is offline in demo mode, and maps failures like a field fill', async () => {
    await expect(readFileText(source, { dataSource: 'fixtures' })).rejects.toMatchObject({ reason: 'offline' })
    const post = vi.fn().mockRejectedValue(new ApiError(422, 'no text'))
    await expect(readFileText(source, { client: { post } })).rejects.toMatchObject({ reason: 'unsupported' })
  })
})
