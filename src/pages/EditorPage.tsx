import './pages.css'

import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useDocument } from '../hooks/use-documents'
import { useTemplateDetail } from '../hooks/use-templates'
import { Button, EmptyState, LoadingState, PanelError } from '../components/ui'
import { EditorWorkspace } from '../components/editor/EditorWorkspace'

/**
 * Document editor route: loads the document (and its template schema for the
 * guided fields panel) and renders the A4 editing workspace.
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

  return (
    <EditorWorkspace
      document={doc}
      template={templateQuery.data ?? null}
      onBack={() => navigate('/documents')}
      refresh={refresh}
    />
  )
}

