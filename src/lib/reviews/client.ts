import { env } from '../../config/env'
import { ApiError, apiClient } from '../api'
import { getRepositories } from '../repositories'
import type { CreatedReview, DocumentReview, PublicReview, ReviewComment, ReviewDecision, ReviewStatus } from './types'

/**
 * Review links over /documents/:id/reviews (the owner) and /reviews/:token
 * (the other party, no account). Demo mode keeps them in this browser's
 * storage, so the whole flow can be tried in one browser.
 */

const isHttp = (): boolean => env.dataSource === 'http'

/** The page the other party opens. */
export function reviewUrl(token: string): string {
  return `${globalThis.location?.origin ?? ''}/review/${encodeURIComponent(token)}`
}

/** Why a link cannot be opened. */
export class ReviewUnavailableError extends Error {
  readonly reason: 'not-found' | 'expired'
  constructor(reason: 'not-found' | 'expired') {
    super(`Review link ${reason}`)
    this.name = 'ReviewUnavailableError'
    this.reason = reason
  }
}

// ── Demo store ───────────────────────────────────────────────────────────
const DEMO_KEY = 'docuA4.fixture.reviews'
interface DemoReview extends DocumentReview {
  token: string
  documentId: string
  title: string
  language: string
  content: string | null
}

function readDemo(): DemoReview[] {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(DEMO_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? (parsed as DemoReview[]) : []
  } catch {
    return []
  }
}

function writeDemo(list: DemoReview[]): void {
  try {
    globalThis.localStorage?.setItem(DEMO_KEY, JSON.stringify(list))
  } catch {
    // Storage full or unavailable: the demo link is simply not kept.
  }
}

const strip = ({ token: _token, documentId: _documentId, title: _title, language: _language, content: _content, ...review }: DemoReview): DocumentReview => review

function demoToken(): string {
  const bytes = new Uint8Array(24)
  globalThis.crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function liveDemo(token: string): DemoReview {
  const review = readDemo().find((r) => r.token === token)
  if (!review || review.revokedAt) throw new ReviewUnavailableError('not-found')
  if (new Date(review.expiresAt).getTime() <= Date.now()) throw new ReviewUnavailableError('expired')
  return review
}

function updateDemo(token: string, change: (review: DemoReview) => DemoReview): DemoReview {
  let updated: DemoReview | null = null
  writeDemo(readDemo().map((r) => (r.token === token ? (updated = change(r)) : r)))
  if (!updated) throw new ReviewUnavailableError('not-found')
  return updated
}

// ── Owner ────────────────────────────────────────────────────────────────
export async function createReview(documentId: string, input: { reviewerName: string; expiresInDays: number }): Promise<CreatedReview> {
  if (isHttp()) {
    return apiClient.post<CreatedReview>(`/documents/${encodeURIComponent(documentId)}/reviews`, input, { auth: 'required' })
  }
  const doc = await getRepositories().documents.get(documentId)
  if (!doc) throw new ApiError(404, 'Document not found')
  const now = new Date()
  const review: DemoReview = {
    id: `demo-review-${now.getTime()}`,
    token: demoToken(),
    documentId,
    title: doc.title,
    language: doc.language,
    content: doc.content ?? null,
    reviewerName: input.reviewerName.trim(),
    version: doc.version ?? 1,
    status: 'open',
    decidedByName: null,
    decisionNote: null,
    decidedAt: null,
    lastViewedAt: null,
    expiresAt: new Date(now.getTime() + input.expiresInDays * 86_400_000).toISOString(),
    revokedAt: null,
    createdAt: now.toISOString(),
    comments: [],
  }
  writeDemo([review, ...readDemo()])
  return { ...strip(review), token: review.token }
}

export async function listReviews(documentId: string, signal?: AbortSignal): Promise<DocumentReview[]> {
  if (isHttp()) {
    return apiClient.get<DocumentReview[]>(`/documents/${encodeURIComponent(documentId)}/reviews`, { signal, auth: 'required' })
  }
  return readDemo()
    .filter((r) => r.documentId === documentId)
    .map(strip)
}

export async function revokeReview(documentId: string, reviewId: string): Promise<void> {
  if (isHttp()) {
    await apiClient.delete<void>(`/documents/${encodeURIComponent(documentId)}/reviews/${encodeURIComponent(reviewId)}`, { auth: 'required' })
    return
  }
  writeDemo(readDemo().map((r) => (r.id === reviewId && r.documentId === documentId ? { ...r, revokedAt: new Date().toISOString() } : r)))
}

// ── The other party ──────────────────────────────────────────────────────
async function publicCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw new ReviewUnavailableError('not-found')
    if (error instanceof ApiError && error.status === 410) throw new ReviewUnavailableError('expired')
    throw error
  }
}

export async function getPublicReview(token: string, signal?: AbortSignal): Promise<PublicReview> {
  if (isHttp()) return publicCall(() => apiClient.get<PublicReview>(`/reviews/${encodeURIComponent(token)}`, { signal }))
  const review = updateDemo(liveDemo(token).token, (r) => ({ ...r, lastViewedAt: new Date().toISOString() }))
  return {
    title: review.title,
    language: review.language,
    content: review.content,
    senderName: 'Demo sender',
    reviewerName: review.reviewerName,
    status: review.status,
    decidedByName: review.decidedByName,
    decisionNote: review.decisionNote,
    decidedAt: review.decidedAt,
    expiresAt: review.expiresAt,
    comments: review.comments,
  }
}

export async function addReviewComment(token: string, input: { name: string; body: string }): Promise<ReviewComment> {
  if (isHttp()) return publicCall(() => apiClient.post<ReviewComment>(`/reviews/${encodeURIComponent(token)}/comments`, input))
  if (liveDemo(token).status !== 'open') throw new ApiError(409, 'This review is finished')
  const comment: ReviewComment = {
    id: `demo-comment-${Date.now()}`,
    authorName: input.name.trim(),
    body: input.body.trim(),
    createdAt: new Date().toISOString(),
  }
  updateDemo(token, (r) => ({ ...r, comments: [...r.comments, comment] }))
  return comment
}

export async function decideReview(
  token: string,
  input: ReviewDecision,
): Promise<{ status: ReviewStatus; decidedByName: string | null; decisionNote: string | null; decidedAt: string | null }> {
  if (isHttp()) return publicCall(() => apiClient.post(`/reviews/${encodeURIComponent(token)}/decision`, input))
  if (liveDemo(token).status !== 'open') throw new ApiError(409, 'This review is already finished')
  const status: ReviewStatus = input.decision === 'approve' ? 'approved' : 'changes_requested'
  const decided = updateDemo(token, (r) => ({
    ...r,
    status,
    decidedByName: input.name.trim(),
    decisionNote: input.note?.trim() || null,
    decidedAt: new Date().toISOString(),
  }))
  return { status, decidedByName: decided.decidedByName, decisionNote: decided.decisionNote, decidedAt: decided.decidedAt }
}
