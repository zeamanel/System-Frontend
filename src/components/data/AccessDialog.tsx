import './data.css'

import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { useDataAccess, useSetMemberAccess } from '../../hooks/use-data'
import type { MemberAccess } from '../../lib/data/types'
import { Badge, Dialog, PanelError, PanelLoading, useToast } from '../ui'

export interface AccessDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * What each member may do with the organization's data: change records (or
 * only view and use them), and see salary, ID numbers and bank accounts
 * without being an admin. Owners and admins always may.
 */
export function AccessDialog({ open, onClose }: AccessDialogProps) {
  const { t } = useI18n()
  const toast = useToast()
  const access = useDataAccess(open)
  const update = useSetMemberAccess()

  const set = async (member: MemberAccess, change: { canEdit?: boolean; canSeeSensitive?: boolean }): Promise<void> => {
    try {
      await update.mutateAsync({ userId: member.userId, ...change })
      toast.push(t('data.accessSaved', { name: member.name || member.email }), { variant: 'success' })
    } catch (failure) {
      toast.push(failure instanceof Error && failure.message ? failure.message : t('data.saveFailed'), { variant: 'error' })
    }
  }

  const members = access.data ?? []

  return (
    <Dialog open={open} onClose={onClose} title={t('data.accessTitle')} closeLabel={t('common.close')} width="md">
      <div className="data-access">
        <p className="data-manage__hint">{t('data.accessHint')}</p>
        {access.isPending ? (
          <PanelLoading />
        ) : access.isError ? (
          <PanelError onRetry={() => void access.refetch()} />
        ) : members.length === 0 ? (
          <p className="record-form__note">{t('data.accessNone')}</p>
        ) : (
          <ul className="data-access__list" data-testid="access-list">
            {members.map((member) => (
              <li key={member.userId} className="data-access__item" data-testid="access-member">
                <span className="data-access__who">
                  <span className="data-item__name">{member.name || member.email}</span>
                  <small>
                    {member.email}
                    {' · '}
                    <Badge variant="neutral">{t(`data.accessRole.${member.role}` as MessageKey)}</Badge>
                  </small>
                </span>
                <span className="data-access__toggles">
                  <label className="record-form__check">
                    <input
                      type="checkbox"
                      checked={member.canEdit}
                      disabled={member.fixed || update.isPending}
                      onChange={(event) => void set(member, { canEdit: event.target.checked })}
                      data-testid="access-edit"
                    />
                    {t('data.accessCanEdit')}
                  </label>
                  <label className="record-form__check">
                    <input
                      type="checkbox"
                      checked={member.canSeeSensitive}
                      disabled={member.fixed || update.isPending}
                      onChange={(event) => void set(member, { canSeeSensitive: event.target.checked })}
                      data-testid="access-sensitive"
                    />
                    {t('data.accessSensitive')}
                  </label>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
