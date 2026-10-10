import { useI18n } from '../../i18n'

export type FlowStep = 'setup' | 'questions' | 'review' | 'generating'

export interface GuidedFlowStepperProps {
  currentStep: FlowStep
}

export function GuidedFlowStepper({ currentStep }: GuidedFlowStepperProps) {
  const { t } = useI18n()

  return (
    <nav className="guided-flow__stepper" aria-label="Creation progress">
      <div
        className={`guided-flow__step-item ${
          currentStep === 'setup'
            ? 'guided-flow__step-item--active'
            : 'guided-flow__step-item--done'
        }`}
      >
        <span className="guided-flow__step-number">1</span>
        <span>{t('flow.step1')}</span>
      </div>
      <div className="guided-flow__step-divider" />

      <div
        className={`guided-flow__step-item ${
          currentStep === 'questions'
            ? 'guided-flow__step-item--active'
            : currentStep === 'review' || currentStep === 'generating'
              ? 'guided-flow__step-item--done'
              : ''
        }`}
      >
        <span className="guided-flow__step-number">2</span>
        <span>{t('flow.step2')}</span>
      </div>
      <div className="guided-flow__step-divider" />

      <div
        className={`guided-flow__step-item ${
          currentStep === 'review'
            ? 'guided-flow__step-item--active'
            : currentStep === 'generating'
              ? 'guided-flow__step-item--done'
              : ''
        }`}
      >
        <span className="guided-flow__step-number">3</span>
        <span>{t('flow.step3')}</span>
      </div>
      <div className="guided-flow__step-divider" />

      <div
        className={`guided-flow__step-item ${
          currentStep === 'generating' ? 'guided-flow__step-item--active' : ''
        }`}
      >
        <span className="guided-flow__step-number">4</span>
        <span>{t('flow.step4')}</span>
      </div>
    </nav>
  )
}