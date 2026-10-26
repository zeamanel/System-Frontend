import './pages.css'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useI18n } from '../i18n'
import type {
  OrganizationMember,
  OrganizationProfile,
  OrganizationRole,
  OrganizationType,
} from '../lib/repositories'
import { isFixtureDataSource } from '../lib/repositories'
import { ApiError } from '../lib/api'
import { canEditOrganization, EMPTY_ORGANIZATION } from '../lib/organization/profile'
import {
  useOrganization,
  useOrganizationMemberAction,
  useOrganizationMembers,
  useUpdateOrganization,
} from '../hooks/use-organization'
import { useSession } from '../session/use-session'
import { useMediaUrls, useSetOrganizationLogo } from '../hooks/use-media'
import { ImagePicker } from '../components/media/ImagePicker'
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

const MAX_HEADER_LINES = 4
const MAX_SIGNATORIES = 10

/**
 * Organization profile ("business memory"): details, letterhead,
 * signatories and bank details fill documents automatically; members share
 * them. Owners and admins edit; members see the profile read-only.
 */
export default function OrganizationPage() {
  const { t } = useI18n()
  const toast = useToast()
  const organization = useOrganization()
  const saveProfile = useUpdateOrganization()

  const [form, setForm] = useState<OrganizationProfile | null>(null)

  // Seed the form once the profile resolves; a missing profile starts blank.
  useEffect(() => {
    if (form === null && organization.data !== undefined) {
      setForm(organization.data ?? EMPTY_ORGANIZATION)
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

  const exists = organization.data !== null
  const editable = canEditOrganization(organization.data ?? null)
  const profile = form ?? EMPTY_ORGANIZATION

  const update = (patch: Partial<OrganizationProfile>) => {
    setForm((current) => ({ ...(current ?? EMPTY_ORGANIZATION), ...patch }))
  }

  // The logo saves on its own (LogoCard), so it never makes the form dirty.
  const withoutLogo = ({ logoMediaId: _logo, ...rest }: OrganizationProfile) => rest
  const dirty =
    form !== null && JSON.stringify(withoutLogo(form)) !== JSON.stringify(withoutLogo(organization.data ?? EMPTY_ORGANIZATION))

  const handleSave = async () => {
    if (!form) return
    try {
      const saved = await saveProfile.mutateAsync({
        ...form,
        letterhead: {
          headerLines: form.letterhead.headerLines.map((line) => line.trim()).filter(Boolean),
          footerLine: form.letterhead.footerLine.trim(),
        },
        signatories: form.signatories.filter((s) => s.fullName.trim()),
      })
      setForm(saved)
      toast.push(t(exists ? 'organization.saved' : 'organization.created'), { variant: 'success' })
    } catch (error) {
      toast.push(error instanceof ApiError && error.status === 400 ? error.message : t('common.error'), {
        variant: 'error',
      })
    }
  }

  const headerLines = profile.letterhead.headerLines
  const setHeaderLine = (index: number, value: string) => {
    const lines = [...headerLines]
    lines[index] = value
    update({ letterhead: { ...profile.letterhead, headerLines: lines } })
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

      {!exists ? <p className="org-note">{t('organization.createHint')}</p> : null}
      {!editable ? <p className="org-note" data-testid="org-read-only">{t('organization.readOnly')}</p> : null}

      <form
        className="org-form"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSave()
        }}
      >
        <fieldset className="org-form__fieldset" disabled={!editable}>
          <Card>
            <CardTitle>{t('organization.section.profile')}</CardTitle>
            <CardBody>
              <div className="org-form__grid">
                <Input
                  id="org-name"
                  label={t('organization.name')}
                  value={profile.name}
                  onChange={(event) => update({ name: event.target.value })}
                  required
                  maxLength={200}
                  autoComplete="organization"
                />
                <Input
                  id="org-legal-name"
                  label={t('organization.legalName')}
                  value={profile.legalName}
                  onChange={(event) => update({ legalName: event.target.value })}
                  maxLength={200}
                />
                <Select
                  id="org-type"
                  label={t('organization.type')}
                  value={profile.type}
                  onChange={(event) => update({ type: event.target.value as OrganizationType })}
                  options={[
                    { value: 'print_shop', label: t('orgType.printShop') },
                    { value: 'office', label: t('orgType.office') },
                    { value: 'personal', label: t('orgType.personal') },
                  ]}
                />
                <Input
                  id="org-tin"
                  label={t('organization.tin')}
                  hint={t('organization.tinHint')}
                  value={profile.tin}
                  onChange={(event) => update({ tin: event.target.value })}
                  inputMode="numeric"
                  pattern="[0-9 \-]*"
                  maxLength={20}
                />
                <Input
                  id="org-address"
                  label={t('organization.address')}
                  value={profile.address}
                  onChange={(event) => update({ address: event.target.value })}
                  maxLength={300}
                  autoComplete="street-address"
                />
                <Input
                  id="org-phone"
                  label={t('organization.phone')}
                  value={profile.phone}
                  onChange={(event) => update({ phone: event.target.value })}
                  maxLength={40}
                  autoComplete="tel"
                  inputMode="tel"
                />
                <Input
                  id="org-email"
                  type="email"
                  label={t('organization.email')}
                  value={profile.email}
                  onChange={(event) => update({ email: event.target.value })}
                  maxLength={200}
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardTitle>{t('organization.section.letterhead')}</CardTitle>
            <CardBody>
              <p className="org-form__hint">{t('organization.letterheadHint')}</p>
              <div className="org-form__stack">
                {Array.from({ length: Math.min(headerLines.length + 1, MAX_HEADER_LINES) }, (_, index) => (
                  <Input
                    key={index}
                    id={`org-header-${index}`}
                    label={t('organization.headerLine', { n: String(index + 1) })}
                    value={headerLines[index] ?? ''}
                    onChange={(event) => setHeaderLine(index, event.target.value)}
                    maxLength={200}
                  />
                ))}
                <Input
                  id="org-footer"
                  label={t('organization.footerLine')}
                  value={profile.letterhead.footerLine}
                  onChange={(event) =>
                    update({ letterhead: { ...profile.letterhead, footerLine: event.target.value } })
                  }
                  maxLength={200}
                />
              </div>
              {headerLines.some((line) => line.trim()) || profile.letterhead.footerLine.trim() ? (
                <div className="org-letterhead-preview" aria-label={t('organization.letterheadPreview')}>
                  <div className="org-letterhead-preview__header">
                    {headerLines
                      .filter((line) => line.trim())
                      .map((line, index) => (
                        <p key={index} className={index === 0 ? 'org-letterhead-preview__name' : undefined}>
                          {line}
                        </p>
                      ))}
                  </div>
                  <div className="org-letterhead-preview__body" aria-hidden="true" />
                  {profile.letterhead.footerLine.trim() ? (
                    <p className="org-letterhead-preview__footer">{profile.letterhead.footerLine}</p>
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardTitle>{t('organization.section.signatories')}</CardTitle>
            <CardBody>
              <p className="org-form__hint">{t('organization.signatoriesHint')}</p>
              <ul className="org-signatories">
                {profile.signatories.map((signatory, index) => (
                  <li key={index} className="org-signatories__row">
                    <Input
                      id={`org-signatory-name-${index}`}
                      label={t('organization.signatoryName')}
                      value={signatory.fullName}
                      maxLength={120}
                      onChange={(event) =>
                        update({
                          signatories: profile.signatories.map((s, i) =>
                            i === index ? { ...s, fullName: event.target.value } : s,
                          ),
                        })
                      }
                    />
                    <Input
                      id={`org-signatory-title-${index}`}
                      label={t('organization.signatoryTitle')}
                      value={signatory.title}
                      maxLength={120}
                      onChange={(event) =>
                        update({
                          signatories: profile.signatories.map((s, i) =>
                            i === index ? { ...s, title: event.target.value } : s,
                          ),
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="org-signatories__remove"
                      onClick={() => update({ signatories: profile.signatories.filter((_, i) => i !== index) })}
                    >
                      {t('organization.removeSignatory')}
                    </Button>
                  </li>
                ))}
              </ul>
              {profile.signatories.length < MAX_SIGNATORIES ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => update({ signatories: [...profile.signatories, { fullName: '', title: '' }] })}
                >
                  {t('organization.addSignatory')}
                </Button>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardTitle>{t('organization.section.bank')}</CardTitle>
            <CardBody>
              <p className="org-form__hint">{t('organization.bankHint')}</p>
              <div className="org-form__grid">
                <Input
                  id="org-bank-name"
                  label={t('organization.bankName')}
                  value={profile.bankDetails.bankName}
                  maxLength={100}
                  onChange={(event) => update({ bankDetails: { ...profile.bankDetails, bankName: event.target.value } })}
                />
                <Input
                  id="org-bank-account"
                  label={t('organization.accountNumber')}
                  value={profile.bankDetails.accountNumber}
                  maxLength={40}
                  inputMode="numeric"
                  autoComplete="off"
                  onChange={(event) =>
                    update({ bankDetails: { ...profile.bankDetails, accountNumber: event.target.value } })
                  }
                />
                <Input
                  id="org-bank-swift"
                  label={t('organization.swift')}
                  value={profile.bankDetails.swift}
                  maxLength={20}
                  autoComplete="off"
                  onChange={(event) => update({ bankDetails: { ...profile.bankDetails, swift: event.target.value } })}
                />
              </div>
            </CardBody>
          </Card>
        </fieldset>

        {editable ? (
          <div className="org-form__footer">
            <Button type="submit" variant="primary" loading={saveProfile.isPending} disabled={!dirty || !profile.name.trim()}>
              {exists ? t('organization.save') : t('organization.create')}
            </Button>
          </div>
        ) : null}
      </form>

      <LogoCard
        logoMediaId={organization.data?.logoMediaId ?? null}
        exists={exists}
        editable={editable}
      />

      {exists ? <MembersCard role={organization.data?.role} /> : null}

      <p className="page__footnote">
        {t('settings.apiUrlLabel')}: <code>{env.apiBaseUrl}</code>
      </p>
    </div>
  )
}

function LogoCard({ logoMediaId, exists, editable }: { logoMediaId: string | null; exists: boolean; editable: boolean }) {
  const { t } = useI18n()
  const toast = useToast()
  const setLogo = useSetOrganizationLogo()
  const { urls, failed } = useMediaUrls({ logo: logoMediaId })

  const save = async (mediaId: string | null): Promise<void> => {
    try {
      await setLogo.mutateAsync(mediaId)
      toast.push(t(mediaId ? 'organization.logoSaved' : 'organization.logoRemoved'), { variant: 'success' })
    } catch {
      toast.push(t('common.error'), { variant: 'error' })
    }
  }

  return (
    <Card className="org-logo">
      <CardTitle>{t('organization.section.logo')}</CardTitle>
      <CardBody>
        {!exists ? (
          <p className="org-form__hint">{t('organization.logoNeedsOrganization')}</p>
        ) : (
          <>
            <p className="org-form__hint">{t('organization.logoHint')}</p>
            <ImagePicker
              kind="logo"
              imageUrl={urls.logo}
              failed={failed.includes('logo')}
              alt={t('organization.logoAlt')}
              uploadLabel={t('organization.logoUpload')}
              replaceLabel={t('organization.logoReplace')}
              removeLabel={t('organization.logoRemove')}
              emptyLabel={t('organization.logoEmpty')}
              disabled={!editable || setLogo.isPending}
              onUploaded={(record) => save(record.id)}
              onRemove={editable ? () => void save(null) : undefined}
              testId="org-logo"
            />
          </>
        )}
      </CardBody>
    </Card>
  )
}

function MembersCard({ role }: { role?: OrganizationRole }) {
  const { t } = useI18n()
  const toast = useToast()
  const { user } = useSession()
  const members = useOrganizationMembers()
  const action = useOrganizationMemberAction()
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<'member' | 'admin'>('member')

  const canManage = role === 'owner' || role === 'admin'
  const roleLabel = (r: OrganizationRole) => t(`organization.role.${r}`)

  const run = async (input: Parameters<typeof action.mutateAsync>[0], success: string) => {
    try {
      await action.mutateAsync(input)
      toast.push(success, { variant: 'success' })
      return true
    } catch (error) {
      const key =
        error instanceof ApiError
          ? error.status === 404 && input.kind === 'add'
            ? 'organization.memberNotFound'
            : error.status === 409
              ? input.kind === 'add'
                ? 'organization.memberExists'
                : 'organization.lastOwner'
              : error.status === 403
                ? 'organization.notAllowed'
                : 'common.error'
          : 'common.error'
      toast.push(t(key), { variant: 'error' })
      return false
    }
  }

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) return
    if (await run({ kind: 'add', email: email.trim(), role: newRole }, t('organization.memberAdded'))) setEmail('')
  }

  return (
    <Card className="org-members">
      <CardTitle>{t('organization.section.members')}</CardTitle>
      <CardBody>
        {members.isPending ? (
          <LoadingState label={t('common.loading')} />
        ) : members.isError ? (
          <PanelError onRetry={() => void members.refetch()} />
        ) : members.data === null ? (
          <p className="org-form__hint">{t('organization.membersDemo')}</p>
        ) : (
          <>
            <p className="org-form__hint">{t('organization.membersHint')}</p>
            <ul className="org-members__list" data-testid="org-members">
              {members.data.map((member: OrganizationMember) => {
                const isSelf = member.email.toLowerCase() === user?.email?.toLowerCase()
                const canRemove =
                  isSelf || role === 'owner' || (role === 'admin' && member.role === 'member')
                return (
                  <li key={member.userId} className="org-members__row">
                    <div className="org-members__who">
                      <span className="org-members__name">
                        {member.name}
                        {isSelf ? <span className="org-members__you"> ({t('organization.you')})</span> : null}
                      </span>
                      <span className="org-members__email">{member.email}</span>
                    </div>
                    {role === 'owner' ? (
                      <Select
                        id={`member-role-${member.userId}`}
                        aria-label={t('organization.memberRole')}
                        value={member.role}
                        onChange={(event) =>
                          void run(
                            { kind: 'role', userId: member.userId, role: event.target.value as OrganizationRole },
                            t('organization.memberUpdated'),
                          )
                        }
                        options={(['owner', 'admin', 'member'] as const).map((r) => ({ value: r, label: roleLabel(r) }))}
                      />
                    ) : (
                      <Badge>{roleLabel(member.role)}</Badge>
                    )}
                    {canRemove ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void run(
                            { kind: 'remove', userId: member.userId },
                            isSelf ? t('organization.left') : t('organization.memberRemoved'),
                          )
                        }
                      >
                        {isSelf ? t('organization.leave') : t('organization.removeMember')}
                      </Button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            {canManage ? (
              <form className="org-members__add" onSubmit={(event) => void handleAdd(event)}>
                <Input
                  id="org-member-email"
                  type="email"
                  label={t('organization.memberEmail')}
                  hint={t('organization.memberEmailHint')}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="off"
                  inputMode="email"
                />
                {role === 'owner' ? (
                  <Select
                    id="org-member-role"
                    label={t('organization.memberRole')}
                    value={newRole}
                    onChange={(event) => setNewRole(event.target.value as 'member' | 'admin')}
                    options={[
                      { value: 'member', label: roleLabel('member') },
                      { value: 'admin', label: roleLabel('admin') },
                    ]}
                  />
                ) : null}
                <Button type="submit" variant="secondary" loading={action.isPending} disabled={!email.trim()}>
                  {t('organization.addMember')}
                </Button>
              </form>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  )
}
