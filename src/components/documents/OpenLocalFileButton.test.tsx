import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { OpenLocalFileButton } from './OpenLocalFileButton'

function renderComponent(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/documents']}>
            <Routes>
              <Route path="/documents" element={ui} />
              <Route path="/documents/:id" element={<div data-testid="document-editor-page" />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('OpenLocalFileButton', () => {
  it('renders button and hidden file input with supported file extensions', () => {
    renderComponent(<OpenLocalFileButton />)

    const button = screen.getByRole('button', { name: /open file/i })
    expect(button).toBeInTheDocument()

    const input = screen.getByTestId('open-local-file-input') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.type).toBe('file')
    expect(input.accept).toContain('.docx')
    expect(input.accept).toContain('.md')
    expect(input.accept).toContain('.txt')
    expect(input.accept).toContain('.json')
    expect(input.accept).toContain('.html')
  })

  it('calls onImportIntoCurrent when provided instead of creating a new document', async () => {
    const handleImport = vi.fn()
    renderComponent(<OpenLocalFileButton onImportIntoCurrent={handleImport} />)

    const input = screen.getByTestId('open-local-file-input')
    const file = new File(['# My Notes\n\nContent paragraph.'], 'My_Notes.md', {
      type: 'text/markdown',
    })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(handleImport).toHaveBeenCalledTimes(1)
    })

    expect(handleImport).toHaveBeenCalledWith(
      expect.stringContaining('docuA4.document'),
      'My Notes',
    )
  })

  it('creates a new document and navigates when picking a local file without onImportIntoCurrent', async () => {
    renderComponent(<OpenLocalFileButton />)

    const input = screen.getByTestId('open-local-file-input')
    const file = new File(['# New Lease\n\nTerm details.'], 'New_Lease.md', {
      type: 'text/markdown',
    })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByTestId('document-editor-page')).toBeInTheDocument()
    })
  })
})
