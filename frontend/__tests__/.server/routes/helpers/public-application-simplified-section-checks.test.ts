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
  isPhoneNumberSectionCompleted,
} from '~/.server/routes/helpers/public-application-simplified-section-checks';
import { getEnv } from '~/.server/utils/env.utils';

vi.mock('~/.server/utils/env.utils');

const APPLICATION_YEAR = { applicationYearId: 'year-2024', taxYear: '2025', dependentEligibilityEndDate: '2027-06-30' };

describe('public-application-simplified-section-checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getEnv, { partial: true }).mockReturnValue({
      COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID: 'SL_EMAIL',
      COMMUNICATION_METHOD_GC_DIGITAL_ID: 'GC_DIGITAL',
    });
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
          context: 'intake',
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
          context: 'intake',
          mailingAddress: {
            hasChanged: true,
            value: { address: '123 Main St', city: 'Anytown', province: 'ON', postalCode: 'A1A 1A1', country: 'CAN' },
          },
          homeAddress: undefined,
        }),
      ).toBe(false);
    });

    it('should return false when both addresses are undefined', () => {
      expect(
        isAddressSectionCompleted({
          context: 'intake',
          mailingAddress: undefined,
          homeAddress: undefined,
        }),
      ).toBe(false);
    });

    it('should return true when both addresses have changed and same-address question is answered', () => {
      expect(
        isAddressSectionCompleted({
          context: 'intake',
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
          context: 'intake',
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

    it('should return true when neither address has changed on renewal and both are on file in the client application', () => {
      expect(
        isAddressSectionCompleted({
          context: 'renewal',
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

    it('should return false when neither address has changed on renewal and home address is not on file', () => {
      expect(
        isAddressSectionCompleted({
          context: 'renewal',
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

    it('should return false when neither address has changed on renewal and no client application is present', () => {
      expect(
        isAddressSectionCompleted({
          context: 'renewal',
          mailingAddress: { hasChanged: false },
          homeAddress: { hasChanged: false },
          clientApplication: undefined,
        } as Parameters<typeof isAddressSectionCompleted>[0]),
      ).toBe(false);
    });

    it('should return false when neither address has changed on intake (carry-forward not allowed)', () => {
      expect(
        isAddressSectionCompleted({
          context: 'intake',
          mailingAddress: { hasChanged: false },
          homeAddress: { hasChanged: false },
          clientApplication: {
            contactInformation: {
              mailingAddress: { address: '123 Main St', city: 'Anytown', country: 'CAN' },
              homeAddress: { address: '456 Oak Ave', city: 'Othertown', country: 'CAN' },
            },
          },
        } as Parameters<typeof isAddressSectionCompleted>[0]),
      ).toBe(false);
    });

    it('should return false when mailing address has changed but home address has not', () => {
      expect(
        isAddressSectionCompleted({
          context: 'renewal',
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
          context: 'renewal',
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
    const baseClientApplication = {
      communicationPreferences: {
        preferredMethodGovernmentOfCanada: 'GC_MAIL',
        preferredMethodSunLife: 'SL_MAIL',
      },
      contactInformation: {
        email: 'test@example.com',
        emailVerified: true,
      },
    };

    // --- SECTION 1: INITIAL GUARD CLAUSES ---

    it('should return false when communicationPreferences is undefined', () => {
      expect(
        isCommunicationPreferencesSectionCompleted({
          clientApplication: baseClientApplication,
          communicationPreferences: undefined,
          email: undefined,
          emailVerified: undefined,
        }),
      ).toBe(false);
    });

    it('should return false when Sun Life preferred method is missing (hasChanged: false)', () => {
      expect(
        isCommunicationPreferencesSectionCompleted({
          clientApplication: {
            ...baseClientApplication,
            communicationPreferences: {
              ...baseClientApplication.communicationPreferences,
              preferredMethodSunLife: undefined,
            },
          },
          communicationPreferences: {
            hasChanged: false,
          },
          email: undefined,
          emailVerified: undefined,
        }),
      ).toBe(false);
    });

    it('should return false when Gov of Canada preferred method is missing (hasChanged: false)', () => {
      expect(
        isCommunicationPreferencesSectionCompleted({
          clientApplication: {
            ...baseClientApplication,
            communicationPreferences: {
              ...baseClientApplication.communicationPreferences,
              preferredMethodGovernmentOfCanada: undefined,
            },
          },
          communicationPreferences: {
            hasChanged: false,
          },
          email: undefined,
          emailVerified: undefined,
        }),
      ).toBe(false);
    });

    it('should return true when mail methods are selected and email requirements are bypassed', () => {
      expect(
        isCommunicationPreferencesSectionCompleted({
          clientApplication: baseClientApplication,
          communicationPreferences: {
            hasChanged: false,
          },
          email: undefined,
          emailVerified: undefined,
        }),
      ).toBe(true);
    });

    // --- SECTION 2: EMAIL REQUIRED SCENARIOS ---

    describe('when email communication is required', () => {
      const clientAppWithEmailReq = {
        ...baseClientApplication,
        communicationPreferences: {
          preferredMethodGovernmentOfCanada: 'GC_DIGITAL',
          preferredMethodSunLife: 'SL_MAIL',
        },
      };

      it('should validate and return true using clientApplication profile data when hasChanged is false', () => {
        expect(
          isCommunicationPreferencesSectionCompleted({
            clientApplication: clientAppWithEmailReq,
            communicationPreferences: {
              hasChanged: false,
            },
            email: undefined,
            emailVerified: undefined,
          }),
        ).toBe(true);
      });

      it('should validate and return true using direct payload fields when hasChanged is true', () => {
        expect(
          isCommunicationPreferencesSectionCompleted({
            clientApplication: baseClientApplication,
            communicationPreferences: {
              hasChanged: true,
              value: {
                preferredLanguage: 'en',
                preferredMethod: 'SL_MAIL',
                preferredNotificationMethod: 'GC_DIGITAL',
              },
            },
            email: 'changed@example.com',
            emailVerified: true,
          }),
        ).toBe(true);
      });

      it('should return false if the email field is undefined', () => {
        expect(
          isCommunicationPreferencesSectionCompleted({
            clientApplication: {
              ...clientAppWithEmailReq,
              contactInformation: {
                email: undefined,
                emailVerified: true,
              },
            },
            communicationPreferences: {
              hasChanged: false,
            },
            email: undefined,
            emailVerified: undefined,
          }),
        ).toBe(false);
      });

      it('should return false if the email format fails validation', () => {
        expect(
          isCommunicationPreferencesSectionCompleted({
            clientApplication: {
              ...clientAppWithEmailReq,
              contactInformation: {
                email: 'invalid-email',
                emailVerified: true,
              },
            },
            communicationPreferences: {
              hasChanged: false,
            },
            email: undefined,
            emailVerified: undefined,
          }),
        ).toBe(false);
      });

      it('should return false if the email is not verified', () => {
        expect(
          isCommunicationPreferencesSectionCompleted({
            clientApplication: {
              ...clientAppWithEmailReq,
              contactInformation: {
                email: 'test@example.com',
                emailVerified: false,
              },
            },
            communicationPreferences: {
              hasChanged: false,
            },
            email: undefined,
            emailVerified: undefined,
          }),
        ).toBe(false);
      });
    });

    // --- SECTION 3: FALLBACK CONFIGURATION ISOLATION ---

    describe('when hasChanged is false (Fallback Isolation)', () => {
      it('should ignore valid value overrides in payload and fall back to incomplete clientApplication settings', () => {
        expect(
          isCommunicationPreferencesSectionCompleted({
            clientApplication: {
              ...baseClientApplication,
              communicationPreferences: {
                preferredMethodSunLife: undefined,
                preferredMethodGovernmentOfCanada: 'GC_MAIL',
              },
            },
            communicationPreferences: {
              hasChanged: false,
            },
            email: undefined,
            emailVerified: undefined,
          }),
        ).toBe(false);
      });

      it('should ignore invalid values in payload and read successful configurations entirely from clientApplication', () => {
        expect(
          isCommunicationPreferencesSectionCompleted({
            clientApplication: baseClientApplication,
            communicationPreferences: {
              hasChanged: false,
            },
            email: undefined,
            emailVerified: undefined,
          }),
        ).toBe(true);
      });

      it('should fall back to clientApplication for email fields and ignore direct payload fields', () => {
        const clientAppWithEmailReq = {
          ...baseClientApplication,
          communicationPreferences: {
            preferredMethodGovernmentOfCanada: 'GC_DIGITAL',
            preferredMethodSunLife: 'SL_MAIL',
          },
          contactInformation: {
            email: 'fallback@example.com',
            emailVerified: true,
          },
        };

        expect(
          isCommunicationPreferencesSectionCompleted({
            clientApplication: clientAppWithEmailReq,
            communicationPreferences: {
              hasChanged: false,
            },
            email: 'ignored@example.com',
            emailVerified: false,
          }),
        ).toBe(true);
      });
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

  describe('isChildInformationSectionCompleted', () => {
    beforeEach(() => {
      vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(Temporal.PlainDate.from('2026-03-04'));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return true when child information is defined with valid date of birth', () => {
      expect(
        isChildInformationSectionCompleted(
          { context: 'intake', applicationYear: APPLICATION_YEAR },
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
          { context: 'intake', applicationYear: APPLICATION_YEAR },
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
      expect(isChildInformationSectionCompleted({ context: 'intake', applicationYear: APPLICATION_YEAR }, { information: undefined })).toBe(false);
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
