import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getContextualAgeCategoryFromDate } from '~/.server/routes/helpers/public-application-route-helpers';
import { DefaultBenefitApplicationStateMapper } from '~/.server/routes/mappers/benefit-application.state.mapper';
import type { ApplicationAdultState, ApplicationChildrenState, ApplicationFamilyState } from '~/.server/routes/mappers/benefit-application.state.mapper';

vi.mock('validator', () => ({
  default: { isEmpty: vi.fn().mockReturnValue(false) },
}));

vi.mock('~/.server/routes/helpers/public-application-route-helpers');

describe('DefaultBenefitApplicationStateMapper', () => {
  const mapper = new DefaultBenefitApplicationStateMapper();

  describe('mapApplicationAdultStateToBenefitApplicationDto', () => {
    beforeEach(() => {
      vi.mocked(getContextualAgeCategoryFromDate).mockReturnValue('adults');
    });

    it('maps adult application state to BenefitApplicationDto', () => {
      const state: ApplicationAdultState = {
        applicantInformation: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1980-01-01',
          socialInsuranceNumber: '800000002',
        },
        applicationYear: {
          applicationYearId: 'AY-2024',
          taxYear: '2024',
          dependentEligibilityEndDate: '2025-06-30',
        },
        communicationPreferences: {
          hasChanged: true,
          value: {
            preferredLanguage: 'en',
            preferredMethod: 'email',
            preferredNotificationMethod: 'digital',
          },
        },
        dentalBenefits: {
          hasChanged: true,
          value: { hasFederalBenefits: false, hasProvincialTerritorialBenefits: false },
        },
        dentalInsurance: { hasDentalInsurance: false },
        email: 'john.doe@example.com',
        emailVerified: true,
        homeAddress: {
          hasChanged: true,
          value: { address: '123 Home St', city: 'Ottawa', country: 'CA', postalCode: 'K1A 0A9', province: 'ON' },
        },
        isHomeAddressSameAsMailingAddress: false,
        mailingAddress: {
          hasChanged: true,
          value: { address: '456 Mail Ave', city: 'Toronto', country: 'CA', postalCode: 'M5V 2T6', province: 'ON' },
        },
        maritalStatus: 'single',
        phoneNumber: { hasChanged: true, value: { primary: '613-555-0100' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      expect(mapper.mapApplicationAdultStateToBenefitApplicationDto(state)).toEqual({
        applicantInformation: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1980-01-01',
          maritalStatus: 'single',
          socialInsuranceNumber: '800000002',
          clientNumber: undefined,
        },
        applicationYearId: 'AY-2024',
        children: [],
        communicationPreferences: {
          email: 'john.doe@example.com',
          emailVerified: true,
          preferredLanguage: 'en',
          preferredMethod: 'email',
          preferredMethodGovernmentOfCanada: 'digital',
        },
        contactInformation: {
          copyMailingAddress: false,
          homeAddress: '123 Home St',
          homeCity: 'Ottawa',
          homeCountry: 'CA',
          homePostalCode: 'K1A 0A9',
          homeProvince: 'ON',
          mailingAddress: '456 Mail Ave',
          mailingCity: 'Toronto',
          mailingCountry: 'CA',
          mailingPostalCode: 'M5V 2T6',
          mailingProvince: 'ON',
          phoneNumber: '613-555-0100',
          phoneNumberAlt: undefined,
        },
        dateOfBirth: '1980-01-01',
        maritalStatus: 'single',
        dentalBenefits: [],
        dentalInsurance: { hasDentalInsurance: false },
        livingIndependently: undefined,
        partnerInformation: undefined,
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
        typeOfApplication: 'adult',
        userId: 'anonymous',
      });
    });

    it('strips email and emailVerified when emailVerified is false', () => {
      const state: ApplicationAdultState = {
        applicantInformation: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1980-01-01',
          socialInsuranceNumber: '800000002',
        },
        applicationYear: {
          applicationYearId: 'AY-2024',
          taxYear: '2024',
          dependentEligibilityEndDate: '2025-06-30',
        },
        communicationPreferences: {
          hasChanged: true,
          value: { preferredLanguage: 'en', preferredMethod: 'email', preferredNotificationMethod: 'digital' },
        },
        dentalBenefits: {
          hasChanged: true,
          value: { hasFederalBenefits: false, hasProvincialTerritorialBenefits: false },
        },
        dentalInsurance: { hasDentalInsurance: false },
        email: 'john.doe@example.com',
        emailVerified: false,
        isHomeAddressSameAsMailingAddress: true,
        mailingAddress: {
          hasChanged: true,
          value: { address: '456 Mail Ave', city: 'Toronto', country: 'CA', postalCode: 'M5V 2T6', province: 'ON' },
        },
        maritalStatus: 'single',
        phoneNumber: { hasChanged: true, value: { primary: '613-555-0100' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.communicationPreferences).toEqual({
        email: undefined,
        emailVerified: undefined,
        preferredLanguage: 'en',
        preferredMethod: 'email',
        preferredMethodGovernmentOfCanada: 'digital',
      });
    });

    it('copies mailing address to home address when isHomeAddressSameAsMailingAddress is true', () => {
      const state: ApplicationAdultState = {
        applicantInformation: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1980-01-01',
          socialInsuranceNumber: '800000002',
        },
        applicationYear: {
          applicationYearId: 'AY-2024',
          taxYear: '2024',
          dependentEligibilityEndDate: '2025-06-30',
        },
        communicationPreferences: {
          hasChanged: true,
          value: { preferredLanguage: 'en', preferredMethod: 'mail', preferredNotificationMethod: 'mail' },
        },
        dentalBenefits: {
          hasChanged: true,
          value: { hasFederalBenefits: false, hasProvincialTerritorialBenefits: false },
        },
        dentalInsurance: { hasDentalInsurance: false },
        isHomeAddressSameAsMailingAddress: true,
        mailingAddress: {
          hasChanged: true,
          value: { address: '456 Mail Ave', city: 'Toronto', country: 'CA', postalCode: 'M5V 2T6', province: 'ON' },
        },
        maritalStatus: 'single',
        phoneNumber: { hasChanged: true, value: { primary: '613-555-0100' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.contactInformation).toMatchObject({
        copyMailingAddress: true,
        homeAddress: '456 Mail Ave',
        homeCity: 'Toronto',
        homeCountry: 'CA',
        homePostalCode: 'M5V 2T6',
        homeProvince: 'ON',
      });
    });

    it('includes program IDs when federal and provincial dental benefits are selected', () => {
      const state: ApplicationAdultState = {
        applicantInformation: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1980-01-01',
          socialInsuranceNumber: '800000002',
        },
        applicationYear: {
          applicationYearId: 'AY-2024',
          taxYear: '2024',
          dependentEligibilityEndDate: '2025-06-30',
        },
        communicationPreferences: {
          hasChanged: true,
          value: { preferredLanguage: 'en', preferredMethod: 'mail', preferredNotificationMethod: 'mail' },
        },
        dentalBenefits: {
          hasChanged: true,
          value: {
            hasFederalBenefits: true,
            federalSocialProgram: 'federal-program-001',
            hasProvincialTerritorialBenefits: true,
            provincialTerritorialSocialProgram: 'provincial-program-001',
          },
        },
        dentalInsurance: { hasDentalInsurance: false },
        isHomeAddressSameAsMailingAddress: true,
        mailingAddress: {
          hasChanged: true,
          value: { address: '456 Mail Ave', city: 'Toronto', country: 'CA', postalCode: 'M5V 2T6', province: 'ON' },
        },
        maritalStatus: 'single',
        phoneNumber: { hasChanged: true, value: { primary: '613-555-0100' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.dentalBenefits).toEqual(['federal-program-001', 'provincial-program-001']);
    });

    it('maps returning member ID to applicantInformation.clientNumber', () => {
      const state: ApplicationAdultState = {
        applicantInformation: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1980-01-01',
          socialInsuranceNumber: '800000002',
        },
        applicationYear: {
          applicationYearId: 'AY-2024',
          taxYear: '2024',
          dependentEligibilityEndDate: '2025-06-30',
        },
        communicationPreferences: {
          hasChanged: true,
          value: { preferredLanguage: 'en', preferredMethod: 'mail', preferredNotificationMethod: 'mail' },
        },
        dentalBenefits: {
          hasChanged: true,
          value: { hasFederalBenefits: false, hasProvincialTerritorialBenefits: false },
        },
        dentalInsurance: { hasDentalInsurance: false },
        isHomeAddressSameAsMailingAddress: true,
        mailingAddress: {
          hasChanged: true,
          value: { address: '456 Mail Ave', city: 'Toronto', country: 'CA', postalCode: 'M5V 2T6', province: 'ON' },
        },
        maritalStatus: 'single',
        newOrReturningMember: { isNewOrReturningMember: false, memberId: 'MBR-001' },
        phoneNumber: { hasChanged: true, value: { primary: '613-555-0100' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.applicantInformation.clientNumber).toBe('MBR-001');
    });

    it('passes livingIndependently for youth applicant', () => {
      vi.mocked(getContextualAgeCategoryFromDate).mockReturnValue('youth');

      const state: ApplicationAdultState = {
        applicantInformation: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '2009-01-01',
          socialInsuranceNumber: '800000002',
        },
        applicationYear: {
          applicationYearId: 'AY-2024',
          taxYear: '2024',
          dependentEligibilityEndDate: '2025-06-30',
        },
        communicationPreferences: {
          hasChanged: true,
          value: { preferredLanguage: 'en', preferredMethod: 'mail', preferredNotificationMethod: 'mail' },
        },
        dentalBenefits: {
          hasChanged: true,
          value: { hasFederalBenefits: false, hasProvincialTerritorialBenefits: false },
        },
        dentalInsurance: { hasDentalInsurance: false },
        isHomeAddressSameAsMailingAddress: true,
        livingIndependently: true,
        mailingAddress: {
          hasChanged: true,
          value: { address: '456 Mail Ave', city: 'Toronto', country: 'CA', postalCode: 'M5V 2T6', province: 'ON' },
        },
        maritalStatus: 'single',
        phoneNumber: { hasChanged: true, value: { primary: '613-555-0100' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.livingIndependently).toBe(true);
    });
  });

  describe('mapApplicationFamilyStateToBenefitApplicationDto', () => {
    beforeEach(() => {
      vi.mocked(getContextualAgeCategoryFromDate).mockReturnValue('adults');
    });

    it('maps family application state to BenefitApplicationDto', () => {
      const state: ApplicationFamilyState = {
        applicantInformation: {
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: '1975-03-15',
          socialInsuranceNumber: '800000003',
        },
        applicationYear: {
          applicationYearId: 'AY-2024',
          taxYear: '2024',
          dependentEligibilityEndDate: '2025-06-30',
        },
        children: [
          {
            id: 'child-1',
            information: {
              firstName: 'Tim',
              lastName: 'Smith',
              dateOfBirth: '2012-08-20',
              isParent: false,
              hasSocialInsuranceNumber: false,
            },
            dentalInsurance: { hasDentalInsurance: false },
            dentalBenefits: {
              hasChanged: true,
              value: { hasFederalBenefits: false, hasProvincialTerritorialBenefits: false },
            },
          },
        ],
        communicationPreferences: {
          hasChanged: true,
          value: {
            preferredLanguage: 'fr',
            preferredMethod: 'mail',
            preferredNotificationMethod: 'mail',
          },
        },
        dentalBenefits: {
          hasChanged: true,
          value: { hasFederalBenefits: false, hasProvincialTerritorialBenefits: false },
        },
        dentalInsurance: { hasDentalInsurance: true },
        homeAddress: {
          hasChanged: true,
          value: { address: '789 Family Rd', city: 'Montreal', country: 'CA', postalCode: 'H3A 1A1', province: 'QC' },
        },
        isHomeAddressSameAsMailingAddress: false,
        mailingAddress: {
          hasChanged: true,
          value: { address: '789 Family Rd', city: 'Montreal', country: 'CA', postalCode: 'H3A 1A1', province: 'QC' },
        },
        maritalStatus: 'married',
        phoneNumber: { hasChanged: true, value: { primary: '514-555-0200', alternate: '514-555-0201' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      expect(mapper.mapApplicationFamilyStateToBenefitApplicationDto(state)).toEqual({
        applicantInformation: {
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: '1975-03-15',
          maritalStatus: 'married',
          socialInsuranceNumber: '800000003',
          clientNumber: undefined,
        },
        applicationYearId: 'AY-2024',
        children: [
          {
            id: 'child-1',
            information: {
              firstName: 'Tim',
              lastName: 'Smith',
              dateOfBirth: '2012-08-20',
              isParent: false,
              socialInsuranceNumber: undefined,
            },
            dentalInsurance: { hasDentalInsurance: false },
            dentalBenefits: [],
          },
        ],
        communicationPreferences: {
          email: undefined,
          emailVerified: undefined,
          preferredLanguage: 'fr',
          preferredMethod: 'mail',
          preferredMethodGovernmentOfCanada: 'mail',
        },
        contactInformation: {
          copyMailingAddress: false,
          homeAddress: '789 Family Rd',
          homeCity: 'Montreal',
          homeCountry: 'CA',
          homePostalCode: 'H3A 1A1',
          homeProvince: 'QC',
          mailingAddress: '789 Family Rd',
          mailingCity: 'Montreal',
          mailingCountry: 'CA',
          mailingPostalCode: 'H3A 1A1',
          mailingProvince: 'QC',
          phoneNumber: '514-555-0200',
          phoneNumberAlt: '514-555-0201',
        },
        dateOfBirth: '1975-03-15',
        maritalStatus: 'married',
        dentalBenefits: [],
        dentalInsurance: { hasDentalInsurance: true },
        livingIndependently: undefined,
        partnerInformation: undefined,
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
        typeOfApplication: 'adult-child',
        userId: 'anonymous',
      });
    });
  });

  describe('mapApplicationChildrenStateToBenefitApplicationDto', () => {
    beforeEach(() => {
      vi.mocked(getContextualAgeCategoryFromDate).mockReturnValue('adults');
    });

    it('maps children-only application state to BenefitApplicationDto', () => {
      const state: ApplicationChildrenState = {
        applicantInformation: {
          firstName: 'Alice',
          lastName: 'Johnson',
          dateOfBirth: '1990-07-04',
          socialInsuranceNumber: '800000004',
        },
        applicationYear: {
          applicationYearId: 'AY-2024',
          taxYear: '2024',
          dependentEligibilityEndDate: '2025-06-30',
        },
        children: [
          {
            id: 'child-1',
            information: {
              firstName: 'Emma',
              lastName: 'Johnson',
              dateOfBirth: '2018-11-10',
              isParent: false,
              hasSocialInsuranceNumber: false,
            },
            dentalInsurance: { hasDentalInsurance: false },
            dentalBenefits: {
              hasChanged: true,
              value: { hasFederalBenefits: false, hasProvincialTerritorialBenefits: false },
            },
          },
        ],
        communicationPreferences: {
          hasChanged: true,
          value: {
            preferredLanguage: 'en',
            preferredMethod: 'email',
            preferredNotificationMethod: 'digital',
          },
        },
        email: 'alice.johnson@example.com',
        emailVerified: true,
        homeAddress: {
          hasChanged: true,
          value: { address: '321 Parent Lane', city: 'Vancouver', country: 'CA', postalCode: 'V6B 1A1', province: 'BC' },
        },
        isHomeAddressSameAsMailingAddress: false,
        mailingAddress: {
          hasChanged: true,
          value: { address: '321 Parent Lane', city: 'Vancouver', country: 'CA', postalCode: 'V6B 1A1', province: 'BC' },
        },
        maritalStatus: 'single',
        phoneNumber: { hasChanged: true, value: { primary: '604-555-0300' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      expect(mapper.mapApplicationChildrenStateToBenefitApplicationDto(state)).toEqual({
        applicantInformation: {
          firstName: 'Alice',
          lastName: 'Johnson',
          dateOfBirth: '1990-07-04',
          maritalStatus: 'single',
          socialInsuranceNumber: '800000004',
          clientNumber: undefined,
        },
        applicationYearId: 'AY-2024',
        children: [
          {
            id: 'child-1',
            information: {
              firstName: 'Emma',
              lastName: 'Johnson',
              dateOfBirth: '2018-11-10',
              isParent: false,
              socialInsuranceNumber: undefined,
            },
            dentalInsurance: { hasDentalInsurance: false },
            dentalBenefits: [],
          },
        ],
        communicationPreferences: {
          email: 'alice.johnson@example.com',
          emailVerified: true,
          preferredLanguage: 'en',
          preferredMethod: 'email',
          preferredMethodGovernmentOfCanada: 'digital',
        },
        contactInformation: {
          copyMailingAddress: false,
          homeAddress: '321 Parent Lane',
          homeCity: 'Vancouver',
          homeCountry: 'CA',
          homePostalCode: 'V6B 1A1',
          homeProvince: 'BC',
          mailingAddress: '321 Parent Lane',
          mailingCity: 'Vancouver',
          mailingCountry: 'CA',
          mailingPostalCode: 'V6B 1A1',
          mailingProvince: 'BC',
          phoneNumber: '604-555-0300',
          phoneNumberAlt: undefined,
        },
        dateOfBirth: '1990-07-04',
        maritalStatus: 'single',
        dentalBenefits: [],
        dentalInsurance: undefined,
        livingIndependently: undefined,
        partnerInformation: undefined,
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
        typeOfApplication: 'child',
        userId: 'anonymous',
      });
    });

    it('maps child socialInsuranceNumber when hasSocialInsuranceNumber is true', () => {
      const state: ApplicationChildrenState = {
        applicantInformation: {
          firstName: 'Alice',
          lastName: 'Johnson',
          dateOfBirth: '1990-07-04',
          socialInsuranceNumber: '800000004',
        },
        applicationYear: {
          applicationYearId: 'AY-2024',
          taxYear: '2024',
          dependentEligibilityEndDate: '2025-06-30',
        },
        children: [
          {
            id: 'child-1',
            information: {
              firstName: 'Emma',
              lastName: 'Johnson',
              dateOfBirth: '2018-11-10',
              isParent: false,
              hasSocialInsuranceNumber: true,
              socialInsuranceNumber: '800000009',
            },
            dentalInsurance: { hasDentalInsurance: false },
            dentalBenefits: {
              hasChanged: true,
              value: { hasFederalBenefits: false, hasProvincialTerritorialBenefits: false },
            },
          },
        ],
        communicationPreferences: {
          hasChanged: true,
          value: { preferredLanguage: 'en', preferredMethod: 'mail', preferredNotificationMethod: 'mail' },
        },
        isHomeAddressSameAsMailingAddress: true,
        mailingAddress: {
          hasChanged: true,
          value: { address: '321 Parent Lane', city: 'Vancouver', country: 'CA', postalCode: 'V6B 1A1', province: 'BC' },
        },
        maritalStatus: 'single',
        phoneNumber: { hasChanged: true, value: { primary: '604-555-0300' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      const result = mapper.mapApplicationChildrenStateToBenefitApplicationDto(state);
      expect(result.children[0]?.information.socialInsuranceNumber).toBe('800000009');
    });
  });
});
