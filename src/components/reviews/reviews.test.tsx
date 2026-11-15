import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { PreferencesProvider } from '../../preferences'
import { ToastProvider } from '../ui'
import { createReview, getPublicReview, ReviewUnavailableError, revokeReview } from '../../lib/reviews/client'
import ReviewPage from '../../pages/ReviewPage'
import { SendForReviewDialog } from './SendForReviewDialog'

function wrap(node: React.ReactNode, path = '/') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PreferencesProvider>
      <I18nProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/review/:token" element={<ReviewPage />} />
              <Route path="*" element={node} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </I18nProvider>
      </PreferencesProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('Send for review', () => {
  it('saves first, makes a link for the named reviewer, and lists it', async () => {
    const beforeCreate = vi.fn().mockResolvedValue(true)
    wrap(<SendForReviewDialog open onClose={vi.fn()} documentId="doc-fixture-1" beforeCreate={beforeCreate} />)

    expect(await screen.findByText('No links yet.')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('review-reviewer-name'), { target: { value: 'Dawit Haile (tenant)' } })
    fireEvent.click(screen.getByTestId('review-create'))

    const url = await screen.findByTestId('review-link-url')
    expect(beforeCreate).toHaveBeenCalled()
    expect((url as HTMLInputElement).value).toMatch(/\/review\/[A-Za-z0-9_-]{32}$/)
    const item = await screen.findByTestId('review-item')
    expect(within(item).getByText('Dawit Haile (tenant)')).toBeInTheDocument()
    expect(within(item).getByText('Waiting')).toBeInTheDocument()
    expect(within(item).getByText(/not opened yet/)).toBeInTheDocument()
  })

  it('makes no link when the latest changes could not be saved', async () => {
    wrap(<SendForReviewDialog open onClose={vi.fn()} documentId="doc-fixture-1" beforeCreate={() => Promise.resolve(false)} />)
    fireEvent.change(await screen.findByTestId('review-reviewer-name'), { target: { value: 'Buyer' } })
    fireEvent.click(screen.getByTestId('review-create'))
    expect(await screen.findByText(/could not be saved, so no link was made/)).toBeInTheDocument()
    expect(screen.queryByTestId('review-link')).toBeNull()
  })

  it('revokes a link after a confirmation', async () => {
    const created = await createReview('doc-fixture-1', { reviewerName: 'Buyer', expiresInDays: 7 })
    wrap(<SendForReviewDialog open onClose={vi.fn()} documentId="doc-fixture-1" beforeCreate={() => Promise.resolve(true)} />)
    fireEvent.click(await screen.findByTestId('review-revoke'))
    fireEvent.click(screen.getByTestId('review-revoke-confirm'))
    expect(await screen.findByText('Revoked')).toBeInTheDocument()
    await expect(getPublicReview(created.token)).rejects.toBeInstanceOf(ReviewUnavailableError)
  })
})

describe('The review page', () => {
  it('shows the copy that was sent; the reviewer comments and approves once', async () => {
    const { token } = await createReview('doc-fixture-1', { reviewerName: 'Dawit Haile', expiresInDays: 14 })
    wrap(null, `/review/${token}`)

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Rental agreement')
    expect(screen.getByText(/sent you this document to review/)).toBeInTheDocument()
    // The name defaults to who it was sent to.
    expect(screen.getByTestId('review-name')).toHaveValue('Dawit Haile')

    fireEvent.change(screen.getByTestId('review-comment'), { target: { value: 'Please add the plate number.' } })
    fireEvent.click(screen.getByTestId('review-comment-send'))
    expect(await screen.findByText('Please add the plate number.')).toBeInTheDocument()

    // Asking for changes needs a note.
    fireEvent.click(screen.getByTestId('review-request-changes'))
    expect(screen.getByTestId('review-decision-send')).toBeDisabled()
    fireEvent.change(screen.getByTestId('review-note'), { target: { value: 'The rent is 30,000.' } })
    fireEvent.click(screen.getByTestId('review-decision-send'))

    expect(await screen.findByTestId('review-outcome')).toHaveTextContent('Dawit Haile asked for changes:The rent is 30,000.')
    // Finished: no more answers or comments.
    expect(screen.queryByTestId('review-approve')).toBeNull()
    expect(screen.queryByTestId('review-comment')).toBeNull()
    expect(window.localStorage.getItem('seneddesk.reviewerName')).toBe('Dawit Haile')
  })

  it('says when a link no longer works', async () => {
    const { id, token } = await createReview('doc-fixture-1', { reviewerName: 'X', expiresInDays: 14 })
    await revokeReview('doc-fixture-1', id)
    wrap(null, `/review/${token}`)
    expect(await screen.findByText('This link does not work')).toBeInTheDocument()
  })

  it('says when a link has expired', async () => {
    const { token } = await createReview('doc-fixture-1', { reviewerName: 'X', expiresInDays: 1 })
    const stored = JSON.parse(window.localStorage.getItem('docuA4.fixture.reviews') ?? '[]') as Array<{ expiresAt: string }>
    stored[0].expiresAt = new Date(Date.now() - 1000).toISOString()
    window.localStorage.setItem('docuA4.fixture.reviews', JSON.stringify(stored))
    wrap(null, `/review/${token}`)
    await waitFor(() => expect(screen.getByText('This link has expired')).toBeInTheDocument())
  })
})
