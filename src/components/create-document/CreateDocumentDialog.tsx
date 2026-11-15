import './CreateDocumentDialog.css'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useTemplatesList } from '../../hooks/use-templates'
import { useStartTemplateDocument } from '../../hooks/use-start-template-document'
import { ArrowLeftIcon, ArrowRightIcon } from '../icons'
import { templateIcon } from '../templates/template-icons'
import { Button, Dialog, PanelError, SearchInput } from '../ui'
import { DesignSheetIcon } from '../designs'
import { DESIGN_CATALOG } from '../../designs/catalog'
import { useFeatures } from '../../hooks/use-features'
import { useCreateDesign } from '../../hooks/use-create-design'
import { splitCustomTemplate } from '../../lib/templates/custom'
import { useDuplicateDocument, useMyTemplates } from '../../hooks/use-documents'
import { CopyIcon } from '../icons'

export interface CreateDocumentDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Primary "create document" entry point: pick a template, then continue on
 * the template page. Replaces the Phase-1 informational dialog with real
 * navigation.
 */
export function CreateDocumentDialog({ open, onClose }: CreateDocumentDialogProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { startTemplateDocument } = useStartTemplateDocument()
  const [filter, setFilter] = useState('')
  // Documents are the main view; designs sit one tap away (and show up in a search).
  const [view, setView] = useState<'documents' | 'designs' | 'mine'>('documents')

  const templates = useTemplatesList()
  const features = useFeatures()
  const { start: startDesign, pendingId } = useCreateDesign()
  // The user's own templates: each start is a new document copied from one.
  const myTemplates = useMyTemplates(open)
  const duplicate = useDuplicateDocument()

  useEffect(() => {
    if (open) {
      setFilter('')
      setView('documents')
    }
  }, [open])

  const needle = filter.trim().toLowerCase()
  const searching = needle !== ''
  const hasDesigns = features.designs && DESIGN_CATALOG.length > 0
  const designs = hasDesigns
    ? DESIGN_CATALOG.filter(
        (design) =>
          !needle ||
          t(design.titleKey).toLowerCase().includes(needle) ||
          t(design.descriptionKey).toLowerCase().includes(needle),
      )
    : []
  // The open "write anything" template is always the first choice, whatever
  // the filter says: it is the way out when no template fits.
  const { custom, rest } = splitCustomTemplate(templates.data ?? [])
  const items = rest.filter(
    (template) =>
      !needle ||
      template.title.toLowerCase().includes(needle) ||
      template.description.toLowerCase().includes(needle),
  )
  const CustomIcon = custom ? templateIcon(custom.iconKey) : null
  const allMine = myTemplates.data ?? []
  const mine = allMine.filter((template) => !needle || template.title.toLowerCase().includes(needle))
  const hasMine = allMine.length > 0

  const mineList = (
    <ul className="create-dialog__list" data-testid="create-dialog-mine-list">
      {mine.map((template) => (
        <li key={template.id}>
          <button
            type="button"
            className="create-dialog__item"
            disabled={duplicate.isPending}
            onClick={() => {
              void duplicate.mutateAsync(template.id).then((started) => {
                onClose()
                navigate(`/documents/${encodeURIComponent(started.id)}`)
              })
            }}
          >
            <span className="create-dialog__item-icon">
              <CopyIcon size={17} />
            </span>
            <span className="create-dialog__item-text">
              <span className="create-dialog__item-title">{template.title}</span>
              <span className="create-dialog__item-description">
                {template.access === 'view' && template.ownerName ? t('documents.sharedBy', { name: template.ownerName }) : t('documents.templateBadge')}
              </span>
            </span>
            <ArrowRightIcon size={15} className="create-dialog__item-arrow" />
          </button>
        </li>
      ))}
    </ul>
  )

  const designList = (
    <ul className="create-dialog__list" data-testid="create-dialog-design-list">
      {designs.map((design) => (
        <li key={design.id}>
          <button
            type="button"
            className="create-dialog__item"
            disabled={pendingId !== null}
            onClick={() => {
              onClose()
              void startDesign(design.id)
            }}
          >
            <span className="create-dialog__item-icon">
              <DesignSheetIcon orientation={design.orientation} />
            </span>
            <span className="create-dialog__item-text">
              <span className="create-dialog__item-title">{t(design.titleKey)}</span>
              <span className="create-dialog__item-description">{t(design.descriptionKey)}</span>
            </span>
            <ArrowRightIcon size={15} className="create-dialog__item-arrow" />
          </button>
        </li>
      ))}
    </ul>
  )

  const documentList: ReactNode = templates.isPending ? (
    <p className="create-dialog__hint">{t('common.loading')}</p>
  ) : templates.isError ? (
    <PanelError onRetry={() => void templates.refetch()} />
  ) : items.length === 0 ? (
    // With a search, a design that matches is a result too.
    (designs.length > 0 || mine.length > 0) && searching ? null : <p className="create-dialog__hint">{t('createDialog.empty')}</p>
  ) : (
    <ul className="create-dialog__list" data-testid="create-dialog-document-list">
      {items.map((template) => {
        const Icon = templateIcon(template.iconKey)
        return (
          <li key={template.id}>
            <button
              type="button"
              className="create-dialog__item"
              onClick={() => {
                onClose()
                void startTemplateDocument(template)
              }}
            >
              <span className="create-dialog__item-icon">
                <Icon size={17} />
              </span>
              <span className="create-dialog__item-text">
                <span className="create-dialog__item-title">{template.title}</span>
                <span className="create-dialog__item-description">{template.description}</span>
              </span>
              <ArrowRightIcon size={15} className="create-dialog__item-arrow" />
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('createDialog.title')}
      closeLabel={t('common.close')}
      width="md"
      footer={
        <Button
          variant="ghost"
          icon={<ArrowRightIcon size={15} />}
          onClick={() => {
            onClose()
            navigate('/templates')
          }}
        >
          {t('createDialog.browseAll')}
        </Button>
      }
    >
      <div className="create-dialog">
        <SearchInput
          value={filter}
          onChange={setFilter}
          placeholder={t('createDialog.searchPlaceholder')}
          ariaLabel={t('createDialog.searchPlaceholder')}
          clearLabel={t('search.clear')}
          loading={templates.isPending}
        />
        {custom && CustomIcon ? (
          <button
            type="button"
            className="create-dialog__item create-dialog__item--pinned"
            data-testid="create-dialog-custom"
            onClick={() => {
              onClose()
              void startTemplateDocument(custom)
            }}
          >
            <span className="create-dialog__item-icon">
              <CustomIcon size={17} />
            </span>
            <span className="create-dialog__item-text">
              <span className="create-dialog__item-title">{custom.title}</span>
              <span className="create-dialog__item-description">{custom.description}</span>
            </span>
            <ArrowRightIcon size={15} className="create-dialog__item-arrow" />
          </button>
        ) : null}

        {(hasDesigns || hasMine) && !searching ? (
          <div className="create-dialog__tabs" role="tablist" aria-label={t('createDialog.title')}>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'documents'}
              className="create-dialog__tab"
              data-testid="create-dialog-tab-documents"
              onClick={() => setView('documents')}
            >
              {t('createDialog.tabDocuments')}
            </button>
            {hasMine ? (
              <button
                type="button"
                role="tab"
                aria-selected={view === 'mine'}
                className="create-dialog__tab"
                data-testid="create-dialog-tab-mine"
                onClick={() => setView('mine')}
              >
                {t('createDialog.tabMine', { count: String(allMine.length) })}
              </button>
            ) : null}
            {hasDesigns ? (
              <button
                type="button"
                role="tab"
                aria-selected={view === 'designs'}
                className="create-dialog__tab"
                data-testid="create-dialog-tab-designs"
                onClick={() => setView('designs')}
              >
                {t('createDialog.tabDesigns', { count: String(DESIGN_CATALOG.length) })}
              </button>
            ) : null}
          </div>
        ) : null}

        {searching ? (
          // A search covers everything: the user's own templates, documents, then the designs that match.
          <>
            {mine.length > 0 ? (
              <div className="create-dialog__group" data-testid="create-dialog-mine">
                <p className="create-dialog__group-title">{t('documents.tabs.templates')}</p>
                {mineList}
              </div>
            ) : null}
            {(designs.length > 0 || mine.length > 0) && items.length > 0 ? (
              <p className="create-dialog__group-title">{t('designs.textDocumentsTitle')}</p>
            ) : null}
            {documentList}
            {designs.length > 0 ? (
              <div className="create-dialog__group" data-testid="create-dialog-designs">
                <p className="create-dialog__group-title">{t('designs.shelfTitle')}</p>
                {designList}
              </div>
            ) : null}
          </>
        ) : hasMine && view === 'mine' ? (
          <div className="create-dialog__group" data-testid="create-dialog-mine">
            <button
              type="button"
              className="create-dialog__back"
              onClick={() => setView('documents')}
            >
              <ArrowLeftIcon size={14} />
              {t('createDialog.backToDocuments')}
            </button>
            {mineList}
          </div>
        ) : hasDesigns && view === 'designs' ? (
          <div className="create-dialog__group" data-testid="create-dialog-designs">
            <button
              type="button"
              className="create-dialog__back"
              data-testid="create-dialog-back"
              onClick={() => setView('documents')}
            >
              <ArrowLeftIcon size={14} />
              {t('createDialog.backToDocuments')}
            </button>
            {designList}
          </div>
        ) : (
          documentList
        )}
      </div>
    </Dialog>
  )
}
