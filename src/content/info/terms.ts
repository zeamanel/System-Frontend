import { p, ul } from './types'
import type { LegalDocument } from './types'

/**
 * Terms of Service (English; the legal text is not machine-translated).
 *
 * A DRAFT for a lawyer to review: see LEGAL_REVIEWED_ON in meta.ts. Business
 * details come from [[tokens]] (VITE_LEGAL_* build variables, REFUND_POLICY).
 * Sections 10–11 (warranty, liability) and 13 (governing law) in particular
 * need counsel's confirmation for Ethiopia.
 */
export const TERMS: LegalDocument = {
  intro:
    'These Terms of Service (“Terms”) are the agreement between you and [[legalName]] (“we”, “us”) for using [[app]], including the website, the document editor, AI drafting and the Telegram bot (together, the “Service”). Please read them. By creating an account or using the Service you agree to them. If you do not agree, please do not use the Service.',
  sections: [
    {
      id: 'who',
      title: '1. Who can use the Service',
      blocks: [
        p(
          'You must be at least 18 years old, or have the permission of a parent or legal guardian, and be able to enter into a binding agreement. If you use [[app]] for an organization, you confirm that you are allowed to accept these Terms on its behalf.',
        ),
      ],
    },
    {
      id: 'account',
      title: '2. Your account',
      blocks: [
        ul(
          'Give us accurate information and keep it up to date.',
          'Keep your sign-in details safe. You are responsible for what happens under your account. Tell us at once at [[email]] if you think someone else has used it.',
          'One account is for one person. Do not share your password.',
        ),
      ],
    },
    {
      id: 'what',
      title: '3. What [[app]] does — and does not do',
      blocks: [
        p(
          '[[app]] helps you write, edit, calculate and print documents. It uses artificial intelligence (AI) to draft text and to read the files and voice messages you give it.',
        ),
        ul(
          'AI can make mistakes. Everything it produces is a draft. You are responsible for reading, correcting and approving every document before you sign, print, send or rely on it.',
          '[[app]] is not a law firm, an accountant, a tax adviser or a notary, and nothing it produces is legal, tax or professional advice. For anything important, ask a qualified professional.',
          'Using [[app]] does not authenticate, register or file anything. Procedures such as authentication at the Documents Authentication and Registration Service, company registration, or filing a VAT return with the Ministry of Revenues are separate and remain your responsibility.',
          'Figures such as invoice totals and VAT are calculated by the software. They depend on what you enter, so check them before you use them.',
        ),
      ],
    },
    {
      id: 'use',
      title: '4. Acceptable use',
      blocks: [
        p('You agree not to use the Service to:'),
        ul(
          'create, forge or alter documents in order to deceive, defraud or harm anyone, or to pretend to be another person or organization;',
          'break any law, or infringe anyone’s rights, including intellectual-property and privacy rights;',
          'upload or process another person’s personal data unless you have the right to do so;',
          'attempt to break, overload, scrape, reverse-engineer or gain unauthorised access to the Service or to other people’s accounts;',
          'use automated means to obtain AI credits or to avoid limits or payment;',
          'send harmful, abusive or unlawful content through the Telegram bot or the Service.',
        ),
      ],
    },
    {
      id: 'content',
      title: '5. Your content',
      blocks: [
        p(
          'Your documents, answers, files, logos, saved customers and any other material you put into the Service (“your content”) belong to you. We do not claim ownership of it.',
        ),
        p(
          'You give us a limited licence to store, process, display and transmit your content only as needed to run the Service for you — including sending the text it needs to our AI provider to produce your result — and to keep it safe. This licence ends when your content is deleted.',
        ),
        p(
          'You promise that you have the right to use your content in the Service and that it does not break the law or anyone’s rights. You are responsible for your content and for how you use the documents you create.',
        ),
      ],
    },
    {
      id: 'telegram',
      title: '6. The Telegram bot',
      blocks: [
        p(
          'The [[app]] bot runs on Telegram, which has its own terms and privacy policy. Files and messages you send to the bot are used to bring their content into your documents and are deleted after 24 hours, or sooner if you use /revoke or /forget. Only send what you are allowed to send.',
        ),
      ],
    },
    {
      id: 'plans',
      title: '7. Plans, credits and payments',
      blocks: [
        ul(
          'Every account gets a number of free AI credits each day. Paid plans give more credits per day for a period of time (currently 30 days). Credits do not carry over to the next day.',
          'Prices are in Ethiopian birr (ETB) and are shown on the Plans & billing page before you pay. We may change prices or plan limits; a change never affects a period you have already paid for.',
          'Payments are made through Chapa. We never see or store your card or mobile-money details. Your plan starts when Chapa confirms the payment to us.',
          'Extending a plan adds a new period after you pay for it. Plans do not renew automatically.',
          'Refunds and cancellation: [[refund]]',
          'If a payment fails or is reversed, we may withdraw the plan it paid for.',
        ),
      ],
    },
    {
      id: 'availability',
      title: '8. Availability and changes to the Service',
      blocks: [
        p(
          'We work to keep the Service available, but we cannot promise that it will always be uninterrupted or free of errors. We may change, add or remove features, templates and AI models, and carry out maintenance, as the Service develops.',
        ),
      ],
    },
    {
      id: 'property',
      title: '9. Our property',
      blocks: [
        p(
          'The software, design, templates, text of the Service and the [[app]] name and logo belong to us or our licensors. You may use the templates, and the documents you create with them, for your own personal or business purposes. You may not copy, sell or resell the Service, its templates or its AI features, or build a competing service from them.',
        ),
      ],
    },
    {
      id: 'warranty',
      title: '10. No warranty',
      blocks: [
        p(
          'To the fullest extent the law allows, the Service is provided “as is” and “as available”. We do not promise that the documents it produces are accurate, complete, legally effective or suitable for your purpose. Nothing in these Terms takes away rights you have under Ethiopian law that cannot be excluded.',
        ),
      ],
    },
    {
      id: 'liability',
      title: '11. Limit of liability',
      blocks: [
        p(
          'To the fullest extent the law allows, we are not liable for indirect or consequential loss, for loss of profit, business, data or goodwill, or for loss caused by relying on a document produced with the Service. Our total liability for any claim relating to the Service is limited to the amount you paid us in the three months before the claim arose.',
        ),
        p('Nothing in these Terms limits liability that cannot be limited under Ethiopian law, such as liability for fraud or intentional wrongdoing.'),
      ],
    },
    {
      id: 'ending',
      title: '12. Suspension and ending',
      blocks: [
        p('You can stop using the Service at any time and can ask us to delete your account (see our [[link:privacy]]).'),
        p(
          'We may suspend or end your access, with notice where that is reasonable, if you break these Terms, misuse the Service, put it or other people at risk, or if the law requires. What happens to your data afterwards is explained in the [[link:privacy]]. Parts of these Terms that by their nature should continue — such as ownership, limits of liability and disputes — continue after your access ends.',
        ),
      ],
    },
    {
      id: 'law',
      title: '13. Governing law and disputes',
      blocks: [
        p(
          'These Terms are governed by the laws of the Federal Democratic Republic of Ethiopia. If you have a complaint, please write to us first at [[email]]; we will try to resolve it fairly and quickly. If we cannot, the competent courts of Ethiopia have jurisdiction, unless the law says otherwise.',
        ),
      ],
    },
    {
      id: 'changes',
      title: '14. Changes to these Terms',
      blocks: [
        p(
          'We may update these Terms. When we make a material change we will tell you in the Service or by email before it applies, and the “Last updated” date above will change. If you keep using the Service after the change, you accept the new Terms. If you do not agree, you can stop using the Service and ask us to delete your account.',
        ),
      ],
    },
    {
      id: 'contact',
      title: '15. Contact',
      blocks: [p('[[legalName]]'), p('Address: [[address]]'), p('Email: [[email]]')],
    },
  ],
}
