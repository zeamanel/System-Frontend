import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { createEmptyDocument, createParagraph, parseDocumentContent } from '../../lib/editor/model'
import { getRepositories } from '../../lib/repositories'
import { BulkCopiesDialog } from './BulkCopiesDialog'

function renderDialog(model = createEmptyDocument('en')) {
  const onClose = vi.fn()
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <I18nProvider>
          <BulkCopiesDialog open onClose={onClose} model={model} title="Employment contract" language="en" templateId="letter" />
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
  return { onClose }
}

const contract = () => ({
  ...createEmptyDocument('en'),
  blocks: [createParagraph('[employee name] is hired as [position] for [salary] birr.')],
})

describe('BulkCopiesDialog', () => {
  it('explains how to add gaps when the document has none', () => {
    renderDialog({ ...createEmptyDocument('en'), blocks: [createParagraph('No gaps here.')] })
    expect(screen.getByTestId('bulk-no-gaps')).toHaveTextContent('[employee name]')
    expect(screen.queryByTestId('bulk-choose-file')).toBeNull()
  })

  it('makes one document per pasted row, with the gaps filled from the matching columns', async () => {
    const create = vi.spyOn(getRepositories().documents, 'create')
    renderDialog(contract())
    fireEvent.change(screen.getByTestId('bulk-paste'), {
      target: { value: 'Employee name\tSalary\tNotes\nDawit Haile\t20,000\tx\nSara Tesfaye\t\ty\n' },
    })
    fireEvent.click(screen.getByTestId('bulk-use-pasted'))

    expect(await screen.findByTestId('bulk-rows')).toHaveTextContent('2 rows in the table.')
    const [name, position, salary] = screen.getAllByTestId('bulk-map') as HTMLSelectElement[]
    expect([name.value, position.value, salary.value]).toEqual(['0', '', '1'])
    expect(screen.getByTestId('bulk-preview')).toHaveTextContent('Employment contract — Dawit Haile')
    expect(screen.getByTestId('bulk-empty-warning')).toHaveTextContent('1 row has empty cells')

    fireEvent.click(screen.getByTestId('bulk-create'))
    const done = await screen.findByTestId('bulk-done')
    expect(done).toHaveTextContent('Made 2 documents.')
    const links = within(screen.getByTestId('bulk-made')).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Employment contract — Dawit Haile', 'Employment contract — Sara Tesfaye'])

    expect(create).toHaveBeenCalledTimes(2)
    const first = create.mock.calls.find((call) => call[0].title === 'Employment contract — Dawit Haile')?.[0]
    expect(first).toMatchObject({ language: 'en', templateId: 'letter' })
    expect(first?.idempotencyKey).toMatch(/^bulk-.+-0$/)
    const made = parseDocumentContent(first?.content ?? '', 'en')
    expect(made?.blocks[0]).toMatchObject({ html: 'Dawit Haile is hired as [position] for 20,000 birr.' })
    create.mockRestore()
  })

  it('lists rows that could not be made and makes only those again', async () => {
    const documents = getRepositories().documents
    const real = documents.create.bind(documents)
    let failOnce = true
    const create = vi.spyOn(documents, 'create').mockImplementation((payload) => {
      if (payload.title?.endsWith('Sara') && failOnce) {
        failOnce = false
        return Promise.reject(new Error('network'))
      }
      return real(payload)
    })
    renderDialog(contract())
    fireEvent.change(screen.getByTestId('bulk-paste'), { target: { value: 'Employee name\nDawit\nSara\n' } })
    fireEvent.click(screen.getByTestId('bulk-use-pasted'))
    fireEvent.click(await screen.findByTestId('bulk-create'))
    expect(await screen.findByTestId('bulk-done')).toHaveTextContent('Made 1 document.')
    expect(screen.getByRole('alert')).toHaveTextContent('1 could not be made.')
    const firstKey = create.mock.calls.find((call) => call[0].title?.endsWith('Sara'))?.[0].idempotencyKey

    fireEvent.click(screen.getByTestId('bulk-retry'))
    await waitFor(() => expect(screen.getByTestId('bulk-done')).toHaveTextContent('Made 2 documents.'))
    expect(create).toHaveBeenCalledTimes(3)
    // The retry reuses the row's key: the server never makes it twice.
    expect(create.mock.calls[2][0]).toMatchObject({ title: 'Employment contract — Sara', idempotencyKey: firstKey })
    create.mockRestore()
  })

  it('says what is wrong with a paste that has no rows', async () => {
    renderDialog(contract())
    fireEvent.change(screen.getByTestId('bulk-paste'), { target: { value: 'Employee name' } })
    fireEvent.click(screen.getByTestId('bulk-use-pasted'))
    expect(await screen.findByTestId('bulk-error')).toHaveTextContent('No rows were found.')
  })
})
