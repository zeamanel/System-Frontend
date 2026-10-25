import './pages.css'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useDeleteDocument, useDocumentsList, useDuplicateDocument } from '../hooks/use-documents'
import { DocumentListItem } from '../components/documents/DocumentListItem'
import { OpenLocalFileButton } from '../components/documents/OpenLocalFileButton'
import { TelegramBridgeButton } from '../components/documents/TelegramBridgeButton'
import { DocumentIcon } from '../components/icons'
import {
  Button,
  EmptyState,
  PageHeader,
  PanelError,
  PanelLoading,
  SearchInput,
} from '../components/ui'

export default function DocumentsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)

  const documents = useDocumentsList(debouncedSearch.trim() || undefined)
  const duplicateMutation = useDuplicateDocument()
  const deleteMutation = useDeleteDocument()
  const items = documents.data ?? []

  const handleDuplicate = async (id: string) => {
    try {
      const copy = await duplicateMutation.mutateAsync(id)
      if (copy?.id) {
        navigate(`/documents/${encodeURIComponent(copy.id)}`)
      }
    } catch {
      // Ignored
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm(t('documents.confirmDelete') || 'Delete this document?')) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch {
        // Ignored
      }
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={t('documents.title')}
        actions={
          <>
            <OpenLocalFileButton />
            <TelegramBridgeButton />
          </>
        }
      />

      <div className="toolbar">
        <div className="toolbar__search">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('documents.searchPlaceholder')}
            ariaLabel={t('common.search')}
            clearLabel={t('search.clear')}
            loading={documents.isFetching}
          />
        </div>
      </div>

      {documents.isPending ? (
        <PanelLoading />
      ) : documents.isError ? (
        <PanelError onRetry={() => void documents.refetch()} />
      ) : items.length === 0 ? (
        search.trim() ? (
          <EmptyState
            title={t('search.empty.title', { query: debouncedSearch.trim() })}
            description={t('search.empty.body')}
            action={
              <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                {t('search.clear')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<DocumentIcon size={22} />}
            title={t('empty.documents.title')}
            description={t('empty.documents.body')}
            action={
              <Button variant="primary" onClick={() => navigate('/')}>
                {t('empty.documents.action')}
              </Button>
            }
          />
        )
      ) : (
        <ul className="document-list document-list--panel">
          {items.map((document) => (
            <li key={document.id}>
              <DocumentListItem
                document={document}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
