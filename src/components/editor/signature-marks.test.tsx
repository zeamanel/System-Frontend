import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import { createEmptyDocument, createParagraph, createSignature, serializeModel } from '../../lib/editor/model'
import { pngUrl } from '../../test/images'
import { EditorWorkspace } from './EditorWorkspace'

/** A visible PNG for the canvas (the editor reads its size; the test browser does not decode it). */
const SIGNATURE = pngUrl(300, 100)
const STAMP = pngUrl(400, 400)

async function openSignedLetter() {
  const repos = getRepositories()
  const signature = createSignature(['Landlord'])
  const created = await repos.documents.create({
    title: 'Lease',
    language: 'en',
    answers: {},
    content: serializeModel({ ...createEmptyDocument('en'), blocks: [createParagraph('The landlord rents the house.'), signature] }),
  })
  const doc = await repos.documents.get(created.id)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <EditorWorkspace document={doc!} template={null} onBack={vi.fn()} refresh={vi.fn(async () => repos.documents.get(created.id))} />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  await screen.findByTestId('editor-title-input')
  // Into the signature block: the Format panel shows its signatories.
  fireEvent.focus(await screen.findByLabelText('Signature role'))
  return { partyId: signature.type === 'signature' ? signature.parties[0].id : '' }
}

describe('A signature and a stamp on a signature line', () => {
  beforeEach(() => {
    localStorage.clear()
    const now = new Date().toISOString()
    const saved = (id: string, kind: string, name: string, dataUrl: string) => ({
      id, kind, name, own: true, ownerName: null, access: 'listed', canUse: true, canEdit: true, canDelete: true, width: 1, height: 1, createdAt: now, dataUrl,
    })
    localStorage.setItem(
      'docuA4.fixture.savedImages',
      JSON.stringify([saved('sig', 'signature', 'My signature', SIGNATURE), saved('stamp', 'stamp', 'Official stamp', STAMP)]),
    )
  })

  it('puts a saved signature on the line and a saved stamp over it, from the signatory in the Format panel', async () => {
    const { partyId } = await openSignedLetter()
    const marks = await screen.findByTestId(`party-marks-${partyId}`)

    fireEvent.click(within(marks).getByTestId('party-mark-add'))
    const dialog = await screen.findByRole('dialog', { name: 'Sign or stamp: Landlord' })
    // Aimed at the line: two device choices, no Telegram, no letterhead logo.
    expect(within(dialog).getByTestId('insert-image-device-signature')).toBeInTheDocument()
    expect(within(dialog).getByTestId('insert-image-device-stamp')).toBeInTheDocument()
    expect(within(dialog).queryByTestId('insert-image-telegram')).toBeNull()
    fireEvent.click(within(await within(dialog).findByTestId('saved-image-sig')).getByTestId('saved-image-insert'))
    await waitFor(() => expect(document.querySelector('.doc-signature__sign')).not.toBeNull())
    expect(document.querySelector('.doc-signature__sign')).toHaveAttribute('alt', 'My signature')
    // Not a separate picture in the text.
    expect(document.querySelector('.doc-block--image')).toBeNull()

    fireEvent.click(within(screen.getByTestId(`party-marks-${partyId}`)).getByTestId('party-mark-add'))
    const again = await screen.findByRole('dialog', { name: 'Sign or stamp: Landlord' })
    fireEvent.click(within(await within(again).findByTestId('saved-image-stamp')).getByTestId('saved-image-insert'))
    await waitFor(() => expect(document.querySelector('.doc-signature__stamp')).not.toBeNull())
    expect(document.querySelector('.doc-signature__party--stamped')).not.toBeNull()

    // Both show in the Format panel and come off with one click each.
    const panel = screen.getByTestId(`party-marks-${partyId}`)
    expect(panel).toHaveTextContent('Signature')
    expect(panel).toHaveTextContent('Stamp')
    fireEvent.click(within(panel).getByLabelText('Remove the stamp'))
    await waitFor(() => expect(document.querySelector('.doc-signature__stamp')).toBeNull())
    expect(document.querySelector('.doc-signature__sign')).not.toBeNull()
  })

  it('takes a stamp from the device onto the line', async () => {
    const { partyId } = await openSignedLetter()
    fireEvent.click(within(await screen.findByTestId(`party-marks-${partyId}`)).getByTestId('party-mark-add'))
    const dialog = await screen.findByRole('dialog', { name: 'Sign or stamp: Landlord' })
    fireEvent.click(within(dialog).getByTestId('insert-image-device-stamp'))
    const bytes = Uint8Array.from(atob(STAMP.split(',')[1]), (c) => c.charCodeAt(0))
    fireEvent.change(within(dialog).getByTestId('insert-image-device-file'), {
      target: { files: [new File([bytes], 'company-stamp.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(document.querySelector('.doc-signature__stamp')).toHaveAttribute('alt', 'company-stamp'))
    expect(document.querySelector('.doc-signature__sign')).toBeNull()
  })
})
