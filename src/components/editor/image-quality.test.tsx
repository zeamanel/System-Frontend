import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { I18nProvider } from '../../i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../ui'
import { createEmptyDocument, createImage } from '../../lib/editor/model'
import type { DocumentModel, FontKey } from '../../lib/editor/types'
import type { EthiopicSupport } from '../../lib/editor/fonts'
import { pngUrl } from '../../test/images'
import { FormatPanel, type FormatPanelCallbacks } from './FormatPanel'

const spies: Record<string | symbol, unknown> = {}
const callbacks = new Proxy(spies, { get: (target, key) => (target[key] ??= vi.fn()) }) as unknown as FormatPanelCallbacks
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const wrap = (children: ReactNode) => (
  <QueryClientProvider client={client}>
    <I18nProvider>
      <ToastProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </ToastProvider>
    </I18nProvider>
  </QueryClientProvider>
)
const support = { sans: 'yes', serif: 'yes', mono: 'yes', abyssinica: 'yes', washra: 'yes' } as Record<FontKey, EthiopicSupport>

function panel(src: string, widthPct: number) {
  const image = { ...createImage(src, 'Shop logo'), widthPct }
  const model: DocumentModel = { ...createEmptyDocument('en'), blocks: [image] }
  return wrap(<FormatPanel model={model} activeBlock={image} ethiopicSupport={support} imageError={null} callbacks={callbacks} />)
}

describe('The print-quality hint beside an image', () => {
  it('warns when the picture is too small for its width, and says how wide it can be', () => {
    // A4, 20 mm margins: 400 px across 85 mm is 120 dpi, sharp up to 67 mm.
    render(panel(pngUrl(400, 150), 50))
    const hint = screen.getByTestId('image-quality')
    expect(hint).toHaveTextContent('about 120 dpi and may look blurry')
    expect(hint).toHaveTextContent('sharp up to about 67 mm; now 85 mm')
    expect(hint).toHaveClass('editor-panel__status--warning')
  })

  it('follows the width: narrower, the same picture prints sharp', () => {
    const { rerender } = render(panel(pngUrl(400, 150), 50))
    expect(screen.getByTestId('image-quality')).toHaveClass('editor-panel__status--warning')
    rerender(panel(pngUrl(400, 150), 30))
    expect(screen.getByTestId('image-quality')).toHaveTextContent('Prints sharp at this size (about 199 dpi).')
    expect(screen.getByTestId('image-quality')).not.toHaveClass('editor-panel__status--warning')
  })

  it('says nothing for a picture whose size cannot be read', () => {
    render(panel('data:image/gif;base64,R0lGODlhAQABAAAAACw=', 50))
    expect(screen.queryByTestId('image-quality')).toBeNull()
  })
})
