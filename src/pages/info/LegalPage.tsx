import { PRIVACY } from '../../content/info/privacy'
import { TERMS } from '../../content/info/terms'
import { LEGAL_REVIEWED_ON, LEGAL_UPDATED } from '../../content/info/meta'
import { renderInline } from '../../content/info/inline'
import { useMediaQuery } from '../../hooks/use-media-query'
import { useI18n } from '../../i18n'
import { formatDate } from '../../lib/datetime'
import { Blocks } from './Blocks'
import { InfoLayout } from './InfoLayout'
import { useInlineContext } from './use-inline-context'

/** The Terms of Service and the Privacy Policy share one layout: title, notices, contents list, numbered sections. */
export function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const { t, locale } = useI18n()
  const context = useInlineContext()
  const wide = useMediaQuery('(min-width: 961px)')
  const doc = kind === 'terms' ? TERMS : PRIVACY
  const title = t(kind === 'terms' ? 'info.nav.terms' : 'info.nav.privacy')

  return (
    <InfoLayout title={title}>
      <article className="info-page info-page--legal">
        <h1 className="info-page__title">{title}</h1>
        <p className="info-page__meta">{t('info.legal.updated', { date: formatDate(new Date(`${LEGAL_UPDATED}T12:00:00`), locale) })}</p>
        {LEGAL_REVIEWED_ON === null ? (
          <p className="info-notice info-notice--draft" role="note" data-testid="legal-draft">
            {t('info.legal.draft')}
          </p>
        ) : null}
        {locale !== 'en' ? (
          <p className="info-notice" role="note" data-testid="legal-english-only">
            {t('info.legal.englishOnly')}
          </p>
        ) : null}
        <p className="info-page__lead info-page__lead--legal" lang="en">
          {renderInline(doc.intro, context)}
        </p>

        <div className="info-doc">
          <details className="info-toc" open={wide}>
            <summary>{t('info.legal.onThisPage')}</summary>
            <ol>
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{renderInline(section.title.replace(/^\d+\.\s*/, ''), context)}</a>
                </li>
              ))}
            </ol>
          </details>
          <div className="info-doc__body" lang="en">
            {doc.sections.map((section) => (
              <section key={section.id} id={section.id} className="info-section">
                <h2>{renderInline(section.title, context)}</h2>
                <Blocks blocks={section.blocks} context={context} />
              </section>
            ))}
          </div>
        </div>
      </article>
    </InfoLayout>
  )
}

export function TermsPage() {
  return <LegalPage kind="terms" />
}

export function PrivacyPage() {
  return <LegalPage kind="privacy" />
}
