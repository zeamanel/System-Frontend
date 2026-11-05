import { describe, expect, it } from 'vitest'
import { matchesDocumentKind } from './document-type'

describe('matchesDocumentKind', () => {
  it('finds every specific type of a kind', () => {
    expect(matchesDocumentKind('employment_offer_letter', 'letter')).toBe(true)
    expect(matchesDocumentKind('general_letter', 'letter')).toBe(true)
    expect(matchesDocumentKind('lease_agreement', 'contract')).toBe(true)
    expect(matchesDocumentKind('vehicle_sale_contract', 'contract')).toBe(true)
    expect(matchesDocumentKind('gift_deed', 'contract')).toBe(true)
    expect(matchesDocumentKind('commercial_invoice', 'invoice')).toBe(true)
    expect(matchesDocumentKind('payment_receipt_acknowledgement', 'receipt')).toBe(true)
    expect(matchesDocumentKind('meeting_minutes', 'minutes')).toBe(true)
    expect(matchesDocumentKind('sworn_affidavit_declaration', 'affidavit')).toBe(true)
    expect(matchesDocumentKind('leave_request', 'request')).toBe(true)
    expect(matchesDocumentKind('trade_license_renewal', 'application')).toBe(true)
    expect(matchesDocumentKind('work_experience_certificate', 'certificate')).toBe(true)
    expect(matchesDocumentKind('cv_resume', 'cv')).toBe(true)
    expect(matchesDocumentKind('periodic_performance_report', 'report')).toBe(true)
    expect(matchesDocumentKind('court_caseflow_performance_report', 'report')).toBe(true)
    expect(matchesDocumentKind('annual_action_and_budget_plan', 'plan')).toBe(true)
    expect(matchesDocumentKind('performance_feedback_letter', 'letter')).toBe(true)
  })

  it('keeps kinds apart, and an exact type always matches', () => {
    expect(matchesDocumentKind('lease_agreement', 'letter')).toBe(false)
    expect(matchesDocumentKind('commercial_invoice', 'receipt')).toBe(false)
    expect(matchesDocumentKind('letter', 'letter')).toBe(true)
    expect(matchesDocumentKind('custom_type', 'custom_type')).toBe(true)
    expect(matchesDocumentKind('custom_type', 'unknown_kind')).toBe(false)
  })
})
