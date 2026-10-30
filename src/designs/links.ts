/**
 * Links from text templates to the graphic design that suits them, with the
 * template answers that fill the design's fields. "Open in Graphic Design"
 * creates a new design document from these values; the text document is
 * left as it is.
 *
 * Kept free of design code (pages, themes) so the editor can import it
 * without loading the designs bundle.
 */

export interface DesignLink {
  designId: string
  /** Design field values from the template answers (only fields that have something). */
  fill: (answers: Record<string, string>) => Record<string, string>
}

const ETHIOPIC = /[ሀ-፿ⶀ-⷟꬀-꬯]/

const hasEthiopic = (value: string): boolean => ETHIOPIC.test(value)
const hasLatin = (value: string): boolean => /[A-Za-z]/.test(value)

function answer(answers: Record<string, string>, id: string): string {
  return (answers[id] ?? '').trim()
}

/** A name goes to the Amharic or English field by the script it is written in. */
function nameFields(name: string, amField: string, enField: string): Record<string, string> {
  if (!name) return {}
  return hasEthiopic(name) ? { [amField]: name } : { [enField]: name }
}

function workExperienceCertificate(answers: Record<string, string>): Record<string, string> {
  const name = answer(answers, 'employee_name')
  const organization = answer(answers, 'employer_organization')
  const job = answer(answers, 'job_title')
  const start = answer(answers, 'employment_start_date')
  const end = answer(answers, 'employment_end_date')
  const parts = [organization, job]
  const period = start && end ? { am: ` ከ${start} እስከ ${end}`, en: ` from ${start} to ${end}` } : { am: '', en: '' }

  const fields: Record<string, string> = {
    titleAm: 'የሥራ ልምድ ማስረጃ',
    titleEn: 'Certificate of Service',
    awardedAm: 'ይህ የሥራ ልምድ ማስረጃ የተሰጠው ለ',
    awardedEn: 'This certificate of service is issued to',
    signer2Role: 'የሰው ሀብት · Human Resources',
    ...nameFields(name, 'recipientAm', 'recipientEn'),
  }
  // Each sentence only when its words are in that language, so no half-translated lines.
  if (job && organization && parts.some(hasEthiopic)) {
    fields.bodyAm = `በ${organization}${period.am} በ${job} የሥራ መደብ ላገለገሉበት።`
  }
  if (job && organization && parts.every(hasLatin) && !parts.some(hasEthiopic)) {
    fields.bodyEn = `For serving as ${job} at ${organization}${period.en}.`
  }
  return fields
}

export const DESIGN_LINKS: Readonly<Record<string, DesignLink>> = {
  work_experience_certificate: { designId: 'certificate-classic', fill: workExperienceCertificate },
}

export function designLinkFor(documentTypeId: string | null | undefined): DesignLink | null {
  if (!documentTypeId) return null
  return Object.hasOwn(DESIGN_LINKS, documentTypeId) ? DESIGN_LINKS[documentTypeId] : null
}
