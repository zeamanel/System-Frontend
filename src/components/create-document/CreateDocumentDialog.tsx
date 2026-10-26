import './CreateDocumentDialog.css'

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useTemplatesList } from '../../hooks/use-templates'
import { useStartTemplateDocument } from '../../hooks/use-start-template-document'
import { ArrowRightIcon } from '../icons'
import { templateIcon } from '../templates/template-icons'
import { Button, Dialog, PanelError, SearchInput } from '../ui'
import { DesignSheetIcon } from '../designs'
import { DESIGN_CATALOG } from '../../designs/catalog'
import { useFeatures } from '../../hooks/use-features'
import { useCreateDesign } from '../../hooks/use-create-design'

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

  const templates = useTemplatesList()
  const features = useFeatures()
  const { start: startDesign, pendingId } = useCreateDesign()

  useEffect(() => {
    if (open) setFilter('')
  }, [open])

  const needle = filter.trim().toLowerCase()
  const designs = features.designs
    ? DESIGN_CATALOG.filter(
        (design) =>
          !needle ||
          t(design.titleKey).toLowerCase().includes(needle) ||
          t(design.descriptionKey).toLowerCase().includes(needle),
      )
    : []
  const items = (templates.data ?? []).filter(
    (template) =>
      !needle ||
      template.title.toLowerCase().includes(needle) ||
      template.description.toLowerCase().includes(needle),
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
        {designs.length > 0 ? (
          <div className="create-dialog__group" data-testid="create-dialog-designs">
            <p className="create-dialog__group-title">{t('designs.shelfTitle')}</p>
            <ul className="create-dialog__list">
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
            <p className="create-dialog__group-title">{t('designs.textDocumentsTitle')}</p>
          </div>
        ) : null}
        {templates.isPending ? (
          <p className="create-dialog__hint">{t('common.loading')}</p>
        ) : templates.isError ? (
          <PanelError onRetry={() => void templates.refetch()} />
        ) : items.length === 0 ? (
          <p className="create-dialog__hint">{t('createDialog.empty')}</p>
        ) : (
          <ul className="create-dialog__list">
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
                      <span className="create-dialog__item-title">
                        {template.title}
                      </span>
                      <span className="create-dialog__item-description">
                        {template.description}
                      </span>
                    </span>
                    <ArrowRightIcon size={15} className="create-dialog__item-arrow" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
