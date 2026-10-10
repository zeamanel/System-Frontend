import './GuidedFlowWizard.css'

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { usePreferences } from '../../preferences'
import { isDocumentLanguage, LANGUAGES, type DocumentLanguage } from '../../lib/languages'
import type { TemplateDetail } from '../../lib/repositories'
import {
  useCreateGenerationRequest,
  useGenerationJob,
} from '../../hooks/use-generation'
import { GuidedFlowStepper, type FlowStep } from './GuidedFlowStepper'
import { GuidedFlowSetupStep } from './GuidedFlowSetupStep'
import { GuidedFlowQuestionStep } from './GuidedFlowQuestionStep'
import { GuidedFlowReviewStep } from './GuidedFlowReviewStep'
import { GuidedFlowGeneratingStep } from './GuidedFlowGeneratingStep'

export interface GuidedFlowWizardProps {
  template: TemplateDetail
  initialLanguage?: string
  onCancel?: () => void
  onComplete?: (documentId: string) => void
}

export function GuidedFlowWizard({
  template,
  initialLanguage,
  onCancel,
  onComplete,
}: GuidedFlowWizardProps) {
  const { t, locale } = useI18n()
  const { defaultDocumentLanguage, regionCode } = usePreferences()
  const navigate = useNavigate()

  const [step, setStep] = useState<FlowStep>('setup')
  const [docTitle, setDocTitle] = useState('')
  const [language, setLanguage] = useState<DocumentLanguage>(() => {
    if (initialLanguage && isDocumentLanguage(initialLanguage)) {
      return initialLanguage
    }
    if (defaultDocumentLanguage && isDocumentLanguage(defaultDocumentLanguage)) {
      return defaultDocumentLanguage
    }
    return locale === 'am' ? 'am' : locale === 'om' ? 'om' : 'en'
  })
  const [region, setRegion] = useState(() => regionCode ?? '')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [fieldError, setFieldError] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)

  const createJob = useCreateGenerationRequest()
  const job = useGenerationJob(requestId)

  const questions = template.questions
  const currentQuestion = questions[currentQuestionIndex]

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      navigate(`/templates/${encodeURIComponent(template.id)}`)
    }
  }

  const handleAnswerChange = (val: string) => {
    if (!currentQuestion) return
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: val }))
    if (fieldError) setFieldError('')
  }

  const handleNextQuestion = () => {
    if (!currentQuestion) return

    const currentAnswer = (answers[currentQuestion.id] ?? '').trim()
    if (currentQuestion.required && !currentAnswer) {
      setFieldError(t('flow.required'))
      return
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
      setFieldError('')
    } else {
      setStep('review')
    }
  }

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
      setFieldError('')
    } else {
      setStep('setup')
    }
  }

  const handleStartGeneration = async () => {
    const finalTitle =
      docTitle.trim() ||
      `${template.title} — ${new Date().toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-US')}`

    const combinedAnswers: Record<string, string> = {
      ...answers,
      title: finalTitle,
    }
    if (region) {
      combinedAnswers.region = region
    }

    try {
      const response = await createJob.mutateAsync({
        documentType: template.id,
        answers: combinedAnswers,
        language,
      })
      setRequestId(response.id)
      setStep('generating')
    } catch {
      // Handled via createJob.isError
    }
  }

  const handleOpenDocument = useCallback(
    (documentId: string) => {
      if (onComplete) {
        onComplete(documentId)
      } else {
        navigate(`/documents/${encodeURIComponent(documentId)}`)
      }
    },
    [navigate, onComplete],
  )

  // Once generation completes, auto-redirect after brief display
  useEffect(() => {
    if (job.data?.status === 'completed' && job.data.documentId) {
      const docId = job.data.documentId
      const timer = window.setTimeout(() => {
        handleOpenDocument(docId)
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [job.data?.status, job.data?.documentId, handleOpenDocument])

  const targetLangName =
    LANGUAGES[language]?.nativeName ?? language.toUpperCase()

  return (
    <div className="guided-flow">
      <GuidedFlowStepper currentStep={step} />

      {step === 'setup' && (
        <GuidedFlowSetupStep
          template={template}
          docTitle={docTitle}
          onDocTitleChange={setDocTitle}
          language={language}
          onLanguageChange={setLanguage}
          region={region}
          onRegionChange={setRegion}
          onCancel={handleCancel}
          onNext={() => setStep('questions')}
        />
      )}

      {step === 'questions' && currentQuestion && (
        <GuidedFlowQuestionStep
          question={currentQuestion}
          questionIndex={currentQuestionIndex}
          totalQuestions={questions.length}
          answer={answers[currentQuestion.id] ?? ''}
          onAnswerChange={handleAnswerChange}
          fieldError={fieldError}
          onPrev={handlePrevQuestion}
          onNext={handleNextQuestion}
        />
      )}

      {step === 'review' && (
        <GuidedFlowReviewStep
          template={template}
          docTitle={docTitle}
          language={language}
          region={region}
          answers={answers}
          isGenerating={createJob.isPending}
          onBack={() => {
            setCurrentQuestionIndex(questions.length - 1)
            setStep('questions')
          }}
          onGenerate={handleStartGeneration}
        />
      )}

      {step === 'generating' && (
        <GuidedFlowGeneratingStep
          jobData={job.data}
          targetLanguageName={targetLangName}
          onBackToReview={() => setStep('review')}
          onRetry={handleStartGeneration}
          onOpenDocument={handleOpenDocument}
        />
      )}
    </div>
  )
}