import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isPersonalInformationSectionCompleted,
  isRenewalSelectionCompleted,
  isTaxFilingSectionCompleted,
  isTermsAndConditionsSectionCompleted,
  isTypeOfApplicationSectionCompleted,
} from '~/.server/routes/helpers/protected-application-entry-section-checks';

const APPLICATION_YEAR = { applicationYearId: 'year-2024', taxYear: '2025', dependentEligibilityEndDate: '2027-06-30' };

describe('isTypeOfApplicationSectionCompleted', () => {
  it('should return true when typeOfApplication is defined and not delegate', () => {
    expect(isTypeOfApplicationSectionCompleted({ typeOfApplication: 'adult' })).toBe(true);
  });

  it('should return false when typeOfApplication is delegate', () => {
    expect(isTypeOfApplicationSectionCompleted({ typeOfApplication: 'delegate' })).toBe(false);
  });

  it('should return false when typeOfApplication is undefined', () => {
    expect(isTypeOfApplicationSectionCompleted({ typeOfApplication: undefined })).toBe(false);
  });
});

describe('isPersonalInformationSectionCompleted', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Temporal.PlainDateTime.from('2026-03-04', { overflow: 'reject' }).toZonedDateTime(Temporal.Now.timeZoneId()) });
  });

  it('should return false when applicantInformation is undefined', () => {
    expect(isPersonalInformationSectionCompleted({ applicantInformation: undefined, applicationYear: APPLICATION_YEAR })).toBe(false);
  });

  it('should return false when dateOfBirth is missing', () => {
    expect(isPersonalInformationSectionCompleted({ applicationYear: APPLICATION_YEAR })).toBe(false);
  });

  it('should return false when ageCategory is children', () => {
    // born 2012-01-01 → age 14 on reference date 2026-07-01
    expect(
      isPersonalInformationSectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantInformation: {
          dateOfBirth: '2012-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
      }),
    ).toBe(false);
  });

  it('should return false when ageCategory is youth and livingIndependently is undefined', () => {
    // born 2009-01-01 → age 17 on reference date 2026-07-01
    expect(
      isPersonalInformationSectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantInformation: {
          dateOfBirth: '2009-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
        livingIndependently: undefined,
      }),
    ).toBe(false);
  });

  it('should return false when ageCategory is youth and livingIndependently is false', () => {
    expect(
      isPersonalInformationSectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantInformation: {
          dateOfBirth: '2009-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
        livingIndependently: false,
      }),
    ).toBe(false);
  });

  it('should return true when ageCategory is youth and livingIndependently is true', () => {
    expect(
      isPersonalInformationSectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantInformation: {
          dateOfBirth: '2009-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
        livingIndependently: true,
      }),
    ).toBe(true);
  });

  it('should return true when ageCategory is adults', () => {
    // born 1990-01-01 → age 36 on reference date 2026-07-01
    expect(
      isPersonalInformationSectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantInformation: {
          dateOfBirth: '1990-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
      }),
    ).toBe(true);
  });

  it('should return true when ageCategory is seniors', () => {
    // born 1950-01-01 → age 76 on reference date 2026-07-01
    expect(
      isPersonalInformationSectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantInformation: {
          dateOfBirth: '1950-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
      }),
    ).toBe(true);
  });
});

describe('isTermsAndConditionsSectionCompleted', () => {
  it('should return true when all conditions are acknowledged', () => {
    expect(
      isTermsAndConditionsSectionCompleted({
        termsAndConditions: {
          acknowledgePrivacy: true,
          acknowledgeTerms: true,
          shareData: true,
        },
      }),
    ).toBe(true);
  });

  it('should return false when acknowledgePrivacy is false', () => {
    expect(
      isTermsAndConditionsSectionCompleted({
        termsAndConditions: {
          acknowledgePrivacy: false,
          acknowledgeTerms: true,
          shareData: true,
        },
      }),
    ).toBe(false);
  });

  it('should return false when acknowledgeTerms is false', () => {
    expect(
      isTermsAndConditionsSectionCompleted({
        termsAndConditions: {
          acknowledgePrivacy: true,
          acknowledgeTerms: false,
          shareData: true,
        },
      }),
    ).toBe(false);
  });

  it('should return false when shareData is false', () => {
    expect(
      isTermsAndConditionsSectionCompleted({
        termsAndConditions: {
          acknowledgePrivacy: true,
          acknowledgeTerms: true,
          shareData: false,
        },
      }),
    ).toBe(false);
  });

  it('should return false when termsAndConditions is undefined', () => {
    expect(isTermsAndConditionsSectionCompleted({ termsAndConditions: undefined })).toBe(false);
  });

  it('should return false when any property is missing', () => {
    expect(isTermsAndConditionsSectionCompleted({})).toBe(false);
  });
});

describe('isTaxFilingSectionCompleted', () => {
  it('should return true when hasFiledTaxes is true', () => {
    expect(isTaxFilingSectionCompleted({ hasFiledTaxes: true })).toBe(true);
  });

  it('should return false when hasFiledTaxes is false', () => {
    expect(isTaxFilingSectionCompleted({ hasFiledTaxes: false })).toBe(false);
  });

  it('should return false when hasFiledTaxes is undefined', () => {
    expect(isTaxFilingSectionCompleted({ hasFiledTaxes: undefined })).toBe(false);
  });
});

describe('isRenewalSelectionCompleted', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Temporal.PlainDateTime.from('2026-03-04', { overflow: 'reject' }).toZonedDateTime(Temporal.Now.timeZoneId()) });
  });

  it('should return false when applicantClientIdsToRenew is undefined', () => {
    expect(
      isRenewalSelectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantClientIdsToRenew: undefined,
        applicantInformation: {
          dateOfBirth: '1990-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
      }),
    ).toBe(false);
  });

  it('should return false when applicantClientIdsToRenew is empty', () => {
    expect(
      isRenewalSelectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantClientIdsToRenew: [],
        applicantInformation: {
          dateOfBirth: '1990-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
      }),
    ).toBe(false);
  });

  it('should return false when dateOfBirth is missing', () => {
    expect(
      isRenewalSelectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantClientIdsToRenew: ['abc'],
        applicantInformation: undefined,
      }),
    ).toBe(false);
  });

  it('should return false when ageCategory is children', () => {
    // born 2012-01-01 → age 14 on reference date 2026-07-01
    expect(
      isRenewalSelectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantClientIdsToRenew: ['abc'],
        applicantInformation: {
          dateOfBirth: '2012-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
      }),
    ).toBe(false);
  });

  it('should return false when ageCategory is youth and livingIndependently is undefined', () => {
    // born 2009-01-01 → age 17 on reference date 2026-07-01
    expect(
      isRenewalSelectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantClientIdsToRenew: ['abc'],
        applicantInformation: {
          dateOfBirth: '2009-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
        livingIndependently: undefined,
      }),
    ).toBe(false);
  });

  it('should return false when ageCategory is youth and livingIndependently is false', () => {
    expect(
      isRenewalSelectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantClientIdsToRenew: ['abc'],
        applicantInformation: {
          dateOfBirth: '2009-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
        livingIndependently: false,
      }),
    ).toBe(false);
  });

  it('should return true when ageCategory is youth and livingIndependently is true', () => {
    expect(
      isRenewalSelectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantClientIdsToRenew: ['abc'],
        applicantInformation: {
          dateOfBirth: '2009-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
        livingIndependently: true,
      }),
    ).toBe(true);
  });

  it('should return true when ageCategory is adults', () => {
    // born 1990-01-01 → age 36 on reference date 2026-07-01
    expect(
      isRenewalSelectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantClientIdsToRenew: ['abc'],
        applicantInformation: {
          dateOfBirth: '1990-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
      }),
    ).toBe(true);
  });

  it('should return true when ageCategory is seniors', () => {
    // born 1950-01-01 → age 76 on reference date 2026-07-01
    expect(
      isRenewalSelectionCompleted({
        applicationYear: APPLICATION_YEAR,
        applicantClientIdsToRenew: ['abc'],
        applicantInformation: {
          dateOfBirth: '1950-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
      }),
    ).toBe(true);
  });
});
