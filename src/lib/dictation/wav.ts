/**
 * A browser recording (WebM/Opus in Chrome, MP4/AAC in Safari, Ogg in
 * Firefox) as a small WAV the transcription model reads everywhere:
 * 16 kHz, mono, 16-bit. Two minutes is about 3.8 MB.
 */

export const SPEECH_SAMPLE_RATE = 16_000

/** 16-bit PCM WAV bytes for mono samples in [-1, 1]. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const write = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  write(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += 2
  }
  return buffer
}

/** Decodes a recording and resamples it to 16 kHz mono WAV. */
export async function recordingToWav(recording: Blob): Promise<Blob> {
  const AudioContextClass =
    globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass || typeof OfflineAudioContext === 'undefined') throw new Error('Audio decoding is not available')
  const context = new AudioContextClass()
  let decoded: AudioBuffer
  try {
    decoded = await context.decodeAudioData(await recording.arrayBuffer())
  } finally {
    void context.close()
  }
  const length = Math.max(1, Math.ceil(decoded.duration * SPEECH_SAMPLE_RATE))
  // An offline context with one channel mixes the recording down and resamples it.
  const offline = new OfflineAudioContext(1, length, SPEECH_SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return new Blob([encodeWav(rendered.getChannelData(0), SPEECH_SAMPLE_RATE)], { type: 'audio/wav' })
}
