import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClientApplicationRenewalEligibleDto } from '~/.server/domain/dtos';
import {
  checkValidAndVerifiedEmailAddress,
  getAgeCategoryFromAge,
  getAgeCategoryFromDateString,
  getAgeCategoryReferenceDate,
  getAllowedTypeOfApplication,
  getEligibilityStatus,
  isChildClientNumberValid,
  isChildOrYouth,
  isEmailAddressRequired,
  isSinReserved,
  maritalStatusHasPartner,
} from '~/.server/routes/helpers/base-application-route-helpers';

vi.mock('~/.server/utils/env-utils', () => ({
  getEnv: vi.fn(() => ({
    ELIGIBILITY_STATUS_CODE_ELIGIBLE: 'ELIGIBLE',
    MARITAL_STATUS_CODE_COMMON_LAW: 'COMMON_LAW',
    MARITAL_STATUS_CODE_MARRIED: 'MARRIED',
    COMMUNICATION_METHOD_GC_DIGITAL_ID: 'digital',
    COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID: 'email',
  })),
}));

describe('base-application-route-helpers', () => {
  describe('getAgeCategoryFromAge', () => {
    it('returns children for ages from 0 to 15', () => {
      expect(getAgeCategoryFromAge(0)).toBe('children');
      expect(getAgeCategoryFromAge(15)).toBe('children');
    });

    it('returns youth for ages from 16 to 17', () => {
      expect(getAgeCategoryFromAge(16)).toBe('youth');
      expect(getAgeCategoryFromAge(17)).toBe('youth');
    });

    it('returns adults for ages from 18 to 64', () => {
      expect(getAgeCategoryFromAge(18)).toBe('adults');
      expect(getAgeCategoryFromAge(64)).toBe('adults');
    });

    it('returns seniors for age 65 and over', () => {
      expect(getAgeCategoryFromAge(65)).toBe('seniors');
      expect(getAgeCategoryFromAge(90)).toBe('seniors');
    });

    it('throws for a negative age', () => {
      expect(() => getAgeCategoryFromAge(-1)).toThrowError('Invalid age [-1]');
    });
  });

  describe('getAgeCategoryFromDateString', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime('2026-03-04T12:00:00.000Z');
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('maps date of birth to category using an explicit reference date', () => {
      expect(getAgeCategoryFromDateString('2008-03-04', '2026-03-04')).toBe('adults');
      expect(getAgeCategoryFromDateString('2009-03-04', '2026-03-04')).toBe('youth');
      expect(getAgeCategoryFromDateString('1960-03-04', '2026-03-04')).toBe('seniors');
      expect(getAgeCategoryFromDateString('2012-03-04', '2026-03-04')).toBe('children');
    });

    it('uses current date when reference date is omitted', () => {
      expect(getAgeCategoryFromDateString('2008-03-04')).toBe('adults');
      expect(getAgeCategoryFromDateString('2009-03-04')).toBe('youth');
    });
  });

  describe('getAgeCategoryReferenceDate', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns the day before coverageStartDate when today is before coverageStartDate', () => {
      // taxYear '2025' → coverageStartDate 2026-07-01; today 2026-03-04 is before it → referenceDate 2026-06-30
      vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-03-04'));

      expect(getAgeCategoryReferenceDate({ taxYear: '2025' }).toString()).toBe('2026-06-30');
    });

    it('returns today when today is exactly on coverageStartDate', () => {
      // taxYear '2025' → coverageStartDate 2026-07-01; today equals coverage start
      vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-07-01'));

      expect(getAgeCategoryReferenceDate({ taxYear: '2025' }).toString()).toBe('2026-07-01');
    });

    it('returns today when today is after coverageStartDate', () => {
      // taxYear '2025' → coverageStartDate 2026-07-01; today 2026-08-01 is after it
      vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-08-01'));

      expect(getAgeCategoryReferenceDate({ taxYear: '2025' }).toString()).toBe('2026-08-01');
    });
  });

  describe('isChildOrYouth', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    // taxYear '2025' → coverageStartDate 2026-07-01; today 2026-03-04 < coverageStartDate → referenceDate 2026-06-30
    it('returns true for a child (age < 16 at referenceDate)', () => {
      vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-03-04'));
      expect(isChildOrYouth('2012-03-04', { taxYear: '2025' })).toBe(true);
    });

    it('returns true for a youth (age 16–17 at referenceDate)', () => {
      vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-03-04'));
      expect(isChildOrYouth('2009-03-04', { taxYear: '2025' })).toBe(true);
    });

    it('returns false for an adult (age 18–64 at referenceDate)', () => {
      vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-03-04'));
      expect(isChildOrYouth('2008-03-04', { taxYear: '2025' })).toBe(false);
    });

    it('returns false for a senior (age >= 65 at referenceDate)', () => {
      vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-03-04'));
      expect(isChildOrYouth('1960-03-04', { taxYear: '2025' })).toBe(false);
    });

    it('uses today as referenceDate when today is on or after coverageStartDate', () => {
      // taxYear '2025' → coverageStartDate 2026-07-01; today 2026-08-01 → referenceDate 2026-08-01
      // born 2009-08-01 → turns 17 on 2026-08-01 → youth → true
      vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-08-01'));
      expect(isChildOrYouth('2009-08-01', { taxYear: '2025' })).toBe(true);
      // born 2008-07-31 → 18 years old by 2026-08-01 → adults → false
      expect(isChildOrYouth('2008-07-31', { taxYear: '2025' })).toBe(false);
    });
  });

  describe('getEligibilityStatus', () => {
    it('returns "eligible" when applicant has no private dental insurance and privateDentalInsuranceOnRecord is false', () => {
      const result = getEligibilityStatus({
        hasPrivateDentalInsurance: false,
        privateDentalInsuranceOnRecord: false,
      });
      expect(result).toBe('eligible');
    });

    it('returns "eligible" when applicant has no private dental insurance and privateDentalInsuranceOnRecord is undefined', () => {
      const result = getEligibilityStatus({
        hasPrivateDentalInsurance: false,
        privateDentalInsuranceOnRecord: undefined,
      });
      expect(result).toBe('eligible');
    });

    it('returns "eligible-proof" when applicant has no private dental insurance but privateDentalInsuranceOnRecord is true', () => {
      const result = getEligibilityStatus({
        hasPrivateDentalInsurance: false,
        privateDentalInsuranceOnRecord: true,
      });
      expect(result).toBe('eligible-proof');
    });

    it('returns "ineligible" when applicant has private dental insurance and privateDentalInsuranceOnRecord is false', () => {
      const result = getEligibilityStatus({
        hasPrivateDentalInsurance: true,
        privateDentalInsuranceOnRecord: false,
      });
      expect(result).toBe('ineligible');
    });

    it('returns "ineligible" when applicant has private dental insurance and privateDentalInsuranceOnRecord is true', () => {
      const result = getEligibilityStatus({
        hasPrivateDentalInsurance: true,
        privateDentalInsuranceOnRecord: true,
      });
      expect(result).toBe('ineligible');
    });

    it('returns "ineligible" when applicant has private dental insurance and privateDentalInsuranceOnRecord is undefined', () => {
      const result = getEligibilityStatus({
        hasPrivateDentalInsurance: true,
        privateDentalInsuranceOnRecord: undefined,
      });
      expect(result).toBe('ineligible');
    });
  });

  describe('isChildClientNumberValid', () => {
    const mockClientApplication = {
      applicantInformation: {
        clientNumber: 'APPLICANT-001',
      },
      eligibleClientNumbers: ['CHILD-001', 'CHILD-002', 'OTHER-001'],
      children: [{ information: { clientNumber: 'CHILD-001' } }, { information: { clientNumber: 'CHILD-002' } }, { information: { clientNumber: 'CHILD-003' } }],
    } as unknown as ClientApplicationRenewalEligibleDto;

    describe('intake context', () => {
      it('always returns true for intake context regardless of other parameters', () => {
        expect(isChildClientNumberValid('intake', mockClientApplication, 'ANY-NUMBER')).toBe(true);
        expect(isChildClientNumberValid('intake', mockClientApplication, undefined)).toBe(true);
        expect(isChildClientNumberValid('intake', undefined, 'ANY-NUMBER')).toBe(true);
        expect(isChildClientNumberValid('intake', undefined, undefined)).toBe(true);
      });
    });

    describe('renewal context', () => {
      it('returns true when clientApplication is undefined (partial form completion)', () => {
        expect(isChildClientNumberValid('renewal', undefined, 'CHILD-001')).toBe(true);
      });

      it('returns true when clientNumber is undefined (partial form completion)', () => {
        expect(isChildClientNumberValid('renewal', mockClientApplication, undefined)).toBe(true);
      });

      it('returns false when clientNumber is only in eligibleClientNumbers but not in children', () => {
        expect(isChildClientNumberValid('renewal', mockClientApplication, 'OTHER-001')).toBe(false);
      });

      it('returns false when clientNumber is only in children but not in eligibleClientNumbers', () => {
        expect(isChildClientNumberValid('renewal', mockClientApplication, 'CHILD-003')).toBe(false);
      });

      it('returns true when clientNumber is in both children and eligibleClientNumbers', () => {
        expect(isChildClientNumberValid('renewal', mockClientApplication, 'CHILD-001')).toBe(true);
        expect(isChildClientNumberValid('renewal', mockClientApplication, 'CHILD-002')).toBe(true);
      });

      it('returns false when clientNumber is not in eligibleClientNumbers or children client numbers', () => {
        expect(isChildClientNumberValid('renewal', mockClientApplication, 'INVALID-001')).toBe(false);
      });

      it('returns false when clientNumber matches applicant client number (filtered out from eligibleClientNumbers)', () => {
        // The applicant's own client number is filtered out from eligibleClientNumbers
        expect(isChildClientNumberValid('renewal', mockClientApplication, 'APPLICANT-001')).toBe(false);
      });

      it('returns false when clientNumber exists in both sets but is applicant number', () => {
        const mockAppWithOverlap = {
          applicantInformation: {
            clientNumber: 'DUPLICATE-001',
          },
          eligibleClientNumbers: ['DUPLICATE-001', 'CHILD-001'],
          children: [{ information: { clientNumber: 'DUPLICATE-001' } }, { information: { clientNumber: 'CHILD-002' } }],
        } as unknown as ClientApplicationRenewalEligibleDto;

        // Even though DUPLICATE-001 appears in both sets, it should be filtered out from eligibleClientNumbers
        // because it equals applicantInformation.clientNumber, and it's not valid as a child client number
        expect(isChildClientNumberValid('renewal', mockAppWithOverlap, 'DUPLICATE-001')).toBe(false);
      });

      it('handles empty eligibleClientNumbers array', () => {
        const mockAppEmptyEligible = {
          ...mockClientApplication,
          eligibleClientNumbers: [],
        };

        expect(isChildClientNumberValid('renewal', mockAppEmptyEligible, 'CHILD-001')).toBe(false);
        expect(isChildClientNumberValid('renewal', mockAppEmptyEligible, 'OTHER-001')).toBe(false);
      });

      it('handles empty children array', () => {
        const mockAppEmptyChildren = {
          ...mockClientApplication,
          children: [],
        };

        expect(isChildClientNumberValid('renewal', mockAppEmptyChildren, 'OTHER-001')).toBe(false);
        expect(isChildClientNumberValid('renewal', mockAppEmptyChildren, 'CHILD-001')).toBe(false);
      });

      it('handles both empty arrays', () => {
        const mockAppEmptyBoth = {
          applicantInformation: {
            clientNumber: 'APPLICANT-001',
          },
          eligibleClientNumbers: [],
          children: [],
        } as unknown as ClientApplicationRenewalEligibleDto;

        expect(isChildClientNumberValid('renewal', mockAppEmptyBoth, 'ANY-NUMBER')).toBe(false);
      });

      it('handles duplicate values across sets', () => {
        const mockAppWithDuplicates = {
          applicantInformation: {
            clientNumber: 'APPLICANT-001',
          },
          eligibleClientNumbers: ['CHILD-001', 'CHILD-002', 'CHILD-002'], // Duplicate in eligible
          children: [
            { information: { clientNumber: 'CHILD-001' } },
            { information: { clientNumber: 'CHILD-002' } },
            { information: { clientNumber: 'CHILD-002' } }, // Duplicate in children
          ],
        } as unknown as ClientApplicationRenewalEligibleDto;

        // Should still work correctly with duplicates in either list
        expect(isChildClientNumberValid('renewal', mockAppWithDuplicates, 'CHILD-001')).toBe(true);
        expect(isChildClientNumberValid('renewal', mockAppWithDuplicates, 'CHILD-002')).toBe(true);
      });

      it('handles client numbers with special characters', () => {
        const mockAppWithSpecialChars = {
          applicantInformation: {
            clientNumber: 'APP-123',
          },
          eligibleClientNumbers: ['CHILD@123', 'CHILD#456'],
          children: [{ information: { clientNumber: 'CHILD@123' } }, { information: { clientNumber: 'CHILD#456' } }],
        } as unknown as ClientApplicationRenewalEligibleDto;

        expect(isChildClientNumberValid('renewal', mockAppWithSpecialChars, 'CHILD@123')).toBe(true);
        expect(isChildClientNumberValid('renewal', mockAppWithSpecialChars, 'CHILD#456')).toBe(true);
        expect(isChildClientNumberValid('renewal', mockAppWithSpecialChars, 'CHILD%000')).toBe(false);
      });

      it('performs exact string matching (case-sensitive)', () => {
        const mockAppCaseSensitive = {
          applicantInformation: {
            clientNumber: 'APP-001',
          },
          eligibleClientNumbers: ['CHILD-001', 'child-002'],
          children: [{ information: { clientNumber: 'CHILD-001' } }, { information: { clientNumber: 'child-002' } }],
        } as unknown as ClientApplicationRenewalEligibleDto;

        expect(isChildClientNumberValid('renewal', mockAppCaseSensitive, 'CHILD-001')).toBe(true);
        expect(isChildClientNumberValid('renewal', mockAppCaseSensitive, 'child-002')).toBe(true);
        expect(isChildClientNumberValid('renewal', mockAppCaseSensitive, 'child-001')).toBe(false);
        expect(isChildClientNumberValid('renewal', mockAppCaseSensitive, 'CHILD-002')).toBe(false);
      });
    });
  });

  describe('getAllowedTypeOfApplication', () => {
    describe('intake context', () => {
      it('returns all three types', () => {
        expect(getAllowedTypeOfApplication({ context: 'intake' })).toEqual(['adult', 'children', 'family']);
      });
    });

    describe('renewal context', () => {
      it('returns adult, children, and family when both the primary applicant and at least one child are eligible', () => {
        expect(
          getAllowedTypeOfApplication({
            context: 'renewal',
            clientApplication: {
              applicantInformation: { clientNumber: 'APP-001' },
              eligibleClientNumbers: ['APP-001', 'CHILD-001'],
              children: [{ information: { clientNumber: 'CHILD-001' } }],
            },
          }),
        ).toEqual(['adult', 'children', 'family']);
      });

      it('returns only adult when the primary applicant is eligible but no children are eligible', () => {
        expect(
          getAllowedTypeOfApplication({
            context: 'renewal',
            clientApplication: {
              applicantInformation: { clientNumber: 'APP-001' },
              eligibleClientNumbers: ['APP-001'],
              children: [{ information: { clientNumber: 'CHILD-001' } }],
            },
          }),
        ).toEqual(['adult']);
      });

      it('returns only adult when the primary applicant is eligible and there are no children', () => {
        expect(
          getAllowedTypeOfApplication({
            context: 'renewal',
            clientApplication: {
              applicantInformation: { clientNumber: 'APP-001' },
              eligibleClientNumbers: ['APP-001'],
              children: [],
            },
          }),
        ).toEqual(['adult']);
      });

      it('returns only children when the primary applicant is not eligible but at least one child is eligible', () => {
        expect(
          getAllowedTypeOfApplication({
            context: 'renewal',
            clientApplication: {
              applicantInformation: { clientNumber: 'APP-001' },
              eligibleClientNumbers: ['CHILD-001'],
              children: [{ information: { clientNumber: 'CHILD-001' } }],
            },
          }),
        ).toEqual(['children']);
      });
    });

    describe('maritalStatusHasPartner', () => {
      it('returns true when marital status is MARITAL_STATUS_CODE_MARRIED', () => {
        expect(maritalStatusHasPartner('MARRIED')).toBe(true);
      });

      it('returns true when marital status is MARITAL_STATUS_CODE_COMMON_LAW', () => {
        expect(maritalStatusHasPartner('COMMON_LAW')).toBe(true);
      });

      it('returns false when marital status is undefined', () => {
        expect(maritalStatusHasPartner(undefined)).toBe(false);
      });

      it('returns false when marital status is empty string', () => {
        expect(maritalStatusHasPartner('')).toBe(false);
      });

      it('returns false when marital status is a value other than married or common law', () => {
        expect(maritalStatusHasPartner('SINGLE')).toBe(false);
        expect(maritalStatusHasPartner('DIVORCED')).toBe(false);
        expect(maritalStatusHasPartner('WIDOWED')).toBe(false);
      });
    });

    // 123456782 and 520325317 are fictitious but structurally valid SINs (pass Luhn check).
    // 123456789 is correctly formatted but fails the Luhn check (invalid SIN).
    describe('isSinReserved', () => {
      it('returns false when the reserved list is empty', () => {
        expect(isSinReserved('123456782', [])).toBe(false);
      });

      it('returns false when no reserved SIN matches the candidate', () => {
        expect(isSinReserved('123456782', ['520325317'])).toBe(false);
      });

      it('returns true when a reserved SIN matches the candidate', () => {
        expect(isSinReserved('123456782', ['123456782'])).toBe(true);
      });

      it('normalizes separators before comparing', () => {
        expect(isSinReserved('123456782', ['123 456 782'])).toBe(true);
        expect(isSinReserved('123 456 782', ['123456782'])).toBe(true);
        expect(isSinReserved('123-456-782', ['123456782'])).toBe(true);
      });

      it('returns true when the match is among multiple reserved SINs', () => {
        expect(isSinReserved('123456782', ['520325317', '123456782'])).toBe(true);
      });

      it('skips undefined entries in the reserved list', () => {
        expect(isSinReserved('123456782', [undefined])).toBe(false);
        expect(isSinReserved('123456782', [undefined, '123456782'])).toBe(true);
      });

      it('returns false when the candidate SIN is invalid', () => {
        expect(isSinReserved('123456789', ['123456782'])).toBe(false);
      });

      it('skips invalid SINs in the reserved list', () => {
        expect(isSinReserved('123456782', ['123456789'])).toBe(false);
        expect(isSinReserved('123456782', ['123456789', '123456782'])).toBe(true);
      });

      it('returns false when the reserved list contains only undefined and invalid SINs', () => {
        expect(isSinReserved('123456782', [undefined, '123456789'])).toBe(false);
      });
    });
  });

  describe('isEmailAddressRequired', () => {
    it('returns true when preferred method includes GC digital', () => {
      expect(isEmailAddressRequired({ preferredMethodSunLife: 'mail', preferredMethodGovernmentOfCanada: 'digital' })).toBe(true);
    });

    it('returns true when preferred method includes Sun Life email', () => {
      expect(isEmailAddressRequired({ preferredMethodSunLife: 'email', preferredMethodGovernmentOfCanada: 'mail' })).toBe(true);
    });

    it('returns true when preferred method includes both GC digital and Sun Life email', () => {
      expect(isEmailAddressRequired({ preferredMethodSunLife: 'email', preferredMethodGovernmentOfCanada: 'digital' })).toBe(true);
    });

    it('returns false when preferred method includes neither GC digital nor Sun Life email', () => {
      expect(isEmailAddressRequired({ preferredMethodSunLife: 'mail', preferredMethodGovernmentOfCanada: 'mail' })).toBe(false);
    });
  });

  describe('checkValidAndVerifiedEmailAddress', () => {
    it('returns valid and verified when email is valid and verified', () => {
      expect(checkValidAndVerifiedEmailAddress({ email: 'valid@example.com', emailVerified: true })).toEqual({ success: true, email: 'valid@example.com', emailVerified: true });
    });

    it.each([
      [undefined, false],
      [undefined, true],
      [undefined, undefined],
      ['invalid-email', false],
      ['invalid-email', true],
      ['invalid-email', undefined],
      ['valid@example.com', false],
      ['valid@example.com', undefined],
    ])('returns invalid when email is [%s] or not verified is [%s]', (email, emailVerified) => {
      expect(checkValidAndVerifiedEmailAddress({ email, emailVerified })).toEqual({ success: false, email, emailVerified });
    });
  });
});
