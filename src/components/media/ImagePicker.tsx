import './ImagePicker.css'

import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../../i18n'
import type { MediaKind, MediaRecord } from '../../lib/repositories'
import { ACCEPTED_IMAGE_TYPES } from '../../lib/media/prepare'
import { imageErrorKey } from '../../lib/media/errors'
import { useUploadMedia } from '../../hooks/use-media'
import { Button, useToast } from '../ui'
import { TrashIcon, UploadIcon } from '../icons'

export interface ImagePickerProps {
  kind: MediaKind
  /** Blob URL of the current image, if any. */
  imageUrl?: string
  /** The current image could not be loaded. */
  failed?: boolean
  alt: string
  uploadLabel: string
  replaceLabel: string
  removeLabel: string
  emptyLabel: string
  onUploaded: (record: MediaRecord) => void | Promise<void>
  onRemove?: () => void
  disabled?: boolean
  /** Extra actions beside Upload/Remove. */
  children?: ReactNode
  testId?: string
}

/** Preview plus Upload/Replace/Remove for one image (logo or photo). */
export function ImagePicker({
  kind,
  imageUrl,
  failed,
  alt,
  uploadLabel,
  replaceLabel,
  removeLabel,
  emptyLabel,
  onUploaded,
  onRemove,
  disabled,
  children,
  testId,
}: ImagePickerProps) {
  const { t } = useI18n()
  const toast = useToast()
  const upload = useUploadMedia()
  const input = useRef<HTMLInputElement | null>(null)
  const hasImage = Boolean(imageUrl) || Boolean(failed)

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    try {
      const record = await upload.mutateAsync({ file, kind })
      await onUploaded(record)
    } catch (error) {
      toast.push(t(imageErrorKey(error)), { variant: 'error' })
    }
  }

  return (
    <div className={`image-picker image-picker--${kind}`} data-testid={testId}>
      <div className="image-picker__preview" aria-live="polite">
        {imageUrl ? (
          <img src={imageUrl} alt={alt} />
        ) : (
          <span className="image-picker__empty">{failed ? t('designs.image.loadFailed') : emptyLabel}</span>
        )}
      </div>
      <div className="image-picker__actions">
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            void handleFile(file)
          }}
          data-testid={testId ? `${testId}-input` : undefined}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<UploadIcon size={16} />}
          loading={upload.isPending}
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? t('media.uploading') : hasImage ? replaceLabel : uploadLabel}
        </Button>
        {hasImage && onRemove ? (
          <Button type="button" size="sm" variant="ghost" icon={<TrashIcon size={16} />} disabled={disabled || upload.isPending} onClick={onRemove}>
            {removeLabel}
          </Button>
        ) : null}
        {children}
      </div>
    </div>
  )
}
