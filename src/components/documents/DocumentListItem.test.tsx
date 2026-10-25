import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../i18n'
import { DocumentListItem } from './DocumentListItem'
import type { DocumentRecord } from '../../lib/repositories'

const mockDoc: DocumentRecord = {
  id: 'doc-item-test-1',
  templateId: 'tpl-1',
  templateTitle: 'Commercial Lease Agreement',
  title: 'Bole Office Lease #42',
  status: 'ready',
  language: 'en',
  version: 1,
  createdAt: '2026-10-25T10:00:00Z',
  updatedAt: '2026-10-25T12:00:00Z',
}

describe('DocumentListItem (UX-01 Duplicate & Delete Actions)', () => {
  it('renders document title, status badge and action buttons', () => {
    render(
      <MemoryRouter>
        <I18nProvider>
          <DocumentListItem
            document={mockDoc}
            onDuplicate={vi.fn()}
            onDelete={vi.fn()}
          />
        </I18nProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Bole Office Lease #42')).toBeInTheDocument()
    expect(screen.getByText(/Commercial Lease Agreement/i)).toBeInTheDocument()
    expect(screen.getByText(/Ready/i)).toBeInTheDocument()
    expect(screen.getByTestId(`duplicate-doc-${mockDoc.id}`)).toBeInTheDocument()
    expect(screen.getByTestId(`delete-doc-${mockDoc.id}`)).toBeInTheDocument()
  })

  it('triggers onDuplicate when clicking duplicate button', async () => {
    const user = userEvent.setup()
    const onDuplicate = vi.fn()

    render(
      <MemoryRouter>
        <I18nProvider>
          <DocumentListItem
            document={mockDoc}
            onDuplicate={onDuplicate}
          />
        </I18nProvider>
      </MemoryRouter>,
    )

    const dupBtn = screen.getByTestId(`duplicate-doc-${mockDoc.id}`)
    await user.click(dupBtn)

    expect(onDuplicate).toHaveBeenCalledTimes(1)
    expect(onDuplicate).toHaveBeenCalledWith(mockDoc.id)
  })

  it('triggers onDelete when clicking delete button', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()

    render(
      <MemoryRouter>
        <I18nProvider>
          <DocumentListItem
            document={mockDoc}
            onDelete={onDelete}
          />
        </I18nProvider>
      </MemoryRouter>,
    )

    const deleteBtn = screen.getByTestId(`delete-doc-${mockDoc.id}`)
    await user.click(deleteBtn)

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith(mockDoc.id)
  })
})
