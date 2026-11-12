import './SavedCustomers.css'

import { useState } from 'react'
import { useI18n } from '../../i18n'
import { clearPendingCustomer, getPendingCustomer } from '../../lib/customers/pending'
import { Button } from '../ui'

/**
 * On the Templates page after "New document for this customer": who the
 * next document is for, with a way to drop the choice.
 */
export function PendingCustomerNotice() {
  const { t } = useI18n()
  const [customer, setCustomer] = useState(() => getPendingCustomer())
  if (!customer) return null
  return (
    <div className="saved-customers__notice" role="status" data-testid="pending-customer-notice">
      <span>{t('customers.choosingFor', { name: customer.name })}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          clearPendingCustomer()
          setCustomer(null)
        }}
      >
        {t('common.cancel')}
      </Button>
    </div>
  )
}
