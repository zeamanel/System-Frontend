import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { getRepositories } from '../../lib/repositories'
import type { DocumentRecord, TemplateSummary } from '../../lib/repositories'
import { DocumentsField } from './DocumentsField'
import { documentIdsOf } from '../../lib/books/ids'

const doc = (id: string, title: string, templateId: string | null): DocumentRecord => ({
  id,
  title,
  templateId,
  templateTitle: templateId ? 'Book Outline' : null,
  status: 'ready',
  language: 'en',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-20T00:00:00.000Z',
})

function Harness({ initial = '', onValue }: { initial?: string; onValue: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <DocumentsField
      id="book_plan"
      label="Book plan documents"
      value={value}
      onChange={(next) => {
        setValue(next)
        onValue(next)
      }}
      accepts={['book_outline', 'book_character_profile']}
      currentDocumentId="current"
    />
  )
}

function wrap(children: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>{children}</I18nProvider>
    </QueryClientProvider>,
  )
}

describe('A "documents" question', () => {
  it('offers the suggested kinds first, keeps the order chosen, and can move and remove', async () => {
    const repos = getRepositories()
    vi.spyOn(repos.documents, 'list').mockResolvedValue([
      doc('outline', 'The River — outline', 'tpl-outline'),
      doc('almaz', 'Almaz', 'tpl-character'),
      doc('lease', 'House lease', 'tpl-lease'),
      doc('current', 'This chapter', 'tpl-chapter'),
    ])
    vi.spyOn(repos.templates, 'list').mockResolvedValue([
      { id: 'tpl-outline', documentTypeId: 'book_outline' },
      { id: 'tpl-character', documentTypeId: 'book_character_profile' },
      { id: 'tpl-lease', documentTypeId: 'lease_agreement' },
    ] as TemplateSummary[])
    const onValue = vi.fn()
    wrap(<Harness onValue={onValue} />)

    const offered = await screen.findByTestId('documents-field-offered-book_plan')
    await waitFor(() => expect(within(offered).getAllByTestId('documents-field-add').map((b) => b.textContent)).toHaveLength(2))
    expect(offered).toHaveTextContent('The River — outline')
    expect(offered).not.toHaveTextContent('House lease')
    expect(offered).not.toHaveTextContent('This chapter')

    fireEvent.click(within(offered).getByText('Almaz'))
    fireEvent.click(within(screen.getByTestId('documents-field-offered-book_plan')).getByText('The River — outline'))
    expect(onValue).toHaveBeenLastCalledWith('almaz,outline')

    fireEvent.click(screen.getByRole('button', { name: 'Move The River — outline up' }))
    expect(onValue).toHaveBeenLastCalledWith('outline,almaz')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Almaz' }))
    expect(onValue).toHaveBeenLastCalledWith('outline')

    // Other documents only on request.
    fireEvent.click(screen.getByTestId('documents-field-toggle-book_plan'))
    expect(screen.getByTestId('documents-field-offered-book_plan')).toHaveTextContent('House lease')
  })

  it('reads its answer as ids in order, once each', () => {
    expect(documentIdsOf(' a, b ,a,,c')).toEqual(['a', 'b', 'c'])
    expect(documentIdsOf('')).toEqual([])
  })
})
