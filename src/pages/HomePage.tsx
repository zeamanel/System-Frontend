import './pages.css'

import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import {
  DocumentIcon,
  EditIcon,
  PrinterIcon,
  SparkIcon,
  TemplateIcon,
  UserIcon,
} from '../components/icons'
import type { IconProps } from '../components/icons'
import type { ComponentType } from 'react'
import { Button, Card, CardBody, CardTitle, EmptyState } from '../components/ui'

interface DocType {
  key: string
  icon: ComponentType<IconProps>
}

const DOC_TYPES: DocType[] = [
  { key: 'letter', icon: DocumentIcon },
  { key: 'application', icon: EditIcon },
  { key: 'cv', icon: UserIcon },
  { key: 'contract', icon: TemplateIcon },
  { key: 'invoice', icon: PrinterIcon },
  { key: 'minutes', icon: SparkIcon },
]

function docTypeKey(key: string, field: 'title' | 'description'): MessageKey {
  return `docType.${key}.${field}` as MessageKey
}

export default function HomePage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">{t('home.title')}</h1>
        <p className="page__subtitle">{t('home.subtitle')}</p>
      </header>

      <section className="page__section" aria-labelledby="doc-types-heading">
        <h2 id="doc-types-heading" className="page__section-title">
          {t('home.featuredTypes')}
        </h2>
        <ul className="doc-types">
          {DOC_TYPES.map(({ key, icon: Icon }) => (
            <li key={key}>
              <Card className="doc-type">
                <span className="doc-type__icon">
                  <Icon size={18} />
                </span>
                <div>
                  <CardTitle className="doc-type__title">
                    {t(docTypeKey(key, 'title'))}
                  </CardTitle>
                  <CardBody className="doc-type__description">
                    {t(docTypeKey(key, 'description'))}
                  </CardBody>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="page__section" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="page__section-title">
          {t('home.recentDocuments')}
        </h2>
        <EmptyState
          icon={<DocumentIcon size={22} />}
          title={t('empty.documents.title')}
          description={t('empty.documents.body')}
          action={
            <Button variant="primary" onClick={() => navigate('/documents')}>
              {t('empty.documents.action')}
            </Button>
          }
        />
      </section>
    </div>
  )
}
