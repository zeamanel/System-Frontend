import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import * as client from '../../lib/saved-images/client'
import type { SavedImage, SavedImageList } from '../../lib/saved-images/types'
import type { SavedImageKind } from '../../lib/saved-images/types'
import { rotatePixels, type Pixels } from '../../lib/media/cleanup'
import * as browser from '../../lib/media/cleanup-browser'
import { preparePrintableImage } from '../../lib/media/prepare'
import { InsertImageDialog } from './InsertImageDialog'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

// The test browser has no canvas: the picture is "prepared" as is.
vi.mock('../../lib/media/prepare', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/media/prepare')>()
  return { ...actual, preparePrintableImage: vi.fn(async (file: Blob) => file) }
})

// The test browser has no canvas either: reading a photo gives a made-up one, and the cleaned picture is a made-up PNG.
vi.mock('../../lib/media/cleanup-browser', () => ({
  decodeToPixels: vi.fn(),
  drawPixels: vi.fn(),
  cleanedImageBlob: vi.fn(async () => new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' })),
  pixelsToPngBlob: vi.fn(),
}))

/** A photo of three lines of handwriting leaning 8 degrees, in black on white paper. */
function leaningNote(): Pixels {
  const width = 200
  const height = 120
  const ink = new Uint8ClampedArray(width * height * 4)
  for (const top of [25, 55, 85]) {
    for (let y = top; y < top + 6; y++) for (let x = 20; x < 180; x++) ink.set([0, 0, 0, 255], (y * width + x) * 4)
  }
  const tilted = rotatePixels({ width, height, data: ink }, 8)
  const paper = new Uint8ClampedArray(tilted.data.length)
  for (let p = 0; p < tilted.width * tilted.height; p++) {
    const a = tilted.data[p * 4 + 3] / 255
    const v = 245 * (1 - a) + tilted.data[p * 4] * a
    paper.set([v, v, v, 255], p * 4)
  }
  return { width: tilted.width, height: tilted.height, data: paper }
}

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
  const onPickFile = vi.fn<(file: File, slot?: 'signature' | 'stamp') => void>()
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
    // Into the text, not onto a signature line: no slot.
    expect(onPickFile).toHaveBeenCalledWith(file, undefined)
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
    vi.mocked(browser.decodeToPixels).mockResolvedValue(leaningNote())
    fireEvent.change(within(form).getByTestId('saved-image-file'), { target: { files: [new File([blob], 'stamp.png', { type: 'image/png' })] } })
    fireEvent.change(within(form).getByLabelText(/What it is/), { target: { value: 'stamp' } })
    fireEvent.change(within(form).getByLabelText(/^Name/), { target: { value: 'Official stamp' } })
    fireEvent.click(screen.getByTestId('saved-image-save'))

    const insert = await screen.findByTestId('saved-image-insert')
    // A stamp is cleaned up by default: the photo goes through the clean-up, not the plain preparation.
    expect(browser.cleanedImageBlob).toHaveBeenCalledWith(expect.any(File), { strength: 0.5, angle: 0 })
    expect(preparePrintableImage).not.toHaveBeenCalled()
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

  it('cleans up a stamp or signature photo by default, and leaves a logo as it is', async () => {
    vi.mocked(browser.decodeToPixels).mockResolvedValue(leaningNote())
    renderDialog()
    fireEvent.click(await screen.findByTestId('saved-image-add'))
    const form = screen.getByTestId('saved-image-form')
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    fireEvent.change(within(form).getByTestId('saved-image-file'), { target: { files: [file] } })
    fireEvent.change(within(form).getByLabelText(/^Name/), { target: { value: 'Logo' } })
    // Stamp (the default kind): the clean-up is on, with its settings.
    expect(within(form).getByTestId('stamp-cleanup-enabled')).toBeChecked()
    expect(await within(form).findByTestId('stamp-cleanup-strength')).toBeInTheDocument()
    // A logo: off, and no settings. Saving prepares the picture the plain way.
    fireEvent.change(within(form).getByLabelText(/What it is/), { target: { value: 'logo' } })
    expect(within(form).getByTestId('stamp-cleanup-enabled')).not.toBeChecked()
    expect(within(form).queryByTestId('stamp-cleanup-strength')).toBeNull()
    fireEvent.click(screen.getByTestId('saved-image-save'))
    await waitFor(() => expect(preparePrintableImage).toHaveBeenCalled())
    expect(browser.cleanedImageBlob).not.toHaveBeenCalled()
  })

  it('straightens a leaning photo automatically, and the saved picture uses the settings chosen', async () => {
    vi.mocked(browser.decodeToPixels).mockResolvedValue(leaningNote())
    renderDialog()
    fireEvent.click(await screen.findByTestId('saved-image-add'))
    const form = screen.getByTestId('saved-image-form')
    fireEvent.change(within(form).getByTestId('saved-image-file'), { target: { files: [new File(['x'], 'sig.png', { type: 'image/png' })] } })
    fireEvent.change(within(form).getByLabelText(/What it is/), { target: { value: 'signature' } })
    fireEvent.change(within(form).getByLabelText(/^Name/), { target: { value: 'Manager signature' } })
    const auto = await within(form).findByTestId('stamp-cleanup-auto')
    await waitFor(() => expect(auto).toBeEnabled())
    fireEvent.click(auto)
    // The lines lean 8 degrees clockwise: turned back about 8 degrees.
    await waitFor(() => expect(Number(within(form).getByTestId<HTMLInputElement>('stamp-cleanup-angle').value)).toBeLessThan(-6))
    const angle = Number(within(form).getByTestId<HTMLInputElement>('stamp-cleanup-angle').value)
    expect(angle).toBeGreaterThan(-9.5)
    fireEvent.change(within(form).getByTestId('stamp-cleanup-strength'), { target: { value: '70' } })
    fireEvent.click(screen.getByTestId('saved-image-save'))
    await waitFor(() => expect(browser.cleanedImageBlob).toHaveBeenCalledWith(expect.any(File), { strength: 0.7, angle }))
  })

  it('says so when no ink is found, and does not save', async () => {
    vi.mocked(browser.decodeToPixels).mockResolvedValue({ width: 40, height: 30, data: new Uint8ClampedArray(40 * 30 * 4).fill(240) })
    vi.mocked(browser.cleanedImageBlob).mockResolvedValueOnce(null)
    renderDialog()
    fireEvent.click(await screen.findByTestId('saved-image-add'))
    const form = screen.getByTestId('saved-image-form')
    fireEvent.change(within(form).getByTestId('saved-image-file'), { target: { files: [new File(['x'], 'blank.png', { type: 'image/png' })] } })
    fireEvent.change(within(form).getByLabelText(/^Name/), { target: { value: 'Blank' } })
    expect(await within(form).findByText(/No ink was found/)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('saved-image-save'))
    await waitFor(() => expect(within(form).getAllByText(/No ink was found/).length).toBeGreaterThan(0))
    expect(screen.queryByTestId('saved-image-insert')).toBeNull()
  })
})

