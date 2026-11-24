import { describe, expect, it } from 'vitest'
import { photoCrop } from './photo'
import { suggestsPhotoBox } from '../editor/photo-box'

describe('photoCrop', () => {
  it('takes the middle of a wide picture and the upper part of a tall one, in the box shape', () => {
    // A landscape photo 1200 x 800 for a 3 x 4 box: 600 wide, centred.
    expect(photoCrop(1200, 800, '3x4')).toEqual({ x: 300, y: 0, width: 600, height: 800 })
    // A tall phone photo 900 x 2000: 1200 high, starting 30% of the way down the spare height (the face is near the top).
    expect(photoCrop(900, 2000, '3x4')).toEqual({ x: 0, y: 240, width: 900, height: 1200 })
    // Passport shape 35 x 45.
    expect(photoCrop(700, 900, '3.5x4.5')).toEqual({ x: 0, y: 0, width: 700, height: 900 })
  })
})

describe('suggestsPhotoBox', () => {
  it('offers a photo box on CVs and ID or membership forms only', () => {
    for (const type of ['cv', 'cv_resume', 'national_id_application', 'membership_form', 'student_registration', 'passport_application']) {
      expect(suggestsPhotoBox(type)).toBe(true)
    }
    for (const type of ['salary_advance_application', 'lease_agreement', 'invoice', 'recv_notice', null]) {
      expect(suggestsPhotoBox(type)).toBe(false)
    }
  })
})
