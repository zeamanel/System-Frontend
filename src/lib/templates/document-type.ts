/**
 * The "Type" filter on the templates page offers broad kinds (letter,
 * contract, …) while templates have specific types (employment_offer_letter,
 * lease_agreement, …). A template is of a kind when its type is that kind or
 * one of the words of its type names the kind.
 */
const KIND_WORDS: Record<string, readonly string[]> = {
  letter: ['letter', 'memo', 'notice'],
  contract: ['contract', 'agreement', 'lease', 'deed'],
  application: ['application', 'renewal'],
  request: ['request', 'petition'],
  certificate: ['certificate', 'certified'],
  invoice: ['invoice'],
  receipt: ['receipt'],
  minutes: ['minutes', 'resolution'],
  affidavit: ['affidavit', 'sworn'],
  cv: ['cv', 'resume'],
  report: ['report'],
  plan: ['plan'],
}

export function matchesDocumentKind(documentTypeId: string, kind: string): boolean {
  if (documentTypeId === kind) return true
  const words = KIND_WORDS[kind]
  if (!words) return false
  return documentTypeId.split(/[_-]/).some((word) => words.includes(word))
}
