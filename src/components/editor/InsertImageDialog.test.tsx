import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import * as client from '../../lib/saved-images/client'
import type { SavedImage, SavedImageList } from '../../lib/saved-images/types'
import type { SavedImageKind } from '../../lib/saved-images/types'
import { InsertImageDialog } from './InsertImageDialog'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

// The test browser has no canvas: the picture is "prepared" as is.
vi.mock('../../lib/media/prepare', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/media/prepare')>()
  return { ...actual, preparePrintableImage: vi.fn(async (file: Blob) => file) }
})

vi.mock('../../hooks/use-organization', () => ({
  useOrganizationMembers: () => ({
    data: [
      { userId: 'u-owner', name: 'Owner Person', email: 'o@x.test', role: 'owner', joinedAt: '' },
      { userId: 'u-clerk', name: 'Clerk Person', email: 'c@x.test', role: 'member', joinedAt: '' },
      { userId: 'u-driver', name: 'Driver Person', email: 'd@x.test', role: 'member', joinedAt: '' },
    ],
  }),
}))

function renderDialog(props: Partial<Parameters<typeof InsertImageDialog>[0]> = {}) {
  const onPickFile = vi.fn<(file: File) => void>()
  const onInsertImage = vi.fn<(dataUrl: string, name: string, kind: SavedImageKind) => void>()
  const onClose = vi.fn()
  const onOpenTelegram = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <InsertImageDialog
            open
            onClose={onClose}
            onPickFile={onPickFile}
            onOpenTelegram={onOpenTelegram}
            onInsertImage={onInsertImage}
            documentId="doc-1"
            {...props}
          />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  return { onPickFile, onInsertImage, onClose, onOpenTelegram }
}

const item = (overrides: Partial<SavedImage>): SavedImage => ({
  id: 'img-1',
  kind: 'stamp',
  name: 'Official stamp',
  own: false,
  ownerName: null,
  access: 'listed',
  canUse: true,
  canEdit: false,
  canDelete: false,
  width: 300,
  height: 300,
  createdAt: '2026-11-24T00:00:00.000Z',
  ...overrides,
})

describe('InsertImageDialog', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('takes a picture from the device, or opens the Telegram files', () => {
    const { onPickFile, onClose, onOpenTelegram } = renderDialog()
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    fireEvent.change(screen.getByTestId('insert-image-device-file'), { target: { files: [file] } })
    expect(onPickFile).toHaveBeenCalledWith(file)
    expect(onClose).toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('insert-image-telegram'))
    expect(onOpenTelegram).toHaveBeenCalled()
  })

  it('saves a stamp once, then puts it into the document in one click', async () => {
    const { onInsertImage, onClose } = renderDialog()
    expect(await screen.findByText('No saved images yet.')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('saved-image-add'))
    const form = screen.getByTestId('saved-image-form')
    const blob = await (await fetch(PNG)).blob()
    fireEvent.change(within(form).getByTestId('saved-image-file'), { target: { files: [new File([blob], 'stamp.png', { type: 'image/png' })] } })
    fireEvent.change(within(form).getByLabelText(/What it is/), { target: { value: 'stamp' } })
    fireEvent.change(within(form).getByLabelText(/^Name/), { target: { value: 'Official stamp' } })
    fireEvent.click(screen.getByTestId('saved-image-save'))

    const insert = await screen.findByTestId('saved-image-insert')
    expect(screen.getByTestId('saved-images')).toHaveTextContent('Official stamp')
    fireEvent.click(insert)
    await waitFor(() => expect(onInsertImage).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/), 'Official stamp', 'stamp'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows images the person may not use as locked, without a way to insert them', async () => {
    const list: SavedImageList = {
      canManage: false,
      canAddOwnSignature: true,
      items: [item({ canUse: false }), item({ id: 'img-2', kind: 'signature', name: 'My signature', own: true, canUse: true, canEdit: true, canDelete: true })],
    }
    vi.spyOn(client, 'listSavedImages').mockResolvedValue(list)
    vi.spyOn(client, 'savedImageBlob').mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
    renderDialog()
    const locked = await screen.findByTestId('saved-image-img-1')
    expect(locked).toHaveTextContent('Ask an owner or admin to let you use it.')
    expect(within(locked).queryByTestId('saved-image-insert')).toBeNull()
    const mine = screen.getByTestId('saved-image-img-2')
    expect(mine).toHaveTextContent('Only you')
    // A member's own signature: no "who can use it" choice, and they add only their signature.
    expect(within(mine).queryByTestId('saved-image-access')).toBeNull()
    expect(screen.getByTestId('saved-image-add')).toHaveTextContent('Save my signature')
  })

  it('lets an owner choose the members who may use a stamp (owners and admins always may)', async () => {
    vi.spyOn(client, 'listSavedImages').mockResolvedValue({
      canManage: true,
      canAddOwnSignature: true,
      items: [item({ canEdit: true, canDelete: true, access: 'everyone', allowedUserIds: [] })],
    })
    vi.spyOn(client, 'savedImageBlob').mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
    const update = vi.spyOn(client, 'updateSavedImage').mockImplementation(async (id, changes) => item({ id, ...changes }))
    renderDialog()
    fireEvent.click(await screen.findByTestId('saved-image-access'))
    fireEvent.click(screen.getByTestId('saved-image-listed'))
    // Only members are listed: owners and admins can always use it.
    expect(screen.queryByLabelText('Owner Person')).toBeNull()
    fireEvent.click(screen.getByLabelText('Driver Person'))
    fireEvent.click(screen.getByTestId('saved-image-access-save'))
    await waitFor(() => expect(update).toHaveBeenCalledWith('img-1', { access: 'listed', allowedUserIds: ['u-driver'] }))
  })
})
