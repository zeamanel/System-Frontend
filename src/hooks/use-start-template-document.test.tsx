import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { getRepositories } from '../lib/repositories'
import { EMPTY_ORGANIZATION } from '../lib/organization/profile'
import { useStartTemplateDocument } from './use-start-template-document'

function TestComponent() {
  const { startTemplateDocument, isStarting } = useStartTemplateDocument()
  const location = useLocation()

  return (
    <div>
      <span data-testid="current-path">{location.pathname}</span>
      <button
        type="button"
        disabled={isStarting}
        onClick={() => {
          void startTemplateDocument({
            id: 'letter',
            title: 'Formal Business Letter',
            documentTypeId: 'letter',
            language: 'en',
          })
        }}
      >
        Start Letter
      </button>
    </div>
  )
}

describe('useStartTemplateDocument', () => {
  it('creates a blank draft document bound to the template and navigates directly to /documents/:id', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/templates']}>
          <TestComponent />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByTestId('current-path')).toHaveTextContent('/templates')

    await user.click(screen.getByRole('button', { name: 'Start Letter' }))

    await waitFor(() => {
      expect(screen.getByTestId('current-path').textContent).toMatch(/^\/documents\/doc-/)
    })

    const path = screen.getByTestId('current-path').textContent ?? ''
    const documentId = path.replace('/documents/', '')

    const doc = await getRepositories().documents.get(documentId)
    expect(doc).not.toBeNull()
    expect(doc?.templateId).toBe('letter')
    expect(doc?.title).toBe('Formal Business Letter')
    // Blank A4 initial paper
    expect(doc?.content).toBe('')
  })

  it('starts a letter clean (branding is added on demand) unless the organization opted in to its letterhead', async () => {
    const start = async (): Promise<string> => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const user = userEvent.setup()
      const view = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/templates']}>
            <TestComponent />
          </MemoryRouter>
        </QueryClientProvider>,
      )
      await user.click(screen.getByRole('button', { name: 'Start Letter' }))
      await waitFor(() => expect(screen.getByTestId('current-path').textContent).toMatch(/^\/documents\/doc-/))
      const id = (screen.getByTestId('current-path').textContent ?? '').replace('/documents/', '')
      view.unmount()
      return (await getRepositories().documents.get(id))?.content ?? ''
    }

    await getRepositories().organization.update({
      ...EMPTY_ORGANIZATION,
      name: 'Bole Consulting',
      type: 'office',
      letterhead: { headerLines: ['Bole Consulting PLC'], footerLine: '' },
    })
    expect(await start()).toBe('')

    await getRepositories().organization.update({
      ...EMPTY_ORGANIZATION,
      name: 'Bole Consulting',
      type: 'office',
      letterhead: { headerLines: ['Bole Consulting PLC'], footerLine: '' },
      documentLook: { autoStyle: true, alwaysLetterhead: true, customerFooter: '' },
    })
    const office = JSON.parse(await start()) as { style?: { id: string }; page: { headerHtml: string } }
    expect(office.style?.id).toBe('executive-letterhead')
    expect(office.page.headerHtml).toContain('Bole Consulting PLC')

    await getRepositories().organization.update({
      ...EMPTY_ORGANIZATION,
      name: 'Abebe Typing',
      type: 'print_shop',
      letterhead: { headerLines: ['Abebe Typing'], footerLine: '' },
      documentLook: { autoStyle: true, alwaysLetterhead: true, customerFooter: 'Prepared at Abebe Typing' },
    })
    // A print shop never gets its own letterhead, and its footer line waits for a click.
    expect(await start()).toBe('')
  })
})
