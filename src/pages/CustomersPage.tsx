import './pages.css'
import './CustomersPage.css'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useCustomerDirectory } from '../hooks/use-customers'
import { formatRelativeTime } from '../lib/datetime'
import { UsersIcon } from '../components/icons'
import { Badge, Button, EmptyState, PageHeader, PanelError, PanelLoading, SearchInput } from '../components/ui'

/** Saved customers: open one to see the documents made for them. */
export default function CustomersPage() {
  const { t, locale } = useI18n()
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 250)
  const customers = useCustomerDirectory(debounced)
  const items = customers.data ?? []

  return (
    <div className="page">
      <PageHeader title={t('customers.pageTitle')} description={t('customers.pageHint')} />

      <div className="toolbar">
        <div className="toolbar__search">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('customers.search')}
            ariaLabel={t('common.search')}
            clearLabel={t('search.clear')}
            loading={customers.isFetching}
          />
        </div>
      </div>

      {customers.isPending ? (
        <PanelLoading />
      ) : customers.isError ? (
        <PanelError onRetry={() => void customers.refetch()} />
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
            icon={<UsersIcon size={22} />}
            title={t('customers.pageEmptyTitle')}
            description={t('customers.pageEmptyBody')}
          />
        )
      ) : (
        <ul className="document-list document-list--panel" data-testid="customer-directory">
          {items.map((customer) => (
            <li key={customer.id}>
              <Link to={`/customers/${encodeURIComponent(customer.id)}`} className="customer-item" data-testid="customer-directory-row">
                <span className="customer-item__icon" aria-hidden="true">
                  {customer.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="customer-item__content">
                  <span className="customer-item__name">{customer.name}</span>
                  <span className="customer-item__meta">
                    {[customer.tin && `TIN ${customer.tin}`, customer.phone, customer.address].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="customer-item__side">
                  <Badge>{customer.shared ? t('customers.shared') : t('customers.personal')}</Badge>
                  <time className="customer-item__time" dateTime={customer.lastUsedAt}>
                    {t('customers.lastUsed', { time: formatRelativeTime(customer.lastUsedAt, locale) })}
                  </time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
