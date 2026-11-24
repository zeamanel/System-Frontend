import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import { createEmptyDocument, createHeading, createParagraph, serializeModel } from '../../lib/editor/model'
import { pngUrl } from '../../test/images'
import { EditorWorkspace } from './EditorWorkspace'

// No canvas in the test browser: the crop gives back a ready photo.
vi.mock('../../lib/media/photo', () => ({ cropToPhotoBox: vi.fn(async () => pngUrl(600, 800)) }))

async function openCv() {
  const repos = getRepositories()
  const heading = createHeading('Abebe Kebede', 1)
  const created = await repos.documents.create({
    title: 'My CV',
    templateId: 'cv',
    language: 'en',
    answers: {},
    content: serializeModel({ ...createEmptyDocument('en'), blocks: [heading, createParagraph('Graphic designer, Bole, Addis Ababa')] }),
  })
  const doc = (await repos.documents.get(created.id))!
  const template = await repos.templates.get('cv', 'en')
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <EditorWorkspace document={doc} template={template} onBack={vi.fn()} refresh={vi.fn(async () => repos.documents.get(created.id))} />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  await screen.findByTestId('editor-title-input')
  return { headingId: heading.id }
}

describe('A photo box on a CV', () => {
  beforeEach(() => localStorage.clear())

  it('is offered in one click on a CV: an empty box beside the name, to glue a photo in', async () => {
    await openCv()
    const offer = await screen.findByTestId('branding-photo-box')
    expect(offer).toHaveTextContent('Add a photo box')
    fireEvent.click(offer)
    const box = await screen.findByTestId('photo-box')
    expect(box).toHaveTextContent('Photo')
    expect(box).toHaveAttribute('data-size', '3x4')
    // Beside the first heading.
    expect(box.closest('.doc-block--heading')).not.toBeNull()
    expect(screen.getByTestId('branding-photo-box')).toHaveTextContent('Remove the photo box')
    fireEvent.click(screen.getByTestId('branding-photo-box'))
    await waitFor(() => expect(screen.queryByTestId('photo-box')).toBeNull())
  })

  it('takes a photo, a size and removals from the Format panel', async () => {
    await openCv()
    fireEvent.focus(await screen.findByLabelText('heading 1'))
    fireEvent.click(await screen.findByTestId('photo-box-add'))
    const controls = await screen.findByTestId('photo-box-controls')
    fireEvent.change(within(controls).getByTestId('photo-box-file'), { target: { files: [new File(['x'], 'abebe.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(within(screen.getByTestId('photo-box')).getByRole('img')).toHaveAttribute('alt', 'abebe'))

    fireEvent.change(within(screen.getByTestId('photo-box-controls')).getByLabelText('Size'), { target: { value: '3.5x4.5' } })
    await waitFor(() => expect(screen.getByTestId('photo-box')).toHaveAttribute('data-size', '3.5x4.5'))
    // The photo stays when the size changes.
    expect(within(screen.getByTestId('photo-box')).getByRole('img')).toBeInTheDocument()

    fireEvent.click(within(screen.getByTestId('photo-box-controls')).getByTestId('photo-box-remove-photo'))
    await waitFor(() => expect(screen.getByTestId('photo-box')).toHaveTextContent('Photo'))
    fireEvent.click(within(screen.getByTestId('photo-box-controls')).getByTestId('photo-box-remove'))
    await waitFor(() => expect(screen.queryByTestId('photo-box')).toBeNull())
  })
})
