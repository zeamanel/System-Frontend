import './GuidedFieldsPanel.css'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useI18n } from '../../i18n'
import { DOCUMENT_LANGUAGES, LANGUAGES } from '../../lib/languages'
import { getSmartSuggestion } from '../../lib/ethiopian/smart-field'
import { getSavedSuggestionsForField } from '../../lib/saved-answers/party-memory'
import { listTelegramMediaVault, type TelegramVaultProfile } from '../../lib/api'
import { SmartSuggestionChip } from '../smart-fields'
import { RecentAnswerChips } from '../saved-answers'
import type { TemplateDetail, TemplateQuestion } from '../../lib/repositories'
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
  children?: React.ReactNode
}

export function isPartyFieldKey(key: string): boolean {
  if (!key) return false
  const k = key.toLowerCase().trim()
  if (
    k.includes('bank_name') ||
    k.includes('file_name') ||
    k.includes('document_name') ||
    k.includes('project_name') ||
    k.includes('property_') ||
    k.includes('business_purpose') ||
    k.includes('scope') ||
    k.includes('purpose') ||
    k.includes('duration') ||
    k.includes('date') ||
    k.includes('terms')
  ) {
    return false
  }
  return (
    k.includes('party') ||
    k.includes('lessor') ||
    k.includes('lessee') ||
    k.includes('landlord') ||
    k.includes('tenant') ||
    k.includes('buyer') ||
    k.includes('seller') ||
    k.includes('employer') ||
    k.includes('employee') ||
    k.includes('principal') ||
    k.includes('agent') ||
    k.includes('borrower') ||
    k.includes('lender') ||
    k.includes('guarantor') ||
    k.includes('applicant') ||
    k.includes('client') ||
    k.includes('contractor') ||
    k.includes('spousal') ||
    k.includes('partner') ||
    k.includes('witness') ||
    k === 'full_name' ||
    k === 'party_name'
  )
}

export interface BoundTelegramProfile {
  fieldKey: string
  roleLabel: string
  slotIndex: number
  fullName: string
  idNumber?: string
  phone?: string
  address?: string
  qalId: string
  text?: string
}

export interface PartySlotState {
  name: string
  profile?: BoundTelegramProfile
}

function serializePartyContext(
  allSlots: Record<string, PartySlotState[]>,
  questions: TemplateQuestion[],
): string {
  const boundProfiles: BoundTelegramProfile[] = []
  for (const [key, slots] of Object.entries(allSlots)) {
    const q = questions.find((item) => (item.id === key || (item as { key?: string }).key === key))
    const roleLabel = q?.label ?? key
    slots.forEach((slot, idx) => {
      if (slot.profile && slot.profile.qalId) {
        boundProfiles.push({
          fieldKey: key,
          roleLabel,
          slotIndex: idx,
          fullName: slot.name || slot.profile.fullName || '',
          idNumber: slot.profile.idNumber,
          phone: slot.profile.phone,
          address: slot.profile.address,
          qalId: slot.profile.qalId,
          text: slot.profile.text,
        })
      }
    })
  }
  return boundProfiles.length > 0 ? JSON.stringify(boundProfiles) : ''
}

function isMultilineQuestion(question: { id: string; label: string }): boolean {
  return (
    question.label.length > 35 ||
    /point|qualif|item|desc|experience|education|decision/i.test(question.id)
  )
}

/**
 * Left panel: guided document fields with independent scroll locking.
 * - Header: "DOCUMENT FIELDS" fixed at top with refresh profiles control
 * - Body: dynamic template input fields with inline Telegram ID mapping and co-party repeaters
 * - Footer: additional details/instructions, language selector, and actions pinned at bottom
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
  children,
}: GuidedFieldsPanelProps) {
  const { t } = useI18n()
  const [invalid, setInvalid] = useState<Record<string, boolean>>({})
  const [confirming, setConfirming] = useState(false)
  const [telegramProfiles, setTelegramProfiles] = useState<TelegramVaultProfile[]>([])
  const [partySlots, setPartySlots] = useState<Record<string, PartySlotState[]>>({})

  const questions = useMemo(() => template?.questions ?? [], [template?.questions])
  const isPromptOnly = questions.length === 0
  const missingRequiredIds = questions
    .filter((q) => q.required && !(answers[q.id] ?? '').trim())
    .map((q) => q.id)

  const loadTelegramProfiles = useCallback(async () => {
    try {
      const list = await listTelegramMediaVault()
      // Deduplicate profiles by qalId
      const dedupedMap = new Map<string, TelegramVaultProfile>()
      for (const item of list) {
        if (!item.qalId) continue
        if (!dedupedMap.has(item.qalId)) {
          dedupedMap.set(item.qalId, item)
        }
      }
      setTelegramProfiles(Array.from(dedupedMap.values()))
    } catch {
      // Graceful fallback
    }
  }, [])

  useEffect(() => {
    void loadTelegramProfiles()
  }, [loadTelegramProfiles])

  useEffect(() => {
    const handleCompleted = () => {
      void loadTelegramProfiles()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('telegram-session-completed', handleCompleted)
      return () => {
        window.removeEventListener('telegram-session-completed', handleCompleted)
      }
    }
  }, [loadTelegramProfiles])

  const getSlots = (fieldKey: string, currentValue: string): PartySlotState[] => {
    if (partySlots[fieldKey] && partySlots[fieldKey].length > 0) {
      return partySlots[fieldKey]
    }
    return [{ name: currentValue || '' }]
  }

  const syncSlotsAndAnswers = (
    fieldKey: string,
    newSlots: PartySlotState[],
    _roleLabel: string,
  ) => {
    const updatedAll = { ...partySlots, [fieldKey]: newSlots }
    setPartySlots(updatedAll)

    // Combine primary and non-empty co-parties
    const names = newSlots.map((s) => s.name.trim()).filter(Boolean)
    const combined = names.join(', ')
    onAnswerChange(fieldKey, combined)

    // Serialize party context
    const serialized = serializePartyContext(updatedAll, questions)
    onAnswerChange('__party_context', serialized)
  }

  const handleTelegramSelect = (
    fieldKey: string,
    slotIdx: number,
    qalId: string,
    roleLabel: string,
    currentValue: string,
  ) => {
    const currentSlots = [...getSlots(fieldKey, currentValue)]
    while (currentSlots.length <= slotIdx) {
      currentSlots.push({ name: '' })
    }

    if (!qalId) {
      currentSlots[slotIdx] = {
        ...currentSlots[slotIdx],
        profile: undefined,
      }
      syncSlotsAndAnswers(fieldKey, currentSlots, roleLabel)
      return
    }

    const matched = telegramProfiles.find((p) => p.qalId === qalId)
    if (!matched) return

    const bound: BoundTelegramProfile = {
      fieldKey,
      roleLabel,
      slotIndex: slotIdx,
      fullName: matched.fullName || matched.accountLabel,
      idNumber: matched.idNumber,
      phone: matched.phone,
      address: matched.address,
      qalId: matched.qalId,
      text: matched.text,
    }

    currentSlots[slotIdx] = {
      name: bound.fullName,
      profile: bound,
    }

    syncSlotsAndAnswers(fieldKey, currentSlots, roleLabel)
  }

  const handleUnlinkTelegram = (
    fieldKey: string,
    slotIdx: number,
    roleLabel: string,
    currentValue: string,
  ) => {
    const currentSlots = [...getSlots(fieldKey, currentValue)]
    if (currentSlots[slotIdx]) {
      currentSlots[slotIdx] = {
        ...currentSlots[slotIdx],
        profile: undefined,
      }
      syncSlotsAndAnswers(fieldKey, currentSlots, roleLabel)
    }
  }

  const handlePrimaryChange = (
    fieldKey: string,
    value: string,
    roleLabel: string,
    currentValue: string,
  ) => {
    const currentSlots = [...getSlots(fieldKey, currentValue)]
    currentSlots[0] = {
      ...currentSlots[0],
      name: value,
    }
    syncSlotsAndAnswers(fieldKey, currentSlots, roleLabel)
  }

  const handleCoPartyChange = (
    fieldKey: string,
    slotIdx: number,
    value: string,
    roleLabel: string,
    currentValue: string,
  ) => {
    const currentSlots = [...getSlots(fieldKey, currentValue)]
    if (currentSlots[slotIdx]) {
      currentSlots[slotIdx] = {
        ...currentSlots[slotIdx],
        name: value,
      }
      syncSlotsAndAnswers(fieldKey, currentSlots, roleLabel)
    }
  }

  const handleAddCoParty = (
    fieldKey: string,
    roleLabel: string,
    currentValue: string,
  ) => {
    const currentSlots = [...getSlots(fieldKey, currentValue)]
    if (currentSlots.length >= 5) return
    currentSlots.push({ name: '' })
    syncSlotsAndAnswers(fieldKey, currentSlots, roleLabel)
  }

  const handleRemoveCoParty = (
    fieldKey: string,
    slotIdx: number,
    roleLabel: string,
    currentValue: string,
  ) => {
    const currentSlots = [...getSlots(fieldKey, currentValue)]
    if (currentSlots.length > 1 && slotIdx < currentSlots.length) {
      currentSlots.splice(slotIdx, 1)
      const reindexed = currentSlots.map((s, idx) => ({
        ...s,
        profile: s.profile ? { ...s.profile, slotIndex: idx } : undefined,
      }))
      syncSlotsAndAnswers(fieldKey, reindexed, roleLabel)
    }
  }

  const languageOptions = (
    template?.supportedLanguages?.length ? template.supportedLanguages : [...DOCUMENT_LANGUAGES]
  ).map((code) => ({
    value: code,
    label: `${LANGUAGES[code]?.nativeName ?? code} (${LANGUAGES[code]?.englishName ?? code})`,
  }))

  const getPayloadAnswers = (): Record<string, string> => {
    const serialized = serializePartyContext(partySlots, questions)
    if (serialized) {
      return { ...answers, __party_context: serialized }
    }
    return answers
  }

  const handleGenerateClick = (): void => {
    const missing: Record<string, boolean> = {}
    for (const id of missingRequiredIds) {
      missing[id] = true
    }
    if (isPromptOnly && !answers[ADDITIONAL_INSTRUCTIONS_FIELD_ID]?.trim()) {
      missing[ADDITIONAL_INSTRUCTIONS_FIELD_ID] = true
    }
    setInvalid(missing)
    if (Object.keys(missing).length > 0) return
    if (hasContent) {
      setConfirming(true)
      return
    }
    onGenerate(getPayloadAnswers())
  }

  const handleConfirmGenerate = (): void => {
    setConfirming(false)
    onGenerate(getPayloadAnswers())
  }

  return (
    <section
      className="editor-panel__section guided-fields-panel"
      aria-labelledby="editor-fields-title"
      data-testid="guided-fields-panel"
    >
      <header className="guided-fields-panel__header" data-testid="guided-fields-header">
        <div className="guided-fields-panel__header-top">
          <h2 id="editor-fields-title" className="editor-panel__title">
            {t('editor.panelFields')}
          </h2>
          <button
            type="button"
            className="guided-fields-panel__refresh-btn"
            data-testid="refresh-telegram-vault-btn"
            onClick={() => void loadTelegramProfiles()}
            title="Refresh Telegram profiles"
            aria-label="Refresh Telegram profiles"
          >
            ↻
          </button>
        </div>
      </header>

      <div className="guided-fields-panel__body" data-testid="guided-fields-body">
        <div className="guided-fields-panel__list">
          {questions.map((question) => {
            const fieldKey = (question as { key?: string; id: string }).key ?? question.id
            const isParty = isPartyFieldKey(fieldKey)
            const currentValue = answers[question.id] ?? ''
            const slots = isParty ? getSlots(fieldKey, currentValue) : []
            const primarySlot = isParty ? slots[0] : null
            const primaryDisplayValue = isParty
              ? (primarySlot?.name ?? currentValue)
              : currentValue

            // Ethiopian legal smart inputs
            const suggestion = getSmartSuggestion(question, currentValue, language)
            // Previously used party/company values from earlier documents
            const recents = getSavedSuggestionsForField(question.id, question.label).filter(
              (recent) => recent !== currentValue,
            )

            return (
              <div key={question.id} className="editor-panel__field">
                {isParty ? (
                  <div className="field">
                    <div className="guided-fields-panel__field-header-row">
                      <label className="field__label" htmlFor={`field-${question.id}`}>
                        {question.label}
                        {question.required ? (
                          <Badge variant="neutral">{t('editor.fieldsRequired')}</Badge>
                        ) : null}
                      </label>
                    </div>

                    <div className="guided-field__input-with-addon">
                      {isMultilineQuestion(question) ? (
                        <Textarea
                          id={`field-${question.id}`}
                          bare
                          rows={3}
                          value={primaryDisplayValue}
                          onChange={(e) =>
                            handlePrimaryChange(
                              fieldKey,
                              e.target.value,
                              question.label,
                              currentValue,
                            )
                          }
                          placeholder={t('editor.fieldPlaceholder')}
                          aria-invalid={invalid[question.id] ? true : undefined}
                        />
                      ) : (
                        <Input
                          id={`field-${question.id}`}
                          bare
                          value={primaryDisplayValue}
                          onChange={(e) =>
                            handlePrimaryChange(
                              fieldKey,
                              e.target.value,
                              question.label,
                              currentValue,
                            )
                          }
                          placeholder={t('editor.fieldPlaceholder')}
                          aria-invalid={invalid[question.id] ? true : undefined}
                        />
                      )}
                      <select
                        data-testid={`party-telegram-select-${fieldKey}-0`}
                        className="guided-fields-panel__party-select"
                        value={primarySlot?.profile?.qalId ?? ''}
                        aria-label={t('editor.fields.mapTelegramId')}
                        onChange={(e) =>
                          handleTelegramSelect(
                            fieldKey,
                            0,
                            e.target.value,
                            question.label,
                            currentValue,
                          )
                        }
                      >
                        <option value="">{t('editor.fields.mapTelegramId')}</option>
                        {telegramProfiles.map((acc) => (
                          <option key={acc.qalId} value={acc.qalId}>
                            {acc.fullName || acc.accountLabel} (ID: {acc.qalId})
                          </option>
                        ))}
                      </select>
                    </div>

                    {invalid[question.id] ? (
                      <p className="field__error" role="alert">
                        {t('editor.fieldRequired')}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {isMultilineQuestion(question) ? (
                      <Textarea
                        id={`field-${question.id}`}
                        label={
                          <>
                            {question.label}
                            {question.required ? (
                              <Badge variant="neutral">{t('editor.fieldsRequired')}</Badge>
                            ) : null}
                          </>
                        }
                        hint={t('editor.fieldMultilineHint')}
                        error={invalid[question.id] ? t('editor.fieldRequired') : undefined}
                        value={currentValue}
                        rows={3}
                        onChange={(e) => onAnswerChange(question.id, e.target.value)}
                        placeholder={t('editor.fieldPlaceholder')}
                      />
                    ) : (
                      <Input
                        id={`field-${question.id}`}
                        label={
                          <>
                            {question.label}
                            {question.required ? (
                              <Badge variant="neutral">{t('editor.fieldsRequired')}</Badge>
                            ) : null}
                          </>
                        }
                        error={invalid[question.id] ? t('editor.fieldRequired') : undefined}
                        value={currentValue}
                        onChange={(e) => onAnswerChange(question.id, e.target.value)}
                        placeholder={t('editor.fieldPlaceholder')}
                      />
                    )}
                  </>
                )}

                {/* Primary Telegram bound profile verified pill */}
                {isParty && primarySlot?.profile ? (
                  <div
                    className="guided-fields-panel__linked-pill"
                    data-testid={`party-telegram-pill-${fieldKey}-0`}
                  >
                    <span className="guided-fields-panel__linked-badge">
                      ✈️ {t('editor.fields.linkedTelegramBadge')}:
                    </span>
                    <span className="guided-fields-panel__linked-details">
                      {primarySlot.profile.fullName} (ID: {primarySlot.profile.qalId}
                      {primarySlot.profile.idNumber ? ` | ${primarySlot.profile.idNumber}` : ''}
                      {primarySlot.profile.address ? ` | ${primarySlot.profile.address}` : ''}
                      {primarySlot.profile.phone ? ` | ${primarySlot.profile.phone}` : ''})
                    </span>
                    <button
                      type="button"
                      className="guided-fields-panel__unlink-btn"
                      data-testid={`unlink-party-telegram-${fieldKey}-0`}
                      onClick={() => handleUnlinkTelegram(fieldKey, 0, question.label, currentValue)}
                      aria-label="Unlink Telegram ID"
                      title="Unlink"
                    >
                      ✕
                    </button>
                  </div>
                ) : null}

                {/* Co-party repeatable slots (Index 1..N) */}
                {isParty &&
                  slots.slice(1).map((coSlot, sliceIdx) => {
                    const idx = sliceIdx + 1
                    return (
                      <div
                        key={`co-party-${fieldKey}-${idx}`}
                        className="guided-fields-panel__co-party-row"
                      >
                        <div className="guided-fields-panel__co-party-header">
                          <label
                            className="field__label guided-fields-panel__co-party-label"
                            htmlFor={`co-party-input-${fieldKey}-${idx}`}
                          >
                            <span>
                              {question.label} #{idx + 1}
                            </span>
                          </label>
                        </div>
                        <div className="guided-fields-panel__co-party-input-wrap">
                          <div className="guided-field__input-with-addon">
                            <input
                              id={`co-party-input-${fieldKey}-${idx}`}
                              data-testid={`co-party-input-${fieldKey}-${idx}`}
                              className="input guided-fields-panel__co-party-input"
                              value={coSlot.name}
                              placeholder={t('editor.fieldPlaceholder')}
                              onChange={(e) =>
                                handleCoPartyChange(
                                  fieldKey,
                                  idx,
                                  e.target.value,
                                  question.label,
                                  currentValue,
                                )
                              }
                            />
                            <select
                              data-testid={`party-telegram-select-${fieldKey}-${idx}`}
                              className="guided-fields-panel__party-select"
                              value={coSlot.profile?.qalId ?? ''}
                              aria-label={t('editor.fields.mapTelegramId')}
                              onChange={(e) =>
                                handleTelegramSelect(
                                  fieldKey,
                                  idx,
                                  e.target.value,
                                  question.label,
                                  currentValue,
                                )
                              }
                            >
                              <option value="">{t('editor.fields.mapTelegramId')}</option>
                              {telegramProfiles.map((acc) => (
                                <option key={acc.qalId} value={acc.qalId}>
                                  {acc.fullName || acc.accountLabel} (ID: {acc.qalId})
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            className="guided-fields-panel__remove-co-party-btn"
                            data-testid={`remove-co-party-btn-${fieldKey}-${idx}`}
                            onClick={() =>
                              handleRemoveCoParty(fieldKey, idx, question.label, currentValue)
                            }
                            aria-label={t('editor.fields.removeCoParty')}
                            title={t('editor.fields.removeCoParty')}
                          >
                            {t('editor.fields.removeCoParty')}
                          </button>
                        </div>
                        {coSlot.profile ? (
                          <div
                            className="guided-fields-panel__linked-pill"
                            data-testid={`party-telegram-pill-${fieldKey}-${idx}`}
                          >
                            <span className="guided-fields-panel__linked-badge">
                              ✈️ {t('editor.fields.linkedTelegramBadge')}:
                            </span>
                            <span className="guided-fields-panel__linked-details">
                              {coSlot.profile.fullName} (ID: {coSlot.profile.qalId}
                              {coSlot.profile.idNumber ? ` | ${coSlot.profile.idNumber}` : ''}
                              {coSlot.profile.address ? ` | ${coSlot.profile.address}` : ''}
                              {coSlot.profile.phone ? ` | ${coSlot.profile.phone}` : ''})
                            </span>
                            <button
                              type="button"
                              className="guided-fields-panel__unlink-btn"
                              data-testid={`unlink-party-telegram-${fieldKey}-${idx}`}
                              onClick={() =>
                                handleUnlinkTelegram(fieldKey, idx, question.label, currentValue)
                              }
                              aria-label="Unlink Telegram ID"
                              title="Unlink"
                            >
                              ✕
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}

                {/* [+ Add Party] button */}
                {isParty && slots.length < 5 ? (
                  <button
                    type="button"
                    className="guided-fields-panel__add-co-party-btn"
                    data-testid={`add-co-party-btn-${fieldKey}`}
                    onClick={() => handleAddCoParty(fieldKey, question.label, currentValue)}
                  >
                    {t('editor.fields.addCoParty')}
                  </button>
                ) : null}

                {suggestion ? (
                  <SmartSuggestionChip
                    suggestion={suggestion}
                    onApply={(formatted) => {
                      if (isParty) {
                        handlePrimaryChange(fieldKey, formatted, question.label, currentValue)
                      } else {
                        onAnswerChange(question.id, formatted)
                      }
                    }}
                  />
                ) : null}
                <RecentAnswerChips
                  suggestions={recents}
                  onPick={(recent) => {
                    if (isParty) {
                      handlePrimaryChange(fieldKey, recent, question.label, currentValue)
                    } else {
                      onAnswerChange(question.id, recent)
                    }
                  }}
                />
              </div>
            )
          })}
        </div>
        {children}
      </div>

      <footer className="guided-fields-panel__footer" data-testid="guided-fields-footer">
        <div className="editor-panel__field">
          <Textarea
            id={`field-${ADDITIONAL_INSTRUCTIONS_FIELD_ID}`}
            rows={isPromptOnly ? 5 : 3}
            autoFocus={isPromptOnly && !hasContent}
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
            disabled={generationPending || (isPromptOnly && !answers[ADDITIONAL_INSTRUCTIONS_FIELD_ID]?.trim())}
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
      </footer>
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
