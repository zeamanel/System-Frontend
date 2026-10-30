import './StylePickerDialog.css'

import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { DOCUMENT_STYLES } from '../../lib/editor/styles'
import type { DocumentStyleId } from '../../lib/editor/types'
import { Button, Dialog } from '../ui'
import { CheckIcon } from '../icons'
import { useCreateDesign } from '../../hooks/use-create-design'

export interface StylePickerDialogProps {
  open: boolean
  onClose: () => void
  current: DocumentStyleId
  /** Styles that suit this template; marked "Suggested". */
  suggested: readonly DocumentStyleId[]
  /** True when the organization has no logo or letterhead lines yet. */
  letterheadIncomplete: boolean
  onChoose: (id: DocumentStyleId) => void
  /** A graphic design made for this template (absent: no such design, or designs are off). */
  graphicDesign?: GraphicDesignLink
}

export interface GraphicDesignLink {
  designId: string
  /** The design's name, shown in the explanation. */
  name: string
  /** Title for the new design document. */
  title: string
  /** Design field values, read when the button is pressed (latest answers). */
  fields: () => Record<string, string>
  /** Runs first (save the text document); false cancels. */
  beforeOpen: () => Promise<boolean>
}

/**
 * One-click looks for a text document. Choosing a style changes the page
 * (font, margins, frame or letterhead band), never the text.
 */
export function StylePickerDialog({
  open,
  onClose,
  current,
  suggested,
  letterheadIncomplete,
  onChoose,
  graphicDesign,
}: StylePickerDialogProps) {
  const { t } = useI18n()

  return (
    <Dialog open={open} onClose={onClose} title={t('styles.title')} closeLabel={t('common.close')} width="md">
      <p className="style-picker__intro">{t('styles.intro')}</p>
      <ul className="style-picker" role="list">
        {DOCUMENT_STYLES.map((style) => {
          const selected = style.id === current
          return (
            <li key={style.id}>
              <button
                type="button"
                className={['style-picker__option', selected ? 'style-picker__option--selected' : null]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={selected}
                data-testid={`style-option-${style.id}`}
                onClick={() => {
                  onChoose(style.id)
                  onClose()
                }}
              >
                <span className={`style-thumb style-thumb--${style.id}`} aria-hidden="true">
                  <span className="style-thumb__band" />
                  <span className="style-thumb__title" />
                  <span className="style-thumb__line" />
                  <span className="style-thumb__line" />
                  <span className="style-thumb__line style-thumb__line--short" />
                </span>
                <span className="style-picker__text">
                  <span className="style-picker__name">
                    {t(style.titleKey as MessageKey)}
                    {suggested.includes(style.id) ? (
                      <span className="style-picker__badge">{t('styles.suggested')}</span>
                    ) : null}
                  </span>
                  <span className="style-picker__description">{t(style.descriptionKey as MessageKey)}</span>
                  {style.id === 'executive-letterhead' && letterheadIncomplete ? (
                    <span className="style-picker__hint">{t('styles.letterheadHint')}</span>
                  ) : null}
                </span>
                {selected ? <CheckIcon size={16} className="style-picker__check" /> : null}
              </button>
            </li>
          )
        })}
      </ul>
      {graphicDesign ? (
        <section className="style-picker__design" data-testid="style-graphic-design">
          <p className="style-picker__name">{t('styles.design.title')}</p>
          <p className="style-picker__description">{t('styles.design.body', { design: graphicDesign.name })}</p>
          <OpenGraphicDesignButton link={graphicDesign} onDone={onClose} />
        </section>
      ) : null}
    </Dialog>
  )
}

/** Creates the design from the answers and opens it (needs the router, so only rendered when linked). */
function OpenGraphicDesignButton({ link, onDone }: { link: GraphicDesignLink; onDone: () => void }) {
  const { t } = useI18n()
  const { start, pendingId } = useCreateDesign()
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pendingId !== null}
      data-testid="open-graphic-design"
      onClick={async () => {
        if (!(await link.beforeOpen())) return
        onDone()
        await start(link.designId, { fields: link.fields(), title: link.title })
      }}
    >
      {t('styles.design.open')}
    </Button>
  )
}
