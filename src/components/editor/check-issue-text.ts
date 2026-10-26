import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import type { DocumentCheckIssue } from '../../lib/document-check/check'

/** Text of a check issue in the user's language (English fallback from the server). */
export function useIssueText(): (issue: DocumentCheckIssue) => string {
  const { t } = useI18n()
  return (issue) => {
    const key = `check.issue.${issue.code}`
    if (!(key in CHECK_ISSUE_KEYS)) return issue.message
    const params = Object.fromEntries(
      // Long runs of underscores or dots read as noise: shorten them.
      Object.entries(issue.params).map(([k, v]) => [k, String(v).replace(/_{4,}/g, '____').replace(/\.{6,}/g, '……')]),
    )
    return t(key as MessageKey, params)
  }
}

const CHECK_ISSUE_KEYS: Record<string, true> = {
  'check.issue.DOCUMENT_EMPTY': true,
  'check.issue.PLACEHOLDER': true,
  'check.issue.BLANK_LINE': true,
  'check.issue.REQUIRED_FIELD_EMPTY': true,
  'check.issue.ANSWER_NOT_IN_DOCUMENT': true,
  'check.issue.AMOUNT_WORDS_MISMATCH': true,
  'check.issue.ETHIOPIAN_DATE_INVALID': true,
  'check.issue.ETHIOPIAN_YEAR_LOOKS_GREGORIAN': true,
  'check.issue.DATE_INVALID': true,
}
