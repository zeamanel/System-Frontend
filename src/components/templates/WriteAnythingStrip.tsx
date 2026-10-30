import '../create-document/CreateDocumentDialog.css'

import { useStartTemplateDocument } from '../../hooks/use-start-template-document'
import { useTemplatesList } from '../../hooks/use-templates'
import { splitCustomTemplate } from '../../lib/templates/custom'
import { ArrowRightIcon } from '../icons'
import { templateIcon } from './template-icons'

/**
 * The open "write anything" template, always first on the Templates page:
 * the way out when no template fits. Renders nothing until it is loaded.
 */
export function WriteAnythingStrip() {
  const templates = useTemplatesList()
  const { startTemplateDocument, isStarting } = useStartTemplateDocument()
  const { custom } = splitCustomTemplate(templates.data ?? [])
  if (!custom) return null
  const Icon = templateIcon(custom.iconKey)

  return (
    <div className="create-dialog">
      <button
        type="button"
        className="create-dialog__item create-dialog__item--pinned"
        data-testid="templates-write-anything"
        disabled={isStarting}
        onClick={() => void startTemplateDocument(custom)}
      >
        <span className="create-dialog__item-icon">
          <Icon size={17} />
        </span>
        <span className="create-dialog__item-text">
          <span className="create-dialog__item-title">{custom.title}</span>
          <span className="create-dialog__item-description">{custom.description}</span>
        </span>
        <ArrowRightIcon size={15} className="create-dialog__item-arrow" />
      </button>
    </div>
  )
}
