import { useI18n } from '../../i18n'
import './RecentAnswerChips.css'

export interface RecentAnswerChipsProps {
  suggestions: string[]
  onPick: (value: string) => void
}

/**
 * Up to two one-click "recently used" pills for reusable party /
 * organization fields (employer, landlord, TIN, …), so repeat users fill
 * their own details in a single click instead of retyping them.
 */
export function RecentAnswerChips({ suggestions, onPick }: RecentAnswerChipsProps) {
  const { t } = useI18n()
  const visible = suggestions.slice(0, 2)
  if (visible.length === 0) return null
  return (
    <div className="recent-chips">
      {visible.map((value) => (
        <button
          key={value}
          type="button"
          className="recent-chip"
          title={value}
          onClick={() => onPick(value)}
        >
          <span aria-hidden="true">↺</span>
          {t('flow.recentAnswer')}: {value}
        </button>
      ))}
    </div>
  )
}
