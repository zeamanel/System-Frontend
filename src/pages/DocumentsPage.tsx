import './pages.css'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import {
  useDeleteDocument,
  useDocumentsList,
  useDuplicateDocument,
  useMyTemplates,
  useSetDocumentSharing,
  useSharedDocuments,
} from '../hooks/use-documents'
import { useOrganization } from '../hooks/use-organization'
import type { DocumentRecord } from '../lib/repositories'
import { DocumentListItem } from '../components/documents/DocumentListItem'
import { OpenLocalFileButton } from '../components/documents/OpenLocalFileButton'
import { TelegramBridgeButton } from '../components/documents/TelegramBridgeButton'
import { CopyIcon, DocumentIcon, UsersIcon } from '../components/icons'
import {
  Button,
  EmptyState,
  PageHeader,
  PanelError,
  PanelLoading,
  SearchInput,
  useToast,
} from '../components/ui'

type Tab = 'mine' | 'templates' | 'shared'

export default function DocumentsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)

  const toast = useToast()
  // Sharing needs an organization: without one there is nothing to share with.
  const hasOrganization = Boolean(useOrganization().data)
  const [tab, setTab] = useState<Tab>('mine')
  const showShared = hasOrganization && tab === 'shared'
  const showTemplates = tab === 'templates'

  const mine = useDocumentsList(debouncedSearch.trim() || undefined)
  const shared = useSharedDocuments(debouncedSearch.trim() || undefined, showShared)
  const templates = useMyTemplates(showTemplates)
  const documents = showTemplates ? templates : showShared ? shared : mine
  const duplicateMutation = useDuplicateDocument()
  const deleteMutation = useDeleteDocument()
  const sharingMutation = useSetDocumentSharing()
  const needle = debouncedSearch.trim().toLowerCase()
  // Templates are few: the search filters them here.
  const items = (documents.data ?? []).filter((document) => !showTemplates || !needle || document.title.toLowerCase().includes(needle))
  const tabs: Tab[] = hasOrganization ? ['mine', 'templates', 'shared'] : ['mine', 'templates']

  const handleToggleShare = async (document: DocumentRecord) => {
    try {
      const updated = await sharingMutation.mutateAsync({ id: document.id, shared: !document.shared })
      toast.push(t(updated.shared ? 'documents.sharedToast' : 'documents.unsharedToast'), { variant: 'success' })
    } catch {
      toast.push(t('documents.shareFailed'), { variant: 'error' })
    }
  }

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

      {tabs.length > 1 ? (
        <div className="category-pills" role="tablist" aria-label={t('documents.tabsLabel')}>
          {tabs.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={['category-pill', tab === value ? 'category-pill--active' : null].filter(Boolean).join(' ')}
              onClick={() => setTab(value)}
              data-testid={`documents-tab-${value}`}
            >
              {t(value === 'mine' ? 'documents.tabs.mine' : value === 'templates' ? 'documents.tabs.templates' : 'documents.tabs.shared')}
            </button>
          ))}
        </div>
      ) : null}

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
        ) : showTemplates ? (
          <EmptyState
            icon={<CopyIcon size={22} />}
            title={t('documents.templatesEmptyTitle')}
            description={t('documents.templatesEmptyBody')}
          />
        ) : showShared ? (
          <EmptyState
            icon={<UsersIcon size={22} />}
            title={t('documents.sharedEmptyTitle')}
            description={t('documents.sharedEmptyBody')}
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
                // A template is used, not copied: "Use" starts a new document from it.
                onDuplicate={showTemplates ? undefined : handleDuplicate}
                onUse={showTemplates ? handleDuplicate : undefined}
                onDelete={handleDelete}
                onToggleShare={hasOrganization ? handleToggleShare : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
