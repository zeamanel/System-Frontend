# About, FAQs, Terms of Service and Privacy Policy

Four public pages (no sign-in needed): `/about`, `/faq`, `/terms`, `/privacy` (`/help` goes to the FAQs).
They are linked from the profile menu ("Help & legal"), the sign-in page ("By continuing you agree…"),
the Plans & billing page, the Telegram files page and the Telegram bot (`/privacy`).

## Before launch — what only the business can provide

Until these are set, the pages show a **visible highlighted `[placeholder]`** in their place, so nothing goes live by accident.

| What | Where | Placeholder shown |
| --- | --- | --- |
| Legal or trade name | `VITE_LEGAL_NAME` | `[Company legal name]` |
| Contact email (privacy, deletion, support) | `VITE_CONTACT_EMAIL` | `[contact email]` |
| Business address | `VITE_LEGAL_ADDRESS` (a city is enough) | `[business address]` |
| Refund and cancellation rule | `REFUND_POLICY` in `src/content/info/meta.ts` | `[Refund and cancellation rule …]` |
| Lawyer's approval date | `LEGAL_REVIEWED_ON` in `src/content/info/meta.ts` | a "draft, not yet reviewed by a lawyer" notice on the Terms and Privacy Policy |

The `VITE_LEGAL_*` values go in `.env.production` or in the Cloudflare Pages build variables (those win).
Set `LEGAL_UPDATED` (same file) whenever the Terms or Privacy Policy text changes.

## Where the text is

All in `src/content/info/`, plain data (no components), so a lawyer or translator can edit it:

- `about.ts`, `faq.ts` — English, Amharic and Afaan Oromoo. Same sections/questions/ids in all three (tests enforce it).
- `terms.ts`, `privacy.ts` — English only for now; other languages see a notice. Translate them professionally, not by machine.
- Markers inside text: `[[app]]`, `[[legalName]]`, `[[email]]`, `[[address]]`, `[[refund]]`, `[[link:about|faq|terms|privacy]]`.

## Keep in step with the backend

The Privacy Policy, Terms and FAQ state the real retention times: Telegram files 24 hours
(`TELEGRAM_MEDIA_RETENTION_MS`), saved customers 365 days (`CUSTOMER_RETENTION_DAYS`), unused uploaded images
7 days (`UNUSED_MEDIA_DAYS`). If one changes in the backend, change the text (a test checks the numbers are present).
