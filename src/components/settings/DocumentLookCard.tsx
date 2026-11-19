import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { usePreferences } from '../../preferences'
import { useOrganization } from '../../hooks/use-organization'
import { Card, CardBody, CardTitle, Input } from '../ui'

const MAX_LINES = 4

/**
 * How new documents start for a person working alone: in the template's look
 * (or plain), with their own header on letters, and for a print shop an
 * optional footer line on customers' documents. Members of an organization
 * follow the organization's settings instead.
 */
export function DocumentLookCard() {
  const { t } = useI18n()
  const { preferences, occupation, updatePreferences } = usePreferences()
  const organization = useOrganization()
  const look = {
    autoStyle: preferences.documentLook?.autoStyle !== false,
    customerFooter: preferences.documentLook?.customerFooter ?? '',
    personalHeader: preferences.documentLook?.personalHeader ?? [],
  }
  const [header, setHeader] = useState<string[]>(look.personalHeader)
  const [footer, setFooter] = useState(look.customerFooter)
  const shop = occupation === 'print_shop'

  // The saved values come back after a save or a sync from another device.
  const savedHeader = look.personalHeader.join('\n')
  useEffect(() => setHeader(savedHeader ? savedHeader.split('\n') : []), [savedHeader])
  useEffect(() => setFooter(look.customerFooter), [look.customerFooter])

  const save = (change: Partial<typeof look>): void => {
    void updatePreferences({ documentLook: { ...look, ...change } })
  }
  const saveHeader = (): void => {
    const lines = header.map((line) => line.trim()).filter(Boolean)
    if (lines.join('\n') !== savedHeader) save({ personalHeader: lines })
  }

  if (organization.data) {
    return (
      <Card className="settings-card" data-testid="settings-look">
        <CardTitle>{t('look.title')}</CardTitle>
        <CardBody>
          <p className="settings-note" data-testid="settings-look-org">
            {t('look.followsOrganization', { name: organization.data.name })} <Link to="/organization">{t('look.organizationLink')}</Link>
          </p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card className="settings-card" data-testid="settings-look">
      <CardTitle info={t('look.personalHint')}>{t('look.title')}</CardTitle>
      <CardBody>
        <div className="settings-look">
          <p className="settings-note">{t(shop ? 'look.modeShop' : 'look.modePersonal')}</p>
          <label className="org-check">
            <input
              type="checkbox"
              checked={look.autoStyle}
              onChange={(event) => save({ autoStyle: event.target.checked })}
              data-testid="settings-look-auto"
            />
            <span>{t('look.autoStyle')}</span>
          </label>
          {shop ? (
            <Input
              id="settings-customer-footer"
              label={t('look.customerFooter')}
              hint={t('look.customerFooterHint')}
              value={footer}
              maxLength={200}
              onChange={(event) => setFooter(event.target.value)}
              onBlur={() => {
                if (footer.trim() !== look.customerFooter) save({ customerFooter: footer.trim() })
              }}
              data-testid="settings-look-footer"
            />
          ) : (
            <fieldset className="settings-look__header">
              <legend>{t('look.personalHeader')}</legend>
              <p className="settings-note">{t('look.personalHeaderHint')}</p>
              {Array.from({ length: Math.min(header.length + 1, MAX_LINES) }, (_, index) => (
                <Input
                  key={index}
                  id={`settings-header-${index}`}
                  label={t('organization.headerLine', { n: String(index + 1) })}
                  value={header[index] ?? ''}
                  maxLength={120}
                  onChange={(event) =>
                    setHeader((lines) => {
                      const next = [...lines]
                      next[index] = event.target.value
                      return next
                    })
                  }
                  onBlur={saveHeader}
                  data-testid="settings-look-header"
                />
              ))}
            </fieldset>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
