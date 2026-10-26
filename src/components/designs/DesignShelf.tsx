import './DesignShelf.css'

import { useI18n } from '../../i18n'
import { DESIGN_CATALOG } from '../../designs/catalog'
import { useCreateDesign } from '../../hooks/use-create-design'
import { ArrowRightIcon } from '../icons'

/** Sheet outline in the design's orientation (a small visual cue, not a preview). */
export function DesignSheetIcon({ orientation }: { orientation: 'portrait' | 'landscape' }) {
  return <span className={`design-sheet-icon design-sheet-icon--${orientation}`} aria-hidden="true" />
}

/**
 * "Designs" on the Templates page: certificates, notices and other
 * fixed-layout pages. Shown only when the designs switch is on.
 */
export function DesignShelf() {
  const { t } = useI18n()
  const { start, pendingId } = useCreateDesign()
  return (
    <section className="design-shelf" aria-labelledby="design-shelf-title" data-testid="design-shelf">
      <div className="design-shelf__header">
        <h2 id="design-shelf-title" className="design-shelf__title">
          {t('designs.shelfTitle')}
        </h2>
        <p className="design-shelf__hint">{t('designs.shelfHint')}</p>
      </div>
      <ul className="design-shelf__list">
        {DESIGN_CATALOG.map((design) => (
          <li key={design.id}>
            <button
              type="button"
              className="design-shelf__card"
              disabled={pendingId !== null}
              aria-busy={pendingId === design.id}
              onClick={() => void start(design.id)}
            >
              <DesignSheetIcon orientation={design.orientation} />
              <span className="design-shelf__text">
                <span className="design-shelf__name">{t(design.titleKey)}</span>
                <span className="design-shelf__description">{t(design.descriptionKey)}</span>
              </span>
              <ArrowRightIcon size={15} className="design-shelf__arrow" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
