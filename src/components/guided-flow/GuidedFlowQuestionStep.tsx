import { useI18n } from '../../i18n'
import { getSmartSuggestion } from '../../lib/ethiopian/smart-field'
import { getSavedSuggestionsForField } from '../../lib/saved-answers/party-memory'
import { SmartSuggestionChip } from '../smart-fields'
import { RecentAnswerChips } from '../saved-answers'
import type { TemplateQuestion } from '../../lib/repositories'
import { ArrowLeftIcon, ArrowRightIcon } from '../icons'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Input,
  Textarea,
} from '../ui'

export interface GuidedFlowQuestionStepProps {
  question: TemplateQuestion
  questionIndex: number
  totalQuestions: number
  answer: string
  onAnswerChange: (val: string) => void
  /** Document language — drives Ethiopian legal smart-input suggestions. */
  language: string
  fieldError: string
  onPrev: () => void
  onNext: () => void
}

export function GuidedFlowQuestionStep({
  question,
  questionIndex,
  totalQuestions,
  answer,
  onAnswerChange,
  language,
  fieldError,
  onPrev,
  onNext,
}: GuidedFlowQuestionStepProps) {
  const { t } = useI18n()

  const isMultiline =
    question.label.length > 35 ||
    question.id.includes('point') ||
    question.id.includes('qualif') ||
    question.id.includes('item') ||
    question.id.includes('desc')

  // Ethiopian legal smart inputs, identical to the editor's guided-fields
  // panel: one click converts a typed Gregorian date or Birr amount into
  // the legal format before the generation job is submitted.
  const suggestion = getSmartSuggestion(question, answer, language)
  // Previously used party/company values from earlier documents.
  const recents = getSavedSuggestionsForField(question.id, question.label).filter(
    (recent) => recent !== answer,
  )

  return (
    <Card>
      <div className="guided-flow__question-nav">
        <span className="guided-flow__question-counter">
          {t('flow.questionProgress', {
            current: questionIndex + 1,
            total: totalQuestions,
          })}
        </span>
        {question.required ? (
          <Badge variant="neutral">{t('flow.required')}</Badge>
        ) : null}
      </div>

      <CardTitle>{question.label}</CardTitle>

      <CardBody>
        <div style={{ marginTop: 'var(--space-4)' }}>
          {isMultiline ? (
            <Textarea
              value={answer}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder={t('flow.answerPlaceholder')}
              rows={4}
              aria-label={question.label}
              error={fieldError || undefined}
            />
          ) : (
            <Input
              value={answer}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder={t('flow.answerPlaceholder')}
              aria-label={question.label}
              error={fieldError || undefined}
            />
          )}
          {suggestion ? (
            <SmartSuggestionChip suggestion={suggestion} onApply={onAnswerChange} />
          ) : null}
          <RecentAnswerChips suggestions={recents} onPick={onAnswerChange} />
        </div>

        <div className="guided-flow__actions">
          <Button
            variant="secondary"
            icon={<ArrowLeftIcon size={15} />}
            onClick={onPrev}
          >
            {t('flow.back')}
          </Button>
          <Button
            variant="primary"
            icon={<ArrowRightIcon size={15} />}
            onClick={onNext}
          >
            {questionIndex === totalQuestions - 1
              ? t('flow.finishQuestions')
              : t('flow.next')}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}