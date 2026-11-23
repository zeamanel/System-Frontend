import './pages.css'
import '../components/data/data.css'

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useCollections, useDataRequests, useDataSpace, useRecords, useRevokeDataRequest } from '../hooks/use-data'
import { catalogField } from '../lib/data/catalog'
import { exportRecords } from '../lib/data/client'
import type { RecordSummary } from '../lib/data/types'
import { FolderIcon } from '../components/icons'
import { RecordDialog } from '../components/data/RecordDialog'
import { ImportRecordsDialog } from '../components/data/ImportRecordsDialog'
import { RequestDialog } from '../components/data/RequestDialog'
import { CollectionsDialog } from '../components/data/CollectionsDialog'
import { AccessDialog } from '../components/data/AccessDialog'
import { DataActivityDialog } from '../components/data/PrivacyTools'
import { collectionLabel, collectionText, fieldLabel, optionLabel } from '../lib/data/labels'
import { Badge, Button, EmptyState, PageHeader, PanelError, PanelLoading, SearchInput, useToast } from '../components/ui'

/**
 * The Organization Data Manager: the customers, employees, properties and
 * record types of its own the organization (or a person working alone) owns,
 * for filling documents.
 */
export default function DataPage() {
  const { t } = useI18n()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const space = useDataSpace()
  const defs = useCollections()
  const asked = params.get('c') ?? 'customer'
  const collection = defs.some((def) => def.key === asked) ? asked : 'customer'
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 250)
  const records = useRecords(collection, debounced)
  const [editing, setEditing] = useState<{ id: string | null } | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [managing, setManaging] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const requests = useDataRequests()
  const revoke = useRevokeDataRequest()
  const visibleRequests = (requests.data ?? []).filter((item) => item.collection === collection && item.status !== 'revoked').slice(0, 20)
  const canSeeSensitive = space.data?.canSeeSensitive ?? false
  const canEdit = space.data?.canEdit ?? true
  const canAdminister = space.data?.canAdminister ?? false
  const askable = collection === 'customer' || collection === 'employee'
  const items = records.data?.items ?? []

  const choose = (next: string): void => {
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
      link.download = `${collectionLabel(t, collection)}.csv`
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
      .map(([key, value]) => (catalogField(collection, key)?.type === 'choice' ? optionLabel(t, collection, key, value) : value))
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
      {space.data && !canEdit ? (
        <p className="data-page__note" data-testid="data-view-only">
          {t('data.viewOnly')}
        </p>
      ) : null}

      <div className="category-pills" role="tablist" aria-label={t('data.tabsLabel')}>
        {defs.map(({ key: value }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={collection === value}
            className={['category-pill', collection === value ? 'category-pill--active' : null].filter(Boolean).join(' ')}
            onClick={() => choose(value)}
            data-testid={`data-tab-${value}`}
          >
            {collectionLabel(t, value)}
            {space.data ? <span className="data-page__count">{space.data.counts[value] ?? 0}</span> : null}
          </button>
        ))}
      </div>

      <div className="toolbar data-page__toolbar">
        <div className="toolbar__search">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={collectionText(t, collection, 'search')}
            ariaLabel={t('common.search')}
            clearLabel={t('search.clear')}
            loading={records.isFetching && Boolean(debounced)}
          />
        </div>
        <div className="data-page__actions">
          {canEdit ? (
            <>
              <Button variant="primary" onClick={() => setEditing({ id: null })} data-testid="data-add">
                {collectionText(t, collection, 'add')}
              </Button>
              <Button variant="secondary" onClick={() => setImporting(true)} data-testid="data-import">
                {t('data.importButton')}
              </Button>
            </>
          ) : null}
          {askable && canEdit ? (
            <Button variant="secondary" onClick={() => setRequesting(true)} data-testid="data-ask">
              {t('data.requestButton')}
            </Button>
          ) : null}
          <Button variant="ghost" loading={exporting} disabled={items.length === 0} onClick={() => void download()} data-testid="data-export">
            {t('data.exportButton')}
          </Button>
          {canAdminister ? (
            <Button variant="ghost" onClick={() => setManaging(true)} data-testid="data-manage">
              {t('data.manageButton')}
            </Button>
          ) : null}
          {canAdminister && space.data?.kind === 'organization' ? (
            <Button variant="ghost" onClick={() => setAccessOpen(true)} data-testid="data-access">
              {t('data.accessButton')}
            </Button>
          ) : null}
          {canAdminister ? (
            <Button variant="ghost" onClick={() => setActivityOpen(true)} data-testid="data-activity">
              {t('privacy.activityButtonAll')}
            </Button>
          ) : null}
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
            title={collectionText(t, collection, 'empty')}
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
                {record.consent === 'withdrawn' ? (
                  <Badge variant="warning" data-testid="data-consent-withdrawn">
                    {t('privacy.consentWithdrawnBadge')}
                  </Badge>
                ) : null}
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

      {visibleRequests.length > 0 ? (
        <section className="data-requests" aria-labelledby="data-requests-title" data-testid="data-requests">
          <h2 id="data-requests-title" className="data-requests__title">
            {t('data.requestsTitle')}
          </h2>
          <ul className="data-list">
            {visibleRequests.map((item) => (
              <li key={item.id} className="data-item data-requests__item">
                <span className="data-item__main data-item__main--static">
                  <span className="data-item__text">
                    <span className="data-item__name">{item.recipientName}</span>
                    <span className="data-item__meta">
                      {item.purpose} · {item.fields.map((key) => fieldLabel(t, item.collection, key)).join(', ')}
                    </span>
                  </span>
                </span>
                <span className="data-item__side">
                  <Badge variant={item.status === 'submitted' ? 'success' : item.status === 'open' ? 'info' : 'neutral'}>
                    {t(`data.requestStatus.${item.status}` as MessageKey)}
                  </Badge>
                  {item.status === 'submitted' && item.resultRecordId ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditing({ id: item.resultRecordId })}>
                      {t('data.requestOpen')}
                    </Button>
                  ) : null}
                  {item.status === 'open' && canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revoke.mutate(item.id)}
                      aria-label={t('data.requestRevokeNamed', { name: item.recipientName })}
                    >
                      {t('data.requestRevoke')}
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {requesting && (collection === 'customer' || collection === 'employee') ? (
        <RequestDialog open onClose={() => setRequesting(false)} collection={collection} canSeeSensitive={canSeeSensitive} />
      ) : null}

      <RecordDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        collection={collection}
        recordId={editing?.id ?? null}
        canSeeSensitive={canSeeSensitive}
        canEdit={canEdit}
        canAdminister={canAdminister}
      />
      <ImportRecordsDialog open={importing} onClose={() => setImporting(false)} collection={collection} canSeeSensitive={canSeeSensitive} />
      {managing ? <CollectionsDialog open onClose={() => setManaging(false)} initial={collection} onCreated={choose} /> : null}
      {accessOpen ? <AccessDialog open onClose={() => setAccessOpen(false)} /> : null}
      {activityOpen ? <DataActivityDialog open onClose={() => setActivityOpen(false)} /> : null}
    </div>
  )
}
