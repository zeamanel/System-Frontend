import { useI18n } from '../i18n'
import { FieldText } from './Placeholder'
import type { DesignPageProps } from './types'

const SERIF_ETHIOPIC = "'Noto Serif Ethiopic', 'Noto Serif', serif"
const SERIF = "'Noto Serif', 'Noto Serif Ethiopic', serif"
const SANS = "'Noto Sans', 'Noto Serif Ethiopic', sans-serif"

function Corner({ color, flip }: { color: string; flip: string }) {
  return (
    <svg className="design-corner" style={{ transform: flip }} width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
      <path d="M10 86 V30 Q10 10 30 10 H86" fill="none" stroke={color} strokeWidth="2.5" />
      <path d="M22 86 V38 Q22 22 38 22 H86" fill="none" stroke={color} strokeWidth="1.2" />
      <rect x="22" y="22" width="14" height="14" transform="rotate(45 29 29)" fill={color} />
    </svg>
  )
}

function Seal({ primary, accent, label }: { primary: string; accent: string; label: string }) {
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label="Seal">
      <defs>
        <path id="design-seal-ring" d="M66 66 m-46 0 a46 46 0 1 1 92 0 a46 46 0 1 1 -92 0" />
      </defs>
      <circle cx="66" cy="66" r="62" fill={primary} />
      <circle cx="66" cy="66" r="57" fill="none" stroke={accent} strokeWidth="2" />
      <circle cx="66" cy="66" r="34" fill="none" stroke={accent} strokeWidth="1.2" />
      <text fontFamily={SANS} fontSize="10" fontWeight="600" letterSpacing="1.4" fill="#fbf8f0">
        <textPath href="#design-seal-ring">{label}</textPath>
      </text>
      <text x="66" y="70" textAnchor="middle" fontFamily={SERIF_ETHIOPIC} fontSize="15" fontWeight="700" fill={accent}>
        ማኅተም
      </text>
    </svg>
  )
}

export function CertificatePage({ content, theme, showPlaceholders }: DesignPageProps) {
  const { t } = useI18n()
  const f = content.fields
  const field = (id: string, labelKey: Parameters<typeof t>[0]) => (
    <FieldText value={f[id]} placeholder={t(labelKey)} showPlaceholders={showPlaceholders} />
  )
  const showSeal = content.options.seal !== false
  const sealLabel = [f.orgNameEn, f.orgNameAm].filter((v) => v?.trim()).join(' · ').toUpperCase().slice(0, 60)

  return (
    <div className="design-page design-certificate" style={{ width: 1123, height: 794, fontFamily: SERIF }}>
      <div className="design-frame" style={{ inset: 22, border: `10px solid ${theme.primary}` }} aria-hidden="true" />
      <div className="design-frame" style={{ inset: 40, border: `2px solid ${theme.accent}` }} aria-hidden="true" />
      <div className="design-frame" style={{ inset: 46, border: `1px solid ${theme.accent}`, opacity: 0.55 }} aria-hidden="true" />
      <div className="design-corner-wrap" style={{ left: 30, top: 30 }}>
        <Corner color={theme.accent} flip="none" />
      </div>
      <div className="design-corner-wrap" style={{ right: 30, top: 30 }}>
        <Corner color={theme.accent} flip="scaleX(-1)" />
      </div>
      <div className="design-corner-wrap" style={{ left: 30, bottom: 30 }}>
        <Corner color={theme.accent} flip="scaleY(-1)" />
      </div>
      <div className="design-corner-wrap" style={{ right: 30, bottom: 30 }}>
        <Corner color={theme.accent} flip="scale(-1, -1)" />
      </div>

      <div className="design-certificate__content">
        <div className="design-row">
          <div className="design-row" style={{ gap: 14, justifyContent: 'flex-start' }}>
            <div className="design-monogram" style={{ background: theme.primary, fontFamily: SANS }}>
              {(f.monogram ?? '').trim().slice(0, 4) || (showPlaceholders ? '◆' : '')}
            </div>
            <div className="design-stack" style={{ gap: 2, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: SERIF_ETHIOPIC, fontWeight: 700, fontSize: 17, color: theme.primary }}>
                {field('orgNameAm', 'designs.field.orgNameAm')}
              </span>
              <span style={{ fontFamily: SANS, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: '#5b574c' }}>
                {field('orgNameEn', 'designs.field.orgNameEn')}
              </span>
            </div>
          </div>
          <div className="design-stack" style={{ alignItems: 'flex-end', gap: 2, fontFamily: SANS, fontSize: 12, color: '#5b574c' }}>
            <span>ቁጥር · No.</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1c1b17' }}>{field('certificateNo', 'designs.field.certificateNo')}</span>
          </div>
        </div>

        <div className="design-stack" style={{ gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: SERIF_ETHIOPIC, fontWeight: 700, fontSize: 50, lineHeight: 1.15, color: theme.primary }}>
            {field('titleAm', 'designs.field.titleAm')}
          </h1>
          <div className="design-row" style={{ gap: 14, justifyContent: 'center' }}>
            <span style={{ width: 64, height: 1, background: theme.accent }} aria-hidden="true" />
            <span style={{ fontSize: 18, letterSpacing: 6, textTransform: 'uppercase', color: theme.accentText, fontWeight: 600 }}>
              {field('titleEn', 'designs.field.titleEn')}
            </span>
            <span style={{ width: 64, height: 1, background: theme.accent }} aria-hidden="true" />
          </div>
        </div>

        <div className="design-stack" style={{ gap: 4 }}>
          <span style={{ fontFamily: SERIF_ETHIOPIC, fontSize: 17, color: '#3b3830' }}>{field('awardedAm', 'designs.field.awardedAm')}</span>
          <span style={{ fontSize: 15, fontStyle: 'italic', color: '#5b574c' }}>{field('awardedEn', 'designs.field.awardedEn')}</span>
          <span style={{ marginTop: 8, fontFamily: SERIF_ETHIOPIC, fontWeight: 700, fontSize: 46, lineHeight: 1.2, color: '#1c1b17' }}>
            {field('recipientAm', 'designs.field.recipientAm')}
          </span>
          <span style={{ fontSize: 26, fontStyle: 'italic', color: '#2c2a24' }}>{field('recipientEn', 'designs.field.recipientEn')}</span>
          <span style={{ marginTop: 6, width: 420, height: 2, background: theme.accent }} aria-hidden="true" />
        </div>

        <div className="design-stack" style={{ gap: 6, maxWidth: 760, alignSelf: 'center' }}>
          <p style={{ margin: 0, fontFamily: SERIF_ETHIOPIC, fontSize: 17, lineHeight: 1.6, color: '#2c2a24' }}>
            {field('bodyAm', 'designs.field.bodyAm')}
          </p>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: '#3b3830' }}>{field('bodyEn', 'designs.field.bodyEn')}</p>
          <p style={{ margin: '4px 0 0', fontFamily: SANS, fontSize: 13, color: '#5b574c' }}>{field('placeDate', 'designs.field.placeDate')}</p>
        </div>

        <div className="design-signatures">
          {(['signer1', 'signer2'] as const).map((signer, index) => (
            <div key={signer} className="design-stack" style={{ gap: 4, gridColumn: index === 0 ? 1 : 3 }}>
              <span style={{ height: 30 }} aria-hidden="true" />
              <span style={{ width: 220, height: 1, background: '#1c1b17' }} aria-hidden="true" />
              <span style={{ fontFamily: SERIF_ETHIOPIC, fontSize: 14, fontWeight: 600 }}>
                {field(`${signer}Name`, index === 0 ? 'designs.field.signer1Name' : 'designs.field.signer2Name')}
              </span>
              <span style={{ fontFamily: SANS, fontSize: 12, color: '#5b574c' }}>
                {field(`${signer}Role`, index === 0 ? 'designs.field.signer1Role' : 'designs.field.signer2Role')}
              </span>
            </div>
          ))}
          <div style={{ gridColumn: 2, gridRow: 1, display: 'flex', justifyContent: 'center' }}>
            {showSeal ? <Seal primary={theme.primary} accent={theme.accent} label={sealLabel || 'SEAL ·'} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
