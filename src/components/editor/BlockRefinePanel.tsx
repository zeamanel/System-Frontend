import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { isDocumentLanguage } from '../../lib/languages'
import { refineBlockContent, type RefineAction } from '../../lib/editor/refine-block'
import { escapePlainText } from '../../lib/editor/sanitize'
import type { Block } from '../../lib/editor/types'
import { Button, Spinner } from '../ui'

export interface BlockRefinePanelProps {
  block: Block | null
  /** Document language — drives register, expansion language and translate target. */
  documentLanguage: string
  templateId?: string
  /** Replace exactly one block's inline HTML (surgical, siblings untouched). */
  onApply: (blockId: string, html: string) => void
  /** Insert a newly drafted block onto the canvas when no block was selected. */
  onInsertBlock?: (html: string) => void
  /** When true, bilingual mode is active in the document. */
  bilingual?: boolean
  /** Populate or update the second column translation for the block. */
  onApplySecondary?: (blockId: string, html: string) => void
}

/**
 * Scoped AI clause refinement & drafting:
 * - When a block is selected: refine it (formalize, concise, expand, translate, or custom instruction).
 * - When no block is selected: draft a new clause from prompt and insert it directly onto the A4 canvas.
 */
export function BlockRefinePanel({
  block,
  documentLanguage,
  onApply,
  onInsertBlock,
  bilingual = false,
  onApplySecondary,
  templateId,
}: BlockRefinePanelProps) {
  const { t } = useI18n()
  const [proposal, setProposal] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('')

  const isTextBlock = block?.type === 'paragraph' || block?.type === 'heading'

  // A proposal belongs to exactly one block context; switching selection drops it.
  useEffect(() => {
    setProposal(null)
    setError(null)
  }, [block?.id])

  const language = isDocumentLanguage(documentLanguage) ? documentLanguage : 'en'
  const translateTarget: 'am' | 'en' = language === 'am' ? 'en' : 'am'
  const translateLabel = translateTarget === 'am' ? '→ አማርኛ' : '→ English'

  const runRefinement = async (action: RefineAction, customInstruction?: string): Promise<void> => {
    if (!isTextBlock || !block || pending) return
    setPending(true)
    setError(null)
    try {
      const html = await refineBlockContent({
        block,
        action,
        instruction: customInstruction,
        documentLanguage: language,
        templateId,
      })
      setProposal(html)
    } catch {
      setError(t('editor.refineError'))
    } finally {
      setPending(false)
    }
  }

  const runDraftClause = async (): Promise<void> => {
    if (!instruction.trim() || pending) return
    setPending(true)
    setError(null)
    try {
      const syntheticBlock: Block = {
        id: 'new-clause',
        type: 'paragraph',
        html: escapePlainText(instruction.trim()),
        align: 'left',
        indent: 0,
        spacing: 'normal',
      }
      const html = await refineBlockContent({
        block: syntheticBlock,
        action: 'formalize',
        instruction: instruction.trim(),
        documentLanguage: language,
        templateId,
      })
      setProposal(html)
    } catch {
      setError(t('editor.refineError'))
    } finally {
      setPending(false)
    }
  }

  const applyProposal = (): void => {
    if (proposal === null) return
    if (block) {
      onApply(block.id, proposal)
    } else if (onInsertBlock) {
      onInsertBlock(proposal)
      setInstruction('')
    }
    setProposal(null)
  }

  const fillBilingualTranslation = async (): Promise<void> => {
    if (!isTextBlock || !block || pending || !onApplySecondary) return
    setPending(true)
    setError(null)
    try {
      const action: RefineAction = language === 'am' ? 'translate-en' : 'translate-am'
      const html = await refineBlockContent({
        block,
        action,
        documentLanguage: language,
        templateId,
      })
      onApplySecondary(block.id, html)
    } catch {
      setError(t('editor.refineError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="editor-panel__section" aria-labelledby="format-refine">
      <h2 id="format-refine" className="editor-panel__title">
        {t('editor.refineTitle')}
      </h2>

      {!isTextBlock ? (
        <>
          <p className="editor-panel__hint">{t('editor.refineHint')}</p>
          <form
            className="editor-refine-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (instruction.trim()) void runDraftClause()
            }}
          >
            <input
              className="editor-refine-input"
              value={instruction}
              placeholder={t('editor.insertClausePlaceholder')}
              aria-label={t('editor.draftNewClause')}
              disabled={pending}
              onChange={(event) => setInstruction(event.target.value)}
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={pending}
              disabled={!instruction.trim()}
            >
              {t('editor.draftNewClause')}
            </Button>
          </form>
        </>
      ) : (
        <>
          <div className="editor-refine-chips" role="group" aria-label={t('editor.refineTitle')}>
            <button
              type="button"
              className="editor-refine-chip"
              disabled={pending}
              onClick={() => void runRefinement('formalize')}
            >
              <span aria-hidden="true">✨</span> {t('editor.refineFormalize')}
            </button>
            <button
              type="button"
              className="editor-refine-chip"
              disabled={pending}
              onClick={() => void runRefinement('concise')}
            >
              <span aria-hidden="true">✂️</span> {t('editor.refineConcise')}
            </button>
            <button
              type="button"
              className="editor-refine-chip"
              disabled={pending}
              onClick={() => void runRefinement('expand')}
            >
              <span aria-hidden="true">➕</span> {t('editor.refineExpand')}
            </button>
            <button
              type="button"
              className="editor-refine-chip"
              aria-label={t('editor.refineTranslate')}
              disabled={pending}
              onClick={() =>
                void runRefinement(translateTarget === 'am' ? 'translate-am' : 'translate-en')
              }
            >
              <span aria-hidden="true">🌐</span> {translateLabel}
            </button>
            {bilingual && onApplySecondary ? (
              <button
                type="button"
                className="editor-refine-chip editor-refine-chip--bilingual"
                disabled={pending}
                onClick={() => void fillBilingualTranslation()}
              >
                <span aria-hidden="true">🌐</span> {t('editor.bilingualFillTranslation')}
              </button>
            ) : null}
          </div>

          <form
            className="editor-refine-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (instruction.trim()) void runRefinement('custom', instruction.trim())
            }}
          >
            <input
              className="editor-refine-input"
              value={instruction}
              placeholder={t('editor.refineCustomPlaceholder')}
              aria-label={t('editor.refineButton')}
              disabled={pending}
              onChange={(event) => setInstruction(event.target.value)}
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              loading={pending}
              disabled={!instruction.trim()}
            >
              {t('editor.refineButton')}
            </Button>
          </form>
        </>
      )}

      {pending ? (
        <p className="editor-panel__status editor-panel__status--muted">
          <Spinner size={14} /> {t('editor.generating')}
        </p>
      ) : null}

      {error ? (
        <p className="editor-panel__status editor-panel__status--error" role="alert">
          {error}
        </p>
      ) : null}

      {proposal !== null ? (
        <div className="editor-refine-preview" data-testid="editor-refine-preview">
          <p className="editor-refine-preview__label">{t('editor.refinePreview')}</p>
          <p
            className="editor-refine-preview__new"
            dangerouslySetInnerHTML={{ __html: proposal }}
          />
          <div className="editor-refine-preview__actions">
            <Button variant="primary" size="sm" onClick={applyProposal}>
              {t('editor.refineApply')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setProposal(null)}>
              {t('editor.refineDiscard')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
