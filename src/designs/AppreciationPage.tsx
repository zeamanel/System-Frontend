import { useI18n } from '../i18n'
import { FieldText } from './Placeholder'
import type { DesignPageProps } from './types'

const SERIF_ETHIOPIC = "'Noto Serif Ethiopic', 'Noto Serif', serif"
const SERIF = "'Noto Serif', 'Noto Serif Ethiopic', serif"
const SANS = "'Noto Sans', 'Noto Serif Ethiopic', sans-serif"

function Rosette({ accent, primary }: { accent: string; primary: string }) {
  const petals = Array.from({ length: 16 }, (_, index) => index * 22.5)
  return (
    <svg width="120" height="150" viewBox="0 0 120 150" aria-hidden="true">
      <path d="M38 88 L24 148 L44 134 L56 148 L60 92 Z" fill={accent} opacity="0.85" />
      <path d="M82 88 L96 148 L76 134 L64 148 L60 92 Z" fill={accent} />
      {petals.map((angle) => (
        <ellipse key={angle} cx="60" cy="24" rx="9" ry="20" fill={accent} transform={`rotate(${angle} 60 60)`} />
      ))}
      <circle cx="60" cy="60" r="34" fill={primary} stroke="#ffffff" strokeWidth="2" />
      <circle cx="60" cy="60" r="27" fill="none" stroke={accent} strokeWidth="1.5" />
      <text x="60" y="66" textAnchor="middle" fontFamily={SERIF_ETHIOPIC} fontSize="16" fontWeight="700" fill="#ffffff">
        ምስጋና
      </text>
    </svg>
  )
}

/** Certificate of appreciation (የምስጋና ምስክር ወረቀት), A4 landscape, with a coloured side panel. */
export function AppreciationPage({ content, theme, showPlaceholders, imageUrls }: DesignPageProps) {
  const { t } = useI18n()
  const f = content.fields
  const field = (id: string, labelKey: Parameters<typeof t>[0]) => (
    <FieldText value={f[id]} placeholder={t(labelKey)} showPlaceholders={showPlaceholders} />
  )
  const showSeal = content.options.seal !== false

  return (
    <div className="design-page design-appreciation" style={{ width: 1123, height: 794, fontFamily: SERIF }}>
      <aside
        className="design-appreciation__panel"
        style={{
          background: `repeating-linear-gradient(135deg, ${theme.primary} 0 18px, ${theme.primary}e6 18px 19px), ${theme.primary}`,
        }}
      >
        <div className="design-stack" style={{ gap: 14 }}>
          {imageUrls.logo ? (
            <span className="design-appreciation__logo">
              <img src={imageUrls.logo} alt="" />
            </span>
          ) : (
            <div className="design-monogram" style={{ width: 84, height: 84, background: theme.accent, fontFamily: SANS, fontSize: 22 }}>
              {(f.monogram ?? '').trim().slice(0, 4) || (showPlaceholders ? '◆' : '')}
            </div>
          )}
          <span style={{ fontFamily: SERIF_ETHIOPIC, fontWeight: 700, fontSize: 19, lineHeight: 1.35, color: '#ffffff' }}>
            {field('orgNameAm', 'designs.field.orgNameAm')}
          </span>
          <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', color: '#f3e6c4' }}>
            {field('orgNameEn', 'designs.field.orgNameEn')}
          </span>
        </div>
        {showSeal ? <Rosette accent={theme.accent} primary={theme.primary} /> : <span />}
      </aside>
      <div className="design-appreciation__edge" style={{ background: theme.accent }} aria-hidden="true" />

      <div className="design-appreciation__content">
        <div className="design-stack" style={{ alignSelf: 'flex-end', alignItems: 'flex-end', gap: 2, fontFamily: SANS, fontSize: 12, color: '#5b574c' }}>
          <span>ቁጥር · No.</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1c1b17' }}>{field('certificateNo', 'designs.field.certificateNo')}</span>
        </div>

        <div className="design-stack" style={{ gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: SERIF_ETHIOPIC, fontWeight: 700, fontSize: 46, lineHeight: 1.15, color: theme.primary }}>
            {field('titleAm', 'designs.field.titleAm')}
          </h1>
          <span style={{ fontSize: 17, letterSpacing: 5, textTransform: 'uppercase', fontWeight: 600, color: theme.accentText }}>
            {field('titleEn', 'designs.field.titleEn')}
          </span>
        </div>

        <div className="design-stack" style={{ gap: 4 }}>
          <span style={{ fontFamily: SERIF_ETHIOPIC, fontSize: 16, color: '#3b3830' }}>{field('awardedAm', 'designs.field.awardedAm')}</span>
          <span style={{ fontSize: 14, fontStyle: 'italic', color: '#5b574c' }}>{field('awardedEn', 'designs.field.awardedEn')}</span>
          <span style={{ marginTop: 10, fontFamily: SERIF_ETHIOPIC, fontWeight: 700, fontSize: 42, lineHeight: 1.2, color: '#1c1b17' }}>
            {field('recipientAm', 'designs.field.recipientAm')}
          </span>
          <span style={{ fontSize: 24, fontStyle: 'italic', color: '#2c2a24' }}>{field('recipientEn', 'designs.field.recipientEn')}</span>
          <span style={{ marginTop: 8, width: 360, height: 2, background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)` }} aria-hidden="true" />
        </div>

        <div className="design-stack" style={{ gap: 6, maxWidth: 620, alignSelf: 'center' }}>
          <p style={{ margin: 0, fontFamily: SERIF_ETHIOPIC, fontSize: 16, lineHeight: 1.6, color: '#2c2a24' }}>{field('bodyAm', 'designs.field.bodyAm')}</p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#3b3830' }}>{field('bodyEn', 'designs.field.bodyEn')}</p>
          <p style={{ margin: '4px 0 0', fontFamily: SANS, fontSize: 13, color: '#5b574c' }}>{field('placeDate', 'designs.field.placeDate')}</p>
        </div>

        <div className="design-appreciation__signatures">
          {(['signer1', 'signer2'] as const).map((signer, index) => (
            <div key={signer} className="design-stack" style={{ gap: 4 }}>
              <span style={{ height: 28 }} aria-hidden="true" />
              <span style={{ width: 210, height: 1, background: '#1c1b17' }} aria-hidden="true" />
              <span style={{ fontFamily: SERIF_ETHIOPIC, fontSize: 14, fontWeight: 600 }}>
                {field(`${signer}Name`, index === 0 ? 'designs.field.signer1Name' : 'designs.field.signer2Name')}
              </span>
              <span style={{ fontFamily: SANS, fontSize: 12, color: '#5b574c' }}>
                {field(`${signer}Role`, index === 0 ? 'designs.field.signer1Role' : 'designs.field.signer2Role')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
