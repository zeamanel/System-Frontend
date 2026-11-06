import type { MessageKey } from '../../i18n'
import type { TemplateSummary } from '../repositories'

/**
 * What a new user does for work (asked once in the welcome questions).
 *
 * `templateTypes` are backend `documentTypeId`s, most useful first. They put
 * the templates this person is most likely to need at the top of the
 * recommended list; nothing is hidden. The ids must match the backend's
 * list (src/lib/occupations.ts there).
 */
export interface Occupation {
  id: string
  labelKey: MessageKey
  templateTypes: readonly string[]
}

export const OCCUPATIONS: readonly Occupation[] = [
  {
    id: 'student',
    labelKey: 'occupation.student',
    templateTypes: ['official_application_letter', 'cover_letter', 'appeal_letter', 'fee_deferral', 'recommendation_letter', 'sworn_affidavit_declaration', 'national_id_application', 'passport_renewal'],
  },
  {
    id: 'employee',
    labelKey: 'occupation.employee',
    templateTypes: ['resignation_letter', 'salary_confirmation_letter', 'work_experience_certificate', 'official_application_letter', 'authorization_letter', 'cover_letter', 'complaint_petition_letter', 'salary_advance_application', 'employee_explanation_letter', 'field_mission_per_diem_request'],
  },
  {
    id: 'civil_servant',
    labelKey: 'occupation.civil_servant',
    templateTypes: ['official_application_letter', 'internal_office_memo', 'official_meeting_notice', 'complaint_petition_letter', 'authorization_letter', 'meeting_minutes', 'salary_confirmation_letter', 'resignation_letter', 'sworn_affidavit_declaration', 'institutional_cooperation_letter', 'field_mission_per_diem_request', 'authority_delegation_letter', 'purchase_requisition_request', 'employee_explanation_letter', 'salary_advance_application'],
  },
  {
    id: 'business_owner',
    labelKey: 'occupation.business_owner',
    templateTypes: ['proforma_invoice', 'commercial_invoice', 'goods_supply_agreement', 'service_agreement', 'payment_demand_letter', 'vat_monthly_report', 'commercial_lease_agreement', 'company_board_resolution', 'institutional_cooperation_letter', 'internal_office_memo', 'purchase_requisition_request'],
  },
  {
    id: 'hr_admin',
    labelKey: 'occupation.hr_admin',
    templateTypes: ['employment_offer_letter', 'employment_contract', 'employment_termination_letter', 'employee_warning_letter', 'work_experience_certificate', 'salary_confirmation_letter', 'resignation_letter', 'internal_office_memo', 'authority_delegation_letter', 'official_meeting_notice', 'salary_advance_application', 'employee_explanation_letter'],
  },
  {
    id: 'accountant',
    labelKey: 'occupation.accountant',
    templateTypes: ['vat_return_worksheet', 'vat_monthly_report', 'proforma_invoice', 'commercial_invoice', 'payment_receipt_acknowledgement', 'debt_acknowledgement', 'payment_demand_letter', 'purchase_requisition_request', 'field_mission_per_diem_request', 'salary_advance_application'],
  },
  {
    id: 'lawyer',
    labelKey: 'occupation.lawyer',
    templateTypes: ['statement_of_claim', 'statement_of_defence', 'power_of_attorney', 'dispute_settlement_agreement', 'sworn_affidavit_declaration', 'last_will_and_testament', 'debt_acknowledgement', 'guarantor_undertaking'],
  },
  {
    id: 'print_shop',
    labelKey: 'occupation.print_shop',
    templateTypes: ['power_of_attorney', 'authorization_letter', 'vehicle_sale_contract', 'lease_agreement', 'house_condominium_sale_contract', 'sworn_affidavit_declaration', 'official_application_letter', 'loan_agreement'],
  },
  {
    id: 'real_estate',
    labelKey: 'occupation.real_estate',
    templateTypes: ['lease_agreement', 'commercial_lease_agreement', 'house_condominium_sale_contract', 'lease_termination_notice', 'gift_deed', 'spousal_property_consent', 'power_of_attorney'],
  },
  {
    id: 'freelancer',
    labelKey: 'occupation.freelancer',
    templateTypes: ['service_agreement', 'proforma_invoice', 'commercial_invoice', 'payment_receipt_acknowledgement', 'payment_demand_letter', 'recommendation_letter', 'cover_letter'],
  },
  {
    id: 'farmer',
    labelKey: 'occupation.farmer',
    templateTypes: ['agricultural_land_lease', 'loan_agreement', 'guarantor_undertaking', 'dispute_settlement_agreement', 'sworn_affidavit_declaration', 'power_of_attorney'],
  },
  { id: 'other', labelKey: 'occupation.other', templateTypes: [] },
]

export function occupationById(id: string | null | undefined): Occupation | undefined {
  return OCCUPATIONS.find((occupation) => occupation.id === id)
}

/**
 * The `limit` templates to recommend: the ones that suit the occupation first
 * (in the occupation's own order, then by popularity), the rest of the
 * list (already sorted by popularity) after them. With no occupation, or
 * "other", this is just the most popular.
 */
export function recommendTemplates(
  all: readonly TemplateSummary[],
  occupationId: string | null | undefined,
  limit = 4,
): TemplateSummary[] {
  const types = occupationById(occupationId)?.templateTypes ?? []
  if (types.length === 0) return all.slice(0, limit)
  const rank = (template: TemplateSummary): number => {
    const index = types.indexOf(template.documentTypeId)
    return index === -1 ? Number.POSITIVE_INFINITY : index
  }
  const matching = all
    .filter((template) => rank(template) !== Number.POSITIVE_INFINITY)
    .sort((a, b) => rank(a) - rank(b) || b.popularity - a.popularity)
  const rest = all.filter((template) => rank(template) === Number.POSITIVE_INFINITY)
  return [...matching, ...rest].slice(0, limit)
}
