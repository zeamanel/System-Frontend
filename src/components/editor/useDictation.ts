import { useCallback, useEffect, useRef, useState } from 'react'
import { DictationError, transcribeRecording, type DictationFailure, type DictationResult } from '../../lib/dictation/client'
import { recordingToWav } from '../../lib/dictation/wav'

/** Longest recording (seconds): the backend takes about two minutes of speech. */
export const MAX_DICTATION_SECONDS = 120

export type DictationProblem = DictationFailure | 'unsupported' | 'denied' | 'no-microphone'

export type DictationState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'recording'; seconds: number }
  | { phase: 'transcribing' }
  | { phase: 'review'; text: string }
  | { phase: 'error'; problem: DictationProblem }

export interface UseDictationOptions {
  /** The document's language: a hint for the transcription. */
  language?: string
  /** Injected in tests. */
  transcribe?: (audio: Blob, options: { language?: string }) => Promise<DictationResult>
  convert?: (recording: Blob) => Promise<Blob>
  getMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>
}

/**
 * Microphone → text: records until stopped (or two minutes), turns the
 * recording into text with the backend, and holds it for the user to check.
 * The microphone is released as soon as recording stops.
 */
export function useDictation({ language, transcribe = transcribeRecording, convert = recordingToWav, getMedia }: UseDictationOptions = {}) {
  const [state, setState] = useState<DictationState>({ phase: 'idle' })
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  /** Bumped on every start and cancel: late results of an older run are dropped. */
  const runRef = useRef(0)

  const release = useCallback((): void => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async (): Promise<void> => {
    const run = ++runRef.current
    const media = getMedia ?? (globalThis.navigator?.mediaDevices?.getUserMedia?.bind(globalThis.navigator.mediaDevices))
    if (!media || typeof MediaRecorder === 'undefined') {
      setState({ phase: 'error', problem: 'unsupported' })
      return
    }
    setState({ phase: 'starting' })
    let stream: MediaStream
    try {
      stream = await media({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
    } catch (error) {
      if (run !== runRef.current) return
      const name = (error as { name?: string }).name
      setState({ phase: 'error', problem: name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'no-microphone' })
      return
    }
    if (run !== runRef.current) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    streamRef.current = stream
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      release()
      recorderRef.current = null
      if (run !== runRef.current) return
      setState({ phase: 'transcribing' })
      void (async () => {
        try {
          const wav = await convert(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
          const result = await transcribe(wav, { language })
          if (run === runRef.current) setState({ phase: 'review', text: result.text })
        } catch (error) {
          if (run === runRef.current) {
            setState({ phase: 'error', problem: error instanceof DictationError ? error.reason : 'failed' })
          }
        }
      })()
    }
    const startedAt = Date.now()
    recorder.start(1000)
    setState({ phase: 'recording', seconds: 0 })
    timerRef.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000)
      if (seconds >= MAX_DICTATION_SECONDS && recorder.state === 'recording') recorder.stop()
      else setState((current) => (current.phase === 'recording' && current.seconds !== seconds ? { phase: 'recording', seconds } : current))
    }, 250)
  }, [convert, getMedia, language, release, transcribe])

  /** Stops recording; the text follows. */
  const stop = useCallback((): void => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  /** Drops everything: the recording, a transcription on its way, the text. */
  const cancel = useCallback((): void => {
    runRef.current++
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder?.state === 'recording') recorder.stop()
    release()
    setState({ phase: 'idle' })
  }, [release])

  const setText = useCallback((text: string): void => {
    setState((current) => (current.phase === 'review' ? { phase: 'review', text } : current))
  }, [])

  // Leaving the editor releases the microphone.
  useEffect(() => cancel, [cancel])

  return { state, start, stop, cancel, setText }
}
