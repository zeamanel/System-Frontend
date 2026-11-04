import type { BlockViewProps } from './BlockView'

/**
 * When a block on the page needs to render again. Model edits keep every
 * untouched block the same object, and the workspace passes a stable `api`,
 * `labels` and `onImageLoad`, so typing re-renders only the edited block (and
 * the one losing or gaining the "active" outline).
 */
export function blockViewPropsEqual(previous: BlockViewProps, next: BlockViewProps): boolean {
  return (
    previous.block === next.block &&
    previous.editable === next.editable &&
    previous.active === next.active &&
    previous.api === next.api &&
    previous.labels === next.labels &&
    previous.onImageLoad === next.onImageLoad &&
    Boolean(previous.bilingual) === Boolean(next.bilingual) &&
    previous.range?.from === next.range?.from &&
    previous.range?.to === next.range?.to &&
    previous.tone === next.tone
  )
}
