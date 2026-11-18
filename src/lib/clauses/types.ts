/** A saved clause (GET /clauses). */
export interface Clause {
  id: string
  title: string
  /** Plain text; blank lines separate paragraphs. */
  body: string
  language: string
  /** Shared with the organization (false: personal). */
  shared: boolean
  /** The signed-in user saved it. */
  mine: boolean
  /** The signed-in user may edit or delete it (its author, or an owner or admin). */
  canManage: boolean
  useCount: number
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ClauseInput {
  title: string
  body: string
  language?: string
}

export const MAX_CLAUSE_TITLE = 120
export const MAX_CLAUSE_BODY = 10_000
