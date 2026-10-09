import './pages.css'

import { useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import { ArrowLeftIcon, PrinterIcon } from '../components/icons'
import { Button, useToast } from '../components/ui'

export default function EditorPage() {
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const { documentId } = useParams<'documentId'>()

  return (
    <div className="editor-page">
      <div className="editor-toolbar">
        <div className="editor-toolbar__group">
          <Button
            variant="ghost"
            icon={<ArrowLeftIcon size={16} />}
            onClick={() => navigate(-1)}
          >
            {t('editor.back')}
          </Button>
          <h1 className="editor-toolbar__title">{t('editor.untitled')}</h1>
          {documentId ? (
            <span className="editor-toolbar__id">
              <code>{documentId}</code>
            </span>
          ) : null}
        </div>
        <div className="editor-toolbar__group">
          <Button
            variant="secondary"
            onClick={() => toast.push(t('common.comingNextPhase'))}
          >
            {t('common.save')}
          </Button>
          <Button
            variant="primary"
            icon={<PrinterIcon size={16} />}
            onClick={() => toast.push(t('common.comingNextPhase'))}
          >
            {t('common.print')}
          </Button>
        </div>
      </div>

      <div className="doc-canvas">
        <article className="doc-page" aria-label={t('editor.untitled')}>
          <p className="doc-page__placeholder">{t('editor.placeholder')}</p>
        </article>
      </div>
    </div>
  )
}
