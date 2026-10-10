/**
 * Inline formatting commands.
 *
 * `document.execCommand` is formally deprecated yet remains the only small,
 * universally implemented API for selection-based rich-text editing (all
 * engines ship it; the replacement — beforeinput + manual Range surgery —
 * would be a framework of its own). It is isolated here so a future swap is
 * a single-module change. jsdom and other hosts without the API degrade to
 * no-ops rather than throwing.
 */

export type InlineCommand = 'bold' | 'italic' | 'underline'

function hasExecCommand(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof document.execCommand === 'function'
  )
}

/** Apply an inline format to the current selection inside a contenteditable. */
export function execInlineCommand(command: InlineCommand): boolean {
  if (!hasExecCommand()) return false
  try {
    return document.execCommand(command, false)
  } catch {
    return false
  }
}

export interface InlineFormatState {
  bold: boolean
  italic: boolean
  underline: boolean
}

export function queryInlineState(): InlineFormatState {
  const empty: InlineFormatState = { bold: false, italic: false, underline: false }
  const doc = (typeof document !== 'undefined' ? document : undefined) as
    | (Document & { queryCommandState?: (command: string) => boolean })
    | undefined
  if (!doc || typeof doc.queryCommandState !== 'function') return empty
  try {
    return {
      bold: doc.queryCommandState('bold'),
      italic: doc.queryCommandState('italic'),
      underline: doc.queryCommandState('underline'),
    }
  } catch {
    return empty
  }
}

/**
 * Insert plain text at the caret (paste path). Using the text-only command
 * guarantees pasted markup never enters the document un-sanitized.
 */
export function insertPlainText(text: string): boolean {
  if (!hasExecCommand() || typeof document.execCommand !== 'function') return false
  try {
    return document.execCommand('insertText', false, text)
  } catch {
    return false
  }
}
