import { env } from '../../config/env'
import { apiClient } from '../api'
import type { Clause, ClauseInput } from './types'

/**
 * The clause library over /clauses. Demo mode keeps clauses in localStorage
 * (a demo store only: real clauses are saved on the server).
 */

const DEMO_KEY = 'docuA4.fixture.clauses'

const isHttp = (): boolean => env.dataSource === 'http'

function readDemo(): Clause[] {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(DEMO_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? (parsed as Clause[]) : []
  } catch {
    return []
  }
}

function writeDemo(list: Clause[]): void {
  try {
    globalThis.localStorage?.setItem(DEMO_KEY, JSON.stringify(list))
  } catch {
    // Storage full or unavailable: the demo list simply is not kept.
  }
}

/** The same tidying the server does: one-line titles, paragraphs kept, stray spacing gone. */
export const tidyClauseTitle = (value: string): string => value.replace(/\s+/g, ' ').trim()
export function tidyClauseBody(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Paragraphs of a clause, in order (blank lines separate them; single line breaks join with a space). */
export function clauseParagraphs(body: string): string[] {
  return tidyClauseBody(body)
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
}

const recency = (clause: Clause): string => clause.lastUsedAt ?? clause.createdAt

/** Clauses matching `query` in title or text, last used (or newest) first. */
export async function listClauses(query = '', signal?: AbortSignal): Promise<Clause[]> {
  const q = query.trim()
  if (isHttp()) {
    return apiClient.get<Clause[]>(`/clauses${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
      signal,
      auth: 'required',
    })
  }
  const needle = q.toLowerCase()
  return readDemo()
    .filter((c) => !needle || c.title.toLowerCase().includes(needle) || c.body.toLowerCase().includes(needle))
    .sort((a, b) => recency(b).localeCompare(recency(a)) || b.useCount - a.useCount)
}

export async function saveClause(input: ClauseInput): Promise<Clause> {
  const body = { title: tidyClauseTitle(input.title), body: tidyClauseBody(input.body), language: input.language }
  if (isHttp()) return apiClient.post<Clause>('/clauses', body, { auth: 'required' })
  const now = new Date().toISOString()
  const clause: Clause = {
    id: globalThis.crypto.randomUUID(),
    title: body.title,
    body: body.body,
    language: body.language ?? 'en',
    shared: false,
    mine: true,
    canManage: true,
    useCount: 0,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  writeDemo([clause, ...readDemo()])
  return clause
}

export async function updateClause(id: string, input: Partial<ClauseInput>): Promise<Clause> {
  const patch = {
    ...(input.title === undefined ? {} : { title: tidyClauseTitle(input.title) }),
    ...(input.body === undefined ? {} : { body: tidyClauseBody(input.body) }),
    ...(input.language === undefined ? {} : { language: input.language }),
  }
  if (isHttp()) return apiClient.patch<Clause>(`/clauses/${encodeURIComponent(id)}`, patch, { auth: 'required' })
  const list = readDemo()
  const current = list.find((c) => c.id === id)
  if (!current) throw new Error('Clause not found')
  const updated: Clause = { ...current, ...patch, updatedAt: new Date().toISOString() }
  writeDemo(list.map((c) => (c.id === id ? updated : c)))
  return updated
}

/** Counts an insertion. Best effort: a failure never blocks the insert. */
export async function markClauseUsed(id: string): Promise<void> {
  try {
    if (isHttp()) {
      await apiClient.post<Clause>(`/clauses/${encodeURIComponent(id)}/use`, {}, { auth: 'required' })
      return
    }
    writeDemo(
      readDemo().map((c) =>
        c.id === id ? { ...c, useCount: c.useCount + 1, lastUsedAt: new Date().toISOString() } : c,
      ),
    )
  } catch {
    // Offline or the clause is gone: the count simply is not updated.
  }
}

export async function deleteClause(id: string): Promise<void> {
  if (isHttp()) {
    await apiClient.delete<void>(`/clauses/${encodeURIComponent(id)}`, { auth: 'required' })
    return
  }
  writeDemo(readDemo().filter((c) => c.id !== id))
}
