/** The open "write anything" template: a blank A4 page, typed by hand or prompted to the AI. */
export const CUSTOM_DOCUMENT_TYPE_ID = 'custom_ai_document'

export function isCustomTemplate(template: { documentTypeId: string }): boolean {
  return template.documentTypeId === CUSTOM_DOCUMENT_TYPE_ID
}

/** Splits the open template from the rest so it can be pinned above the list. */
export function splitCustomTemplate<T extends { documentTypeId: string }>(
  templates: readonly T[],
): { custom: T | null; rest: T[] } {
  const custom = templates.find(isCustomTemplate) ?? null
  return { custom, rest: templates.filter((template) => !isCustomTemplate(template)) }
}
