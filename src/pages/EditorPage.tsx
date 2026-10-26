import './pages.css'

import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useDocument } from '../hooks/use-documents'
import { useTemplateDetail } from '../hooks/use-templates'
import { Button, EmptyState, LoadingState, PanelError } from '../components/ui'
import { EditorWorkspace, type NewCustomerDocumentInput } from '../components/editor/EditorWorkspace'
import { useStartTemplateDocument } from '../hooks/use-start-template-document'
import { documentKindOf } from '../lib/editor/document-kind'

/**
 * Document editor route: loads the document (and its template schema for the
 * guided fields panel) and renders the A4 editing workspace. Design documents
 * never open here: they get their own editor.
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

  // A design must never reach the text editor (its loader would rewrite it).
  if (documentKindOf(doc) === 'design') {
    return (
      <div className="page">
        <EmptyState
          title={t('editor.designDocumentTitle')}
          description={t('editor.designDocumentDesc')}
          action={
            <Button variant="secondary" onClick={() => navigate('/documents')}>
              {t('editor.back')}
            </Button>
          }
        />
      </div>
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

