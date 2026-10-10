import { useI18n } from '../../i18n'
import type { GenerationRequest } from '../../types/api'
import { AlertIcon, ArrowRightIcon, CheckIcon } from '../icons'
import { Button, Card, CardBody, CardTitle, Spinner } from '../ui'

export interface GuidedFlowGeneratingStepProps {
  jobData: GenerationRequest | null | undefined
  targetLanguageName: string
  onBackToReview: () => void
  onRetry: () => void
  onOpenDocument: (documentId: string) => void
}

export function GuidedFlowGeneratingStep({
  jobData,
  targetLanguageName,
  onBackToReview,
  onRetry,
  onOpenDocument,
}: GuidedFlowGeneratingStepProps) {
  const { t } = useI18n()

  return (
    <Card>
      <CardBody>
        <div className="guided-flow__generating">
          <CardTitle>{t('flow.generatingTitle')}</CardTitle>

          {jobData?.status === 'failed' ? (
            <>
              <div
                style={{
                  color: 'var(--color-error)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <AlertIcon size={24} />
                <span>{t('flow.generatingFailed')}</span>
              </div>
              <div className="guided-flow__actions">
                <Button variant="secondary" onClick={onBackToReview}>
                  {t('flow.back')}
                </Button>
                <Button variant="primary" onClick={onRetry}>
                  {t('common.retry')}
                </Button>
              </div>
            </>
          ) : jobData?.status === 'completed' ? (
            <>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '2px solid var(--color-text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckIcon size={24} />
                </div>
                <p style={{ fontWeight: 600, fontSize: 'var(--font-base)' }}>
                  {t('flow.generatingSuccess')}
                </p>
              </div>

              {jobData.documentId && (
                <Button
                  variant="primary"
                  icon={<ArrowRightIcon size={15} />}
                  onClick={() => onOpenDocument(jobData.documentId!)}
                >
                  {t('flow.openEditor')}
                </Button>
              )}
            </>
          ) : (
            <>
              <Spinner size={32} />

              <div className="guided-flow__generating-steps">
                <div
                  className={`guided-flow__gen-step ${
                    jobData?.status === 'processing'
                      ? 'guided-flow__gen-step--done'
                      : 'guided-flow__gen-step--active'
                  }`}
                >
                  <span className="guided-flow__gen-step-icon">
                    {jobData?.status === 'processing' ? (
                      <CheckIcon size={16} />
                    ) : (
                      <Spinner size={14} />
                    )}
                  </span>
                  <span>{t('flow.generatingStep1')}</span>
                </div>

                <div
                  className={`guided-flow__gen-step ${
                    jobData?.status === 'processing'
                      ? 'guided-flow__gen-step--active'
                      : ''
                  }`}
                >
                  <span className="guided-flow__gen-step-icon">
                    {jobData?.status === 'processing' ? (
                      <Spinner size={14} />
                    ) : (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: 'var(--color-border)',
                        }}
                      />
                    )}
                  </span>
                  <span>
                    {t('flow.generatingStep2', { language: targetLanguageName })}
                  </span>
                </div>

                <div className="guided-flow__gen-step">
                  <span className="guided-flow__gen-step-icon">
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-border)',
                      }}
                    />
                  </span>
                  <span>{t('flow.generatingStep3')}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  )
}