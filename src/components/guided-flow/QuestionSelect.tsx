import type { ReactNode } from 'react'
import { useI18n } from '../../i18n'
import type { TemplateQuestion } from '../../lib/repositories'
import { Select } from '../ui'

export function QuestionSelect({
  id,
  question,
  value,
  onChange,
  label,
  error,
}: {
  id?: string
  question: TemplateQuestion & { options: NonNullable<TemplateQuestion['options']> }
  value: string
  onChange: (value: string) => void
  /** Shown above the control; omit when the surrounding screen already shows it. */
  label?: ReactNode
  error?: ReactNode
}) {
  const { t } = useI18n()
  return (
    <Select
      id={id}
      label={label}
      aria-label={label ? undefined : question.label}
      options={question.options}
      value={value}
      placeholder={t('editor.fieldChoose')}
      error={error}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
