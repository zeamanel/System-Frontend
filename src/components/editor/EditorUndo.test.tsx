import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import type { DocumentDetailRecord } from '../../lib/repositories'
import { EditorWorkspace } from './EditorWorkspace'
import { UNDO_COALESCE_MS } from './useDocumentEditor'

const repos = getRepositories()

async function renderEditor(): Promise<DocumentDetailRecord> {
  window.innerWidth = 1600
  const doc = await repos.documents.get('doc-fixture-1')
  if (!doc) throw new Error('fixture missing')
  const template = doc.templateId ? await repos.templates.get(doc.templateId, 'en') : null
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <EditorWorkspace document={doc} template={template} onBack={vi.fn()} refresh={vi.fn(async () => doc)} />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  await screen.findByTestId('editor-title-input')
  return doc
}

/** The editable surfaces on the page, in order. */
const surfaces = () => [...document.querySelectorAll<HTMLElement>('[data-editor-canvas-root] [contenteditable][data-block-id]')]

let now = 1_000_000
function type(surface: HTMLElement, html: string, after = 100): void {
  now += after
  surface.innerHTML = html
  fireEvent.input(surface)
}

const key = (init: KeyboardEventInit, target: EventTarget = document.activeElement ?? document.body) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

// jsdom has no isContentEditable (browsers do); the Enter split relies on it.
if (!('isContentEditable' in HTMLElement.prototype) || document.createElement('div').isContentEditable === undefined) {
  Object.defineProperty(HTMLElement.prototype, 'isContentEditable', {
    configurable: true,
    get(this: HTMLElement) {
      return this.closest('[contenteditable="true"], [contenteditable=""]') !== null
    },
  })
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('undo / redo', () => {
  it('typing in one place is one step until a pause; Ctrl+Z and Ctrl+Shift+Z walk through the steps', async () => {
    await renderEditor()
    const first = surfaces()[0]
    const original = first.innerHTML
    first.focus()

    type(first, 'One')
    type(first, 'One two') // within the pause: same step
    type(first, 'One two three', UNDO_COALESCE_MS + 50) // after a pause: a new step
    expect(screen.getByTestId('editor-undo')).toBeEnabled()
    expect(screen.getByTestId('editor-redo')).toBeDisabled()

    expect(key({ key: 'z', ctrlKey: true }, first).defaultPrevented).toBe(true)
    await waitFor(() => expect(surfaces()[0].innerHTML).toBe('One two'))
    key({ key: 'z', ctrlKey: true }, surfaces()[0])
    await waitFor(() => expect(surfaces()[0].innerHTML).toBe(original))
    expect(screen.getByTestId('editor-undo')).toBeDisabled()

    key({ key: 'z', ctrlKey: true, shiftKey: true }, surfaces()[0])
    await waitFor(() => expect(surfaces()[0].innerHTML).toBe('One two'))
    key({ key: 'y', ctrlKey: true }, surfaces()[0])
    await waitFor(() => expect(surfaces()[0].innerHTML).toBe('One two three'))
    expect(screen.getByTestId('editor-redo')).toBeDisabled()
  })

  it('undoes structural edits too (Enter splits a paragraph; undo joins it back)', async () => {
    await renderEditor()
    const count = surfaces().length
    const first = surfaces()[0]
    first.focus()
    type(first, 'Before split')
    // Enter with the caret at the end splits the block (a new empty paragraph after it).
    const range = document.createRange()
    range.selectNodeContents(first)
    range.collapse(false)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    fireEvent.keyDown(first, { key: 'Enter' })
    await waitFor(() => expect(surfaces()).toHaveLength(count + 1))

    fireEvent.click(screen.getByTestId('editor-undo'))
    await waitFor(() => expect(surfaces()).toHaveLength(count))
    expect(surfaces()[0].innerHTML).toBe('Before split')
    fireEvent.click(screen.getByTestId('editor-redo'))
    await waitFor(() => expect(surfaces()).toHaveLength(count + 1))
  })

  it('a new edit after undo clears redo', async () => {
    await renderEditor()
    const first = surfaces()[0]
    first.focus()
    type(first, 'A')
    type(first, 'AB', UNDO_COALESCE_MS + 10)
    fireEvent.click(screen.getByTestId('editor-undo'))
    await waitFor(() => expect(screen.getByTestId('editor-redo')).toBeEnabled())
    type(surfaces()[0], 'AC', UNDO_COALESCE_MS + 10)
    await waitFor(() => expect(screen.getByTestId('editor-redo')).toBeDisabled())
  })

  it('leaves Ctrl+Z alone in a form field, so the field keeps its own undo', async () => {
    await renderEditor()
    const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('.guided-fields-panel input, .guided-fields-panel textarea')
    if (!field) throw new Error('no field')
    field.focus()
    expect(key({ key: 'z', ctrlKey: true }, field).defaultPrevented).toBe(false)
  })

  it('takes the Edit-menu undo (beforeinput historyUndo) inside the page', async () => {
    await renderEditor()
    const first = surfaces()[0]
    const original = first.innerHTML
    first.focus()
    type(first, 'Changed')
    const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'historyUndo' })
    act(() => {
      first.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => expect(surfaces()[0].innerHTML).toBe(original))
  })
})
