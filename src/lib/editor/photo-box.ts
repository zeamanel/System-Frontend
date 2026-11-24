/**
 * Documents that usually carry the person's photo: a CV, an ID or passport
 * application, a registration or membership form, an admission form. The
 * editor offers a photo box on them in one click.
 */
const PHOTO_DOCUMENTS = /(^|_)(cv|resume|curriculum|biodata|bio_data|national_id|id_card|id_application|passport|registration|membership|admission|enrol(l)?ment)(_|$)/

export function suggestsPhotoBox(documentTypeId: string | null | undefined): boolean {
  return PHOTO_DOCUMENTS.test((documentTypeId ?? '').toLowerCase())
}
