import './ClauseLibraryDialog.css'

import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { useDebouncedValue } from '../../hooks/use-debounced-value'
import { useClauses, useDeleteClause, useMarkClauseUsed, useSaveClause, useUpdateClause } from '../../hooks/use-clauses'
import type { Clause } from '../../lib/clauses/types'
import { MAX_CLAUSE_BODY, MAX_CLAUSE_TITLE } from '../../lib/clauses/types'
import { Badge, Button, Dialog, Input, PanelError, PanelLoading, SearchInput, Textarea, useToast } from '../ui'

export interface ClauseLibraryDialogProps {
  open: boolean
  onClose: () => void
  /** The document's language: new clauses are saved in it. */
  language: string
  /** Text selected on the page (or the paragraph the caret is in) when the dialog opened. */
  draftText: string
  /** False while the page cannot be edited (a generation is running, preview). */
  canInsert: boolean
  onInsert: (clause: Clause) => void
}

type View = { kind: 'list' } | { kind: 'edit'; clause: Clause | null; title: string; body: string }

/** First words of the text, as a suggested title. */
function suggestTitle(text: string): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ')
  return words.length > 60 ? `${words.slice(0, 60).trimEnd()}…` : words
}

/**
 * The clause library: passages saved once (payment terms, a confidentiality
 * clause) and inserted into any document where the caret is.
 */
export function ClauseLibraryDialog({ open, onClose, language, draftText, canInsert, onInsert }: ClauseLibraryDialogProps) {
  const { t } = useI18n()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, 250)
  const [view, setView] = useState<View>({ kind: 'list' })
  const clauses = useClauses(debounced, open)
  const save = useSaveClause()
  const update = useUpdateClause()
  const remove = useDeleteClause()
  const markUsed = useMarkClauseUsed()

  // Each opening starts on the list.
  useEffect(() => {
    if (open) setView({ kind: 'list' })
  }, [open])

  const startNew = (text: string): void => {
    const body = text.slice(0, MAX_CLAUSE_BODY)
    setView({ kind: 'edit', clause: null, title: suggestTitle(body), body })
  }

  const insert = (clause: Clause): void => {
    onInsert(clause)
    markUsed.mutate(clause.id)
    onClose()
  }

  const confirmDelete = async (clause: Clause): Promise<void> => {
    if (!window.confirm(t('clauses.confirmDelete', { title: clause.title }))) return
    try {
      await remove.mutateAsync(clause.id)
      toast.push(t('clauses.deleted'), { variant: 'success' })
    } catch {
      toast.push(t('clauses.failed'), { variant: 'error' })
    }
  }

  const submit = async (): Promise<void> => {
    if (view.kind !== 'edit') return
    const input = { title: view.title, body: view.body }
    try {
      if (view.clause) {
        await update.mutateAsync({ id: view.clause.id, input })
      } else {
        await save.mutateAsync({ ...input, language })
      }
      toast.push(t('clauses.saved'), { variant: 'success' })
      setView({ kind: 'list' })
    } catch {
      toast.push(t('clauses.failed'), { variant: 'error' })
    }
  }

  const items = clauses.data ?? []
  const draft = draftText.trim()

  return (
    <Dialog open={open} onClose={onClose} title={t('clauses.title')} closeLabel={t('common.close')} width="md">
      {view.kind === 'edit' ? (
        <form
          className="clause-library__form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <Input
            label={t('clauses.name')}
            value={view.title}
            maxLength={MAX_CLAUSE_TITLE}
            required
            autoFocus
            onChange={(event) => setView({ ...view, title: event.target.value })}
            data-testid="clause-title"
          />
          <Textarea
            label={t('clauses.text')}
            hint={t('clauses.textHint')}
            hintMode="always"
            value={view.body}
            rows={8}
            maxLength={MAX_CLAUSE_BODY}
            required
            onChange={(event) => setView({ ...view, body: event.target.value })}
            data-testid="clause-body"
          />
          <div className="clause-library__form-actions">
            <Button variant="ghost" type="button" onClick={() => setView({ kind: 'list' })}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={save.isPending || update.isPending}
              disabled={!view.title.trim() || !view.body.trim()}
              data-testid="clause-save"
            >
              {t('common.save')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="clause-library">
          <p className="clause-library__hint">{t('clauses.hint')}</p>
          <div className="clause-library__bar">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={t('clauses.search')}
              ariaLabel={t('clauses.search')}
              clearLabel={t('clauses.clearSearch')}
              loading={clauses.isFetching && Boolean(debounced)}
            />
            <Button variant="secondary" size="sm" onClick={() => startNew(draft)} data-testid="clause-new">
              {draft ? t('clauses.saveSelection') : t('clauses.new')}
            </Button>
          </div>

          {clauses.isPending ? (
            <PanelLoading />
          ) : clauses.isError ? (
            <PanelError onRetry={() => void clauses.refetch()} />
          ) : items.length === 0 ? (
            <p className="clause-library__empty" data-testid="clause-empty">
              {debounced.trim() ? t('clauses.noMatch') : t('clauses.empty')}
            </p>
          ) : (
            <ul className="clause-library__list" data-testid="clause-list">
              {items.map((clause) => (
                <li key={clause.id} className="clause-library__item">
                  <div className="clause-library__text">
                    <span className="clause-library__name">
                      {clause.title}
                      {clause.language !== language ? <Badge variant="neutral">{clause.language.toUpperCase()}</Badge> : null}
                      {clause.shared && !clause.mine ? <Badge variant="info">{t('clauses.shared')}</Badge> : null}
                    </span>
                    <span className="clause-library__preview">{clause.body}</span>
                  </div>
                  <div className="clause-library__actions">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!canInsert}
                      onClick={() => insert(clause)}
                      aria-label={t('clauses.insertNamed', { title: clause.title })}
                      data-testid="clause-insert"
                    >
                      {t('clauses.insert')}
                    </Button>
                    {clause.canManage ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setView({ kind: 'edit', clause, title: clause.title, body: clause.body })}
                          aria-label={t('clauses.editNamed', { title: clause.title })}
                        >
                          {t('clauses.edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void confirmDelete(clause)}
                          aria-label={t('clauses.deleteNamed', { title: clause.title })}
                          data-testid="clause-delete"
                        >
                          {t('clauses.delete')}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  )
}
