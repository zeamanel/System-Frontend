import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { getRepositories } from '../../lib/repositories'
import { createEmptyDocument, createParagraph } from '../../lib/editor/model'
import { VersionHistoryDialog } from './VersionHistoryDialog'

describe('VersionHistoryDialog: compare', () => {
  it('shows what changed between a saved version and the text on the page now', async () => {
    const repo = getRepositories().documents
    vi.spyOn(repo, 'versions').mockResolvedValue([
      { version: 2, title: 'Lease', createdAt: new Date().toISOString() },
      { version: 1, title: 'Lease', createdAt: new Date().toISOString() },
    ])
    const old = { ...createEmptyDocument('en'), blocks: [createParagraph('Rent is 5,000 birr.'), createParagraph('Old clause.')] }
    vi.spyOn(repo, 'versionContent').mockResolvedValue({ version: 1, title: 'Lease', createdAt: new Date().toISOString(), content: JSON.stringify(old) })
    const now = { ...createEmptyDocument('en'), blocks: [createParagraph('Rent is 7,500 birr.'), createParagraph('A new clause.')] }

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <I18nProvider>
          <VersionHistoryDialog
            open
            onClose={vi.fn()}
            documentId="doc-1"
            currentVersion={2}
            beforeRestore={vi.fn()}
            onRestored={vi.fn()}
            onFailed={vi.fn()}
            currentModel={now}
          />
        </I18nProvider>
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByTestId('compare-version-1'))
    expect(await screen.findByTestId('compare-summary')).toHaveTextContent('1 edited, 1 added, 1 removed')
    const view = screen.getByTestId('version-compare')
    expect(view.querySelector('del')?.textContent).toBe('5,000')
    expect(view.querySelector('ins')?.textContent).toBe('7,500')
    expect(view).toHaveTextContent('Old clause.')
    fireEvent.click(screen.getByTestId('compare-back'))
    expect(await screen.findByTestId('version-history')).toBeInTheDocument()
  })
})
