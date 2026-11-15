import './pages.css'
import './CustomersPage.css'

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useCustomer, useCustomerDocuments, useDeleteCustomer } from '../hooks/use-customers'
import { setPendingCustomer } from '../lib/customers/pending'
import { DocumentListItem } from '../components/documents/DocumentListItem'
import { ArrowLeftIcon, DocumentIcon, PlusIcon, UsersIcon } from '../components/icons'
import { Badge, Button, EmptyState, PageHeader, PanelError, PanelLoading, useToast } from '../components/ui'

/** One customer: their details and the documents made for them. */
export default function CustomerDetailPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  const { customerId = '' } = useParams()
  const customer = useCustomer(customerId)
  const documents = useCustomerDocuments(customerId, Boolean(customer.data))
  const forget = useDeleteCustomer()
  const [confirming, setConfirming] = useState(false)

  const back = (
    <Link className="panel__link customer-detail__back" to="/customers">
      <ArrowLeftIcon size={15} />
      {t('customers.allCustomers')}
    </Link>
  )

  if (customer.isPending) {
    return (
      <div className="page">
        {back}
        <PanelLoading />
      </div>
    )
  }
  if (customer.isError) {
    return (
      <div className="page">
        {back}
        <PanelError onRetry={() => void customer.refetch()} />
      </div>
    )
  }
  const data = customer.data
  if (!data) {
    return (
      <div className="page">
        {back}
        <EmptyState icon={<UsersIcon size={22} />} title={t('customers.notFoundTitle')} description={t('customers.notFoundBody')} />
      </div>
    )
  }

  const newDocument = (): void => {
    setPendingCustomer(data)
    navigate('/templates')
  }

  const details: Array<[string, string]> = [
    [t('customers.tin'), data.tin],
    [t('customers.phone'), data.phone],
    [t('customers.email'), data.email],
    [t('customers.address'), data.address],
  ]
  const filled = details.filter(([, value]) => value)
  const items = documents.data ?? []

  return (
    <div className="page customer-detail">
      {back}
      <PageHeader
        title={
          <>
            {data.name}
            <Badge className="page__title-badge">{data.shared ? t('customers.shared') : t('customers.personal')}</Badge>
          </>
        }
        actions={
          confirming ? (
            <div className="customer-detail__confirm" role="group" aria-label={t('customers.forgetConfirm', { name: data.name })}>
              <span>{t('customers.forgetConfirm', { name: data.name })}</span>
              <Button
                variant="secondary"
                loading={forget.isPending}
                onClick={() =>
                  forget.mutate(data.id, {
                    onSuccess: () => {
                      toast.push(t('customers.forgotten'))
                      navigate('/customers')
                    },
                    onError: () => {
                      setConfirming(false)
                      toast.push(t('customers.forgetFailed'), { variant: 'error' })
                    },
                  })
                }
                data-testid="customer-forget-confirm"
              >
                {t('customers.forget')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                {t('customers.keep')}
              </Button>
            </div>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setConfirming(true)} data-testid="customer-forget">
                {t('customers.forget')}
              </Button>
              <Button variant="primary" icon={<PlusIcon size={16} />} onClick={newDocument} data-testid="customer-new-document">
                {t('customers.newDocument')}
              </Button>
            </>
          )
        }
      />

      {filled.length > 0 ? (
        <dl className="customer-detail__facts" data-testid="customer-details">
          {filled.map(([label, value]) => (
            <div key={label} className="customer-detail__fact">
              <dt>{label}</dt>
              <dd dir="auto">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <section className="customer-detail__documents" aria-labelledby="customer-documents-title">
        <h2 id="customer-documents-title" className="customer-detail__heading">
          {t('customers.documentsTitle')}
          {items.length > 0 ? <span className="customer-detail__count">{items.length}</span> : null}
        </h2>
        {documents.isPending ? (
          <PanelLoading />
        ) : documents.isError ? (
          <PanelError onRetry={() => void documents.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<DocumentIcon size={22} />}
            title={t('customers.documentsEmptyTitle')}
            description={t('customers.documentsEmptyBody')}
          />
        ) : (
          <ul className="document-list document-list--panel" data-testid="customer-documents">
            {items.map((document) => (
              <li key={document.id}>
                <DocumentListItem document={document} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
