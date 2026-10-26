import './pages.css'

import { Suspense, lazy, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useDocument, useDuplicateDocument } from '../hooks/use-documents'
import { useTemplateDetail } from '../hooks/use-templates'
import { Button, EmptyState, LoadingState, PanelError, useToast } from '../components/ui'
import { SharedDocumentView } from '../components/editor/SharedDocumentView'
import { EditorWorkspace, type NewCustomerDocumentInput } from '../components/editor/EditorWorkspace'
import { useStartTemplateDocument } from '../hooks/use-start-template-document'
import { documentKindOf } from '../lib/editor/document-kind'

const DesignWorkspace = lazy(() => import('../designs/DesignWorkspace'))

/**
 * Document editor route: loads the document (and its template schema for the
 * guided fields panel) and renders the A4 editing workspace. Design documents
 * open in the design editor instead, never in the text editor.
 */
export default function EditorPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { documentId } = useParams<'documentId'>()

  const docQuery = useDocument(documentId)
  const doc = docQuery.data ?? null
  const templateQuery = useTemplateDetail(doc?.templateId ?? '')

  const refresh = useCallback(async () => {
    const result = await docQuery.refetch()
    return result.data ?? null
  }, [docQuery])

  const toast = useToast()
  const duplicate = useDuplicateDocument()
  const makeCopy = useCallback(async (): Promise<void> => {
    if (!documentId) return
    try {
      const copy = await duplicate.mutateAsync(documentId)
      navigate(`/documents/${encodeURIComponent(copy.id)}`)
    } catch {
      toast.push(t('shared.copyFailed'), { variant: 'error' })
    }
  }, [documentId, duplicate, navigate, toast, t])

  const { startTemplateDocument } = useStartTemplateDocument()
  const handleNewCustomer = useCallback(
    async (input: NewCustomerDocumentInput): Promise<void> => {
      await startTemplateDocument(
        { id: input.templateId, title: input.title, documentTypeId: input.documentTypeId },
        input.language,
      )
    },
    [startTemplateDocument],
  )

  if (docQuery.isPending) {
    return <LoadingState full label={t('common.loading')} />
  }

  if (docQuery.isError) {
    return (
      <div className="page">
        <PanelError onRetry={() => void docQuery.refetch()} />
      </div>
    )
  }

  if (documentId && !doc) {
    return (
      <div className="page">
        <EmptyState
          title={t('editor.documentNotFound')}
          description={t('editor.documentNotFoundDesc')}
          action={
            <Button variant="secondary" onClick={() => navigate('/documents')}>
              {t('editor.back')}
            </Button>
          }
        />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="page">
        <EmptyState
          title={t('editor.untitled')}
          description={t('editor.placeholder')}
          action={
            <Button variant="secondary" onClick={() => navigate('/documents')}>
              {t('editor.back')}
            </Button>
          }
        />
      </div>
    )
  }

  // A colleague's shared document opens read only: it can be printed and copied, never saved.
  const readOnly = doc.access === 'view' ? { onCopy: () => void makeCopy(), copying: duplicate.isPending } : undefined

  // A design never reaches the text editor (its loader would rewrite it):
  // it opens in the design editor, loaded only for designs.
  if (documentKindOf(doc) === 'design') {
    return (
      <Suspense fallback={<LoadingState full label={t('common.loading')} />}>
        <DesignWorkspace key={doc.id} document={doc} onBack={() => navigate('/documents')} readOnly={readOnly} />
      </Suspense>
    )
  }

  if (readOnly) {
    return (
      <SharedDocumentView
        key={doc.id}
        document={doc}
        onBack={() => navigate('/documents')}
        onCopy={readOnly.onCopy}
        copying={readOnly.copying}
      />
    )
  }

  return (
    <EditorWorkspace
      // Remount per document so editor state can never carry over from the
      // previous document (e.g. after "New customer").
      key={doc.id}
      document={doc}
      template={templateQuery.data ?? null}
      onBack={() => navigate('/documents')}
      refresh={refresh}
      onNewCustomer={handleNewCustomer}
    />
  )
}

