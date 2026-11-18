import './pages.css'
import '../components/data/data.css'

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useDataSpace, useRecords } from '../hooks/use-data'
import { DATA_COLLECTIONS, catalogField, isDataCollection, type DataCollection } from '../lib/data/catalog'
import { exportRecords } from '../lib/data/client'
import type { RecordSummary } from '../lib/data/types'
import { FolderIcon } from '../components/icons'
import { RecordDialog } from '../components/data/RecordDialog'
import { ImportRecordsDialog } from '../components/data/ImportRecordsDialog'
import { Badge, Button, EmptyState, PageHeader, PanelError, PanelLoading, SearchInput, useToast } from '../components/ui'

/**
 * The Organization Data Manager: the customers, employees and properties the
 * organization (or a person working alone) owns, for filling documents.
 */
export default function DataPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const collection: DataCollection = isDataCollection(params.get('c')) ? (params.get('c') as DataCollection) : 'customer'
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 250)
  const space = useDataSpace()
  const records = useRecords(collection, debounced)
  const [editing, setEditing] = useState<{ id: string | null } | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const canSeeSensitive = space.data?.canSeeSensitive ?? false
  const items = records.data?.items ?? []

  const choose = (next: DataCollection): void => {
    setSearch('')
    setParams(next === 'customer' ? {} : { c: next }, { replace: true })
  }

  const download = async (): Promise<void> => {
    setExporting(true)
    try {
      const blob = await exportRecords(collection)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${t(`data.tab.${collection}` as MessageKey)}.csv`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      toast.push(t('data.exportFailed'), { variant: 'error' })
    } finally {
      setExporting(false)
    }
  }

  const summaryText = (record: RecordSummary): string =>
    Object.entries(record.summary)
      .map(([key, value]) => (catalogField(collection, key)?.type === 'choice' ? t(`data.option.${value}` as MessageKey) : value))
      .join(' · ')

  const personal = space.data?.kind === 'personal'

  return (
    <div className="page">
      <PageHeader
        title={t(personal ? 'data.titlePersonal' : 'data.titleOrganization')}
        description={t(personal ? 'data.hintPersonal' : 'data.hintOrganization')}
      />
      {space.data && !canSeeSensitive ? (
        <p className="data-page__note" data-testid="data-sensitive-note">
          {t('data.memberNote')}
        </p>
      ) : null}

      <div className="category-pills" role="tablist" aria-label={t('data.tabsLabel')}>
        {DATA_COLLECTIONS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={collection === value}
            className={['category-pill', collection === value ? 'category-pill--active' : null].filter(Boolean).join(' ')}
            onClick={() => choose(value)}
            data-testid={`data-tab-${value}`}
          >
            {t(`data.tab.${value}` as MessageKey)}
            {space.data ? <span className="data-page__count">{space.data.counts[value]}</span> : null}
          </button>
        ))}
      </div>

      <div className="toolbar data-page__toolbar">
        <div className="toolbar__search">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t(`data.search.${collection}` as MessageKey)}
            ariaLabel={t('common.search')}
            clearLabel={t('search.clear')}
            loading={records.isFetching && Boolean(debounced)}
          />
        </div>
        <div className="data-page__actions">
          <Button variant="primary" onClick={() => setEditing({ id: null })} data-testid="data-add">
            {t(`data.add.${collection}` as MessageKey)}
          </Button>
          <Button variant="secondary" onClick={() => setImporting(true)} data-testid="data-import">
            {t('data.importButton')}
          </Button>
          <Button variant="ghost" loading={exporting} disabled={items.length === 0} onClick={() => void download()} data-testid="data-export">
            {t('data.exportButton')}
          </Button>
        </div>
      </div>

      {records.isPending ? (
        <PanelLoading />
      ) : records.isError ? (
        <PanelError onRetry={() => void records.refetch()} />
      ) : items.length === 0 ? (
        debounced.trim() ? (
          <EmptyState
            title={t('customers.noMatch', { query: debounced.trim() })}
            action={
              <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                {t('search.clear')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<FolderIcon size={22} />}
            title={t(`data.empty.${collection}` as MessageKey)}
            description={t('data.emptyHint')}
          />
        )
      ) : (
        <ul className="data-list" data-testid="data-list">
          {items.map((record) => (
            <li key={record.id} className="data-item">
              <button type="button" className="data-item__main" onClick={() => setEditing({ id: record.id })} data-testid="data-row">
                <span className="data-item__icon" aria-hidden="true">
                  {record.displayName.trim().charAt(0).toUpperCase()}
                </span>
                <span className="data-item__text">
                  <span className="data-item__name">{record.displayName}</span>
                  {summaryText(record) ? <span className="data-item__meta">{summaryText(record)}</span> : null}
                </span>
              </button>
              <span className="data-item__side">
                {record.useCount > 0 ? <Badge variant="neutral">{t('data.used', { count: String(record.useCount) })}</Badge> : null}
                {collection === 'customer' ? (
                  <Link className="data-item__link" to={`/customers/${encodeURIComponent(record.id)}`}>
                    {t('data.documents')}
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      <RecordDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        collection={collection}
        recordId={editing?.id ?? null}
        canSeeSensitive={canSeeSensitive}
      />
      <ImportRecordsDialog open={importing} onClose={() => setImporting(false)} collection={collection} canSeeSensitive={canSeeSensitive} />
    </div>
  )
}
