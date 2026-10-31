import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { isDocumentLanguage } from '../../lib/languages'
import { refineBlockContent } from '../../lib/editor/refine-block'
import type { Block } from '../../lib/editor/types'
import { Spinner } from '../ui'

export interface BilingualFillPanelProps {
  block: Block | null
  documentLanguage: string
  templateId?: string
  /** Set the second-column translation of the block. */
  onApplySecondary: (blockId: string, html: string) => void
}

/**
 * Bilingual mode only: fill the selected paragraph's second column with a
 * translation in one click. Rewording and new clauses go through the
 * Assistant, which shows a diff and can be undone.
 */
export function BilingualFillPanel({ block, documentLanguage, templateId, onApplySecondary }: BilingualFillPanelProps) {
  const { t } = useI18n()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setError(null), [block?.id])

  if (!block || (block.type !== 'paragraph' && block.type !== 'heading')) return null
  const language = isDocumentLanguage(documentLanguage) ? documentLanguage : 'en'

  const fill = async (): Promise<void> => {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const html = await refineBlockContent({
        block,
        action: language === 'am' ? 'translate-en' : 'translate-am',
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
    <section className="editor-panel__section" aria-label={t('editor.bilingualFillTranslation')}>
      <button
        type="button"
        className="editor-refine-chip editor-refine-chip--bilingual"
        disabled={pending}
        onClick={() => void fill()}
      >
        {pending ? <Spinner size={14} /> : <span aria-hidden="true">🌐</span>} {t('editor.bilingualFillTranslation')}
      </button>
      {error ? (
        <p className="editor-panel__status editor-panel__status--error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
