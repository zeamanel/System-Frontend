import './AiImagePanel.css'

import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import {
  AI_IMAGE_ASPECTS,
  AI_IMAGE_STYLES,
  AiImageError,
  createAiImages,
  type AiImageAspect,
  type AiImagePurpose,
  type AiImageStyle,
  type AiPicture,
} from '../../lib/ai-image/client'
import { pictureName } from '../../lib/media/ai-picture'
import { Button, Select, Textarea } from '../ui'
import { SparkIcon } from '../icons'

export interface AiImagePanelProps {
  documentId: string
  purpose: AiImagePurpose
  /** Puts the chosen picture in (named from the description); the panel shows it busy meanwhile. */
  onUse: (picture: AiPicture, name: string) => void | Promise<void>
}

const STYLE_KEY: Record<AiImageStyle, MessageKey> = {
  illustration: 'aiImage.style.illustration',
  watercolour: 'aiImage.style.watercolour',
  photo: 'aiImage.style.photo',
  line: 'aiImage.style.line',
  flat: 'aiImage.style.flat',
}

const SHAPE_KEY: Record<AiImageAspect, MessageKey> = {
  '4:3': 'aiImage.shape.landscape',
  '3:4': 'aiImage.shape.portrait',
  '1:1': 'aiImage.shape.square',
  '16:9': 'aiImage.shape.wide',
  '9:16': 'aiImage.shape.tall',
}

function errorKey(error: unknown): MessageKey {
  if (!(error instanceof AiImageError)) return 'aiImage.error.unavailable'
  switch (error.reason) {
    case 'demo':
      return 'aiImage.error.demo'
    case 'not-allowed':
      return 'aiImage.error.notAllowed'
    case 'quota':
      return 'aiImage.error.quota'
    case 'rate-limit':
      return 'aiImage.error.rateLimit'
    case 'refused':
      switch (error.refusal) {
        case 'official_mark':
          return 'aiImage.refused.officialMark'
        case 'identity_document':
          return 'aiImage.refused.identityDocument'
        case 'money':
          return 'aiImage.refused.money'
        case 'real_person':
          return 'aiImage.refused.realPerson'
        case 'filtered':
          return 'aiImage.refused.filtered'
        default:
          return 'aiImage.refused.unsafe'
      }
    default:
      return 'aiImage.error.unavailable'
  }
}

/**
 * A picture made from a description: a book illustration, or a design's
 * logo. Two to choose from; the one picked goes in like a picture from the
 * device. The server refuses stamps, signatures, ID documents, money and
 * real people, and every picture uses AI credits, as the panel says.
 */
export function AiImagePanel({ documentId, purpose, onUse }: AiImagePanelProps) {
  const { t } = useI18n()
  const logo = purpose === 'logo'
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState<AiImageStyle>('illustration')
  const [aspect, setAspect] = useState<AiImageAspect>('4:3')
  const [pictures, setPictures] = useState<AiPicture[]>([])
  const [credits, setCredits] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [using, setUsing] = useState<number | null>(null)
  const [error, setError] = useState<MessageKey | null>(null)
  const ready = description.trim().length >= 3 && !pending

  const create = async () => {
    setError(null)
    setPending(true)
    try {
      const result = await createAiImages({
        documentId,
        description: description.trim(),
        purpose,
        ...(logo ? { aspect: '1:1' as const } : { style, aspect }),
        count: 2,
      })
      setPictures(result.images)
      setCredits(result.credits)
    } catch (caught) {
      setError(errorKey(caught))
    } finally {
      setPending(false)
    }
  }

  const use = async (picture: AiPicture, index: number) => {
    setError(null)
    setUsing(index)
    try {
      await onUse(picture, pictureName(description))
    } catch {
      setError('aiImage.useFailed')
    } finally {
      setUsing(null)
    }
  }

  return (
    <div className="ai-image" data-testid="ai-image-panel">
      <Textarea
        id={`ai-image-description-${purpose}`}
        label={t('aiImage.describe')}
        hint={t(logo ? 'aiImage.describeLogoHint' : 'aiImage.describeHint')}
        rows={3}
        maxLength={1000}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        data-testid="ai-image-description"
      />
      {logo ? null : (
        <div className="ai-image__choices">
          <Select
            id="ai-image-style"
            label={t('aiImage.style')}
            value={style}
            options={AI_IMAGE_STYLES.map((value) => ({ value, label: t(STYLE_KEY[value]) }))}
            onChange={(event) => setStyle(event.target.value as AiImageStyle)}
          />
          <Select
            id="ai-image-shape"
            label={t('aiImage.shape')}
            value={aspect}
            options={AI_IMAGE_ASPECTS.map((value) => ({ value, label: t(SHAPE_KEY[value]) }))}
            onChange={(event) => setAspect(event.target.value as AiImageAspect)}
          />
        </div>
      )}
      <p className="ai-image__rules">{t('aiImage.rules')}</p>
      <div className="ai-image__actions">
        <Button variant="primary" icon={<SparkIcon size={16} />} loading={pending} disabled={!ready} onClick={() => void create()} data-testid="ai-image-create">
          {pending ? t('aiImage.creating') : pictures.length > 0 ? t('aiImage.again') : t('aiImage.create')}
        </Button>
        {credits !== null && !pending ? <span className="ai-image__credits">{t('aiImage.credits', { credits })}</span> : null}
      </div>
      {error ? (
        <p className="ai-image__error" role="alert">
          {t(error)}
        </p>
      ) : null}
      {pictures.length > 0 ? (
        <ul className={['ai-image__results', logo ? 'ai-image__results--logo' : null].filter(Boolean).join(' ')} role="list" data-testid="ai-image-results">
          {pictures.map((picture, index) => (
            <li key={picture.dataUrl.slice(-40) + index} className="ai-image__result">
              <img src={picture.dataUrl} alt={t('aiImage.option', { n: index + 1 })} />
              <Button size="sm" variant="secondary" loading={using === index} disabled={using !== null} onClick={() => void use(picture, index)} data-testid="ai-image-use">
                {t(logo ? 'aiImage.useLogo' : 'aiImage.use')}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
