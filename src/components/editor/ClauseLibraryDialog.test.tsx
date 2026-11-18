import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { listClauses, saveClause } from '../../lib/clauses/client'
import type { Clause } from '../../lib/clauses/types'
import { ClauseLibraryDialog } from './ClauseLibraryDialog'

function renderDialog(props: Partial<Parameters<typeof ClauseLibraryDialog>[0]> = {}) {
  const onInsert = vi.fn<(clause: Clause) => void>()
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <ClauseLibraryDialog open onClose={onClose} language="en" draftText="" canInsert onInsert={onInsert} {...props} />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  return { onInsert, onClose }
}

describe('ClauseLibraryDialog', () => {
  beforeEach(() => localStorage.clear())

  it('saves the selected text as a clause with a suggested name', async () => {
    renderDialog({ draftText: 'The tenant pays rent by the fifth day of each month.' })
    expect(await screen.findByTestId('clause-empty')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('clause-new'))
    expect(screen.getByTestId('clause-title')).toHaveValue('The tenant pays rent by the')
    expect(screen.getByTestId('clause-body')).toHaveValue('The tenant pays rent by the fifth day of each month.')
    fireEvent.change(screen.getByTestId('clause-title'), { target: { value: 'Rent due date' } })
    fireEvent.click(screen.getByTestId('clause-save'))
    await waitFor(() => expect(screen.getByTestId('clause-list')).toHaveTextContent('Rent due date'))
    expect((await listClauses())[0]).toMatchObject({ title: 'Rent due date', language: 'en' })
  })

  it('inserts a clause, counts the use and closes', async () => {
    await saveClause({ title: 'Warranty', body: 'One-year warranty.\n\nParts only.', language: 'am' })
    const { onInsert, onClose } = renderDialog()
    const list = await screen.findByTestId('clause-list')
    expect(list).toHaveTextContent('AM')
    fireEvent.click(screen.getByRole('button', { name: 'Insert Warranty' }))
    expect(onInsert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Warranty' }))
    expect(onClose).toHaveBeenCalled()
    await waitFor(async () => expect((await listClauses())[0]?.useCount).toBe(1))
  })

  it('does not insert while the page is locked, and hides edit for clauses the user cannot change', async () => {
    const saved = await saveClause({ title: 'Shared one', body: 'Text.' })
    localStorage.setItem('docuA4.fixture.clauses', JSON.stringify([{ ...saved, mine: false, canManage: false, shared: true }]))
    renderDialog({ canInsert: false })
    await screen.findByTestId('clause-list')
    expect(screen.getByTestId('clause-insert')).toBeDisabled()
    expect(screen.queryByTestId('clause-delete')).toBeNull()
    expect(screen.getByTestId('clause-list')).toHaveTextContent('Shared')
  })
})
