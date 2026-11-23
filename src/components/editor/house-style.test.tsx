import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { I18nProvider } from '../../i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../ui'
import { createEmptyDocument } from '../../lib/editor/model'
import type { FontKey } from '../../lib/editor/types'
import type { EthiopicSupport } from '../../lib/editor/fonts'
import { FormatPanel, type FormatPanelCallbacks } from './FormatPanel'
import { StylePickerDialog } from './StylePickerDialog'

/** Every callback is a no-op spy. */
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

describe('A locked house look in the editor', () => {
  it('shows why, and the font and text size cannot be changed', () => {
    const { rerender } = render(
      wrap(<FormatPanel model={createEmptyDocument('en')} activeBlock={null} ethiopicSupport={support} imageError={null} callbacks={callbacks} lookLocked />),
    )
    expect(screen.getByTestId('format-look-locked')).toHaveTextContent('Your organization sets the look of documents')
    expect(document.getElementById('format-font') as HTMLSelectElement).toBeDisabled()
    expect(document.getElementById('format-font-size') as HTMLInputElement).toBeDisabled()

    rerender(
      wrap(<FormatPanel model={createEmptyDocument('en')} activeBlock={null} ethiopicSupport={support} imageError={null} callbacks={callbacks} />),
    )
    expect(screen.queryByTestId('format-look-locked')).toBeNull()
    expect(document.getElementById('format-font') as HTMLSelectElement).toBeEnabled()
  })

  it('shows the styles without letting a member choose one', () => {
    const onChoose = vi.fn()
    render(
      wrap(<StylePickerDialog open onClose={vi.fn()} current="legal-frame" suggested={[]} letterheadIncomplete={false} onChoose={onChoose} locked />),
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByTestId('style-locked')).toBeInTheDocument()
    expect(within(dialog).getByTestId('style-option-formal-border')).toBeDisabled()
  })
})
