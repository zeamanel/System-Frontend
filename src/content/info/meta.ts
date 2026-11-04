/**
 * Things only the business can decide. Change them here (or, for the contact
 * details, in the VITE_LEGAL_* build variables) before launch.
 */

/** Shown as "Last updated" on the Terms and the Privacy Policy. Change it whenever their text changes. */
export const LEGAL_UPDATED = '2026-11-03'

/**
 * The date a lawyer approved the Terms and the Privacy Policy, as YYYY-MM-DD.
 * While it is null both pages carry a visible "draft, not yet reviewed by a
 * lawyer" notice. Set it once they have been reviewed.
 */
export const LEGAL_REVIEWED_ON: string | null = null

/**
 * The refund and cancellation rule for paid plans, in one or two plain
 * sentences. While it is null the FAQ and the Terms show a visible
 * [placeholder] where it belongs, so nothing is promised by accident.
 * Example: "Plans are not refundable once started, except where the law requires it."
 */
export const REFUND_POLICY: string | null = null
