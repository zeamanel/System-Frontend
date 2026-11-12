import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import { EditorWorkspace } from './EditorWorkspace'

// The recording is turned into text by the (mocked) service.
vi.mock('../../lib/dictation/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/dictation/client')>()
  return { ...actual, transcribeRecording: vi.fn().mockResolvedValue({ text: 'Make the rent clause more formal.', language: 'en' }) }
})
vi.mock('../../lib/dictation/wav', () => ({ recordingToWav: (blob: Blob) => Promise.resolve(blob) }))

class FakeRecorder {
  state: 'inactive' | 'recording' = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
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

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('Speaking to the assistant', () => {
  it('puts the checked words into the message box, without touching the page', async () => {
    const repos = getRepositories()
    const created = await repos.documents.create({ title: 'Dictation test', templateId: 'rental-agreement', language: 'en', answers: {}, content: 'The tenant will pay rent.' })
    const doc = await repos.documents.get(created.id)
    const template = await repos.templates.get('rental-agreement', 'en')
    window.innerWidth = 1600
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <I18nProvider>
          <ToastProvider>
            <EditorWorkspace document={doc!} template={template} onBack={vi.fn()} refresh={vi.fn(async () => repos.documents.get(created.id))} />
          </ToastProvider>
        </I18nProvider>
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByTestId('editor-tab-assistant'))
    fireEvent.change(screen.getByTestId('assistant-input'), { target: { value: 'Please' } })

    fireEvent.click(screen.getByTestId('assistant-dictate'))
    fireEvent.click(await screen.findByTestId('dictation-stop'))
    await screen.findByTestId('dictation-text')
    expect(screen.getByTestId('dictation-insert')).toHaveTextContent('Use in message')
    fireEvent.click(screen.getByTestId('dictation-insert'))

    await waitFor(() => expect(screen.getByTestId('assistant-input')).toHaveValue('Please Make the rent clause more formal.'))
    expect(screen.queryByTestId('dictation-panel')).toBeNull()
    expect(track.stop).toHaveBeenCalled()
    // Nothing went into the page.
    expect(document.querySelector('.doc-paper')?.textContent).not.toContain('Make the rent clause more formal.')
  })
})
