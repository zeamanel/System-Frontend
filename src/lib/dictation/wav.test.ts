import { describe, expect, it } from 'vitest'
import { encodeWav, SPEECH_SAMPLE_RATE } from './wav'

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM WAV header and the samples', () => {
    const bytes = encodeWav(new Float32Array([0, 1, -1, 2, -0.5]), SPEECH_SAMPLE_RATE)
    const view = new DataView(bytes)
    const text = (offset: number, length: number) => String.fromCharCode(...new Uint8Array(bytes, offset, length))
    expect(bytes.byteLength).toBe(44 + 10)
    expect(text(0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(36 + 10)
    expect(text(8, 8)).toBe('WAVEfmt ')
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(16_000)
    expect(view.getUint32(28, true)).toBe(32_000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(text(36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(10)
    // Samples, with out-of-range values clamped.
    expect([0, 1, 2, 3, 4].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767, -16384])
  })
})
