import { useState } from 'react'
import { useI18n } from '../../i18n'
import { getSmartSuggestion } from '../../lib/ethiopian/smart-field'
import { getSavedSuggestionsForField } from '../../lib/saved-answers/party-memory'
import { SmartSuggestionChip } from '../smart-fields'
import { RecentAnswerChips } from '../saved-answers'
import type { TemplateQuestion } from '../../lib/repositories'
import { SparkIcon } from '../icons'
import { Badge, Button, Card, CardBody, CardTitle, Input, Textarea } from '../ui'

export interface GuidedFlowQuickFillStepProps {
  questions: TemplateQuestion[]
  answers: Record<string, string>
  onAnswerChange: (questionId: string, value: string) => void
  /** Document language — drives Ethiopian legal smart-input suggestions. */
  language: string
  isGenerating: boolean
  onGenerate: () => void
}

function isMultilineQuestion(question: { id: string; label: string }): boolean {
  return (
    question.label.length > 35 ||
    /point|qualif|item|desc|experience|education|decision/i.test(question.id)
  )
}

/**
 * "All questions" (Quick Fill) sub-mode of the Questions step: every
 * template field on one screen so typing-shop operators can Tab through
 * everything and generate immediately. Validates all required fields at
 * once and jumps straight to generation — no per-question Next clicks.
 */
export function GuidedFlowQuickFillStep({
  questions,
  answers,
  onAnswerChange,
  language,
  isGenerating,
  onGenerate,
}: GuidedFlowQuickFillStepProps) {
  const { t } = useI18n()
  const [invalid, setInvalid] = useState<Record<string, boolean>>({})

  const handleGenerateClick = (): void => {
    const missing: Record<string, boolean> = {}
    for (const question of questions) {
      if (question.required && !(answers[question.id] ?? '').trim()) {
        missing[question.id] = true
      }
    }
    setInvalid(missing)
    if (Object.keys(missing).length > 0) return
    onGenerate()
  }

  return (
    <Card>
      <CardTitle>
        {t('flow.step2')} — {t('flow.allQuestions', { count: String(questions.length) })}
      </CardTitle>
      <CardBody>
        <div className="guided-flow__quickfill">
          {questions.map((question) => {
            const value = answers[question.id] ?? ''
            const suggestion = getSmartSuggestion(question, value, language)
            const recents = getSavedSuggestionsForField(question.id, question.label).filter(
              (recent) => recent !== value,
            )
            return (
              <div key={question.id} className="guided-flow__quickfill-field">
                {isMultilineQuestion(question) ? (
                  <Textarea
                    id={`quickfill-${question.id}`}
                    rows={3}
                    label={
                      <>
                        {question.label}
                        {question.required ? (
                          <Badge variant="neutral">{t('flow.required')}</Badge>
                        ) : null}
                      </>
                    }
                    value={value}
                    placeholder={t('flow.answerPlaceholder')}
                    error={invalid[question.id] ? t('flow.required') : undefined}
                    onChange={(event) => onAnswerChange(question.id, event.target.value)}
                  />
                ) : (
                  <Input
                    id={`quickfill-${question.id}`}
                    label={
                      <>
                        {question.label}
                        {question.required ? (
                          <Badge variant="neutral">{t('flow.required')}</Badge>
                        ) : null}
                      </>
                    }
                    value={value}
                    placeholder={t('flow.answerPlaceholder')}
                    error={invalid[question.id] ? t('flow.required') : undefined}
                    onChange={(event) => onAnswerChange(question.id, event.target.value)}
                  />
                )}
                {suggestion ? (
                  <SmartSuggestionChip
                    suggestion={suggestion}
                    onApply={(formatted) => onAnswerChange(question.id, formatted)}
                  />
                ) : null}
                <RecentAnswerChips
                  suggestions={recents}
                  onPick={(recent) => onAnswerChange(question.id, recent)}
                />
              </div>
            )
          })}
            <div className="guided-flow__quickfill-field">
              <Textarea
                id="quickfill-additional_instructions"
                rows={3}
                label={
                  <>
                    {t('editor.additionalInstructionsLabel')}
                    <Badge variant="neutral">{t('wizard.optionalTag')}</Badge>
                  </>
                }
                value={answers['additional_instructions'] ?? ''}
                placeholder={t('editor.additionalInstructionsPlaceholder')}
                onChange={(event) =>
                  onAnswerChange('additional_instructions', event.target.value)
                }
              />
            </div>
        </div>
        <div className="guided-flow__actions guided-flow__actions--end">
          <Button
            variant="primary"
            icon={<SparkIcon size={15} />}
            loading={isGenerating}
            onClick={handleGenerateClick}
          >
            {t('flow.generateAction')}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
