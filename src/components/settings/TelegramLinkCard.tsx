import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../../i18n'
import { createTelegramLinkCode, getTelegramLink, telegramLinkAvailable, unlinkTelegram, type TelegramLinkCode } from '../../lib/telegram-link/client'
import { ApiError } from '../../lib/api'
import { Button, Card, CardBody, CardTitle, useToast } from '../ui'

const LINK_KEY = ['telegram-link'] as const

/**
 * Settings → Telegram: link the person's own Telegram chat (optional). The
 * bot works without it; linking adds /ask, /files, /workspace and
 * notifications, with the member's own access. While a code is shown the
 * card checks every few seconds whether the chat has been linked.
 */
export function TelegramLinkCard() {
  const { t } = useI18n()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [code, setCode] = useState<TelegramLinkCode | null>(null)
  const status = useQuery({
    queryKey: LINK_KEY,
    queryFn: ({ signal }) => getTelegramLink(signal),
    enabled: telegramLinkAvailable(),
    refetchInterval: code ? 3000 : false,
  })
  const linked = status.data?.linked === true

  // Linked while the code was shown: done.
  useEffect(() => {
    if (code && linked) {
      setCode(null)
      toast.push(t('telegramLink.linkedToast'), { variant: 'success' })
    }
  }, [code, linked, t, toast])

  const create = useMutation({
    mutationFn: createTelegramLinkCode,
    onSuccess: setCode,
    onError: (error) =>
      toast.push(error instanceof ApiError && error.status === 403 ? t('telegramLink.disabled') : t('telegramLink.failed'), { variant: 'error' }),
  })
  const remove = useMutation({
    mutationFn: unlinkTelegram,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LINK_KEY })
      toast.push(t('telegramLink.unlinkedToast'), { variant: 'success' })
    },
  })

  return (
    <Card className="settings-card" data-testid="settings-telegram">
      <CardTitle info={t('telegramLink.info')}>{t('telegramLink.title')}</CardTitle>
      <CardBody>
        <div className="settings-look">
          {!telegramLinkAvailable() ? (
            <p className="settings-note">{t('telegramLink.demo')}</p>
          ) : linked ? (
            <>
              <p className="settings-note" data-testid="telegram-linked">
                {t('telegramLink.linked', {
                  chat: status.data?.chatName ?? 'Telegram',
                  workspace: status.data?.workspace?.name ?? t('data.titlePersonal'),
                })}
              </p>
              <p className="settings-note">{t('telegramLink.commands')}</p>
              <div>
                <Button variant="secondary" size="sm" loading={remove.isPending} onClick={() => remove.mutate()} data-testid="telegram-unlink">
                  {t('telegramLink.unlink')}
                </Button>
              </div>
            </>
          ) : code ? (
            <>
              <p className="settings-note">{t('telegramLink.codeHint')}</p>
              <p className="telegram-link__code" data-testid="telegram-code">
                /link {code.code}
              </p>
              <div className="telegram-link__actions">
                {code.url ? (
                  <a className="btn btn--primary btn--sm" href={code.url} target="_blank" rel="noopener noreferrer" data-testid="telegram-open">
                    {t('telegramLink.open')}
                  </a>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => setCode(null)}>
                  {t('common.cancel')}
                </Button>
              </div>
              <p className="settings-note" role="status">
                {t('telegramLink.waiting')}
              </p>
            </>
          ) : (
            <>
              <p className="settings-note">{t('telegramLink.optional')}</p>
              <div>
                <Button variant="secondary" size="sm" loading={create.isPending} onClick={() => create.mutate()} data-testid="telegram-link">
                  {t('telegramLink.link')}
                </Button>
              </div>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
