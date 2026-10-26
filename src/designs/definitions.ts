import { CertificatePage } from './CertificatePage'
import { NoticePage } from './NoticePage'
import { AnnouncementPage } from './AnnouncementPage'
import { AppreciationPage } from './AppreciationPage'
import { BusinessCardsPage } from './BusinessCardsPage'
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
  imageSlots: [
    { id: 'logo', kind: 'logo', labelKey: 'designs.image.logo', hintKey: 'designs.image.logoHint' },
    { id: 'photo', kind: 'photo', labelKey: 'designs.image.photo', hintKey: 'designs.image.photoHint' },
  ],
  batch: { amField: 'recipientAm', enField: 'recipientEn', numberField: 'certificateNo', personalImages: ['photo'] },
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
  imageSlots: [{ id: 'logo', kind: 'logo', labelKey: 'designs.image.logo', hintKey: 'designs.image.noticeLogoHint' }],
  defaults: {
    headlineAm: 'የሥራ ማስታወቂያ',
    headlineEn: 'Vacancy Announcement',
  },
  Page: NoticePage,
}

export const announcement: DesignDefinition = {
  id: 'announcement',
  titleKey: 'designs.announcement.title',
  descriptionKey: 'designs.announcement.description',
  page: { width: 794, height: 1123, orientation: 'portrait', paper: 'A4' },
  groups: [
    {
      labelKey: 'designs.group.organization',
      fields: [
        { id: 'orgNameAm', labelKey: 'designs.field.orgNameAm', maxLength: 120 },
        { id: 'orgNameEn', labelKey: 'designs.field.orgNameEn', maxLength: 120 },
        { id: 'noticeNo', labelKey: 'designs.field.noticeNo', maxLength: 40 },
        { id: 'issuedDate', labelKey: 'designs.field.issuedDate', maxLength: 120 },
      ],
    },
    {
      labelKey: 'designs.group.message',
      fields: [
        { id: 'subjectAm', labelKey: 'designs.field.subjectAm', maxLength: 140 },
        { id: 'subjectEn', labelKey: 'designs.field.subjectEn', maxLength: 140 },
        { id: 'bodyAm', labelKey: 'designs.field.announcementAm', multiline: true, hintKey: 'designs.oneParagraphPerLine', maxLength: 1800 },
        { id: 'bodyEn', labelKey: 'designs.field.announcementEn', multiline: true, hintKey: 'designs.oneParagraphPerLine', maxLength: 1800 },
      ],
    },
    {
      labelKey: 'designs.group.when',
      fields: [
        { id: 'eventDate', labelKey: 'designs.field.eventDate', maxLength: 80 },
        { id: 'eventTime', labelKey: 'designs.field.eventTime', maxLength: 60 },
        { id: 'venue', labelKey: 'designs.field.venue', maxLength: 100 },
      ],
    },
    {
      labelKey: 'designs.group.signatures',
      fields: [
        { id: 'signer1Name', labelKey: 'designs.field.signer1Name', maxLength: 80 },
        { id: 'signer1Role', labelKey: 'designs.field.signer1Role', maxLength: 80 },
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
  options: [
    { id: 'details', labelKey: 'designs.option.details', default: true },
    { id: 'stampBox', labelKey: 'designs.option.stamp', default: true },
  ],
  imageSlots: [{ id: 'logo', kind: 'logo', labelKey: 'designs.image.logo', hintKey: 'designs.image.headerLogoHint' }],
  defaults: {
    headlineAm: 'ማስታወቂያ',
    headlineEn: 'Announcement',
  },
  Page: AnnouncementPage,
}

export const certificateAppreciation: DesignDefinition = {
  id: 'certificate-appreciation',
  titleKey: 'designs.appreciation.title',
  descriptionKey: 'designs.appreciation.description',
  page: { width: 1123, height: 794, orientation: 'landscape', paper: 'A4' },
  groups: certificateClassic.groups,
  options: [{ id: 'seal', labelKey: 'designs.option.rosette', default: true }],
  imageSlots: [{ id: 'logo', kind: 'logo', labelKey: 'designs.image.logo', hintKey: 'designs.image.logoHint' }],
  batch: { amField: 'recipientAm', enField: 'recipientEn', numberField: 'certificateNo', personalImages: [] },
  defaults: {
    titleAm: 'የምስጋና ምስክር ወረቀት',
    titleEn: 'Certificate of Appreciation',
    awardedAm: 'ይህ የምስጋና ምስክር ወረቀት በአክብሮት የተሰጠው ለ',
    awardedEn: 'This certificate is gratefully presented to',
    signer1Role: 'ዳይሬክተር · Director',
    signer2Role: 'ሊቀመንበር · Chairperson',
  },
  Page: AppreciationPage,
}

export const businessCards: DesignDefinition = {
  id: 'business-cards',
  titleKey: 'designs.cards.title',
  descriptionKey: 'designs.cards.description',
  page: { width: 794, height: 1123, orientation: 'portrait', paper: 'A4' },
  groups: [
    {
      labelKey: 'designs.group.person',
      fields: [
        { id: 'nameAm', labelKey: 'designs.field.nameAm', maxLength: 60 },
        { id: 'nameEn', labelKey: 'designs.field.nameEn', maxLength: 60 },
        { id: 'roleAm', labelKey: 'designs.field.roleAm', maxLength: 60 },
        { id: 'roleEn', labelKey: 'designs.field.roleEn', maxLength: 60 },
      ],
    },
    {
      labelKey: 'designs.group.contact',
      fields: [
        { id: 'phone', labelKey: 'designs.field.phone', maxLength: 60 },
        { id: 'email', labelKey: 'designs.field.email', maxLength: 80 },
        { id: 'address', labelKey: 'designs.field.address', maxLength: 80 },
      ],
    },
    {
      labelKey: 'designs.group.organization',
      fields: [
        { id: 'orgNameAm', labelKey: 'designs.field.orgNameAm', maxLength: 60 },
        { id: 'orgNameEn', labelKey: 'designs.field.orgNameEn', maxLength: 60 },
      ],
    },
  ],
  options: [{ id: 'cropMarks', labelKey: 'designs.option.cropMarks', default: true }],
  imageSlots: [{ id: 'logo', kind: 'logo', labelKey: 'designs.image.logo', hintKey: 'designs.image.cardLogoHint' }],
  defaults: {},
  Page: BusinessCardsPage,
}
