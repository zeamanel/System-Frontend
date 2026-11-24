import './InsertImageDialog.css'

import { useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { useOrganizationMembers } from '../../hooks/use-organization'
import { useMediaUrls } from '../../hooks/use-media'
import {
  useAddSavedImage,
  useDeleteSavedImage,
  useSavedImagePreview,
  useSavedImages,
  useTakeSavedImage,
  useUpdateSavedImage,
} from '../../hooks/use-saved-images'
import { getRepositories } from '../../lib/repositories'
import type { OrganizationMember, OrganizationProfile } from '../../lib/repositories/types'
import { DEFAULT_CLEANUP, type CleanupChoice } from '../../lib/media/cleanup'
import { cleanedImageBlob } from '../../lib/media/cleanup-browser'
import { blobToDataUrl, ImagePrepareError, preparePrintableImage } from '../../lib/media/prepare'
import type { SavedImage, SavedImageAccess, SavedImageKind } from '../../lib/saved-images/types'
import { SAVED_IMAGE_KINDS } from '../../lib/saved-images/types'
import { Button, Dialog, Input, Select } from '../ui'
import { StampCleanup } from './StampCleanup'
import { AiImagePanel } from '../media/AiImagePanel'
import { ImagePlusIcon, PaperclipIcon, ShieldIcon, SparkIcon, TrashIcon, UsersIcon } from '../icons'

export interface InsertImageDialogProps {
  open: boolean
  onClose: () => void
  /** A picture from the device (the editor checks and converts it); `slot` when it goes on a signature line. */
  onPickFile: (file: File, slot?: 'signature' | 'stamp') => void
  /** Opens the Telegram files (absent: not offered). */
  onOpenTelegram?: () => void
  /** Puts a logo, stamp, signature or other saved image into the document. */
  onInsertImage: (dataUrl: string, name: string, kind: SavedImageKind) => void
  /** The open document: each use of a saved image is recorded with it. */
  documentId?: string
  /** The caller's organization: its letterhead logo is offered first. */
  organization?: OrganizationProfile | null
  /**
   * The picture goes on this party's signature line (a signature on it, a
   * stamp over it) rather than into the text: the device offers both, and
   * Telegram and the letterhead logo are not offered.
   */
  target?: { partyLabel: string }
  /** A book: pictures can be made from a description and go in here (absent: not offered). */
  onInsertGenerated?: (dataUrl: string, name: string) => void | Promise<void>
}

const KIND_KEY: Record<SavedImageKind, MessageKey> = {
  logo: 'images.kind.logo',
  stamp: 'images.kind.stamp',
  signature: 'images.kind.signature',
  image: 'images.kind.image',
}

/**
 * Adding an image to a document: from the device, from Telegram, or one of
 * the space's saved logos, stamps and signatures. Who may use each saved
 * image is decided on the server; people who may not see it locked.
 */
export function InsertImageDialog({
  open,
  onClose,
  onPickFile,
  onOpenTelegram,
  onInsertImage,
  documentId,
  organization,
  target,
  onInsertGenerated,
}: InsertImageDialogProps) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  // Which slot of the signature line a picture from the device is for.
  const slotRef = useRef<'signature' | 'stamp' | undefined>(undefined)
  const saved = useSavedImages(open)
  const take = useTakeSavedImage()
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const aiOffered = Boolean(onInsertGenerated && documentId && !target)
  const list = saved.data
  const inOrganization = Boolean(list?.canAddOwnSignature)
  const manager = Boolean(list?.canManage)
  const members = useOrganizationMembers(open && inOrganization && manager)
  const logoId = target ? null : (organization?.logoMediaId ?? null)
  const logo = useMediaUrls({ logo: open ? logoId : null })

  const insertSaved = async (item: SavedImage) => {
    setError(null)
    setPending(item.id)
    try {
      const used = await take.mutateAsync({ id: item.id, documentId })
      onInsertImage(used.dataUrl, used.name, used.kind)
      onClose()
    } catch {
      setError(t('images.insertFailed'))
    } finally {
      setPending(null)
    }
  }

  const insertLogo = async () => {
    if (!logoId) return
    setError(null)
    setPending('logo')
    try {
      const blob = await getRepositories().media.get(logoId)
      onInsertImage(await blobToDataUrl(blob), organization?.name || t('images.organizationLogo'), 'logo')
      onClose()
    } catch {
      setError(t('images.insertFailed'))
    } finally {
      setPending(null)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={target ? t('images.target.title', { party: target.partyLabel }) : t('images.title')}
      closeLabel={t('common.close')}
      width="lg"
    >
      <div className="insert-image">
        {target ? <p className="insert-image__intro">{t('images.target.intro')}</p> : null}
        <div className="insert-image__sources">
          {target ? (
            (['signature', 'stamp'] as const).map((slot) => (
              <Button
                key={slot}
                variant="secondary"
                icon={<ImagePlusIcon size={16} />}
                onClick={() => {
                  slotRef.current = slot
                  fileRef.current?.click()
                }}
                data-testid={`insert-image-device-${slot}`}
              >
                {t(slot === 'signature' ? 'images.target.deviceSignature' : 'images.target.deviceStamp')}
              </Button>
            ))
          ) : (
            <Button
              variant="secondary"
              icon={<ImagePlusIcon size={16} />}
              onClick={() => {
                slotRef.current = undefined
                fileRef.current?.click()
              }}
              data-testid="insert-image-device"
            >
              {t('images.fromDevice')}
            </Button>
          )}
          {onOpenTelegram && !target ? (
            <Button
              variant="secondary"
              icon={<PaperclipIcon size={16} />}
              onClick={() => {
                onClose()
                onOpenTelegram()
              }}
              data-testid="insert-image-telegram"
            >
              {t('images.fromTelegram')}
            </Button>
          ) : null}
          {aiOffered ? (
            <Button
              variant={drawing ? 'primary' : 'secondary'}
              icon={<SparkIcon size={16} />}
              aria-expanded={drawing}
              onClick={() => setDrawing((value) => !value)}
              data-testid="insert-image-ai"
            >
              {t('images.fromAi')}
            </Button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="insert-image__file"
            aria-label={t('images.fromDevice')}
            data-testid="insert-image-device-file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              onPickFile(file, slotRef.current)
              onClose()
            }}
          />
        </div>

        {aiOffered && drawing && documentId && onInsertGenerated ? (
          <section className="insert-image__ai" aria-labelledby="insert-image-ai">
            <h3 id="insert-image-ai">{t('aiImage.title')}</h3>
            <AiImagePanel
              documentId={documentId}
              purpose="illustration"
              onUse={async (picture, name) => {
                await onInsertGenerated(picture.dataUrl, name)
                onClose()
              }}
            />
          </section>
        ) : null}

        <section className="insert-image__saved" aria-labelledby="insert-image-saved">
          <div className="insert-image__head">
            <h3 id="insert-image-saved">{t('images.savedTitle')}</h3>
            {list && (list.canManage || list.canAddOwnSignature) && !adding ? (
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)} data-testid="saved-image-add">
                {manager ? t('images.add') : t('images.addOwnSignature')}
              </Button>
            ) : null}
          </div>
          <p className="insert-image__intro">{inOrganization ? t('images.introOrganization') : t('images.introPersonal')}</p>

          {adding && list ? (
            <AddSavedImageForm
              manager={manager}
              inOrganization={inOrganization}
              members={members.data ?? []}
              onDone={() => setAdding(false)}
            />
          ) : null}

          {error ? (
            <p className="insert-image__error" role="alert">
              {error}
            </p>
          ) : null}

          {saved.isLoading ? <p className="insert-image__intro">{t('common.loading')}</p> : null}
          {saved.isError ? (
            <p className="insert-image__error" role="alert">
              {t('images.loadFailed')}
            </p>
          ) : null}

          <ul className="insert-image__grid" role="list" data-testid="saved-images">
            {logoId ? (
              <li className="saved-image" data-testid="saved-image-org-logo">
                <span className="saved-image__thumb">{logo.urls.logo ? <img src={logo.urls.logo} alt="" /> : null}</span>
                <span className="saved-image__name">{t('images.organizationLogo')}</span>
                <span className="saved-image__meta">{t('images.fromProfile')}</span>
                <Button size="sm" variant="primary" loading={pending === 'logo'} onClick={() => void insertLogo()}>
                  {t('images.insert')}
                </Button>
              </li>
            ) : null}
            {(list?.items ?? []).map((item) => (
              <SavedImageCard
                key={item.id}
                item={item}
                members={members.data ?? []}
                pending={pending === item.id}
                onInsert={() => void insertSaved(item)}
              />
            ))}
          </ul>
          {list && list.items.length === 0 && !logoId ? <p className="insert-image__intro">{t('images.empty')}</p> : null}
        </section>
      </div>
    </Dialog>
  )
}

function SavedImageCard({ item, members, pending, onInsert }: { item: SavedImage; members: OrganizationMember[]; pending: boolean; onInsert: () => void }) {
  const { t } = useI18n()
  const preview = useSavedImagePreview(item.id, item.canUse)
  const remove = useDeleteSavedImage()
  const [editing, setEditing] = useState(false)
  const who = item.own
    ? item.ownerName
      ? t('images.ownerSignature', { name: item.ownerName })
      : t('images.onlyYou')
    : item.access === 'everyone'
      ? t('images.everyone')
      : t('images.onlyChosen')
  return (
    <li className={['saved-image', item.canUse ? null : 'saved-image--locked'].filter(Boolean).join(' ')} data-testid={`saved-image-${item.id}`}>
      <span className="saved-image__thumb">
        {item.canUse ? preview ? <img src={preview} alt="" /> : null : <ShieldIcon size={20} aria-hidden="true" />}
      </span>
      <span className="saved-image__name">{item.name}</span>
      <span className="saved-image__meta">
        {t(KIND_KEY[item.kind])} · {who}
      </span>
      {item.canUse ? (
        <Button size="sm" variant="primary" loading={pending} onClick={onInsert} data-testid="saved-image-insert">
          {t('images.insert')}
        </Button>
      ) : (
        <span className="saved-image__locked">{item.own ? t('images.lockedOwn') : t('images.locked')}</span>
      )}
      {item.canEdit || item.canDelete ? (
        <span className="saved-image__actions">
          {item.canEdit && !item.own ? (
            <Button size="sm" variant="ghost" icon={<UsersIcon size={14} />} onClick={() => setEditing((value) => !value)} data-testid="saved-image-access">
              {t('images.whoCanUse')}
            </Button>
          ) : null}
          {item.canDelete ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<TrashIcon size={14} />}
              aria-label={t('images.delete', { name: item.name })}
              loading={remove.isPending}
              onClick={() => {
                if (window.confirm(t('images.deleteConfirm', { name: item.name }))) remove.mutate(item.id)
              }}
              data-testid="saved-image-delete"
            />
          ) : null}
        </span>
      ) : null}
      {editing ? <AccessEditor item={item} members={members} onDone={() => setEditing(false)} /> : null}
    </li>
  )
}

/** Who may use an organization image: everyone, or the members chosen (owners and admins always may). */
function AccessChoice({
  access,
  allowed,
  members,
  onChange,
}: {
  access: SavedImageAccess
  allowed: string[]
  members: OrganizationMember[]
  onChange: (access: SavedImageAccess, allowed: string[]) => void
}) {
  const { t } = useI18n()
  const choosable = members.filter((member) => member.role === 'member')
  return (
    <fieldset className="saved-image-access">
      <legend>{t('images.whoCanUse')}</legend>
      <label>
        <input type="radio" checked={access === 'everyone'} onChange={() => onChange('everyone', allowed)} /> {t('images.everyone')}
      </label>
      <label>
        <input type="radio" checked={access === 'listed'} onChange={() => onChange('listed', allowed)} data-testid="saved-image-listed" />{' '}
        {t('images.onlyChosen')}
      </label>
      {access === 'listed' ? (
        <div className="saved-image-access__members">
          {choosable.length === 0 ? <p>{t('images.noMembers')}</p> : null}
          {choosable.map((member) => (
            <label key={member.userId}>
              <input
                type="checkbox"
                checked={allowed.includes(member.userId)}
                onChange={(event) =>
                  onChange('listed', event.target.checked ? [...allowed, member.userId] : allowed.filter((id) => id !== member.userId))
                }
              />{' '}
              {member.name || member.email}
            </label>
          ))}
          <p className="saved-image-access__note">{t('images.adminsAlways')}</p>
        </div>
      ) : null}
    </fieldset>
  )
}

function AccessEditor({ item, members, onDone }: { item: SavedImage; members: OrganizationMember[]; onDone: () => void }) {
  const { t } = useI18n()
  const update = useUpdateSavedImage()
  const [access, setAccess] = useState<SavedImageAccess>(item.access)
  const [allowed, setAllowed] = useState<string[]>(item.allowedUserIds ?? [])
  return (
    <div className="saved-image__editor">
      <AccessChoice
        access={access}
        allowed={allowed}
        members={members}
        onChange={(nextAccess, nextAllowed) => {
          setAccess(nextAccess)
          setAllowed(nextAllowed)
        }}
      />
      <Button
        size="sm"
        variant="primary"
        loading={update.isPending}
        onClick={() => update.mutate({ id: item.id, changes: { access, allowedUserIds: allowed } }, { onSuccess: onDone })}
        data-testid="saved-image-access-save"
      >
        {t('common.save')}
      </Button>
    </div>
  )
}

function AddSavedImageForm({
  manager,
  inOrganization,
  members,
  onDone,
}: {
  manager: boolean
  inOrganization: boolean
  members: OrganizationMember[]
  onDone: () => void
}) {
  const { t } = useI18n()
  const add = useAddSavedImage()
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<SavedImageKind>(manager ? 'stamp' : 'signature')
  const [name, setName] = useState('')
  const [own, setOwn] = useState(false)
  const [access, setAccess] = useState<SavedImageAccess>('listed')
  const [allowed, setAllowed] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cleanup, setCleanup] = useState<CleanupChoice>(DEFAULT_CLEANUP)
  // A photo of a stamp or signature is cleaned up by default; a logo or other picture is left as it is.
  const cleanupOn = cleanup.enabled ?? (kind === 'stamp' || kind === 'signature')
  // Organization images that owners and admins hand out; a person's own signature is theirs alone.
  const handedOut = inOrganization && manager && !(kind === 'signature' && own)

  const save = async () => {
    setError(null)
    if (!file || !name.trim()) {
      setError(t('images.addMissing'))
      return
    }
    try {
      let prepared: Blob
      if (cleanupOn) {
        const cleaned = await cleanedImageBlob(file, { strength: cleanup.strength, angle: cleanup.angle })
        if (!cleaned) {
          setError(t('images.cleanup.nothing'))
          return
        }
        prepared = cleaned
      } else {
        prepared = await preparePrintableImage(file)
      }
      const image = await blobToDataUrl(prepared)
      await add.mutateAsync({
        kind: manager ? kind : 'signature',
        name: name.trim(),
        image,
        ...(inOrganization ? { own: !manager || (kind === 'signature' && own) } : {}),
        ...(handedOut ? { access, allowedUserIds: access === 'listed' ? allowed : [] } : {}),
      })
      onDone()
    } catch (err) {
      setError(err instanceof ImagePrepareError ? t('images.prepareFailed') : t('images.addFailed'))
    }
  }

  return (
    <div className="saved-image-form" data-testid="saved-image-form">
      <label className="saved-image-form__file">
        <span>{t('images.file')}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          data-testid="saved-image-file"
        />
      </label>
      {manager ? (
        <Select
          id="saved-image-kind"
          label={t('images.kindLabel')}
          value={kind}
          options={SAVED_IMAGE_KINDS.map((value) => ({ value, label: t(KIND_KEY[value]) }))}
          onChange={(event) => setKind(event.target.value as SavedImageKind)}
        />
      ) : null}
      <StampCleanup file={file} enabled={cleanupOn} value={cleanup} onChange={setCleanup} />
      <Input
        id="saved-image-name"
        label={t('images.nameLabel')}
        hint={t('images.nameHint')}
        value={name}
        maxLength={80}
        onChange={(event) => setName(event.target.value)}
      />
      {inOrganization && manager && kind === 'signature' ? (
        <label className="saved-image-form__check">
          <input type="checkbox" checked={own} onChange={(event) => setOwn(event.target.checked)} /> {t('images.ownSignature')}
        </label>
      ) : null}
      {inOrganization && !manager ? <p className="saved-image-access__note">{t('images.ownSignatureNote')}</p> : null}
      {handedOut ? (
        <AccessChoice
          access={access}
          allowed={allowed}
          members={members}
          onChange={(nextAccess, nextAllowed) => {
            setAccess(nextAccess)
            setAllowed(nextAllowed)
          }}
        />
      ) : null}
      {error ? (
        <p className="insert-image__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="saved-image-form__actions">
        <Button variant="ghost" size="sm" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" size="sm" loading={add.isPending} onClick={() => void save()} data-testid="saved-image-save">
          {t('images.save')}
        </Button>
      </div>
    </div>
  )
}
