import { Link } from 'react-router-dom'
import { env } from '../../config/env'
import { ABOUT } from '../../content/info/about'
import { renderInline } from '../../content/info/inline'
import { useI18n } from '../../i18n'
import { useSession } from '../../session'
import { Blocks } from './Blocks'
import { InfoLayout } from './InfoLayout'
import { useInlineContext } from './use-inline-context'

export default function AboutPage() {
  const { t, locale } = useI18n()
  const { state } = useSession()
  const context = useInlineContext()
  const content = ABOUT[locale] ?? ABOUT.en
  const title = t('info.about.title', { app: env.appName })

  return (
    <InfoLayout title={title}>
      <article className="info-page">
        <h1 className="info-page__title">{title}</h1>
        <p className="info-page__lead">{renderInline(content.lead, context)}</p>
        <div className="info-page__cta">
          <Link className="btn btn--primary btn--md" to={state.status === 'authenticated' ? '/' : '/login'}>
            {t('info.about.getStarted')}
          </Link>
          <Link className="btn btn--secondary btn--md" to="/faq">
            {t('info.about.readFaq')}
          </Link>
        </div>
        {content.sections.map((section) => (
          <section key={section.id} id={section.id} className="info-card">
            <h2>{renderInline(section.title, context)}</h2>
            <Blocks blocks={section.blocks} context={context} />
          </section>
        ))}
      </article>
    </InfoLayout>
  )
}
