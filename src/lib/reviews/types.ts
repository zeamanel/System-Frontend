/** Review links (backend docs/API.md §8b). */

export type ReviewStatus = 'open' | 'approved' | 'changes_requested'

export interface ReviewComment {
  id: string
  authorName: string
  body: string
  createdAt: string
}

/** One link, as its owner sees it. */
export interface DocumentReview {
  id: string
  reviewerName: string
  version: number
  status: ReviewStatus
  decidedByName: string | null
  decisionNote: string | null
  decidedAt: string | null
  lastViewedAt: string | null
  expiresAt: string
  revokedAt: string | null
  createdAt: string
  comments: ReviewComment[]
}

/** A new link: its token is shown once. */
export interface CreatedReview extends DocumentReview {
  token: string
}

/** What the other party sees. */
export interface PublicReview {
  title: string
  language: string
  content: string | null
  senderName: string
  reviewerName: string
  status: ReviewStatus
  decidedByName: string | null
  decisionNote: string | null
  decidedAt: string | null
  expiresAt: string
  comments: ReviewComment[]
}

export interface ReviewDecision {
  name: string
  decision: 'approve' | 'request_changes'
  note?: string
}
