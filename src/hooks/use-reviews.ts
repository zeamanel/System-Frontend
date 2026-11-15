import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addReviewComment,
  createReview,
  decideReview,
  getPublicReview,
  listReviews,
  ReviewUnavailableError,
  revokeReview,
} from '../lib/reviews/client'
import type { PublicReview, ReviewDecision } from '../lib/reviews/types'
import { queryKeys } from '../lib/query-keys'

/** The review links of one document (its owner). */
export function useDocumentReviews(documentId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reviews.forDocument(documentId),
    queryFn: ({ signal }) => listReviews(documentId, signal),
    enabled: Boolean(documentId) && enabled,
    // Answers come in while the dialog is open.
    refetchInterval: enabled ? 30_000 : false,
  })
}

export function useCreateReview(documentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { reviewerName: string; expiresInDays: number }) => createReview(documentId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forDocument(documentId) }),
  })
}

export function useRevokeReview(documentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reviewId: string) => revokeReview(documentId, reviewId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forDocument(documentId) }),
  })
}

/** The review page (the other party, no account). */
export function usePublicReview(token: string) {
  return useQuery({
    queryKey: queryKeys.reviews.public(token),
    queryFn: ({ signal }) => getPublicReview(token, signal),
    enabled: Boolean(token),
    retry: (failures, error) => !(error instanceof ReviewUnavailableError) && failures < 2,
  })
}

export function useAddReviewComment(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; body: string }) => addReviewComment(token, input),
    onSuccess: (comment) =>
      queryClient.setQueryData<PublicReview>(queryKeys.reviews.public(token), (current) =>
        current ? { ...current, comments: [...current.comments, comment] } : current,
      ),
  })
}

export function useDecideReview(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ReviewDecision) => decideReview(token, input),
    onSuccess: (decision) =>
      queryClient.setQueryData<PublicReview>(queryKeys.reviews.public(token), (current) =>
        current ? { ...current, ...decision } : current,
      ),
  })
}
