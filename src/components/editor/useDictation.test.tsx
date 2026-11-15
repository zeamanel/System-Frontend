import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { DictationError } from '../../lib/dictation/client'
import { DictationPanel } from './DictationPanel'
import { MAX_DICTATION_SECONDS, useDictation, type DictationState } from './useDictation'

/** A stand-in for the browser recorder: start, data, stop. */
class FakeRecorder {
  static last: FakeRecorder | null = null
  state: 'inactive' | 'recording' = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor() {
    FakeRecorder.last = this
  }
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['sound']) })
    this.onstop?.()
  }
}

const track = { stop: vi.fn() }
const stream = { getTracks: () => [track] } as unknown as MediaStream

beforeEach(() => {
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  track.stop.mockClear()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const flush = () => act(async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
})

describe('useDictation', () => {
  it('records, releases the microphone, and holds the text to check', async () => {
    const transcribe = vi.fn().mockResolvedValue({ text: 'The rent is 15,000 birr.', language: 'en' })
    const convert = vi.fn((blob: Blob) => Promise.resolve(new Blob([blob], { type: 'audio/wav' })))
    const { result } = renderHook(() => useDictation({ language: 'en', transcribe, convert, getMedia: () => Promise.resolve(stream) }))

    await act(() => result.current.start())
    expect(result.current.state).toEqual({ phase: 'recording', seconds: 0 })

    act(() => result.current.stop())
    expect(track.stop).toHaveBeenCalled()
    await flush()
    expect(convert).toHaveBeenCalled()
    expect(transcribe).toHaveBeenCalledWith(expect.any(Blob), { language: 'en' })
    expect(result.current.state).toEqual({ phase: 'review', text: 'The rent is 15,000 birr.' })

    act(() => result.current.setText('The rent is 15,000 birr a month.'))
    expect(result.current.state).toEqual({ phase: 'review', text: 'The rent is 15,000 birr a month.' })
  })

  it('stops by itself at the time limit', async () => {
    vi.useFakeTimers()
    const transcribe = vi.fn().mockResolvedValue({ text: 'Long', language: 'en' })
    const { result } = renderHook(() =>
      useDictation({ transcribe, convert: (blob) => Promise.resolve(blob), getMedia: () => Promise.resolve(stream) }),
    )
    await act(() => result.current.start())
    act(() => vi.advanceTimersByTime(5_000))
    expect(result.current.state).toEqual({ phase: 'recording', seconds: 5 })
    act(() => vi.advanceTimersByTime(MAX_DICTATION_SECONDS * 1000))
    expect(FakeRecorder.last?.state).toBe('inactive')
    expect(track.stop).toHaveBeenCalled()
  })

  it('says when the microphone is blocked or missing, or the browser cannot record', async () => {
    const denied = renderHook(() => useDictation({ getMedia: () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })) }))
    await act(() => denied.result.current.start())
    expect(denied.result.current.state).toEqual({ phase: 'error', problem: 'denied' })

    const missing = renderHook(() => useDictation({ getMedia: () => Promise.reject(Object.assign(new Error('no'), { name: 'NotFoundError' })) }))
    await act(() => missing.result.current.start())
    expect(missing.result.current.state).toEqual({ phase: 'error', problem: 'no-microphone' })

    vi.stubGlobal('MediaRecorder', undefined)
    const old = renderHook(() => useDictation({ getMedia: () => Promise.resolve(stream) }))
    await act(() => old.result.current.start())
    expect(old.result.current.state).toEqual({ phase: 'error', problem: 'unsupported' })
  })

  it('reports why the text could not be made', async () => {
    const transcribe = vi.fn().mockRejectedValue(new DictationError('no-speech'))
    const { result } = renderHook(() =>
      useDictation({ transcribe, convert: (blob) => Promise.resolve(blob), getMedia: () => Promise.resolve(stream) }),
    )
    await act(() => result.current.start())
    act(() => result.current.stop())
    await flush()
    expect(result.current.state).toEqual({ phase: 'error', problem: 'no-speech' })
  })

  it('Cancel drops the recording and a late transcription', async () => {
    let resolve: (value: { text: string; language: string }) => void = () => {}
    const transcribe = vi.fn(() => new Promise<{ text: string; language: string }>((done) => (resolve = done)))
    const { result } = renderHook(() =>
      useDictation({ transcribe, convert: (blob) => Promise.resolve(blob), getMedia: () => Promise.resolve(stream) }),
    )
    await act(() => result.current.start())
    act(() => result.current.stop())
    await flush()
    expect(result.current.state).toEqual({ phase: 'transcribing' })
    act(() => result.current.cancel())
    await act(async () => resolve({ text: 'too late', language: 'en' }))
    expect(result.current.state).toEqual({ phase: 'idle' })
  })
})

describe('DictationPanel', () => {
  const renderPanel = (state: DictationState, handlers: Partial<Record<'onStop' | 'onCancel' | 'onRetry' | 'onTextChange' | 'onInsert', ReturnType<typeof vi.fn>>> = {}) =>
    render(
      <I18nProvider>
        <DictationPanel
          state={state}
          onStop={handlers.onStop ?? vi.fn()}
          onCancel={handlers.onCancel ?? vi.fn()}
          onRetry={handlers.onRetry ?? vi.fn()}
          onTextChange={handlers.onTextChange ?? vi.fn()}
          onInsert={handlers.onInsert ?? vi.fn()}
        />
      </I18nProvider>,
    )

  it('shows the time while recording and stops on Stop', () => {
    const onStop = vi.fn()
    renderPanel({ phase: 'recording', seconds: 65 }, { onStop })
    expect(screen.getByText('Listening… 1:05 of 2:00')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('dictation-stop'))
    expect(onStop).toHaveBeenCalled()
  })

  it('lets the text be checked, then inserts it', () => {
    const onInsert = vi.fn()
    const onTextChange = vi.fn()
    renderPanel({ phase: 'review', text: 'ኪራዩ በወር 15 ሺህ ብር ነው።' }, { onInsert, onTextChange })
    expect(screen.getByText(/names, amounts and dates may be misheard/)).toBeInTheDocument()
    const box = screen.getByTestId('dictation-text')
    expect(box).toHaveValue('ኪራዩ በወር 15 ሺህ ብር ነው።')
    fireEvent.change(box, { target: { value: 'ኪራዩ በወር 16 ሺህ ብር ነው።' } })
    expect(onTextChange).toHaveBeenCalledWith('ኪራዩ በወር 16 ሺህ ብር ነው።')
    fireEvent.click(screen.getByTestId('dictation-insert'))
    expect(onInsert).toHaveBeenCalledWith('ኪራዩ በወር 15 ሺህ ብር ነው።')
  })

  it('explains a problem; Esc closes', () => {
    const onCancel = vi.fn()
    renderPanel({ phase: 'error', problem: 'denied' }, { onCancel })
    expect(screen.getByRole('alert')).toHaveTextContent('The microphone is blocked')
    fireEvent.keyDown(screen.getByTestId('dictation-panel'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })

  it('offers no retry where retrying cannot help', () => {
    renderPanel({ phase: 'error', problem: 'offline' })
    expect(screen.queryByTestId('dictation-retry')).toBeNull()
  })
})
