import { p, table, ul } from './types'
import type { LegalDocument } from './types'

/**
 * Privacy Policy (English; the legal text is not machine-translated).
 *
 * A DRAFT for a lawyer to review: see LEGAL_REVIEWED_ON in meta.ts. It
 * describes what the system really does. The retention times in section 6
 * are the real ones in the backend (TELEGRAM_MEDIA_RETENTION_MS = 24 hours,
 * CUSTOMER_RETENTION_DAYS = 365, UNUSED_MEDIA_DAYS = 7); change them
 * together. Business details come from [[tokens]].
 */
export const PRIVACY: LegalDocument = {
  intro:
    'This Privacy Policy explains what personal data [[legalName]] (“we”, “us”) collects when you use [[app]] — the website, the document editor, AI drafting and the Telegram bot — why we collect it, who we share it with, how long we keep it and what choices you have. We are responsible for your personal data. We aim to follow applicable Ethiopian data-protection law, including the Personal Data Protection Proclamation No. 1321/2024.',
  sections: [
    {
      id: 'collect',
      title: '1. What we collect',
      blocks: [
        table(
          ['Kind of data', 'Examples', 'Where it comes from'],
          ['Account', 'Name, email address, profile picture link and sign-in method (Google, or email and password)', 'You, or Google when you sign in with Google'],
          ['Settings', 'Language, country, region and city, calendar and number style, occupation', 'You (Settings and the welcome questions)'],
          ['Your documents', 'Documents and their earlier versions, the answers you type, favourite templates, exports', 'You'],
          ['Business details', 'Organization name, TIN, address, phone, letterhead, bank details and signatories; members and their roles', 'You and your organization'],
          ['Saved customers', 'Name, TIN, phone, email and address of people and companies you choose to save', 'You'],
          ['Images', 'Logos and photos you upload', 'You'],
          ['Telegram', 'Messages, photos, files and voice messages you send to the bot; your Telegram chat ID, and the Qal ID and profile details you set in the bot', 'You, through Telegram'],
          ['Payments', 'Plan, amount, status and Chapa’s payment reference (never card or mobile-money details)', 'You and Chapa'],
          ['Usage and security', 'AI credits used; a log of important account actions (which fields changed, not their content); IP address and device information in server logs', 'Automatically'],
          ['Browser storage', 'Your settings, sign-in session and unsaved drafts, kept on your own device', 'Automatically'],
        ),
      ],
    },
    {
      id: 'use',
      title: '2. How we use it',
      blocks: [
        ul(
          'To provide the Service: store your documents, generate and edit them, read text from photos and files, transcribe voice messages, fill in forms, calculate totals, and export or print.',
          'To run your account: sign you in, keep your settings, and share saved customers and business details with the members of your organization.',
          'To take payments and give you the plan you paid for.',
          'To keep the Service secure, prevent abuse and fix problems.',
          'To meet our legal obligations.',
        ),
        p('We do not sell your personal data and we do not use your documents for advertising. We do not use your content to train our own AI models.'),
      ],
    },
    {
      id: 'ai',
      title: '3. How AI is used',
      blocks: [
        p(
          'To draft and fill in documents, read files and transcribe voice messages, we send the details you entered, the text of files you ask us to read, and voice recordings to Google’s Gemini AI models, which we use through Google Cloud. Google processes this data on our behalf to produce your result, under its Google Cloud terms.',
        ),
        p(
          'We send only what is needed for the task. Please do not enter sensitive information that a document does not need (for example passwords or full bank-card numbers). AI output can be wrong: see our [[link:terms]].',
        ),
      ],
    },
    {
      id: 'share',
      title: '4. Who we share it with',
      blocks: [
        p('We share personal data only with the following, and only as needed to provide the Service:'),
        ul(
          'Our cloud, database and sign-in providers, including Google Cloud and Firebase: hosting, storing data, signing you in and AI processing.',
          'Cloudflare: delivering the website, and basic visit statistics that do not use cookies.',
          'Chapa and its payment partners: processing your payments.',
          'Telegram: the bot runs on Telegram, which handles the messages you send to it under its own privacy policy.',
          'Members of your organization: saved customers, business details and any document you choose to share.',
          'Authorities, when the law requires it, and professional advisers bound by confidentiality.',
          'A buyer or successor, if the business is sold or merged, who must respect this policy.',
        ),
        p('We do not sell your data to anyone.'),
      ],
    },
    {
      id: 'where',
      title: '5. Where your data is processed',
      blocks: [
        p(
          'Our servers, and those of our providers, are mainly outside Ethiopia. By using the Service you understand that your data is transferred to, and processed in, those countries. We use providers that protect data to a high standard, and we take steps to keep your data safe when it is transferred, as the law requires.',
        ),
      ],
    },
    {
      id: 'keep',
      title: '6. How long we keep it',
      blocks: [
        table(
          ['Data', 'How long'],
          ['Your documents', 'Until you delete them. Deleted documents go to Trash first, so you can restore them.'],
          ['Saved customers', 'Removed automatically 365 days after you last used them.'],
          ['Images you uploaded', 'Kept while a document or your organization profile uses them; removed 7 days after upload if nothing uses them.'],
          ['Telegram files and messages', 'Removed automatically after 24 hours, or sooner when you use /revoke or /forget.'],
          ['Account and settings', 'While your account is open; deleted when you ask us to delete it.'],
          ['Payment records', 'As long as the law requires us to keep accounting and tax records.'],
          ['Security logs', 'For a limited time needed to keep the Service safe.'],
        ),
      ],
    },
    {
      id: 'rights',
      title: '7. Your rights and choices',
      blocks: [
        p('You can ask us to:'),
        ul(
          'give you a copy of your personal data;',
          'correct data that is wrong;',
          'delete your data or your account;',
          'stop or limit certain uses of your data, or withdraw a consent you gave;',
          'move your data to another service, where this applies.',
        ),
        p(
          'Much of this you can do yourself: edit or delete documents, saved customers and your organization details in the app, and use /revoke or /forget in the Telegram bot. For anything else, write to [[email]] from the email address you signed up with. We will reply within a reasonable time, and no later than the law requires. If you are unhappy with our answer, you may complain to the data-protection authority in Ethiopia.',
        ),
      ],
    },
    {
      id: 'security',
      title: '8. How we protect your data',
      blocks: [
        ul(
          'Connections to the Service are encrypted (HTTPS).',
          'Access to accounts is checked on every request, and each user’s data is kept apart from other users’ data.',
          'Telegram files are short-lived by design, and Telegram connection codes expire within minutes.',
          'Payments are handled by Chapa; we never receive card details.',
        ),
        p(
          'No online service is perfectly secure. If you find a security problem, please tell us at [[email]]. If a breach affects your data, we will tell you and the authorities as the law requires.',
        ),
      ],
    },
    {
      id: 'children',
      title: '9. Children',
      blocks: [
        p(
          'The Service is not meant for people under 18, and we do not knowingly collect their data. If you think a child has given us data, contact us and we will delete it.',
        ),
      ],
    },
    {
      id: 'cookies',
      title: '10. Cookies and browser storage',
      blocks: [
        p(
          'We do not use advertising or tracking cookies. The Service stores your settings, language, sign-in session and unsaved drafts in your browser so that it works the way you left it; you can clear them in your browser settings (unsaved drafts will then be lost). Cloudflare provides basic visit statistics without cookies.',
        ),
      ],
    },
    {
      id: 'changes',
      title: '11. Changes to this policy',
      blocks: [
        p(
          'We may update this policy. When we make a material change we will tell you in the Service or by email before it applies, and the “Last updated” date above will change.',
        ),
      ],
    },
    {
      id: 'contact',
      title: '12. Contact us',
      blocks: [p('[[legalName]]'), p('Address: [[address]]'), p('Email: [[email]]')],
    },
  ],
}
