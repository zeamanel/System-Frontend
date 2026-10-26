import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import { FieldText } from './Placeholder'
import type { DesignPageProps, DesignTheme } from './types'

const SERIF_ETHIOPIC = "'Noto Serif Ethiopic', 'Noto Serif', serif"
const SANS = "'Noto Sans', 'Noto Serif Ethiopic', sans-serif"

/** Standard card, 85 × 55 mm; ten per A4 sheet, butted together so one cut separates two cards. */
const CARD = { width: 85, height: 55 }
const COLUMNS = 2
const ROWS = 5
const LEFT = (210 - CARD.width * COLUMNS) / 2
const TOP = (297 - CARD.height * ROWS) / 2
const MARK = { gap: 1.5, length: 5 }

function CutMarks() {
  const marks: Array<{ x: number; y: number; w: number; h: number }> = []
  const thin = 0.2
  for (let c = 0; c <= COLUMNS; c++) {
    const x = LEFT + c * CARD.width - thin / 2
    marks.push({ x, y: TOP - MARK.gap - MARK.length, w: thin, h: MARK.length })
    marks.push({ x, y: TOP + ROWS * CARD.height + MARK.gap, w: thin, h: MARK.length })
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = TOP + r * CARD.height - thin / 2
    marks.push({ x: LEFT - MARK.gap - MARK.length, y, w: MARK.length, h: thin })
    marks.push({ x: LEFT + COLUMNS * CARD.width + MARK.gap, y, w: MARK.length, h: thin })
  }
  return (
    <>
      {marks.map((mark, index) => (
        <span
          key={index}
          className="design-cards__mark"
          style={{ left: `${mark.x}mm`, top: `${mark.y}mm`, width: `${mark.w}mm`, height: `${mark.h}mm` }}
          aria-hidden="true"
        />
      ))}
    </>
  )
}

function Card({
  fields,
  theme,
  logo,
  editing,
  field,
}: {
  fields: Record<string, string>
  theme: DesignTheme
  logo?: string
  editing: boolean
  field: (id: string) => ReactNode
}) {
  const contact = [
    { id: 'phone', label: 'ስ.ቁ.' },
    { id: 'email', label: '@' },
    { id: 'address', label: '⌂' },
  ]
  return (
    <div className="design-card">
      <span className="design-card__stripe" style={{ background: theme.primary }} aria-hidden="true" />
      <div className="design-card__top">
        {logo ? <img className="design-card__logo" src={logo} alt="" /> : null}
        <div className="design-card__org">
          <span style={{ fontFamily: SERIF_ETHIOPIC, fontWeight: 700, color: theme.primary }}>{field('orgNameAm')}</span>
          <span style={{ color: '#5b574c', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{field('orgNameEn')}</span>
        </div>
      </div>
      <div className="design-card__person">
        <span style={{ fontFamily: SERIF_ETHIOPIC, fontSize: '4.6mm', fontWeight: 700, color: '#1c1b17' }}>{field('nameAm')}</span>
        <span style={{ fontSize: '3.3mm', fontWeight: 600, color: '#1c1b17' }}>{field('nameEn')}</span>
        <span style={{ fontSize: '2.7mm', color: theme.accentText }}>
          {field('roleAm')}
          {fields.roleAm?.trim() && fields.roleEn?.trim() ? ' · ' : ' '}
          {field('roleEn')}
        </span>
      </div>
      <div className="design-card__contact">
        {contact.map((item) =>
          fields[item.id]?.trim() || editing ? (
            <span key={item.id}>
              <span className="design-card__label" style={{ color: theme.primary }}>
                {item.label}
              </span>
              {field(item.id)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  )
}

/** Ten business cards on one A4 sheet, with cutting marks. Print at actual size (100%). */
export function BusinessCardsPage({ content, theme, showPlaceholders, imageUrls }: DesignPageProps) {
  const { t } = useI18n()
  const labels: Record<string, Parameters<typeof t>[0]> = {
    orgNameAm: 'designs.field.orgNameAm',
    orgNameEn: 'designs.field.orgNameEn',
    nameAm: 'designs.field.nameAm',
    nameEn: 'designs.field.nameEn',
    roleAm: 'designs.field.roleAm',
    roleEn: 'designs.field.roleEn',
    phone: 'designs.field.phone',
    email: 'designs.field.email',
    address: 'designs.field.address',
  }
  const field = (id: string) => (
    <FieldText value={content.fields[id]} placeholder={labels[id] ? t(labels[id]) : id} showPlaceholders={showPlaceholders} />
  )
  const cards = Array.from({ length: COLUMNS * ROWS }, (_, index) => index)

  return (
    <div
      className={`design-page design-cards${showPlaceholders ? ' design-cards--editing' : ''}`}
      style={{ width: 794, height: 1123, fontFamily: SANS, background: '#ffffff' }}
    >
      {content.options.cropMarks !== false ? <CutMarks /> : null}
      <div
        className="design-cards__grid"
        style={{
          left: `${LEFT}mm`,
          top: `${TOP}mm`,
          gridTemplateColumns: `repeat(${COLUMNS}, ${CARD.width}mm)`,
          gridTemplateRows: `repeat(${ROWS}, ${CARD.height}mm)`,
        }}
      >
        {cards.map((index) => (
          <Card key={index} fields={content.fields} theme={theme} logo={imageUrls.logo} editing={showPlaceholders} field={field} />
        ))}
      </div>
    </div>
  )
}
