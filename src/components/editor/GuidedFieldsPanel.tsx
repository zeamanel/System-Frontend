import { useState } from 'react'
import { useI18n } from '../../i18n'
import { DOCUMENT_LANGUAGES, LANGUAGES } from '../../lib/languages'
import { getSmartSuggestion } from '../../lib/ethiopian/smart-field'
import { getSavedSuggestionsForField } from '../../lib/saved-answers/party-memory'
import { SmartSuggestionChip } from '../smart-fields'
import { RecentAnswerChips } from '../saved-answers'
import type { TemplateDetail } from '../../lib/repositories'
import type { OutlineEntry } from '../../lib/editor/model'
import { Badge, Button, Input, Select, Spinner, Textarea } from '../ui'
import { AlertIcon, SparkIcon } from '../icons'

export const ADDITIONAL_INSTRUCTIONS_FIELD_ID = 'additional_instructions'

export interface GuidedFieldsPanelProps {
  template: TemplateDetail | null | undefined
  answers: Record<string, string>
  onAnswerChange: (questionId: string, value: string) => void
  language: string
  onLanguageChange: (language: string) => void
  hasContent: boolean
  generationPending: boolean
  generationFailed: boolean
  onGenerate: (answers: Record<string, string>) => void
  outline: OutlineEntry[]
  onOutlineSelect: (blockId: string) => void
}

function isMultilineQuestion(question: { id: string; label: string }): boolean {
  return (
    question.label.length > 35 ||
    /point|qualif|item|desc|experience|education|decision/i.test(question.id)
  )
}

/**
 * Left panel, part 1: guided document fields rendered from the linked
 * template's schema (required/optional, hints, per-field validation), the
 * document language, and generate/regenerate — which always sends the current
 * answers so changing language or settings never discards user input.
 */
export function GuidedFieldsPanel({
  template,
  answers,
  onAnswerChange,
  language,
  onLanguageChange,
  hasContent,
  generationPending,
  generationFailed,
  onGenerate,
}: GuidedFieldsPanelProps) {
  const { t } = useI18n()
  const [invalid, setInvalid] = useState<Record<string, boolean>>({})
  const [confirming, setConfirming] = useState(false)

  const questions = template?.questions ?? []
  const languageOptions = (
    template?.supportedLanguages?.length ? template.supportedLanguages : [...DOCUMENT_LANGUAGES]
  ).map((code) => ({
    value: code,
    label: `${LANGUAGES[code]?.nativeName ?? code} (${LANGUAGES[code]?.englishName ?? code})`,
  }))

  const handleGenerateClick = (): void => {
    const missing: Record<string, boolean> = {}
    for (const question of questions) {
      if (question.required && !(answers[question.id] ?? '').trim()) {
        missing[question.id] = true
      }
    }
    setInvalid(missing)
    if (Object.keys(missing).length > 0) return
    if (hasContent) {
      setConfirming(true)
      return
    }
    onGenerate(answers)
  }

  const handleConfirmGenerate = (): void => {
    setConfirming(false)
    onGenerate(answers)
  }

  return (
    <section className="editor-panel__section" aria-labelledby="editor-fields-title">
      <h2 id="editor-fields-title" className="editor-panel__title">
        {t('editor.panelFields')}
      </h2>

      {template ? (
        <p className="editor-panel__hint">{t('editor.fieldsHint')}</p>
      ) : (
        <p className="editor-panel__hint">{t('editor.noTemplate')}</p>
      )}

      {questions.map((question) => {
        const currentValue = answers[question.id] ?? ''
        const shared = {
          id: `field-${question.id}`,
          label: (
            <>
              {question.label}
              {question.required ? (
                <Badge variant="neutral">{t('editor.fieldsRequired')}</Badge>
              ) : null}
            </>
          ),
          hint: isMultilineQuestion(question) ? t('editor.fieldMultilineHint') : undefined,
          error: invalid[question.id] ? t('editor.fieldRequired') : undefined,
          value: currentValue,
          onChange: (
            event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
          ) => onAnswerChange(question.id, event.target.value),
          placeholder: t('editor.fieldPlaceholder'),
        }
        // Ethiopian legal smart inputs: offer a one-click suggestion when
        // the typed value can become a dual-calendar date or a
        // words-in-parentheses Birr amount.
        const suggestion = getSmartSuggestion(question, currentValue, language)
        // Previously used party/company values from earlier documents.
        const recents = getSavedSuggestionsForField(question.id, question.label).filter(
          (recent) => recent !== currentValue,
        )
        return (
          <div key={question.id} className="editor-panel__field">
            {isMultilineQuestion(question) ? (
              <Textarea rows={3} {...shared} />
            ) : (
              <Input {...shared} />
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

      <div className="editor-panel__field">
        <Textarea
          id={`field-${ADDITIONAL_INSTRUCTIONS_FIELD_ID}`}
          rows={3}
          label={
            <>
              {t('editor.additionalInstructionsLabel')}
              <Badge variant="neutral">{t('wizard.optionalTag')}</Badge>
            </>
          }
          placeholder={t('editor.additionalInstructionsPlaceholder')}
          value={answers[ADDITIONAL_INSTRUCTIONS_FIELD_ID] ?? ''}
          onChange={(event) =>
            onAnswerChange(ADDITIONAL_INSTRUCTIONS_FIELD_ID, event.target.value)
          }
        />
      </div>

      <Select
        id="editor-language-select"
        label={t('flow.language')}
        hint={t('editor.languageHelp')}
        options={languageOptions}
        value={language}
        onChange={(event) => onLanguageChange(event.target.value)}
      />

      {confirming ? (
        <div className="editor-panel__confirm" role="alertdialog" aria-label={t('editor.regenerate')}>
          <p>{t('editor.regenerateConfirm')}</p>
          <div className="editor-panel__confirm-actions">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmGenerate}>
              {t('editor.regenerateConfirmAction')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          fullWidth
          icon={<SparkIcon size={15} />}
          loading={generationPending}
          onClick={handleGenerateClick}
        >
          {hasContent ? t('editor.regenerate') : t('editor.generate')}
        </Button>
      )}

      {generationPending ? (
        <p className="editor-panel__status editor-panel__status--muted" data-testid="editor-generating">
          <Spinner size={14} /> {t('editor.generating')}
        </p>
      ) : null}

      {generationFailed ? (
        <p className="editor-panel__status editor-panel__status--error" role="alert">
          <AlertIcon size={14} /> {t('editor.generateFailed')}
        </p>
      ) : null}
    </section>
  )
}

/** Left panel, part 2: document sections outline. */
export function SectionsOutline({
  outline,
  onSelect,
}: {
  outline: OutlineEntry[]
  onSelect: (blockId: string) => void
}) {
  const { t } = useI18n()
  return (
    <section className="editor-panel__section" aria-labelledby="editor-sections-title">
      <h2 id="editor-sections-title" className="editor-panel__title">
        {t('editor.panelSections')}
      </h2>
      {outline.length === 0 ? (
        <p className="editor-panel__hint">{t('editor.outlineEmpty')}</p>
      ) : (
        <ul className="editor-outline">
          {outline.map((entry) => (
            <li
              key={entry.id}
              className={`editor-outline__item editor-outline__item--l${entry.level}`}
            >
              <button type="button" onClick={() => onSelect(entry.id)}>
                <span className="editor-outline__text">{entry.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

