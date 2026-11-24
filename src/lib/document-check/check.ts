import { env } from '../../config/env'
import { apiClient } from '../api'
import { blockPlainText } from '../assistant/context'
import { dataUrlImageInfo } from '../editor/image'
import { imagePrintQuality, photoBoxQuality, signatureLineQuality } from '../editor/print-quality'
import type { DocumentModel } from '../editor/types'

/**
 * Pre-print check (POST /documents/:id/check).
 *
 * The backend runs deterministic checks (placeholders, blank lines, empty
 * required fields, answers missing from the text, amounts in figures vs
 * words, Ethiopian and Gregorian dates) on the editor's current, possibly
 * unsaved, content. In demo mode, or when the backend cannot be reached, a
 * smaller local check runs instead and the result says so.
 */

export type CheckSeverity = 'error' | 'warning'

export interface DocumentCheckIssue {
  id: string
  severity: CheckSeverity
  /** Stable code; the UI translates by code with `params`. */
  code: string
  /** English fallback for codes the UI does not know. */
  message: string
  blockId?: string
  params: Record<string, string | number>
}

export interface DocumentCheckResult {
  ok: boolean
  summary: { errors: number; warnings: number }
  issues: DocumentCheckIssue[]
  /** True when only the local check ran. */
  local?: boolean
}

/**
 * Findings worth stopping for before printing: errors, and pictures that
 * would print blurry or not at all. Other warnings (a blank line to fill in
 * by hand) are shown in the assistant's check but do not interrupt printing.
 */
export const isPrintProblem = (issue: Pick<DocumentCheckIssue, 'severity' | 'code'>): boolean =>
  issue.severity === 'error' || issue.code === 'IMAGE_LOW_RESOLUTION' || issue.code === 'IMAGE_NOT_PRINTED'

export interface CheckQuestion {
  id: string
  label: string
  required?: boolean
}

export interface RunDocumentCheckInput {
  documentId: string
  model: DocumentModel
  answers: Record<string, string>
  questions: CheckQuestion[]
  signal?: AbortSignal
  /** 'print': the user is printing (the backend counts it for template health). */
  purpose?: 'print'
}

export interface RunDocumentCheckOptions {
  /** Test seam; defaults to the live API client. */
  client?: { post: <T>(path: string, body?: unknown, options?: { signal?: AbortSignal; auth?: 'required' | 'optional' }) => Promise<T> }
  dataSource?: 'fixtures' | 'http'
}

const BRACKET_PLACEHOLDER = /\[[^\]\n]{2,80}\]/g
const BLANK_LINE = /_{4,}/
const HANDWRITTEN_LINE = /signature|signed|witness|name|date|stamp|seal|ፊርማ|ስም|ቀን|ማህተም|ምስክር|mallattoo|maqaa|guyyaa|chaappaa/i

function summarize(issues: DocumentCheckIssue[], local?: boolean): DocumentCheckResult {
  const errors = issues.filter((issue) => issue.severity === 'error').length
  return { ok: errors === 0, summary: { errors, warnings: issues.length - errors }, issues, ...(local ? { local } : {}) }
}

/** What the browser can check on its own: empty text, placeholders, blanks, required fields. */
export function localDocumentCheck(
  model: DocumentModel,
  answers: Record<string, string>,
  questions: CheckQuestion[],
): DocumentCheckResult {
  const issues: DocumentCheckIssue[] = []
  const add = (issue: Omit<DocumentCheckIssue, 'id'>): void => {
    issues.push({ ...issue, id: `${issue.code}:${issue.blockId ?? 'doc'}:${issues.length}` })
  }

  let anyText = false
  for (const block of model.blocks) {
    if (block.type === 'image' || block.type === 'page-break') continue
    const text = blockPlainText(block)
    if (text.trim()) anyText = true
    for (const match of text.matchAll(BRACKET_PLACEHOLDER)) {
      add({
        severity: 'error',
        code: 'PLACEHOLDER',
        message: `"${match[0]}" still needs to be filled in.`,
        blockId: block.id,
        params: { text: match[0] },
      })
    }
    if (block.type === 'signature') continue
    for (const line of text.split('\n')) {
      if (BLANK_LINE.test(line) && !HANDWRITTEN_LINE.test(line)) {
        add({
          severity: 'warning',
          code: 'BLANK_LINE',
          message: 'A blank line is left to fill in by hand.',
          blockId: block.id,
          params: { text: line.trim().slice(0, 120) },
        })
      }
    }
  }
  if (!anyText) add({ severity: 'error', code: 'DOCUMENT_EMPTY', message: 'The document has no text yet.', params: {} })

  // Pictures the printout would leave out, or that are too small for the size they are placed at.
  for (const block of model.blocks) {
    if (block.type === 'signature') {
      for (const party of block.parties) {
        for (const [mark, slot] of [[party.signatureImage, 'signature'], [party.stampImage, 'stamp']] as const) {
          if (!mark) continue
          const quality = signatureLineQuality(dataUrlImageInfo(mark.src), slot, model.page)
          if (quality?.low) {
            const name = mark.alt.trim().slice(0, 60)
            const pixels = dataUrlImageInfo(mark.src).width ?? 0
            add({
              severity: 'warning',
              code: 'IMAGE_LOW_RESOLUTION',
              message: `${name ? `"${name}"` : 'A picture'} is ${pixels} pixels wide: at ${quality.widthMm} mm it prints at about ${quality.dpi} dpi and may look blurry.`,
              blockId: block.id,
              params: { name, pixels, widthMm: quality.widthMm, dpi: quality.dpi, sharpMm: quality.sharpMm },
            })
          }
        }
      }
      continue
    }
    if ((block.type === 'heading' || block.type === 'paragraph') && block.photoBox?.src) {
      const info = dataUrlImageInfo(block.photoBox.src)
      const quality = photoBoxQuality(info, block.photoBox.size)
      if (quality?.low) {
        const name = (block.photoBox.alt ?? '').trim().slice(0, 60)
        add({
          severity: 'warning',
          code: 'IMAGE_LOW_RESOLUTION',
          message: `${name ? `"${name}"` : 'A picture'} is ${info.width} pixels wide: at ${quality.widthMm} mm it prints at about ${quality.dpi} dpi and may look blurry.`,
          blockId: block.id,
          params: { name, pixels: info.width ?? 0, widthMm: quality.widthMm, dpi: quality.dpi, sharpMm: quality.sharpMm },
        })
      }
      continue
    }
    if (block.type !== 'image') continue
    const name = block.alt.trim().slice(0, 60)
    if (!dataUrlImageInfo(block.src).printable) {
      add({
        severity: 'warning',
        code: 'IMAGE_NOT_PRINTED',
        message: `${name ? `"${name}"` : 'A picture'} is not a PNG or JPEG picture stored in the document, so it is left out of the PDF and Word file.`,
        blockId: block.id,
        params: { name },
      })
      continue
    }
    const quality = imagePrintQuality(block, model.page)
    if (quality?.low) {
      const pixels = dataUrlImageInfo(block.src).width ?? 0
      add({
        severity: 'warning',
        code: 'IMAGE_LOW_RESOLUTION',
        message: `${name ? `"${name}"` : 'A picture'} is ${pixels} pixels wide: at ${quality.widthMm} mm it prints at about ${quality.dpi} dpi and may look blurry.`,
        blockId: block.id,
        params: { name, pixels, widthMm: quality.widthMm, dpi: quality.dpi, sharpMm: quality.sharpMm },
      })
    }
  }

  for (const question of questions) {
    if (question.required && !(answers[question.id] ?? '').trim()) {
      add({
        severity: 'warning',
        code: 'REQUIRED_FIELD_EMPTY',
        message: `The required field "${question.label}" is empty.`,
        params: { fieldId: question.id, label: question.label },
      })
    }
  }
  return summarize(issues, true)
}

function isResult(value: unknown): value is Omit<DocumentCheckResult, 'local'> {
  const candidate = value as Partial<DocumentCheckResult> | null
  return Boolean(candidate && Array.isArray(candidate.issues) && candidate.summary)
}

export async function runDocumentCheck(
  input: RunDocumentCheckInput,
  options: RunDocumentCheckOptions = {},
): Promise<DocumentCheckResult> {
  const dataSource = options.dataSource ?? env.dataSource
  if (dataSource !== 'http' && !options.client) {
    return localDocumentCheck(input.model, input.answers, input.questions)
  }
  const client = options.client ?? apiClient
  try {
    const response = await client.post<unknown>(
      `/documents/${encodeURIComponent(input.documentId)}/check`,
      // Images carry no checkable text: their data stays out of the request (slow connections),
      // and what was read from each (size, and whether it can be printed) goes instead.
      {
        content: {
          ...input.model,
          blocks: input.model.blocks.map((block) => {
            if (block.type === 'image') return { ...block, src: '', srcInfo: dataUrlImageInfo(block.src) }
            if ((block.type === 'heading' || block.type === 'paragraph') && block.photoBox?.src) {
              return { ...block, photoBox: { ...block.photoBox, src: '', srcInfo: dataUrlImageInfo(block.photoBox.src) } }
            }
            if (block.type !== 'signature') return block
            const light = (mark?: { src: string; alt: string }) => (mark ? { alt: mark.alt, src: '', srcInfo: dataUrlImageInfo(mark.src) } : undefined)
            return {
              ...block,
              parties: block.parties.map((party) => ({
                ...party,
                ...(party.signatureImage ? { signatureImage: light(party.signatureImage) } : {}),
                ...(party.stampImage ? { stampImage: light(party.stampImage) } : {}),
              })),
            }
          }),
        },
        answers: input.answers,
        ...(input.purpose ? { purpose: input.purpose } : {}),
      },
      { signal: input.signal, auth: 'required' },
    )
    if (isResult(response)) {
      return summarize(
        response.issues.map((issue) => ({ ...issue, params: issue.params ?? {} })),
      )
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
  }
  return localDocumentCheck(input.model, input.answers, input.questions)
}
