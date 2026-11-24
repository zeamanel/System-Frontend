import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import type { TemplateDetail } from '../../lib/repositories/types'
import { createAiImages } from '../../lib/ai-image/client'
import { createEmptyDocument, createHeading, createParagraph, serializeModel } from '../../lib/editor/model'
import { EditorWorkspace } from './EditorWorkspace'

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

vi.mock('../../lib/ai-image/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/ai-image/client')>()),
  createAiImages: vi.fn(async () => ({ images: [{ dataUrl: JPEG, width: 2048, height: 1536 }], credits: 5 })),
}))
// No canvas in the test browser: the picture is "scaled" as is.
vi.mock('../../lib/media/ai-picture', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/media/ai-picture')>()),
  bookPictureDataUrl: vi.fn(async (dataUrl: string) => dataUrl),
}))

async function openWith(documentTypeId: string) {
  const repos = getRepositories()
  const base = (await repos.templates.get('cv', 'en'))!
  const template: TemplateDetail = { ...base, documentTypeId }
  const created = await repos.documents.create({
    title: 'Chapter one',
    templateId: 'cv',
    language: 'en',
    answers: {},
    content: serializeModel({ ...createEmptyDocument('en'), blocks: [createHeading('Chapter one', 1), createParagraph('The rains came early that year.')] }),
  })
  const doc = (await repos.documents.get(created.id))!
  // Wide window: the Format panel starts open.
  window.innerWidth = 1600
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
  fireEvent.click(screen.getAllByRole('button', { name: 'Insert logo or image' })[0])
  return screen.findByRole('dialog', { name: 'Add an image' })
}

describe('AI pictures in the editor', () => {
  beforeEach(() => localStorage.clear())

  it('a book can have a picture drawn, which goes in across the page width', async () => {
    const dialog = await openWith('book_narrative_chapter')
    fireEvent.click(within(dialog).getByTestId('insert-image-ai'))
    fireEvent.change(within(dialog).getByTestId('ai-image-description'), { target: { value: 'Grandmother roasting coffee at dawn' } })
    fireEvent.click(within(dialog).getByTestId('ai-image-create'))
    fireEvent.click(await within(dialog).findByTestId('ai-image-use'))
    await waitFor(() => expect(document.querySelector('.doc-pages img[alt="Grandmother roasting coffee at dawn"]')).not.toBeNull())
    expect(createAiImages).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'illustration' }))
    expect(screen.queryByRole('dialog', { name: 'Add an image' })).toBeNull()
    const figure = document.querySelector('.doc-pages img[alt="Grandmother roasting coffee at dawn"]')!.closest('[data-block-type="image"], .doc-block')
    expect(figure?.outerHTML).toContain('100%')
  })

  it('other documents are not offered it', async () => {
    const dialog = await openWith('cv')
    expect(within(dialog).queryByTestId('insert-image-ai')).toBeNull()
    expect(within(dialog).getByTestId('insert-image-device')).toBeInTheDocument()
  })
})
