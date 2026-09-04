import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAllowedTypeOfApplication } from '~/.server/routes/helpers/base-application-route-helpers';
import { getTypeOfApplicationSectionCompletionResult, isPersonalInformationSectionCompleted, isTaxFilingSectionCompleted, isTermsAndConditionsSectionCompleted } from '~/.server/routes/helpers/public-application-entry-section-checks';

vi.mock(import('~/.server/routes/helpers/base-application-route-helpers'), async (importOriginal) => ({
  ...(await importOriginal()),
  getAllowedTypeOfApplication: vi.fn(),
}));

const mockClientApplication = {
  applicantInformation: { clientNumber: 'APP-001' },
  eligibleClientNumbers: [],
  children: [],
};

const APPLICATION_YEAR = { applicationYearId: 'year-2024', taxYear: '2025', dependentEligibilityEndDate: '2027-06-30' };

describe('getTypeOfApplicationSectionCompletionResult', () => {
  describe('intake context', () => {
    it('should return COMPLETED when typeOfApplication is included in allowed types', () => {
      vi.mocked(getAllowedTypeOfApplication).mockReturnValue(['adult', 'children', 'family']);
      expect(getTypeOfApplicationSectionCompletionResult({ context: 'intake', typeOfApplication: 'adult' })).toBe('COMPLETED');
      expect(getTypeOfApplicationSectionCompletionResult({ context: 'intake', typeOfApplication: 'children' })).toBe('COMPLETED');
      expect(getTypeOfApplicationSectionCompletionResult({ context: 'intake', typeOfApplication: 'family' })).toBe('COMPLETED');
    });

    it('should return TYPE-MISMATCHED when typeOfApplication is not included in allowed types', () => {
      vi.mocked(getAllowedTypeOfApplication).mockReturnValue(['adult']);
      expect(getTypeOfApplicationSectionCompletionResult({ context: 'intake', typeOfApplication: 'family' })).toBe('TYPE-MISMATCHED');
    });

    it('should return INCOMPLETED when typeOfApplication is delegate', () => {
      expect(getTypeOfApplicationSectionCompletionResult({ context: 'intake', typeOfApplication: 'delegate' })).toBe('INCOMPLETED');
    });

    it('should return INCOMPLETED when typeOfApplication is undefined', () => {
      expect(getTypeOfApplicationSectionCompletionResult({ context: 'intake', typeOfApplication: undefined })).toBe('INCOMPLETED');
    });
  });

  describe('renewal context', () => {
    it('should return INCOMPLETED when typeOfApplication is undefined', () => {
      expect(getTypeOfApplicationSectionCompletionResult({ context: 'renewal', typeOfApplication: undefined })).toBe('INCOMPLETED');
    });

    it('should return INCOMPLETED when typeOfApplication is delegate', () => {
      expect(getTypeOfApplicationSectionCompletionResult({ context: 'renewal', typeOfApplication: 'delegate' })).toBe('INCOMPLETED');
    });

    it('should return COMPLETED when clientApplication is absent', () => {
      expect(getTypeOfApplicationSectionCompletionResult({ context: 'renewal', typeOfApplication: 'adult' })).toBe('COMPLETED');
    });

    it('should return COMPLETED when typeOfApplication is included in allowed types', () => {
      vi.mocked(getAllowedTypeOfApplication).mockReturnValue(['adult']);
      expect(getTypeOfApplicationSectionCompletionResult({ context: 'renewal', typeOfApplication: 'adult', clientApplication: mockClientApplication })).toBe('COMPLETED');
    });

    it('should return TYPE-MISMATCHED when typeOfApplication is not included in allowed types', () => {
      vi.mocked(getAllowedTypeOfApplication).mockReturnValue(['adult']);
      expect(getTypeOfApplicationSectionCompletionResult({ context: 'renewal', typeOfApplication: 'children', clientApplication: mockClientApplication })).toBe('TYPE-MISMATCHED');
      expect(getTypeOfApplicationSectionCompletionResult({ context: 'renewal', typeOfApplication: 'family', clientApplication: mockClientApplication })).toBe('TYPE-MISMATCHED');
    });
  });
});

describe('isPersonalInformationSectionCompleted', () => {
  beforeEach(() => {
    vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-03-04'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false when inputModel is undefined', () => {
    expect(
      isPersonalInformationSectionCompleted({
        context: 'intake',
        applicationYear: APPLICATION_YEAR,
        inputModel: undefined,
        applicantInformation: {
          dateOfBirth: '1990-01-01',
          firstName: 'John',
          lastName: 'Doe',
          socialInsuranceNumber: '123456789',
        },
      }),
    ).toBe(false);
  });

  it('should return false when applicantInformation is undefined', () => {
    expect(
      isPersonalInformationSectionCompleted({
        context: 'intake',
        applicationYear: APPLICATION_YEAR,
        inputModel: 'full',
        applicantInformation: undefined,
      }),
    ).toBe(false);
  });

  it('should return false when both are undefined', () => {
    expect(isPersonalInformationSectionCompleted({ context: 'intake', applicationYear: APPLICATION_YEAR })).toBe(false);
  });

  it('should return false when ageCategory is children', () => {
    // born 2012-01-01 → age 14 on reference date 2026-06-30
    expect(
      isPersonalInformationSectionCompleted({
        context: 'intake',
        applicationYear: APPLICATION_YEAR,
        inputModel: 'full',
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
    // born 2009-01-01 → age 17 on reference date 2026-06-30
    expect(
      isPersonalInformationSectionCompleted({
        context: 'intake',
        applicationYear: APPLICATION_YEAR,
        inputModel: 'full',
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
    // born 2009-01-01 → age 17 on reference date 2026-06-30
    expect(
      isPersonalInformationSectionCompleted({
        context: 'intake',
        applicationYear: APPLICATION_YEAR,
        inputModel: 'full',
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
    // born 2009-01-01 → age 17 on reference date 2026-06-30
    expect(
      isPersonalInformationSectionCompleted({
        context: 'intake',
        applicationYear: APPLICATION_YEAR,
        inputModel: 'full',
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
    // born 1990-01-01 → age 36 on reference date 2026-06-30
    expect(
      isPersonalInformationSectionCompleted({
        context: 'intake',
        applicationYear: APPLICATION_YEAR,
        inputModel: 'full',
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
    // born 1950-01-01 → age 76 on reference date 2026-06-30
    expect(
      isPersonalInformationSectionCompleted({
        context: 'intake',
        applicationYear: APPLICATION_YEAR,
        inputModel: 'full',
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
