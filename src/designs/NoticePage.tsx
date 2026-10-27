import { useI18n } from '../i18n'
import { FieldText } from './Placeholder'
import { lines } from './text'
import type { DesignPageProps } from './types'

const SERIF_ETHIOPIC = "'Noto Serif Ethiopic', 'Noto Serif', serif"
const SANS = "'Noto Sans', 'Noto Serif Ethiopic', sans-serif"

function DetailList({ value, placeholder, showPlaceholders }: { value: string | undefined; placeholder: string; showPlaceholders: boolean }) {
  const items = lines(value)
  if (items.length === 0) {
    return showPlaceholders ? <p className="design-placeholder" style={{ margin: 0 }}>[{placeholder}]</p> : null
  }
  return (
    <ul className="design-list">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

export function NoticePage({ content, theme, showPlaceholders, imageUrls }: DesignPageProps) {
  const { t } = useI18n()
  const f = content.fields
  const field = (id: string, labelKey: Parameters<typeof t>[0]) => (
    <FieldText value={f[id]} placeholder={t(labelKey)} showPlaceholders={showPlaceholders} />
  )
  const showStampBox = content.options.stampBox !== false

  return (
    <div className="design-page design-notice" style={{ width: 794, height: 1123, fontFamily: SANS }}>
      <header className="design-notice__band" style={{ background: theme.primary }}>
        {imageUrls.logo ? (
          <span className="design-notice__logo">
            <img src={imageUrls.logo} alt="" />
          </span>
        ) : null}
        <div className="design-stack" style={{ alignItems: 'flex-start', gap: 4, flex: 1 }}>
          <span style={{ fontFamily: SERIF_ETHIOPIC, fontWeight: 700, fontSize: 24, color: '#ffffff' }}>
            {field('orgNameAm', 'designs.field.orgNameAm')}
          </span>
          <span style={{ fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: '#f3e6c4' }}>
            {field('orgNameEn', 'designs.field.orgNameEn')}
          </span>
        </div>
        <div className="design-stack" style={{ alignItems: 'flex-end', gap: 2, fontSize: 12, color: '#f3e6c4' }}>
          <span>ቁጥር · Ref.</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>{field('noticeNo', 'designs.field.noticeNo')}</span>
        </div>
      </header>
      <div style={{ height: 6, background: theme.accent }} aria-hidden="true" />

      <div className="design-notice__body">
        <div className="design-stack" style={{ gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: SERIF_ETHIOPIC, fontWeight: 700, fontSize: 54, lineHeight: 1.15, color: theme.primary }}>
            {field('headlineAm', 'designs.field.headlineAm')}
          </h1>
          <span style={{ fontSize: 20, letterSpacing: 5, textTransform: 'uppercase', fontWeight: 600, color: theme.accentText }}>
            {field('headlineEn', 'designs.field.headlineEn')}
          </span>
        </div>

        <div className="design-notice__position" style={{ borderColor: theme.primary }}>
          <span style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#5b574c' }}>የሥራ መደብ · Position</span>
          <span style={{ fontFamily: SERIF_ETHIOPIC, fontSize: 30, fontWeight: 700, color: '#1c1b17' }}>
            {field('positionAm', 'designs.field.positionAm')}
          </span>
          <span style={{ fontSize: 19, color: '#2c2a24' }}>{field('positionEn', 'designs.field.positionEn')}</span>
        </div>

        <div className="design-notice__details">
          <section className="design-stack" style={{ alignItems: 'stretch', gap: 8, textAlign: 'left', fontFamily: SERIF_ETHIOPIC }}>
            <h2 style={{ margin: 0, fontSize: 18, color: theme.primary }}>ዝርዝር መረጃ</h2>
            <DetailList value={f.detailsAm} placeholder={t('designs.field.detailsAm')} showPlaceholders={showPlaceholders} />
          </section>
          <section className="design-stack" style={{ alignItems: 'stretch', gap: 8, textAlign: 'left' }}>
            <h2 style={{ margin: 0, fontSize: 18, color: theme.primary }}>Details</h2>
            <DetailList value={f.detailsEn} placeholder={t('designs.field.detailsEn')} showPlaceholders={showPlaceholders} />
          </section>
        </div>

        <div className="design-notice__deadline" style={{ background: `${theme.accent}26`, borderColor: theme.accent }}>
          <span style={{ fontFamily: SERIF_ETHIOPIC, fontWeight: 600 }}>የማመልከቻ ጊዜ ገደብ · Application deadline</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: theme.primary }}>{field('deadline', 'designs.field.deadline')}</span>
        </div>

        <div className="design-notice__footer-row">
          <div className="design-stack" style={{ alignItems: 'flex-start', gap: 4, textAlign: 'left' }}>
            <span style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#5b574c' }}>አድራሻ · Contact</span>
            {lines(f.contact).length > 0 ? (
              lines(f.contact).map((line, index) => (
                <span key={index} style={{ fontSize: 15, color: '#1c1b17' }}>
                  {line}
                </span>
              ))
            ) : (
              <span style={{ fontSize: 15 }}>{field('contact', 'designs.field.contact')}</span>
            )}
            <span style={{ marginTop: 6, fontSize: 13, color: '#5b574c' }}>{field('issuedDate', 'designs.field.issuedDate')}</span>
          </div>
          {showStampBox ? (
            <div className="design-notice__stamp">
              <span>ማኅተም እና ፊርማ</span>
              <span>Stamp &amp; signature</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="design-notice__bottom" style={{ background: theme.primary }} aria-hidden="true" />
    </div>
  )
}
