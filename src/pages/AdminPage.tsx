import './pages.css'

import { useI18n } from '../i18n'
import { useSession } from '../session'
import { useUsage } from '../hooks/use-usage'
import {
  Button,
  CardRow,
  EmptyState,
  PageHeader,
  Panel,
  PanelError,
  PanelLoading,
} from '../components/ui'

/** Admin-only area: usage (when provided) and team (arrives later). */
export default function AdminPage() {
  const { t } = useI18n()
  const { user, isAdmin } = useSession()
  const usage = useUsage()
  const isUserAdmin = user ? user.role === 'admin' : Boolean(isAdmin)

  if (!isUserAdmin) {
    return (
      <div className="page">
        <EmptyState title={t('admin.limited')} />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title={t('admin.title')} />

      <div className="dashboard-grid dashboard-grid--top">
        <Panel
          title={t('admin.usage')}
          action={
            <Button
              variant="ghost"
              size="sm"
              loading={usage.isFetching}
              onClick={() => void usage.refetch()}
            >
              {t('admin.refresh')}
            </Button>
          }
        >
          {usage.isPending ? (
            <PanelLoading />
          ) : usage.isError ? (
            <PanelError onRetry={() => void usage.refetch()} />
          ) : usage.data ? (
            <dl className="panel-rows">
              <CardRow label={t('dashboard.usageDocumentsThisMonth')}>
                {usage.data.documentsThisMonth}
              </CardRow>
            </dl>
          ) : (
            <p className="panel-note">{t('dashboard.usageUnavailable')}</p>
          )}
        </Panel>

        <Panel title={t('admin.team')}>
          <EmptyState
            className="empty-state--compact"
            title={t('admin.teamEmpty.title')}
            description={t('admin.teamEmpty.body')}
          />
        </Panel>
      </div>
    </div>
  )
}
