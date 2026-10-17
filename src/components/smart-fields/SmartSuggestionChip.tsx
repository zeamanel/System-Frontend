import type { SmartSuggestion } from '../../lib/ethiopian/smart-field'
import './SmartSuggestionChip.css'

export interface SmartSuggestionChipProps {
  suggestion: SmartSuggestion
  onApply: (formatted: string) => void
}

/**
 * One-click Ethiopian legal-input suggestion pill: a dual-calendar date
 * (📅) or a tamper-proof Birr-words amount (💰). Shared by the editor's
 * guided-fields panel and the initial document-creation flow.
 */
export function SmartSuggestionChip({ suggestion, onApply }: SmartSuggestionChipProps) {
  return (
    <button
      type="button"
      className="smart-chip"
      title={suggestion.hint}
      onClick={() => onApply(suggestion.formatted)}
    >
      <span aria-hidden="true">{suggestion.kind === 'date' ? '📅' : '💰'}</span>
      {suggestion.formatted}
    </button>
  )
}
