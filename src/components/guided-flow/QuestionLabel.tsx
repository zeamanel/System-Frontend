import type { TemplateQuestion } from '../../lib/repositories/types'
import './QuestionLabel.css'

/**
 * A question's label. For a document written in Arabic, the template's Arabic
 * label comes first and the interface-language label under it, so the
 * question reads for someone who reads Arabic and for someone who does not.
 */
export function QuestionLabel({ question, language }: { question: Pick<TemplateQuestion, 'label' | 'labelAr'>; language: string }) {
  if (language !== 'ar' || !question.labelAr) return <>{question.label}</>
  return (
    <span className="question-label">
      <span className="question-label__ar" dir="rtl" lang="ar">
        {question.labelAr}
      </span>
      <span className="question-label__ui">{question.label}</span>
    </span>
  )
}
