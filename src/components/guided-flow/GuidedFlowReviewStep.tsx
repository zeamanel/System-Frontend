import { useI18n } from '../../i18n'
import { LANGUAGES, type DocumentLanguage } from '../../lib/languages'
import { regionDisplayName } from '../../lib/geo'
import type { TemplateDetail } from '../../lib/repositories'
import { ArrowLeftIcon, SparkIcon } from '../icons'
import { Button, Card, CardBody, CardTitle } from '../ui'

export interface GuidedFlowReviewStepProps {
  template: TemplateDetail
  docTitle: string
  language: DocumentLanguage
  region: string
  answers: Record<string, string>
  isGenerating: boolean
  onBack: () => void
  onGenerate: () => void
}

export function GuidedFlowReviewStep({
  template,
  docTitle,
  language,
  region,
  answers,
  isGenerating,
  onBack,
  onGenerate,
}: GuidedFlowReviewStepProps) {
  const { t, locale } = useI18n()
  const questions = template.questions
  const targetLangName =
    LANGUAGES[language]?.nativeName ?? language.toUpperCase()

  const displayTitle =
    docTitle.trim() ||
    `${template.title} — ${new Date().toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-US')}`

  return (
    <Card>
      <CardTitle>{t('flow.reviewTitle')}</CardTitle>
      <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
        {t('flow.reviewSubtitle')}
      </p>

      <CardBody>
        <div className="guided-flow__review-grid">
          <div className="guided-flow__review-item">
            <div className="guided-flow__review-label">{t('flow.docTitle')}</div>
            <div className="guided-flow__review-value">{displayTitle}</div>
          </div>

          <div className="guided-flow__review-item">
            <div className="guided-flow__review-label">{t('flow.language')}</div>
            <div className="guided-flow__review-value">{targetLangName}</div>
          </div>

          {region && (
            <div className="guided-flow__review-item">
              <div className="guided-flow__review-label">{t('flow.region')}</div>
              <div className="guided-flow__review-value">
                {regionDisplayName(region, locale)}
              </div>
            </div>
          )}

          {questions.map((q, idx) => (
            <div key={q.id} className="guided-flow__review-item">
              <div className="guided-flow__review-label">
                {idx + 1}. {q.label}
              </div>
              <div className="guided-flow__review-value">
                {answers[q.id]?.trim() ? (
                  answers[q.id]
                ) : (
                  <em style={{ color: 'var(--color-text-muted)' }}>
                    {t('flow.notAnswered')}
                  </em>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="guided-flow__actions">
          <Button
            variant="secondary"
            icon={<ArrowLeftIcon size={15} />}
            onClick={onBack}
          >
            {t('flow.back')}
          </Button>
          <Button
            variant="primary"
            icon={<SparkIcon size={15} />}
            loading={isGenerating}
            onClick={onGenerate}
          >
            {t('flow.generateAction')}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}