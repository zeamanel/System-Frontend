import type { TemplateQuestion } from '../../lib/repositories'

/** A "select" question has a fixed list of choices; the answer is the chosen option's value. */
export function isSelectQuestion(
  question: Pick<TemplateQuestion, 'type' | 'options'>,
): question is Pick<TemplateQuestion, 'type'> & { options: NonNullable<TemplateQuestion['options']> } {
  return question.type === 'select' && Array.isArray(question.options) && question.options.length > 0
}
