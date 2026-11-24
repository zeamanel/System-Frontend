import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { AiImageError, createAiImages } from '../../lib/ai-image/client'
import { AiImagePanel } from './AiImagePanel'

vi.mock('../../lib/ai-image/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/ai-image/client')>()),
  createAiImages: vi.fn(),
}))

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const JPEG = 'data:image/jpeg;base64,/9j/4AAQ'

function renderPanel(purpose: 'illustration' | 'logo', onUse = vi.fn()) {
  render(
    <I18nProvider>
      <AiImagePanel documentId="doc-1" purpose={purpose} onUse={onUse} />
    </I18nProvider>,
  )
  return onUse
}

describe('AiImagePanel', () => {
  it('draws two pictures from a description, in the chosen style and shape, and hands over the one picked', async () => {
    vi.mocked(createAiImages).mockResolvedValue({ images: [{ dataUrl: PNG, width: 2048, height: 1536 }, { dataUrl: JPEG, width: 2048, height: 1536 }], credits: 9 })
    const onUse = renderPanel('illustration')
    expect(screen.getByTestId('ai-image-create')).toBeDisabled()
    expect(screen.getByText(/never drawn/)).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('ai-image-description'), { target: { value: 'A girl reading under a coffee tree at dawn, Jimma' } })
    fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'watercolour' } })
    fireEvent.change(screen.getByLabelText('Shape'), { target: { value: '3:4' } })
    fireEvent.click(screen.getByTestId('ai-image-create'))
    const results = await screen.findByTestId('ai-image-results')
    expect(createAiImages).toHaveBeenCalledWith({
      documentId: 'doc-1',
      description: 'A girl reading under a coffee tree at dawn, Jimma',
      purpose: 'illustration',
      style: 'watercolour',
      aspect: '3:4',
      count: 2,
    })
    expect(within(results).getAllByRole('img')).toHaveLength(2)
    expect(screen.getByText('Used 9 credits.')).toBeInTheDocument()
    expect(screen.getByTestId('ai-image-create')).toHaveTextContent('Create others')
    fireEvent.click(within(results).getAllByTestId('ai-image-use')[1])
    await waitFor(() => expect(onUse).toHaveBeenCalledWith({ dataUrl: JPEG, width: 2048, height: 1536 }, 'A girl reading under a coffee'))
  })

  it('asks a logo in a square, without a style', async () => {
    vi.mocked(createAiImages).mockResolvedValue({ images: [{ dataUrl: PNG, width: 1024, height: 1024 }], credits: 5 })
    renderPanel('logo')
    expect(screen.queryByLabelText('Style')).toBeNull()
    fireEvent.change(screen.getByTestId('ai-image-description'), { target: { value: 'a coffee cup' } })
    fireEvent.click(screen.getByTestId('ai-image-create'))
    expect(await screen.findByRole('button', { name: 'Use this logo' })).toBeInTheDocument()
    expect(createAiImages).toHaveBeenLastCalledWith({ documentId: 'doc-1', description: 'a coffee cup', purpose: 'logo', aspect: '1:1', count: 2 })
  })

  it('says why nothing was drawn', async () => {
    renderPanel('illustration')
    fireEvent.change(screen.getByTestId('ai-image-description'), { target: { value: 'our office stamp' } })
    for (const [error, text] of [
      [new AiImageError('refused', 'official_mark'), /use the real one from your saved images/],
      [new AiImageError('refused', 'filtered'), /cost nothing/],
      [new AiImageError('quota'), /renew at midnight/],
      [new AiImageError('demo'), /not available in this demo/],
    ] as const) {
      vi.mocked(createAiImages).mockRejectedValueOnce(error)
      fireEvent.click(screen.getByTestId('ai-image-create'))
      expect(await screen.findByRole('alert')).toHaveTextContent(text)
    }
  })
})
