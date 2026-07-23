import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClientApplicationRenewalEligibleDto } from '~/.server/domain/dtos';
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
} from '~/.server/routes/helpers/protected-application-renewal-section-checks';
import { getEnv } from '~/.server/utils/env-utils';

vi.mock('~/.server/utils/env-utils');

const APPLICATION_YEAR = { applicationYearId: 'year-2024', taxYear: '2025', dependentEligibilityEndDate: '2027-06-30' };

describe('protected-application-simplified-section-checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isPhoneNumberSectionCompleted', () => {
    it('should return true when phoneNumber is defined', () => {
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

    it('should return true when phoneNumber is defined with only primary number', () => {
      expect(
        isPhoneNumberSectionCompleted({
          phoneNumber: {
            hasChanged: true,
            value: {
              primary: '123-456-7890',
            },
          },
        }),
      ).toBe(true);
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
      expect(
        isAddressSectionCompleted({
          mailingAddress: undefined,
          homeAddress: undefined,
        }),
      ).toBe(false);
    });

    it('should return true when both addresses have changed and same-address question is answered', () => {
      expect(
        isAddressSectionCompleted({
          mailingAddress: {
            hasChanged: true,
            value: { address: '123 Main St', city: 'Anytown', province: 'ON', postalCode: 'A1A 1A1', country: 'CAN' },
          },
          homeAddress: {
            hasChanged: true,
            value: { address: '456 Oak Ave', city: 'Othertown', province: 'BC', postalCode: 'B2B 2B2', country: 'CAN' },
          },
          isHomeAddressSameAsMailingAddress: false,
        }),
      ).toBe(true);
    });

    it('should return false when both addresses have changed but same-address question is unanswered', () => {
      expect(
        isAddressSectionCompleted({
          mailingAddress: {
            hasChanged: true,
            value: { address: '123 Main St', city: 'Anytown', province: 'ON', postalCode: 'A1A 1A1', country: 'CAN' },
          },
          homeAddress: {
            hasChanged: true,
            value: { address: '456 Oak Ave', city: 'Othertown', province: 'BC', postalCode: 'B2B 2B2', country: 'CAN' },
          },
          isHomeAddressSameAsMailingAddress: undefined,
        }),
      ).toBe(false);
    });

    it('should return true when neither address has changed and both are on file in the client application', () => {
      expect(
        isAddressSectionCompleted({
          mailingAddress: { hasChanged: false },
          homeAddress: { hasChanged: false },
          clientApplication: {
            contactInformation: {
              mailingAddress: { address: '123 Main St', city: 'Anytown', country: 'CAN' },
              homeAddress: { address: '456 Oak Ave', city: 'Othertown', country: 'CAN' },
            },
          },
        } as Parameters<typeof isAddressSectionCompleted>[0]),
      ).toBe(true);
    });

    it('should return false when neither address has changed and home address is not on file in the client application', () => {
      expect(
        isAddressSectionCompleted({
          mailingAddress: { hasChanged: false },
          homeAddress: { hasChanged: false },
          clientApplication: {
            contactInformation: {
              mailingAddress: { address: '123 Main St', city: 'Anytown', country: 'CAN' },
              homeAddress: undefined,
            },
          },
        } as Parameters<typeof isAddressSectionCompleted>[0]),
      ).toBe(false);
    });

    it('should return false when neither address has changed and no client application is present', () => {
      expect(
        isAddressSectionCompleted({
          mailingAddress: { hasChanged: false },
          homeAddress: { hasChanged: false },
          clientApplication: undefined,
        } as Parameters<typeof isAddressSectionCompleted>[0]),
      ).toBe(false);
    });

    it('should return false when mailing address has changed but home address has not', () => {
      expect(
        isAddressSectionCompleted({
          mailingAddress: {
            hasChanged: true,
            value: { address: '123 Main St', city: 'Anytown', province: 'ON', postalCode: 'A1A 1A1', country: 'CAN' },
          },
          homeAddress: {
            hasChanged: false,
          },
        }),
      ).toBe(false);
    });

    it('should return false when home address has changed but mailing address has not', () => {
      expect(
        isAddressSectionCompleted({
          mailingAddress: {
            hasChanged: false,
          },
          homeAddress: {
            hasChanged: true,
            value: { address: '456 Oak Ave', city: 'Othertown', province: 'BC', postalCode: 'B2B 2B2', country: 'CAN' },
          },
        }),
      ).toBe(false);
    });
  });

  describe('isCommunicationPreferencesSectionCompleted', () => {
    vi.mocked(getEnv, { partial: true }).mockReturnValue({
      COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID: 'email',
      COMMUNICATION_METHOD_GC_DIGITAL_ID: 'email',
    });

    it('should return false when communicationPreferences is undefined', () => {
      expect(
        isCommunicationPreferencesSectionCompleted({
          communicationPreferences: undefined,
        }),
      ).toBe(false);
    });

    it('should return true when communicationPreferences is defined', () => {
      expect(
        isCommunicationPreferencesSectionCompleted({
          communicationPreferences: {
            hasChanged: false,
          },
        }),
      ).toBe(true);
    });
  });

  describe('isDentalInsuranceSectionCompleted', () => {
    it('should return true when dentalInsurance is defined with hasDentalInsurance true', () => {
      expect(
        isDentalInsuranceSectionCompleted({
          dentalInsurance: {
            hasDentalInsurance: true,
            dentalInsuranceEligibilityConfirmation: true,
          },
        }),
      ).toBe(true);
    });

    it('should return true when dentalInsurance is defined with hasDentalInsurance false', () => {
      expect(
        isDentalInsuranceSectionCompleted({
          dentalInsurance: {
            hasDentalInsurance: false,
            dentalInsuranceEligibilityConfirmation: false,
          },
        }),
      ).toBe(true);
    });

    it('should return false when dentalInsurance is undefined', () => {
      expect(isDentalInsuranceSectionCompleted({ dentalInsurance: undefined })).toBe(false);
    });
  });

  describe('isDentalBenefitsSectionCompleted', () => {
    it('should return false when dentalBenefits is undefined', () => {
      expect(isDentalBenefitsSectionCompleted({ dentalBenefits: undefined })).toBe(false);
    });

    it('should return true when dentalBenefits.hasChanged is true', () => {
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

    it('should return true when dentalBenefits.hasChanged is false and clientApplication.dentalBenefits is defined', () => {
      expect(
        isDentalBenefitsSectionCompleted({
          dentalBenefits: { hasChanged: false },
          clientApplication: { dentalBenefits: ['provincial-program-id'] } as unknown as ClientApplicationRenewalEligibleDto,
        }),
      ).toBe(true);
    });

    it('should return false when dentalBenefits.hasChanged is false and clientApplication.dentalBenefits is undefined', () => {
      expect(
        isDentalBenefitsSectionCompleted({
          dentalBenefits: { hasChanged: false },
          clientApplication: { dentalBenefits: undefined } as unknown as ClientApplicationRenewalEligibleDto,
        }),
      ).toBe(false);
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

    const mockClientApplication = {
      applicantInformation: {
        clientNumber: 'APP-123',
        firstName: 'John',
        lastName: 'Doe',
      },
      eligibleClientNumbers: ['APP-123', 'CHILD-001', 'CHILD-002'],
      children: [
        {
          information: {
            clientNumber: 'CHILD-001',
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: '2010-01-01',
            isParent: true,
          },
        },
        {
          information: {
            clientNumber: 'CHILD-002',
            firstName: 'Jim',
            lastName: 'Doe',
            dateOfBirth: '2012-01-01',
            isParent: true,
          },
        },
      ],
    } as unknown as ClientApplicationRenewalEligibleDto;

    it('should return true when child information is defined with valid date of birth', () => {
      expect(
        isChildInformationSectionCompleted(
          {
            applicationYear: APPLICATION_YEAR,
            clientApplication: mockClientApplication,
          },
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
      expect(
        isChildInformationSectionCompleted(
          { applicationYear: APPLICATION_YEAR },
          {
            information: {
              firstName: 'Test',
              lastName: 'Child',
              hasSocialInsuranceNumber: false,
              isParent: true,
              dateOfBirth: '',
            },
          },
        ),
      ).toBe(false);
    });

    it('should return false when information is undefined', () => {
      expect(isChildInformationSectionCompleted({ applicationYear: APPLICATION_YEAR }, { information: undefined })).toBe(false);
    });
  });

  describe('isChildDentalInsuranceSectionCompleted', () => {
    it('should return true when child dentalInsurance is defined with insurance', () => {
      expect(
        isChildDentalInsuranceSectionCompleted({
          dentalInsurance: {
            hasDentalInsurance: true,
            dentalInsuranceEligibilityConfirmation: true,
          },
        }),
      ).toBe(true);
    });

    it('should return true when child dentalInsurance is defined without insurance', () => {
      expect(
        isChildDentalInsuranceSectionCompleted({
          dentalInsurance: {
            hasDentalInsurance: false,
            dentalInsuranceEligibilityConfirmation: false,
          },
        }),
      ).toBe(true);
    });

    it('should return false when child dentalInsurance is undefined', () => {
      expect(isChildDentalInsuranceSectionCompleted({ dentalInsurance: undefined })).toBe(false);
    });
  });

  describe('isChildDentalBenefitsSectionCompleted', () => {
    it('should return true when child dentalBenefits is defined', () => {
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

    it('should return true when child dentalBenefits is defined with benefits', () => {
      expect(
        isChildDentalBenefitsSectionCompleted({
          dentalBenefits: {
            hasChanged: true,
            value: {
              hasFederalBenefits: true,
              federalSocialProgram: 'federal-program-id',
              hasProvincialTerritorialBenefits: true,
              province: 'ON',
              provincialTerritorialSocialProgram: 'provincial-program-id',
            },
          },
        }),
      ).toBe(true);
    });

    it('should return false when child dentalBenefits is undefined', () => {
      expect(isChildDentalBenefitsSectionCompleted({ dentalBenefits: undefined })).toBe(false);
    });
  });
});
