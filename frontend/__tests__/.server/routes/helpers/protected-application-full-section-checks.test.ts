import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isAddressSectionCompleted,
  isChildDentalBenefitsSectionCompleted,
  isChildDentalInsuranceSectionCompleted,
  isChildInformationSectionCompleted,
  isCommunicationPreferencesSectionCompleted,
  isDentalBenefitsSectionCompleted,
  isDentalInsuranceSectionCompleted,
  isMaritalStatusSectionCompleted,
  isPhoneNumberSectionCompleted,
} from '~/.server/routes/helpers/protected-application-intake-section-checks';
import { getEnv } from '~/.server/utils/env-utils';

vi.mock('~/.server/utils/env-utils');

const APPLICATION_YEAR = { applicationYearId: 'year-2024', taxYear: '2025', dependentEligibilityEndDate: '2027-06-30' };

describe('protected-application-full-section-checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isPhoneNumberSectionCompleted', () => {
    it('should return true when phoneNumber.hasChanged is true', () => {
      expect(
        isPhoneNumberSectionCompleted({
          phoneNumber: {
            hasChanged: true,
            value: {
              primary: '123-456-7890',
              alternate: '098-765-4321',
            },
          },
        }),
      ).toBe(true);
    });

    it('should return true when phoneNumber.hasChanged is false', () => {
      expect(isPhoneNumberSectionCompleted({ phoneNumber: { hasChanged: false } })).toBe(true);
    });

    it('should return false when phoneNumber is undefined', () => {
      expect(isPhoneNumberSectionCompleted({ phoneNumber: undefined })).toBe(false);
    });
  });

  describe('isAddressSectionCompleted', () => {
    it('should return false when mailingAddress is undefined', () => {
      expect(
        isAddressSectionCompleted({
          mailingAddress: undefined,
          homeAddress: {
            hasChanged: true,
            value: { address: '456 Oak Ave', city: 'Othertown', province: 'BC', postalCode: 'B2B 2B2', country: 'CAN' },
          },
        }),
      ).toBe(false);
    });

    it('should return false when homeAddress is undefined', () => {
      expect(
        isAddressSectionCompleted({
          mailingAddress: { hasChanged: true, value: { address: '123 Main St', city: 'Anytown', province: 'ON', postalCode: 'A1A 1A1', country: 'CAN' } },
          homeAddress: undefined,
        }),
      ).toBe(false);
    });

    it('should return false when both addresses are undefined', () => {
      expect(isAddressSectionCompleted({ mailingAddress: undefined, homeAddress: undefined })).toBe(false);
    });

    it('should return true when both addresses have changed and same-address question is answered', () => {
      expect(
        isAddressSectionCompleted({
          mailingAddress: { hasChanged: true, value: { address: '123 Main St', city: 'Anytown', province: 'ON', postalCode: 'A1A 1A1', country: 'CAN' } },
          homeAddress: { hasChanged: true, value: { address: '456 Oak Ave', city: 'Othertown', province: 'BC', postalCode: 'B2B 2B2', country: 'CAN' } },
          isHomeAddressSameAsMailingAddress: false,
        }),
      ).toBe(true);
    });

    it('should return false when both addresses have changed but same-address question is unanswered', () => {
      expect(
        isAddressSectionCompleted({
          mailingAddress: { hasChanged: true, value: { address: '123 Main St', city: 'Anytown', province: 'ON', postalCode: 'A1A 1A1', country: 'CAN' } },
          homeAddress: { hasChanged: true, value: { address: '456 Oak Ave', city: 'Othertown', province: 'BC', postalCode: 'B2B 2B2', country: 'CAN' } },
          isHomeAddressSameAsMailingAddress: undefined,
        }),
      ).toBe(false);
    });

    it('should return false when mailing address has not changed', () => {
      expect(
        isAddressSectionCompleted({
          mailingAddress: { hasChanged: false },
          homeAddress: { hasChanged: true, value: { address: '456 Oak Ave', city: 'Othertown', province: 'BC', postalCode: 'B2B 2B2', country: 'CAN' } },
        }),
      ).toBe(false);
    });

    it('should return false when home address has not changed', () => {
      expect(
        isAddressSectionCompleted({
          mailingAddress: { hasChanged: true, value: { address: '123 Main St', city: 'Anytown', province: 'ON', postalCode: 'A1A 1A1', country: 'CAN' } },
          homeAddress: { hasChanged: false },
        }),
      ).toBe(false);
    });

    it('should return false when neither address has changed', () => {
      expect(isAddressSectionCompleted({ mailingAddress: { hasChanged: false }, homeAddress: { hasChanged: false } })).toBe(false);
    });
  });

  describe('isCommunicationPreferencesSectionCompleted', () => {
    it('should return true when communication preferences have not changed', () => {
      expect(
        isCommunicationPreferencesSectionCompleted({
          communicationPreferences: { hasChanged: false },
        }),
      ).toBe(true);
    });

    it('should return true when email not required and preferences set', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({
        COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID: 'sunlife',
        COMMUNICATION_METHOD_GC_DIGITAL_ID: 'gc-digital',
      });

      expect(
        isCommunicationPreferencesSectionCompleted({
          communicationPreferences: {
            hasChanged: true,
            value: {
              preferredMethod: 'mail',
              preferredLanguage: 'en',
              preferredNotificationMethod: 'mail',
            },
          },
        }),
      ).toBe(true);
    });
  });

  describe('isDentalInsuranceSectionCompleted', () => {
    it('should return true when dental insurance eligibility confirmation is true', () => {
      expect(
        isDentalInsuranceSectionCompleted({
          dentalInsurance: {
            hasDentalInsurance: true,
            dentalInsuranceEligibilityConfirmation: true,
          },
        }),
      ).toBe(true);
    });

    it('should return false when dental insurance eligibility confirmation is false', () => {
      expect(
        isDentalInsuranceSectionCompleted({
          dentalInsurance: {
            hasDentalInsurance: true,
            dentalInsuranceEligibilityConfirmation: false,
          },
        }),
      ).toBe(false);
    });
  });

  describe('isDentalBenefitsSectionCompleted', () => {
    it('should return true when dental benefits have changed', () => {
      expect(
        isDentalBenefitsSectionCompleted({
          dentalBenefits: {
            hasChanged: true,
            value: {
              hasFederalBenefits: false,
              hasProvincialTerritorialBenefits: false,
            },
          },
        }),
      ).toBe(true);
    });

    it('should return true when dental benefits have not changed', () => {
      expect(isDentalBenefitsSectionCompleted({ dentalBenefits: { hasChanged: false } })).toBe(true);
    });
  });

  describe('isMaritalStatusSectionCompleted', () => {
    it('should return false when marital status is undefined', () => {
      const state = { maritalStatus: undefined, partnerInformation: undefined };
      expect(isMaritalStatusSectionCompleted(state)).toBe(false);
    });

    it('should return true for single status without partner information', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({
        MARITAL_STATUS_CODE_COMMON_LAW: 'common-law',
        MARITAL_STATUS_CODE_MARRIED: 'married',
      });

      expect(
        isMaritalStatusSectionCompleted({
          maritalStatus: 'single',
          partnerInformation: undefined,
        }),
      ).toBe(true);
    });

    it('should return true for married status with partner confirmation', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({
        MARITAL_STATUS_CODE_COMMON_LAW: 'common-law',
        MARITAL_STATUS_CODE_MARRIED: 'married',
      });

      expect(
        isMaritalStatusSectionCompleted({
          maritalStatus: 'married',
          partnerInformation: {
            consentToSharePersonalInformation: true,
            socialInsuranceNumber: '123-456-789',
            yearOfBirth: '1980',
          },
        }),
      ).toBe(true);
    });

    it('should return false for common-law status without partner confirmation', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({
        MARITAL_STATUS_CODE_COMMON_LAW: 'common-law',
        MARITAL_STATUS_CODE_MARRIED: 'married',
      });

      expect(isMaritalStatusSectionCompleted({ maritalStatus: 'common-law' })).toBe(false);
    });
  });

  describe('isChildInformationSectionCompleted', () => {
    beforeEach(() => {
      vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-03-04'));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return true when child information has date of birth', () => {
      expect(
        isChildInformationSectionCompleted(
          { applicationYear: APPLICATION_YEAR },
          {
            information: {
              firstName: 'Test',
              lastName: 'Child',
              hasSocialInsuranceNumber: false,
              isParent: true,
              dateOfBirth: '2010-01-01',
            },
          },
        ),
      ).toBe(true);
    });

    it('should return false when date of birth is empty string', () => {
      const child = {
        information: {
          firstName: 'Test',
          lastName: 'Child',
          hasSocialInsuranceNumber: false,
          isParent: true,
          dateOfBirth: '',
        },
      };
      expect(isChildInformationSectionCompleted({ applicationYear: APPLICATION_YEAR }, child)).toBe(false);
    });

    it('should return false when information is undefined', () => {
      expect(isChildInformationSectionCompleted({ applicationYear: APPLICATION_YEAR }, { information: undefined })).toBe(false);
    });
  });

  describe('isChildDentalInsuranceSectionCompleted', () => {
    it('should return true when child dental insurance is defined', () => {
      expect(
        isChildDentalInsuranceSectionCompleted({
          dentalInsurance: {
            hasDentalInsurance: false,
            dentalInsuranceEligibilityConfirmation: true,
          },
        }),
      ).toBe(true);
    });

    it('should return false when child dental insurance is undefined', () => {
      expect(isChildDentalInsuranceSectionCompleted({ dentalInsurance: undefined })).toBe(false);
    });
  });

  describe('isChildDentalBenefitsSectionCompleted', () => {
    it('should return true when child dental benefits have changed', () => {
      expect(
        isChildDentalBenefitsSectionCompleted({
          dentalBenefits: {
            hasChanged: true,
            value: {
              hasFederalBenefits: false,
              hasProvincialTerritorialBenefits: false,
            },
          },
        }),
      ).toBe(true);
    });

    it('should return false when child dental benefits have not changed', () => {
      expect(isChildDentalBenefitsSectionCompleted({ dentalBenefits: { hasChanged: false } })).toBe(false);
    });
  });
});
