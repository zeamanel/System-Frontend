import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { isDocumentLanguage } from '../../lib/languages'
import { refineBlockContent, type RefineAction } from '../../lib/editor/refine-block'
import type { Block } from '../../lib/editor/types'
import { Button, Spinner } from '../ui'

export interface BlockRefinePanelProps {
  block: Block | null
  /** Document language — drives register, expansion language and translate target. */
  documentLanguage: string
  /** Replace exactly one block's inline HTML (surgical, siblings untouched). */
  onApply: (blockId: string, html: string) => void
  /** When true, bilingual mode is active in the document. */
  bilingual?: boolean
  /** Populate or update the second column translation for the block. */
  onApplySecondary?: (blockId: string, html: string) => void
}

/**
 * Scoped AI clause refinement for the active paragraph/heading: pick a
 * preset (or type an instruction), review the proposal in a non-destructive
 * preview, then apply it to *only* that block or discard it. Nothing is
 * written to the document until "Apply to block" is clicked.
 */
export function BlockRefinePanel({
  block,
  documentLanguage,
  onApply,
  bilingual = false,
  onApplySecondary,
}: BlockRefinePanelProps) {
  const { t } = useI18n()
  const [proposal, setProposal] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('')

  const isTextBlock = block?.type === 'paragraph' || block?.type === 'heading'

  // A proposal belongs to exactly one block; switching selection drops it.
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
      })
      setProposal(html)
    } catch {
      setError(t('editor.refineError'))
    } finally {
      setPending(false)
    }
  }

  const applyProposal = (): void => {
    if (!block || proposal === null) return
    onApply(block.id, proposal)
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
        <p className="editor-panel__hint">{t('editor.refineHint')}</p>
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
        </>
      )}
    </section>
  )
}
