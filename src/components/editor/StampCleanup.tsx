import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { detectSkew, prepareCleanup, renderCleanup, type CleanupChoice, type Pixels, type Prepared } from '../../lib/media/cleanup'
import { decodeToPixels, drawPixels } from '../../lib/media/cleanup-browser'

/** The preview works on a small copy: moving a slider stays quick. */
const PREVIEW_SIDE = 480

/**
 * Clean-up for a photo of a stamp or signature on paper: remove the paper
 * background, straighten, trim. Shows the result on a see-through background
 * while the settings change; the saved picture is made from the full-size
 * photo (cleanedImageBlob).
 */
export function StampCleanup({
  file,
  enabled,
  value,
  onChange,
}: {
  file: File | null
  /** Whether the clean-up applies (the choice, or the kind's default). */
  enabled: boolean
  value: CleanupChoice
  onChange: (value: CleanupChoice) => void
}) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [source, setSource] = useState<Pixels | null>(null)
  const [failed, setFailed] = useState(false)
  const [straightNote, setStraightNote] = useState(false)

  useEffect(() => {
    setSource(null)
    setFailed(false)
    setStraightNote(false)
    if (!file) return
    let current = true
    decodeToPixels(file, PREVIEW_SIDE)
      .then((px) => {
        if (current) setSource(px)
      })
      .catch(() => {
        if (current) setFailed(true)
      })
    return () => {
      current = false
    }
  }, [file])

  const prepared = useMemo<Prepared | null>(() => (source && enabled ? prepareCleanup(source) : null), [source, enabled])
  const cleaned = useMemo(
    () => (prepared ? renderCleanup(prepared, { strength: value.strength, angle: value.angle }) : null),
    [prepared, value.strength, value.angle],
  )

  // The picture shown: the cleaned one, or the original while the clean-up is off.
  const shown = enabled ? cleaned : source
  useEffect(() => {
    if (canvasRef.current && shown) drawPixels(canvasRef.current, shown)
  }, [shown])

  const straighten = () => {
    if (!prepared) return
    const level = renderCleanup(prepared, { strength: value.strength, angle: 0 })
    const turn = level ? detectSkew(level) : 0
    setStraightNote(turn === 0)
    onChange({ ...value, angle: turn })
  }

  return (
    <fieldset className="stamp-cleanup" data-testid="stamp-cleanup">
      <legend>{t('images.cleanup.title')}</legend>
      <label className="stamp-cleanup__check">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
          data-testid="stamp-cleanup-enabled"
        />{' '}
        {t('images.cleanup.remove')}
      </label>
      <p className="stamp-cleanup__hint">{t('images.cleanup.hint')}</p>
      {file && enabled ? (
        <div className="stamp-cleanup__controls">
          <label className="stamp-cleanup__slider">
            <span>{t('images.cleanup.strength')}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(value.strength * 100)}
              onChange={(event) => onChange({ ...value, strength: Number(event.target.value) / 100 })}
              data-testid="stamp-cleanup-strength"
            />
          </label>
          <label className="stamp-cleanup__slider">
            <span>
              {t('images.cleanup.angle')} <output>{value.angle > 0 ? '+' : ''}{value.angle.toFixed(1)}°</output>
            </span>
            <input
              type="range"
              min={-20}
              max={20}
              step={0.5}
              value={value.angle}
              onChange={(event) => {
                setStraightNote(false)
                onChange({ ...value, angle: Number(event.target.value) })
              }}
              data-testid="stamp-cleanup-angle"
            />
          </label>
          <button type="button" className="stamp-cleanup__auto" onClick={straighten} disabled={!prepared} data-testid="stamp-cleanup-auto">
            {t('images.cleanup.auto')}
          </button>
          {straightNote ? <span className="stamp-cleanup__note" role="status">{t('images.cleanup.levelAlready')}</span> : null}
        </div>
      ) : null}
      {file ? (
        <div className="stamp-cleanup__preview" aria-label={t('images.cleanup.preview')}>
          {failed ? <span>{t('images.prepareFailed')}</span> : !source ? <span>{t('images.cleanup.reading')}</span> : enabled && !cleaned ? <span role="alert">{t('images.cleanup.nothing')}</span> : null}
          <canvas ref={canvasRef} hidden={!shown} data-testid="stamp-cleanup-preview" />
        </div>
      ) : null}
    </fieldset>
  )
}
