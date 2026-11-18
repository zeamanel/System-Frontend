import { display } from './fill'
import { comparable } from './tags'
import type { DocumentRecordLink } from './types'

export interface LinkDifference {
  questionId: string
  label: string
  key: string
  /** As the document has it. */
  documentValue: string
  /** As the record has it now (formatted for the document). */
  recordValue: string
}

/** Fields where the document and the record now say different things. */
export function linkDifferences(
  link: DocumentRecordLink,
  questions: ReadonlyArray<{ id: string; label: string }>,
  answers: Record<string, string>,
): LinkDifference[] {
  const labels = new Map(questions.map((question) => [question.id, question.label]))
  return Object.entries(link.fieldMap).flatMap(([questionId, key]) => {
    if (!(key in link.current)) return []
    const documentValue = (answers[questionId] ?? '').trim()
    const recordValue = display(link.collection, key, link.current[key] ?? '')
    if (comparable(link.collection, key, documentValue) === comparable(link.collection, key, recordValue)) return []
    return [{ questionId, label: labels.get(questionId) ?? questionId, key, documentValue, recordValue }]
  })
}

