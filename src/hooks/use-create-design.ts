import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../i18n'
import { generateKey } from '../lib/api/idempotency'
import { queryKeys } from '../lib/query-keys'
import { DESIGN_CATALOG } from '../designs/catalog'
import { useToast } from '../components/ui'

/** Starts a new design document and opens it. */
export function useCreateDesign() {
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const start = useCallback(
    async (designId: string): Promise<void> => {
      const entry = DESIGN_CATALOG.find((design) => design.id === designId)
      if (!entry || pendingId) return
      setPendingId(designId)
      try {
        // The design code loads here, not with the menus.
        const { createDesignDocument } = await import('../designs/create')
        const doc = await createDesignDocument({ designId, title: t(entry.titleKey), idempotencyKey: generateKey() })
        void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
        navigate(`/documents/${doc.id}`)
      } catch {
        toast.push(t('designs.createFailed'), { variant: 'error' })
      } finally {
        setPendingId(null)
      }
    },
    [navigate, pendingId, queryClient, t, toast],
  )

  return { start, pendingId }
}
