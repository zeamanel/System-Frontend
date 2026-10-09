import { useI18n } from '../../i18n'
import { formatRelativeTime } from '../../lib/datetime'
import { isFixtureDataSource } from '../../lib/repositories'
import {
  useMarkAllNotificationsRead,
  useNotifications,
} from '../../hooks/use-notifications'
import { BellIcon } from '../icons'
import { Badge, Button, PanelError, Popover } from '../ui'

/** Notifications area: unread badge, list, and mark-all-as-read. */
export function NotificationsMenu() {
  const { t, locale } = useI18n()
  const notifications = useNotifications()
  const markAllRead = useMarkAllNotificationsRead()

  const items = notifications.data ?? []
  const unreadCount = items.filter((item) => !item.read).length
  const triggerLabel = unreadCount
    ? `${t('topbar.notifications')} — ${t('topbar.unreadNotifications', { count: unreadCount })}`
    : t('topbar.notifications')

  return (
    <Popover
      ariaLabel={triggerLabel}
      align="right"
      panelClassName="notifications-menu__panel"
      label={
        <>
          <BellIcon size={16} />
          {unreadCount > 0 ? (
            <span className="notifications-menu__count" aria-hidden="true">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </>
      }
    >
      {() => (
        <>
          <div className="notifications-menu__header">
            <span className="notifications-menu__title">
              {t('topbar.notifications')}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={unreadCount === 0}
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              {t('notifications.markAllRead')}
            </Button>
          </div>
          <div className="notifications-menu__list">
            {notifications.isPending ? (
              <p className="notifications-menu__hint">{t('common.loading')}</p>
            ) : notifications.isError ? (
              <PanelError onRetry={() => void notifications.refetch()} />
            ) : items.length === 0 ? (
              <div className="notifications-menu__empty">
                <p className="notifications-menu__empty-title">
                  {t('notifications.empty.title')}
                </p>
                <p className="notifications-menu__empty-body">
                  {t('notifications.empty.body')}
                </p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="notification-item"
                  data-read={item.read}
                >
                  <span className="notification-item__dot" aria-hidden="true" />
                  <div className="notification-item__content">
                    <span className="notification-item__title-row">
                      <span className="notification-item__title">
                        {item.title}
                      </span>
                      {isFixtureDataSource() ? (
                        <Badge variant="warning">{t('dev.badge')}</Badge>
                      ) : null}
                    </span>
                    <p className="notification-item__body">{item.body}</p>
                    <time className="notification-item__time" dateTime={item.createdAt}>
                      {formatRelativeTime(item.createdAt, locale)}
                    </time>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </Popover>
  )
}
