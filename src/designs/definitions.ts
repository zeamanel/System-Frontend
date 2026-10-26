import { CertificatePage } from './CertificatePage'
import { NoticePage } from './NoticePage'
import type { DesignDefinition } from './types'

export const certificateClassic: DesignDefinition = {
  id: 'certificate-classic',
  titleKey: 'designs.certificate.title',
  descriptionKey: 'designs.certificate.description',
  page: { width: 1123, height: 794, orientation: 'landscape', paper: 'A4' },
  groups: [
    {
      labelKey: 'designs.group.organization',
      fields: [
        { id: 'orgNameAm', labelKey: 'designs.field.orgNameAm', maxLength: 120 },
        { id: 'orgNameEn', labelKey: 'designs.field.orgNameEn', maxLength: 120 },
        { id: 'monogram', labelKey: 'designs.field.monogram', maxLength: 4 },
        { id: 'certificateNo', labelKey: 'designs.field.certificateNo', maxLength: 40 },
      ],
    },
    {
      labelKey: 'designs.group.recipient',
      fields: [
        { id: 'recipientAm', labelKey: 'designs.field.recipientAm', maxLength: 80 },
        { id: 'recipientEn', labelKey: 'designs.field.recipientEn', maxLength: 80 },
        { id: 'bodyAm', labelKey: 'designs.field.bodyAm', multiline: true, maxLength: 300 },
        { id: 'bodyEn', labelKey: 'designs.field.bodyEn', multiline: true, maxLength: 300 },
        { id: 'placeDate', labelKey: 'designs.field.placeDate', maxLength: 120 },
      ],
    },
    {
      labelKey: 'designs.group.signatures',
      fields: [
        { id: 'signer1Name', labelKey: 'designs.field.signer1Name', maxLength: 80 },
        { id: 'signer1Role', labelKey: 'designs.field.signer1Role', maxLength: 80 },
        { id: 'signer2Name', labelKey: 'designs.field.signer2Name', maxLength: 80 },
        { id: 'signer2Role', labelKey: 'designs.field.signer2Role', maxLength: 80 },
      ],
    },
    {
      labelKey: 'designs.group.headings',
      fields: [
        { id: 'titleAm', labelKey: 'designs.field.titleAm', maxLength: 60 },
        { id: 'titleEn', labelKey: 'designs.field.titleEn', maxLength: 60 },
        { id: 'awardedAm', labelKey: 'designs.field.awardedAm', maxLength: 80 },
        { id: 'awardedEn', labelKey: 'designs.field.awardedEn', maxLength: 80 },
      ],
    },
  ],
  options: [{ id: 'seal', labelKey: 'designs.option.seal', default: true }],
  defaults: {
    titleAm: 'የምስክር ወረቀት',
    titleEn: 'Certificate of Completion',
    awardedAm: 'ይህ የምስክር ወረቀት የተሰጠው ለ',
    awardedEn: 'This certificate is proudly awarded to',
    signer1Role: 'ዳይሬክተር · Director',
    signer2Role: 'አሰልጣኝ · Trainer',
  },
  Page: CertificatePage,
}

export const vacancyNotice: DesignDefinition = {
  id: 'vacancy-notice',
  titleKey: 'designs.notice.title',
  descriptionKey: 'designs.notice.description',
  page: { width: 794, height: 1123, orientation: 'portrait', paper: 'A4' },
  groups: [
    {
      labelKey: 'designs.group.organization',
      fields: [
        { id: 'orgNameAm', labelKey: 'designs.field.orgNameAm', maxLength: 120 },
        { id: 'orgNameEn', labelKey: 'designs.field.orgNameEn', maxLength: 120 },
        { id: 'noticeNo', labelKey: 'designs.field.noticeNo', maxLength: 40 },
      ],
    },
    {
      labelKey: 'designs.group.position',
      fields: [
        { id: 'positionAm', labelKey: 'designs.field.positionAm', maxLength: 100 },
        { id: 'positionEn', labelKey: 'designs.field.positionEn', maxLength: 100 },
        { id: 'detailsAm', labelKey: 'designs.field.detailsAm', multiline: true, maxLength: 1200 },
        { id: 'detailsEn', labelKey: 'designs.field.detailsEn', multiline: true, maxLength: 1200 },
        { id: 'deadline', labelKey: 'designs.field.deadline', maxLength: 120 },
      ],
    },
    {
      labelKey: 'designs.group.contact',
      fields: [
        { id: 'contact', labelKey: 'designs.field.contact', multiline: true, maxLength: 300 },
        { id: 'issuedDate', labelKey: 'designs.field.issuedDate', maxLength: 120 },
      ],
    },
    {
      labelKey: 'designs.group.headings',
      fields: [
        { id: 'headlineAm', labelKey: 'designs.field.headlineAm', maxLength: 60 },
        { id: 'headlineEn', labelKey: 'designs.field.headlineEn', maxLength: 60 },
      ],
    },
  ],
  options: [{ id: 'stampBox', labelKey: 'designs.option.stampBox', default: true }],
  defaults: {
    headlineAm: 'የሥራ ማስታወቂያ',
    headlineEn: 'Vacancy Announcement',
  },
  Page: NoticePage,
}
