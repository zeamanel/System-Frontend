import type { Block, DocumentModel, PageSize } from './types'

/**
 * The look of a bound book's pages (the typeset-interior template; backend
 * src/lib/books/interior.ts builds the same): an A5 (or A4) page with a
 * binding margin on the inside that swaps on left-hand pages, the chapter's
 * title as each page's header, page numbers, justified paragraphs, chapters
 * starting on a new page, and a drop cap opening each chapter.
 */

export interface BookLook {
  size: PageSize
  /** Extra inside margin for the binding, in millimetres. */
  gutterMm: number
}

const DEFAULT_LOOK: BookLook = { size: 'a5', gutterMm: 6 }

/**
 * Margins of a book page (left = inside, right = outside). The running header
 * and the page number take their own bands above and below, so the top and
 * bottom margins are the space between them and the text.
 */
export function bookMargins(look: BookLook): DocumentModel['page']['margins'] {
  return look.size === 'a5'
    ? { top: 10, right: 14, bottom: 10, left: 14 + look.gutterMm }
    : { top: 12, right: 18, bottom: 12, left: 18 + look.gutterMm }
}

/** The text of a heading or paragraph, without markup. */
export const plainText = (html: string): string =>
  html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()

/**
 * Applies the book look: the page set-up, and in the text a drop cap on the
 * paragraph right after each chapter title (level 1 heading) unless it is a
 * centred line, chapter titles centred, and other paragraphs justified.
 * Amharic books use Abyssinica.
 */
export function bookInteriorLook(model: DocumentModel, look: BookLook = DEFAULT_LOOK): DocumentModel {
  const blocks: Block[] = []
  let afterChapterTitle = false
  for (const block of model.blocks) {
    if (block.type === 'heading') {
      afterChapterTitle = block.level === 1
      blocks.push(block.level === 1 ? { ...block, align: 'center' } : block)
      continue
    }
    if (block.type === 'paragraph') {
      const centred = block.align === 'center' || block.align === 'right'
      // The chapter's opening paragraph gets the drop cap; a centred line (a subtitle on the title page) does not.
      const opens = afterChapterTitle && !centred && plainText(block.html).length > 1
      const { dropCap: _drop, ...rest } = block
      blocks.push({ ...rest, align: centred ? block.align : 'justify', ...(opens ? { dropCap: true } : {}) })
      if (plainText(block.html)) afterChapterTitle = false
      continue
    }
    afterChapterTitle = false
    blocks.push(block)
  }
  return {
    ...model,
    font: model.language === 'am' ? 'abyssinica' : 'serif',
    fontSize: look.size === 'a5' ? 10.5 : 11,
    style: { id: 'book-interior' },
    page: {
      ...model.page,
      size: look.size,
      orientation: 'portrait',
      margins: bookMargins(look),
      mirrorMargins: true,
      runningHeader: true,
      showPageNumbers: true,
      headerEnabled: false,
      headerHtml: '',
      bilingual: false,
    },
    blocks,
  }
}

/**
 * The chapter each page belongs to, for its running header: the last chapter
 * title (level 1 heading) on that page or before it; `starts` is true on the
 * page where a chapter begins (no header there).
 */
export function pageChapters(
  pages: ReadonlyArray<ReadonlyArray<{ id: string; from?: number }>>,
  blocksById: ReadonlyMap<string, Block>,
): Array<{ title: string; starts: boolean }> {
  let current = ''
  return pages.map((slices) => {
    let starts = false
    for (const slice of slices) {
      const block = blocksById.get(slice.id)
      // A title split over two pages starts on the first of them only.
      if (block?.type === 'heading' && block.level === 1 && !slice.from) {
        current = plainText(block.html)
        starts = true
      }
    }
    return { title: current, starts }
  })
}
