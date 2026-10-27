import { useI18n } from '../i18n'
import { FieldText } from './Placeholder'
import { lines } from './text'
import type { DesignPageProps } from './types'

const SERIF_ETHIOPIC = "'Noto Serif Ethiopic', 'Noto Serif', serif"
const SANS = "'Noto Sans', 'Noto Serif Ethiopic', sans-serif"

function Paragraphs({ value, placeholder, showPlaceholders, font }: { value: string | undefined; placeholder: string; showPlaceholders: boolean; font: string }) {
  const paragraphs = lines(value)
  if (paragraphs.length === 0) {
    return showPlaceholders ? <p className="design-placeholder" style={{ margin: 0 }}>[{placeholder}]</p> : null
  }
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="design-announcement__paragraph" style={{ fontFamily: font }}>
          {paragraph}
        </p>
      ))}
    </>
  )
}

/** General announcement or meeting notice (ማስታወቂያ / የስብሰባ ጥሪ), A4 portrait. */
export function AnnouncementPage({ content, theme, showPlaceholders, imageUrls }: DesignPageProps) {
  const { t } = useI18n()
  const f = content.fields
  const field = (id: string, labelKey: Parameters<typeof t>[0]) => (
    <FieldText value={f[id]} placeholder={t(labelKey)} showPlaceholders={showPlaceholders} />
  )
  const details = [
    { id: 'eventDate', label: 'ቀን · Date', labelKey: 'designs.field.eventDate' as const },
    { id: 'eventTime', label: 'ሰዓት · Time', labelKey: 'designs.field.eventTime' as const },
    { id: 'venue', label: 'ቦታ · Venue', labelKey: 'designs.field.venue' as const },
  ].filter((detail) => showPlaceholders || f[detail.id]?.trim())
  const showDetails = content.options.details !== false && details.length > 0
  const showStampBox = content.options.stampBox !== false

  return (
    <div className="design-page design-announcement" style={{ width: 794, height: 1123, fontFamily: SANS }}>
      <div style={{ height: 14, background: theme.primary }} aria-hidden="true" />
      <header className="design-announcement__header">
        {imageUrls.logo ? <img className="design-logo" src={imageUrls.logo} alt="" style={{ maxHeight: 80 }} /> : null}
        <span style={{ fontFamily: SERIF_ETHIOPIC, fontWeight: 700, fontSize: 24, color: theme.primary }}>
          {field('orgNameAm', 'designs.field.orgNameAm')}
        </span>
        <span style={{ fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: '#5b574c' }}>
          {field('orgNameEn', 'designs.field.orgNameEn')}
        </span>
      </header>
      <div className="design-announcement__rule" style={{ background: theme.accent }} aria-hidden="true" />

      <div className="design-announcement__meta">
        <span>
          ቁጥር · Ref. <strong>{field('noticeNo', 'designs.field.noticeNo')}</strong>
        </span>
        <span>
          ቀን · Date <strong>{field('issuedDate', 'designs.field.issuedDate')}</strong>
        </span>
      </div>

      <div className="design-announcement__body">
        <div className="design-stack" style={{ gap: 4 }}>
          <h1 style={{ margin: 0, fontFamily: SERIF_ETHIOPIC, fontWeight: 700, fontSize: 58, lineHeight: 1.1, color: theme.primary }}>
            {field('headlineAm', 'designs.field.headlineAm')}
          </h1>
          <span style={{ fontSize: 18, letterSpacing: 6, textTransform: 'uppercase', fontWeight: 600, color: theme.accentText }}>
            {field('headlineEn', 'designs.field.headlineEn')}
          </span>
        </div>

        <div className="design-announcement__subject" style={{ background: theme.primary }}>
          <span style={{ fontFamily: SERIF_ETHIOPIC, fontSize: 20, fontWeight: 700 }}>{field('subjectAm', 'designs.field.subjectAm')}</span>
          <span style={{ fontSize: 15, color: '#f3e6c4' }}>{field('subjectEn', 'designs.field.subjectEn')}</span>
        </div>

        <div className="design-announcement__text">
          <Paragraphs value={f.bodyAm} placeholder={t('designs.field.announcementAm')} showPlaceholders={showPlaceholders} font={SERIF_ETHIOPIC} />
          {lines(f.bodyAm).length > 0 && lines(f.bodyEn).length > 0 ? (
            <span className="design-announcement__divider" style={{ background: theme.accent }} aria-hidden="true" />
          ) : null}
          <Paragraphs value={f.bodyEn} placeholder={t('designs.field.announcementEn')} showPlaceholders={showPlaceholders} font={SANS} />
        </div>

        {showDetails ? (
          <div className="design-announcement__details" style={{ gridTemplateColumns: `repeat(${details.length}, minmax(0, 1fr))` }}>
            {details.map((detail) => (
              <div key={detail.id} className="design-announcement__detail" style={{ borderColor: theme.accent, background: `${theme.accent}1a` }}>
                <span style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: '#5b574c' }}>{detail.label}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: theme.primary }}>{field(detail.id, detail.labelKey)}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="design-notice__footer-row">
          <div className="design-stack" style={{ alignItems: 'flex-start', gap: 4, textAlign: 'left' }}>
            <span style={{ height: 34 }} aria-hidden="true" />
            <span style={{ width: 220, height: 1, background: '#1c1b17' }} aria-hidden="true" />
            <span style={{ fontFamily: SERIF_ETHIOPIC, fontSize: 15, fontWeight: 600 }}>{field('signer1Name', 'designs.field.signer1Name')}</span>
            <span style={{ fontSize: 13, color: '#5b574c' }}>{field('signer1Role', 'designs.field.signer1Role')}</span>
          </div>
          {showStampBox ? (
            <div className="design-notice__stamp">
              <span>ማኅተም</span>
              <span>Stamp</span>
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ height: 14, background: theme.primary }} aria-hidden="true" />
    </div>
  )
}
