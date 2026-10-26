import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { ToastProvider } from '../components/ui'
import { SessionContext } from '../session/context'
import type { SessionContextValue } from '../session/context'
import type { SessionUser } from '../lib/repositories'
import { getRepositories } from '../lib/repositories'
import OrganizationPage from './OrganizationPage'

vi.mock('../lib/media/prepare', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/media/prepare')>()),
  // jsdom cannot decode images; shrinking is tested in lib/media.
  prepareImage: vi.fn((file: Blob) => Promise.resolve(file)),
}))

function renderPage() {
  const user: SessionUser = { id: 'u1', name: 'Test User', email: 'test@example.com', role: 'user' }
  const session: SessionContextValue = {
    state: { status: 'authenticated', user },
    user,
    isAdmin: false,
    signIn: vi.fn(async () => user),
    signOut: vi.fn(async () => undefined),
  }
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <SessionContext.Provider value={session}>
            <OrganizationPage />
          </SessionContext.Provider>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('OrganizationPage', () => {
  it('edits business details, letterhead and signatories and saves them', async () => {
    renderPage()
    const tin = await screen.findByLabelText(/^TIN/)
    expect(tin).toHaveValue('0012345678')
    expect(screen.getByLabelText(/^Organization name/)).toHaveValue('Tadesse Print Works')

    fireEvent.change(tin, { target: { value: '0099887766' } })
    fireEvent.change(screen.getByLabelText('Header line 3'), { target: { value: 'P.O. Box 1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add signatory' }))
    const names = screen.getAllByLabelText('Full name')
    fireEvent.change(names[names.length - 1], { target: { value: 'Sara Haile' } })
    fireEvent.change(screen.getAllByLabelText('Title').at(-1)!, { target: { value: 'Finance Head' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(async () => {
      const saved = await getRepositories().organization.get()
      expect(saved?.tin).toBe('0099887766')
      expect(saved?.letterhead.headerLines).toEqual(['Tadesse Print Works PLC', 'Bole Road, Addis Ababa', 'P.O. Box 1234'])
      expect(saved?.signatories).toEqual([
        { fullName: 'Tadesse Alemu', title: 'General Manager' },
        { fullName: 'Sara Haile', title: 'Finance Head' },
      ])
    })
    expect(screen.getByLabelText('Letterhead preview')).toHaveTextContent('P.O. Box 1234')
  })

  it('says members need a real account in demo mode', async () => {
    renderPage()
    expect(await screen.findByText(/members are available when you are signed in/i)).toBeInTheDocument()
  })

  it('uploads, keeps and removes the organization logo', async () => {
    const blobUrls = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown }
    blobUrls.createObjectURL = vi.fn(() => 'blob:logo')
    blobUrls.revokeObjectURL = vi.fn()
    onTestFinished(() => {
      delete blobUrls.createObjectURL
      delete blobUrls.revokeObjectURL
    })
    renderPage()
    expect(await screen.findByText('No logo yet')).toBeInTheDocument()
    const logo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'logo.png', { type: 'image/png' })
    fireEvent.change(screen.getByTestId('org-logo-input'), { target: { files: [logo] } })

    expect(await screen.findByAltText('Organization logo')).toHaveAttribute('src', 'blob:logo')
    const saved = await getRepositories().organization.get()
    expect(saved?.logoMediaId).toMatch(/^[0-9a-f-]{36}$/)

    // Saving the form afterwards keeps the logo.
    fireEvent.change(screen.getByLabelText(/^TIN/), { target: { value: '0011223344' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(async () => expect((await getRepositories().organization.get())?.tin).toBe('0011223344'))
    expect((await getRepositories().organization.get())?.logoMediaId).toBe(saved?.logoMediaId)

    fireEvent.click(screen.getByRole('button', { name: 'Remove logo' }))
    expect(await screen.findByText('No logo yet')).toBeInTheDocument()
    expect((await getRepositories().organization.get())?.logoMediaId).toBeUndefined()
  })
})
