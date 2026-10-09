import './pages.css'

import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import type { OrganizationProfile, OrganizationType } from '../lib/repositories'
import { isFixtureDataSource } from '../lib/repositories'
import { useOrganization, useUpdateOrganization } from '../hooks/use-organization'
import { env } from '../config/env'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Input,
  LoadingState,
  PanelError,
  Select,
  useToast,
} from '../components/ui'

const EMPTY_PROFILE: OrganizationProfile = {
  name: '',
  type: 'print_shop',
  address: '',
  phone: '',
  email: '',
}

export default function OrganizationPage() {
  const { t } = useI18n()
  const toast = useToast()
  const organization = useOrganization()
  const saveProfile = useUpdateOrganization()

  const [form, setForm] = useState<OrganizationProfile | null>(null)

  // Seed the form once the profile resolves; a missing profile starts blank.
  useEffect(() => {
    if (form === null && organization.data !== undefined) {
      setForm(organization.data ?? EMPTY_PROFILE)
    }
  }, [organization.data, form])

  if (organization.isPending) {
    return <LoadingState full label={t('common.loading')} />
  }

  if (organization.isError) {
    return (
      <div className="page">
        <PanelError onRetry={() => void organization.refetch()} />
      </div>
    )
  }

  const update = <K extends keyof OrganizationProfile>(
    key: K,
    value: OrganizationProfile[K],
  ) => {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  const dirty = form !== null && form !== (organization.data ?? null)

  const handleSave = async () => {
    if (!form) return
    try {
      await saveProfile.mutateAsync(form)
      toast.push(t('organization.saved'), { variant: 'success' })
    } catch {
      toast.push(t('common.error'), { variant: 'error' })
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">
          {t('organization.title')}
          {isFixtureDataSource() ? (
            <Badge variant="warning" className="page__title-badge">
              {t('dev.badge')}
            </Badge>
          ) : null}
        </h1>
        <p className="page__subtitle">{t('organization.subtitle')}</p>
      </header>

      <form
        className="org-form"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSave()
        }}
      >
        <Card>
          <CardTitle>{t('organization.title')}</CardTitle>
          <CardBody>
            <div className="org-form__grid">
              <Input
                id="org-name"
                label={t('organization.name')}
                value={form?.name ?? ''}
                onChange={(event) => update('name', event.target.value)}
                required
                autoComplete="organization"
              />
              <Select
                id="org-type"
                label={t('organization.type')}
                value={form?.type ?? 'print_shop'}
                onChange={(event) =>
                  update('type', event.target.value as OrganizationType)
                }
                options={[
                  { value: 'print_shop', label: t('orgType.printShop') },
                  { value: 'office', label: t('orgType.office') },
                  { value: 'personal', label: t('orgType.personal') },
                ]}
              />
              <Input
                id="org-address"
                label={t('organization.address')}
                value={form?.address ?? ''}
                onChange={(event) => update('address', event.target.value)}
                autoComplete="street-address"
              />
              <Input
                id="org-phone"
                label={t('organization.phone')}
                value={form?.phone ?? ''}
                onChange={(event) => update('phone', event.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
              <Input
                id="org-email"
                type="email"
                label={t('organization.email')}
                value={form?.email ?? ''}
                onChange={(event) => update('email', event.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </div>
          </CardBody>
        </Card>

        <div className="org-form__footer">
          <Button
            type="submit"
            variant="primary"
            loading={saveProfile.isPending}
            disabled={!dirty}
          >
            {t('organization.save')}
          </Button>
        </div>
      </form>

      <p className="page__footnote">
        {t('settings.apiUrlLabel')}: <code>{env.apiBaseUrl}</code>
      </p>
    </div>
  )
}
