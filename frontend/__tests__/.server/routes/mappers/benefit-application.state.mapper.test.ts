import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkValidAndVerifiedEmailAddress, isEmailAddressRequired } from '~/.server/routes/helpers/base-application-route-helpers';
import { getContextualAgeCategoryFromDate } from '~/.server/routes/helpers/public-application-route-helpers';
import { DefaultBenefitApplicationStateMapper } from '~/.server/routes/mappers/benefit-application.state.mapper';
import type { ApplicationAdultState, ApplicationChildrenState, ApplicationFamilyState } from '~/.server/routes/mappers/benefit-application.state.mapper';

vi.mock('validator', () => ({
  default: { isEmpty: vi.fn().mockReturnValue(false) },
}));

vi.mock('~/.server/routes/helpers/base-application-route-helpers');
vi.mock('~/.server/routes/helpers/public-application-route-helpers');

// ============================================================================
// Test Data Constants
// ============================================================================

const TEST_ADDRESSES = {
  OTTAWA: { address: '123 Home St', city: 'Ottawa', country: 'CA', postalCode: 'K1A 0A9', province: 'ON' },
  TORONTO: { address: '456 Mail Ave', city: 'Toronto', country: 'CA', postalCode: 'M5V 2T6', province: 'ON' },
  VANCOUVER: { address: '321 Parent Lane', city: 'Vancouver', country: 'CA', postalCode: 'V6B 1A1', province: 'BC' },
  CALGARY: { address: '789 Family Rd', city: 'Calgary', country: 'CA', postalCode: 'T2P 1H9', province: 'AB' },
  HALIFAX: { address: '555 Family', city: 'City', country: 'CA', postalCode: 'F5F 5F5', province: 'PE' },
  PROTECTED: { address: '777 Protected', city: 'Protected City', country: 'CA', postalCode: 'P7P 7P7', province: 'NB' },
} as const;

const TEST_PHONE = {
  PRIMARY_OTTAWA: '613-555-0100',
  PRIMARY_VANCOUVER: '604-555-0000',
  PRIMARY_CALGARY: '403-555-0000',
  PRIMARY_HALIFAX: '902-555-5555',
  PRIMARY_PROTECTED: '506-555-7777',
  ALTERNATE: '780-555-0000',
} as const;

const TEST_APPLICANTS = {
  JOHN_DOE: { firstName: 'John', lastName: 'Doe', dateOfBirth: '1980-01-01', socialInsuranceNumber: '800000002' },
  ALICE_JOHNSON: { firstName: 'Alice', lastName: 'Johnson', dateOfBirth: '1990-07-04', socialInsuranceNumber: '800000004' },
  BOB_SMITH: { firstName: 'Bob', lastName: 'Smith', dateOfBirth: '1975-12-15', socialInsuranceNumber: '800000005' },
  YOUTH: { firstName: 'John', lastName: 'Doe', dateOfBirth: '2009-01-01', socialInsuranceNumber: '800000002' },
  PROTECTED_FAMILY: { firstName: 'Protected', lastName: 'Family', dateOfBirth: '1980-06-15', socialInsuranceNumber: '800000018' },
} as const;

const TEST_APPLICATION_YEAR = { applicationYearId: 'AY-2024', taxYear: '2024', dependentEligibilityEndDate: '2025-06-30' } as const;

const TEST_COMMUNICATION_PREFS = {
  EMAIL: { preferredLanguage: 'en', preferredMethod: 'email', preferredNotificationMethod: 'digital' },
  MAIL: { preferredLanguage: 'en', preferredMethod: 'mail', preferredNotificationMethod: 'mail' },
} as const;

const TEST_DENTAL_BENEFITS = {
  NO_BENEFITS: { hasFederalBenefits: false, hasProvincialTerritorialBenefits: false },
  FEDERAL_ONLY: (program: string) => ({ hasFederalBenefits: true, federalSocialProgram: program, hasProvincialTerritorialBenefits: false }),
  PROVINCIAL_ONLY: (program: string) => ({ hasProvincialTerritorialBenefits: true, provincialTerritorialSocialProgram: program, hasFederalBenefits: false }),
} as const;

// ============================================================================
// Test Data Factories
// ============================================================================

/** Create a complete adult application state with sensible defaults */
const createAdultApplicationState = (overrides: Partial<ApplicationAdultState> = {}): ApplicationAdultState => ({
  channelCode: 'public',
  applicantInformation: TEST_APPLICANTS.JOHN_DOE,
  applicationYear: TEST_APPLICATION_YEAR,
  communicationPreferences: { hasChanged: true, value: TEST_COMMUNICATION_PREFS.EMAIL },
  dentalBenefits: { hasChanged: true, value: TEST_DENTAL_BENEFITS.NO_BENEFITS },
  dentalInsurance: { hasDentalInsurance: false },
  email: 'john.doe@example.com',
  emailVerified: true,
  homeAddress: { hasChanged: true, value: TEST_ADDRESSES.OTTAWA },
  isHomeAddressSameAsMailingAddress: false,
  mailingAddress: { hasChanged: true, value: TEST_ADDRESSES.TORONTO },
  maritalStatus: 'single',
  phoneNumber: { hasChanged: true, value: { primary: TEST_PHONE.PRIMARY_OTTAWA } },
  termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
  ...overrides,
});

/** Create a complete family application state with sensible defaults */
const createFamilyApplicationState = (overrides: Partial<ApplicationFamilyState> = {}): ApplicationFamilyState => ({
  channelCode: 'public',
  applicantInformation: TEST_APPLICANTS.BOB_SMITH,
  applicationYear: TEST_APPLICATION_YEAR,
  communicationPreferences: { hasChanged: true, value: TEST_COMMUNICATION_PREFS.EMAIL },
  dentalBenefits: { hasChanged: true, value: TEST_DENTAL_BENEFITS.NO_BENEFITS },
  dentalInsurance: { hasDentalInsurance: false },
  email: 'bob.smith@example.com',
  emailVerified: true,
  homeAddress: { hasChanged: true, value: TEST_ADDRESSES.CALGARY },
  isHomeAddressSameAsMailingAddress: false,
  mailingAddress: { hasChanged: true, value: TEST_ADDRESSES.CALGARY },
  maritalStatus: 'married',
  phoneNumber: { hasChanged: true, value: { primary: TEST_PHONE.PRIMARY_CALGARY } },
  termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
  children: [],
  ...overrides,
});

/** Create a complete children-only application state with sensible defaults */
const createChildrenApplicationState = (overrides: Partial<ApplicationChildrenState> = {}): ApplicationChildrenState => ({
  channelCode: 'public',
  applicantInformation: TEST_APPLICANTS.ALICE_JOHNSON,
  applicationYear: TEST_APPLICATION_YEAR,
  communicationPreferences: { hasChanged: true, value: TEST_COMMUNICATION_PREFS.EMAIL },
  email: 'alice.johnson@example.com',
  emailVerified: true,
  homeAddress: { hasChanged: true, value: TEST_ADDRESSES.VANCOUVER },
  isHomeAddressSameAsMailingAddress: false,
  mailingAddress: { hasChanged: true, value: TEST_ADDRESSES.VANCOUVER },
  livingIndependently: true,
  maritalStatus: 'single',
  phoneNumber: { hasChanged: true, value: { primary: TEST_PHONE.PRIMARY_VANCOUVER } },
  termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
  children: [],
  ...overrides,
});

/** Create a complete child object with sensible defaults */
const createChild = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  information: { firstName: 'Child', lastName: 'Person', dateOfBirth: '2018-01-01', isParent: false, hasSocialInsuranceNumber: false },
  dentalInsurance: { hasDentalInsurance: false },
  dentalBenefits: { hasChanged: true as const, value: TEST_DENTAL_BENEFITS.NO_BENEFITS },
  ...overrides,
});

// ============================================================================
// Reusable Child Configurations
// ============================================================================

const CHILD_BASIC = createChild('child-1');

const CHILD_YOUTH_WITH_CONTEXT = createChild('child-1', {
  information: { firstName: 'Kid', lastName: 'Youth', dateOfBirth: '2018-01-01', isParent: false, hasSocialInsuranceNumber: false },
});

// ============================================================================
// Mock Helpers
// ============================================================================

/** Reset and configure mocks for a new test */
const setupMocks = (config: { ageCategory?: 'adults' | 'youth' | 'children'; emailRequired?: boolean; emailValid?: boolean; email?: string } = {}) => {
  const { ageCategory = 'adults', emailRequired = true, emailValid = true, email = 'test@example.com' } = config;
  vi.mocked(getContextualAgeCategoryFromDate).mockReturnValue(ageCategory);
  vi.mocked(isEmailAddressRequired).mockReturnValue(emailRequired);
  if (emailValid) {
    vi.mocked(checkValidAndVerifiedEmailAddress).mockReturnValue({ success: true, email, emailVerified: true });
  } else {
    vi.mocked(checkValidAndVerifiedEmailAddress).mockReturnValue({ success: false, email: undefined, emailVerified: undefined });
  }
};

describe('DefaultBenefitApplicationStateMapper', () => {
  const mapper = new DefaultBenefitApplicationStateMapper();

  describe('mapApplicationAdultStateToBenefitApplicationDto', () => {
    beforeEach(() => {
      setupMocks({ ageCategory: 'adults' });
    });

    it('maps adult application state to BenefitApplicationDto', () => {
      const state = createAdultApplicationState();
      setupMocks({ emailRequired: true, emailValid: true, email: 'john.doe@example.com' });

      expect(mapper.mapApplicationAdultStateToBenefitApplicationDto(state)).toStrictEqual({
        applicationChannelCode: 'public',
        applicantInformation: {
          firstName: 'John',
          lastName: 'Doe',
          maritalStatus: 'single',
          socialInsuranceNumber: '800000002',
          clientNumber: undefined,
        },
        applicationYearId: 'AY-2024',
        children: [],
        communicationPreferences: {
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
        emailAddress: { value: 'john.doe@example.com', verified: true },
        dentalBenefits: [],
        dentalInsurance: { hasDentalInsurance: false },
        livingIndependently: undefined,
        partnerInformation: undefined,
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
        typeOfApplication: 'adult',
        userId: 'anonymous',
      });
    });

    it('copies mailing address to home address when isHomeAddressSameAsMailingAddress is true', () => {
      const state = createAdultApplicationState({
        isHomeAddressSameAsMailingAddress: true,
        communicationPreferences: { hasChanged: true, value: TEST_COMMUNICATION_PREFS.MAIL },
        mailingAddress: { hasChanged: true, value: TEST_ADDRESSES.TORONTO },
      });
      setupMocks({ emailRequired: false });

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
      const state = createAdultApplicationState({
        communicationPreferences: { hasChanged: true, value: TEST_COMMUNICATION_PREFS.MAIL },
        dentalBenefits: {
          hasChanged: true,
          value: {
            hasFederalBenefits: true,
            federalSocialProgram: 'federal-program-001',
            hasProvincialTerritorialBenefits: true,
            provincialTerritorialSocialProgram: 'provincial-program-001',
          },
        },
        isHomeAddressSameAsMailingAddress: true,
      });
      setupMocks({ emailRequired: false });

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.dentalBenefits).toStrictEqual(['federal-program-001', 'provincial-program-001']);
    });

    it('maps returning member ID to applicantInformation.clientNumber', () => {
      const state: ApplicationAdultState = {
        channelCode: 'public',
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
      const state = createAdultApplicationState({
        applicantInformation: TEST_APPLICANTS.YOUTH,
        livingIndependently: true,
        communicationPreferences: { hasChanged: true, value: TEST_COMMUNICATION_PREFS.MAIL },
        isHomeAddressSameAsMailingAddress: true,
      });
      setupMocks({ ageCategory: 'youth', emailRequired: false });

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.livingIndependently).toBe(true);
    });
  });

  describe('mapApplicationFamilyStateToBenefitApplicationDto', () => {
    beforeEach(() => {
      setupMocks({ ageCategory: 'adults' });
    });

    it('maps family application state to BenefitApplicationDto', () => {
      const state = createFamilyApplicationState({
        applicantInformation: { firstName: 'Jane', lastName: 'Smith', dateOfBirth: '1975-03-15', socialInsuranceNumber: '800000003' },
        email: 'jane.smith@example.com',
        children: [
          createChild('child-1', {
            information: {
              firstName: 'Tim',
              lastName: 'Smith',
              dateOfBirth: '2012-08-20',
              isParent: false,
              hasSocialInsuranceNumber: false,
            },
          }),
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
      });
      setupMocks({ emailRequired: false });

      expect(mapper.mapApplicationFamilyStateToBenefitApplicationDto(state)).toStrictEqual({
        applicationChannelCode: 'public',
        applicantInformation: {
          firstName: 'Jane',
          lastName: 'Smith',
          maritalStatus: 'married',
          socialInsuranceNumber: '800000003',
          clientNumber: undefined,
        },
        applicationYearId: 'AY-2024',
        children: [
          {
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
        emailAddress: { value: undefined, verified: undefined },
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
      setupMocks({ ageCategory: 'adults' });
    });

    it('maps children-only application state to BenefitApplicationDto', () => {
      const state = createChildrenApplicationState({
        applicantInformation: TEST_APPLICANTS.ALICE_JOHNSON,
        livingIndependently: undefined,
        children: [
          createChild('child-1', {
            information: {
              firstName: 'Emma',
              lastName: 'Johnson',
              dateOfBirth: '2018-11-10',
              isParent: false,
              hasSocialInsuranceNumber: false,
            },
          }),
        ],
        email: 'alice.johnson@example.com',
        homeAddress: { hasChanged: true, value: { address: '321 Parent Lane', city: 'Vancouver', country: 'CA', postalCode: 'V6B 1A1', province: 'BC' } },
        mailingAddress: { hasChanged: true, value: { address: '321 Parent Lane', city: 'Vancouver', country: 'CA', postalCode: 'V6B 1A1', province: 'BC' } },
        phoneNumber: { hasChanged: true, value: { primary: '604-555-0300' } },
      });
      setupMocks({ emailRequired: true, emailValid: true, email: 'alice.johnson@example.com' });

      expect(mapper.mapApplicationChildrenStateToBenefitApplicationDto(state)).toStrictEqual({
        applicationChannelCode: 'public',
        applicantInformation: {
          firstName: 'Alice',
          lastName: 'Johnson',
          maritalStatus: 'single',
          socialInsuranceNumber: '800000004',
          clientNumber: undefined,
        },
        applicationYearId: 'AY-2024',
        children: [
          {
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
        emailAddress: { value: 'alice.johnson@example.com', verified: true },
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
        channelCode: 'public',
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
      expect(result.children.at(0)?.information.socialInsuranceNumber).toBe('800000009');
    });

    it('throws when youth applicant missing livingIndependently', () => {
      vi.mocked(getContextualAgeCategoryFromDate).mockReturnValueOnce('youth');
      const state: ApplicationChildrenState = {
        channelCode: 'public',
        applicantInformation: {
          firstName: 'Youth',
          lastName: 'Person',
          dateOfBirth: '2015-01-01',
          socialInsuranceNumber: '800000010',
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
              firstName: 'Child',
              lastName: 'Person',
              dateOfBirth: '2018-01-01',
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
          value: { preferredLanguage: 'en', preferredMethod: 'email', preferredNotificationMethod: 'digital' },
        },
        isHomeAddressSameAsMailingAddress: true,
        mailingAddress: {
          hasChanged: true,
          value: { address: '123 St', city: 'City', country: 'CA', postalCode: 'X1A 1A1', province: 'ON' },
        },
        maritalStatus: 'single',
        phoneNumber: { hasChanged: true, value: { primary: '613-555-0000' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
        // livingIndependently undefined for youth
      };

      expect(() => mapper.mapApplicationChildrenStateToBenefitApplicationDto(state)).toThrow('Expected livingIndependently to be defined');
    });

    it('maps multiple children with dentalBenefits and dentalInsurance', () => {
      const state: ApplicationChildrenState = {
        channelCode: 'public',
        applicantInformation: {
          firstName: 'Parent',
          lastName: 'Name',
          dateOfBirth: '1985-01-01',
          socialInsuranceNumber: '800000005',
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
              firstName: 'Child1',
              lastName: 'Name',
              dateOfBirth: '2015-01-01',
              isParent: false,
              hasSocialInsuranceNumber: false,
            },
            dentalInsurance: { hasDentalInsurance: true, dentalInsuranceEligibilityConfirmation: true },
            dentalBenefits: {
              hasChanged: true,
              value: { hasFederalBenefits: true, federalSocialProgram: 'fed-program', hasProvincialTerritorialBenefits: false },
            },
          },
          {
            id: 'child-2',
            information: {
              firstName: 'Child2',
              lastName: 'Name',
              dateOfBirth: '2017-06-15',
              isParent: false,
              hasSocialInsuranceNumber: false,
            },
            dentalInsurance: { hasDentalInsurance: false },
            dentalBenefits: {
              hasChanged: true,
              value: { hasFederalBenefits: false, hasProvincialTerritorialBenefits: true, provincialTerritorialSocialProgram: 'prov-program' },
            },
          },
        ],
        communicationPreferences: {
          hasChanged: true,
          value: { preferredLanguage: 'en', preferredMethod: 'mail', preferredNotificationMethod: 'mail' },
        },
        isHomeAddressSameAsMailingAddress: false,
        homeAddress: {
          hasChanged: true,
          value: { address: '123 Home', city: 'Ottawa', country: 'CA', postalCode: 'K1A 0B1', province: 'ON' },
        },
        mailingAddress: {
          hasChanged: true,
          value: { address: '456 Mail', city: 'Toronto', country: 'CA', postalCode: 'M5H 2N2', province: 'ON' },
        },
        maritalStatus: 'married',
        phoneNumber: { hasChanged: true, value: { primary: '613-555-0001', alternate: '613-555-0002' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      vi.mocked(isEmailAddressRequired).mockReturnValueOnce(false);

      const result = mapper.mapApplicationChildrenStateToBenefitApplicationDto(state);
      expect(result.children).toHaveLength(2);
      expect(result.children.at(0)).toMatchObject({
        dentalBenefits: ['fed-program'],
        dentalInsurance: { hasDentalInsurance: true, dentalInsuranceEligibilityConfirmation: true },
        information: {
          firstName: 'Child1',
          lastName: 'Name',
          dateOfBirth: '2015-01-01',
          isParent: false,
        },
      });
      expect(result.children.at(1)).toMatchObject({
        dentalBenefits: ['prov-program'],
        dentalInsurance: { hasDentalInsurance: false },
        information: {
          firstName: 'Child2',
          lastName: 'Name',
          dateOfBirth: '2017-06-15',
          isParent: false,
        },
      });
      expect(result.contactInformation.phoneNumberAlt).toBe('613-555-0002');
    });
  });

  describe('protected channel email validation', () => {
    beforeEach(() => {
      vi.mocked(getContextualAgeCategoryFromDate).mockReturnValue('adults');
    });

    it('maps adult with protected channel and valid email', () => {
      const state: ApplicationAdultState = {
        channelCode: 'protected',
        applicantInformation: {
          firstName: 'Protected',
          lastName: 'User',
          dateOfBirth: '1990-01-01',
          socialInsuranceNumber: '800000006',
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
        email: 'protected@example.com',
        emailVerified: true,
        isHomeAddressSameAsMailingAddress: true,
        mailingAddress: {
          hasChanged: true,
          value: { address: '789 Protected', city: 'City', country: 'CA', postalCode: 'X1X 1X1', province: 'AB' },
        },
        maritalStatus: 'single',
        phoneNumber: { hasChanged: true, value: { primary: '403-555-0000' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      vi.mocked(checkValidAndVerifiedEmailAddress).mockReturnValueOnce({ success: true, email: 'protected@example.com', emailVerified: true });

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.applicationChannelCode).toBe('protected');
      expect(result.emailAddress).toStrictEqual({ value: 'protected@example.com', verified: true });
    });

    it('throws when protected channel email invalid', () => {
      const state: ApplicationAdultState = {
        channelCode: 'protected',
        applicantInformation: {
          firstName: 'Bad',
          lastName: 'Email',
          dateOfBirth: '1990-01-01',
          socialInsuranceNumber: '800000007',
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
        email: '',
        emailVerified: false,
        isHomeAddressSameAsMailingAddress: true,
        mailingAddress: {
          hasChanged: true,
          value: { address: '789 Protected', city: 'City', country: 'CA', postalCode: 'X1X 1X1', province: 'AB' },
        },
        maritalStatus: 'single',
        phoneNumber: { hasChanged: true, value: { primary: '403-555-0000' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      vi.mocked(checkValidAndVerifiedEmailAddress).mockReturnValueOnce({ success: false, email: undefined, emailVerified: undefined });

      expect(() => mapper.mapApplicationAdultStateToBenefitApplicationDto(state)).toThrow('Expected a valid and verified email for protected application channel');
    });
  });

  describe('public channel email conditional requirement', () => {
    beforeEach(() => {
      vi.mocked(getContextualAgeCategoryFromDate).mockReturnValue('adults');
    });

    it('returns undefined email when public channel email not required', () => {
      const state: ApplicationAdultState = {
        channelCode: 'public',
        applicantInformation: {
          firstName: 'NoEmail',
          lastName: 'User',
          dateOfBirth: '1990-01-01',
          socialInsuranceNumber: '800000008',
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
          value: { address: '999 NoEmail St', city: 'NoCity', country: 'CA', postalCode: 'Z9Z 9Z9', province: 'SK' },
        },
        maritalStatus: 'single',
        phoneNumber: { hasChanged: true, value: { primary: '306-555-0000' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      vi.mocked(isEmailAddressRequired).mockReturnValueOnce(false);

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.emailAddress).toStrictEqual({ value: undefined, verified: undefined });
    });

    it('throws when public channel email required but invalid', () => {
      const state: ApplicationAdultState = {
        channelCode: 'public',
        applicantInformation: {
          firstName: 'BadEmail',
          lastName: 'User',
          dateOfBirth: '1990-01-01',
          socialInsuranceNumber: '800000009',
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
        email: 'invalid',
        emailVerified: false,
        isHomeAddressSameAsMailingAddress: true,
        mailingAddress: {
          hasChanged: true,
          value: { address: '999 Email St', city: 'City', country: 'CA', postalCode: 'Z9Z 9Z9', province: 'MB' },
        },
        maritalStatus: 'single',
        phoneNumber: { hasChanged: true, value: { primary: '204-555-0000' } },
        termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
      };

      vi.mocked(isEmailAddressRequired).mockReturnValueOnce(true);
      vi.mocked(checkValidAndVerifiedEmailAddress).mockReturnValueOnce({ success: false, email: undefined, emailVerified: undefined });

      expect(() => mapper.mapApplicationAdultStateToBenefitApplicationDto(state)).toThrow('Expected a valid and verified email for public application channel when at least one communication method requires email');
    });
  });

  describe('dental benefits selection', () => {
    beforeEach(() => {
      setupMocks({ ageCategory: 'adults', emailRequired: false });
    });

    it('includes only federal benefits when selected', () => {
      const state = createAdultApplicationState({
        communicationPreferences: { hasChanged: true, value: TEST_COMMUNICATION_PREFS.MAIL },
        dentalBenefits: {
          hasChanged: true,
          value: TEST_DENTAL_BENEFITS.FEDERAL_ONLY('federal-only-program'),
        },
        isHomeAddressSameAsMailingAddress: true,
      });

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.dentalBenefits).toStrictEqual(['federal-only-program']);
    });

    it('includes only provincial benefits when selected', () => {
      const state = createAdultApplicationState({
        communicationPreferences: { hasChanged: true, value: TEST_COMMUNICATION_PREFS.MAIL },
        dentalBenefits: {
          hasChanged: true,
          value: TEST_DENTAL_BENEFITS.PROVINCIAL_ONLY('provincial-only-program'),
        },
        isHomeAddressSameAsMailingAddress: true,
      });

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.dentalBenefits).toStrictEqual(['provincial-only-program']);
    });

    it('skips empty string dental benefit programs', () => {
      const state = createAdultApplicationState({
        communicationPreferences: { hasChanged: true, value: TEST_COMMUNICATION_PREFS.MAIL },
        dentalBenefits: {
          hasChanged: true,
          value: {
            hasFederalBenefits: true,
            federalSocialProgram: '',
            hasProvincialTerritorialBenefits: true,
            provincialTerritorialSocialProgram: '',
          },
        },
        isHomeAddressSameAsMailingAddress: true,
      });

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.dentalBenefits).toStrictEqual([]);
    });

    it('maps adult with public channel when email not required by communication preferences', () => {
      const state = createAdultApplicationState({
        channelCode: 'public',
        communicationPreferences: { hasChanged: true, value: TEST_COMMUNICATION_PREFS.MAIL },
        email: undefined,
        emailVerified: undefined,
      });
      setupMocks({ emailRequired: false, emailValid: false });

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.applicationChannelCode).toBe('public');
      expect(result.emailAddress).toStrictEqual({ value: undefined, verified: undefined });
    });
  });

  describe('error scenarios - missing required fields', () => {
    beforeEach(() => {
      setupMocks({ ageCategory: 'adults' });
    });

    it('throws when adult application missing dentalBenefits', () => {
      // Create state without dentalBenefits by explicitly typing as Partial to allow undefined
      const state = createAdultApplicationState({
        dentalBenefits: undefined as unknown as typeof undefined,
      });

      expect(() => mapper.mapApplicationAdultStateToBenefitApplicationDto(state)).toThrow('Expected dentalBenefits to be defined for an adult application');
    });

    it('throws when family application missing dentalBenefits', () => {
      const state = createFamilyApplicationState({
        children: [CHILD_BASIC],
        dentalBenefits: undefined as unknown as typeof undefined,
      });

      expect(() => mapper.mapApplicationFamilyStateToBenefitApplicationDto(state)).toThrow('Expected dentalBenefits to be defined for a family application');
    });
  });

  describe('family application scenarios', () => {
    beforeEach(() => {
      setupMocks({ ageCategory: 'adults', emailRequired: false });
    });

    it('maps family application with partner information and multiple children', () => {
      const state = createFamilyApplicationState({
        applicantInformation: { ...TEST_APPLICANTS.JOHN_DOE, socialInsuranceNumber: '800000016' },
        partnerInformation: {
          consentToSharePersonalInformation: true,
          yearOfBirth: '1987',
          socialInsuranceNumber: '800000017',
        },
        phoneNumber: { hasChanged: true, value: { primary: '902-555-6666', alternate: '902-555-6667' } },
        children: [
          createChild('child-1', {
            information: {
              firstName: 'Sarah',
              lastName: 'Smith',
              dateOfBirth: '2015-03-20',
              isParent: false,
              hasSocialInsuranceNumber: false,
            },
          }),
        ],
      });

      const result = mapper.mapApplicationFamilyStateToBenefitApplicationDto(state);
      expect(result.typeOfApplication).toBe('adult-child');
      expect(result.partnerInformation).toStrictEqual({
        consentToSharePersonalInformation: true,
        yearOfBirth: '1987',
        socialInsuranceNumber: '800000017',
      });
      expect(result.contactInformation.phoneNumberAlt).toBe('902-555-6667');
    });

    it('maps family application with protected channel and dental benefits', () => {
      const state = createFamilyApplicationState({
        channelCode: 'protected',
        applicantInformation: TEST_APPLICANTS.PROTECTED_FAMILY,
        email: 'protected.family@example.com',
        emailVerified: true,
        dentalBenefits: {
          hasChanged: true,
          value: TEST_DENTAL_BENEFITS.FEDERAL_ONLY('parent-fed-program'),
        },
        children: [
          createChild('child-1', {
            information: {
              firstName: 'Kid',
              lastName: 'Family',
              dateOfBirth: '2016-07-20',
              isParent: false,
              hasSocialInsuranceNumber: false,
            },
            dentalBenefits: {
              hasChanged: true,
              value: TEST_DENTAL_BENEFITS.FEDERAL_ONLY('kid-fed-program'),
            },
          }),
        ],
      });
      setupMocks({ emailValid: true, email: 'protected.family@example.com' });

      const result = mapper.mapApplicationFamilyStateToBenefitApplicationDto(state);
      expect(result.applicationChannelCode).toBe('protected');
      expect(result.emailAddress).toStrictEqual({ value: 'protected.family@example.com', verified: true });
      expect(result.dentalBenefits).toStrictEqual(['parent-fed-program']);
      expect(result.children.at(0)?.dentalBenefits).toStrictEqual(['kid-fed-program']);
    });
  });

  describe('youth age category validation', () => {
    // Youth applicants (under 18, but meeting age of majority requirements independently)
    // must explicitly declare their living arrangement (livingIndependently: true/false)

    it('throws for youth adult applicant without livingIndependently defined', () => {
      const state = createAdultApplicationState({
        applicantInformation: TEST_APPLICANTS.YOUTH,
        livingIndependently: undefined,
      });
      setupMocks({ ageCategory: 'youth' });

      expect(() => mapper.mapApplicationAdultStateToBenefitApplicationDto(state)).toThrow('Expected livingIndependently to be defined');
    });

    it('maps adult application for youth applicant with livingIndependently defined', () => {
      const state = createAdultApplicationState({
        applicantInformation: TEST_APPLICANTS.YOUTH,
        livingIndependently: true,
      });
      setupMocks({ ageCategory: 'youth' });

      const result = mapper.mapApplicationAdultStateToBenefitApplicationDto(state);
      expect(result.livingIndependently).toBe(true);
      expect(result.typeOfApplication).toBe('adult');
    });

    it('throws for youth family applicant without livingIndependently defined', () => {
      const state = createFamilyApplicationState({
        applicantInformation: { ...TEST_APPLICANTS.YOUTH, socialInsuranceNumber: '800000026' },
        livingIndependently: undefined,
        children: [CHILD_YOUTH_WITH_CONTEXT],
        dentalBenefits: { hasChanged: true, value: TEST_DENTAL_BENEFITS.NO_BENEFITS },
      });
      setupMocks({ ageCategory: 'youth' });

      expect(() => mapper.mapApplicationFamilyStateToBenefitApplicationDto(state)).toThrow('Expected livingIndependently to be defined');
    });

    it('maps family application for youth applicant with livingIndependently defined', () => {
      const state = createFamilyApplicationState({
        applicantInformation: { ...TEST_APPLICANTS.YOUTH, socialInsuranceNumber: '800000025' },
        livingIndependently: true,
        children: [CHILD_YOUTH_WITH_CONTEXT],
        dentalBenefits: { hasChanged: true, value: TEST_DENTAL_BENEFITS.NO_BENEFITS },
      });
      setupMocks({ ageCategory: 'youth', emailRequired: false });

      const result = mapper.mapApplicationFamilyStateToBenefitApplicationDto(state);
      expect(result.livingIndependently).toBe(true);
      expect(result.typeOfApplication).toBe('adult-child');
    });

    it('throws for youth children applicant without livingIndependently defined', () => {
      const state = createChildrenApplicationState({
        applicantInformation: { ...TEST_APPLICANTS.YOUTH, socialInsuranceNumber: '800000028' },
        livingIndependently: undefined,
        children: [CHILD_YOUTH_WITH_CONTEXT],
      });
      setupMocks({ ageCategory: 'youth' });

      expect(() => mapper.mapApplicationChildrenStateToBenefitApplicationDto(state)).toThrow('Expected livingIndependently to be defined');
    });

    it('maps children application for youth applicant with livingIndependently defined as false', () => {
      const state = createChildrenApplicationState({
        applicantInformation: { ...TEST_APPLICANTS.YOUTH, socialInsuranceNumber: '800000027' },
        livingIndependently: false,
        children: [CHILD_YOUTH_WITH_CONTEXT],
      });
      setupMocks({ ageCategory: 'youth', emailRequired: false });

      const result = mapper.mapApplicationChildrenStateToBenefitApplicationDto(state);
      expect(result.livingIndependently).toBe(false);
      expect(result.typeOfApplication).toBe('child');
    });
  });
});
