import { describe, expect, it } from 'vitest';

import { DefaultBenefitRenewalStateMapper } from '~/.server/routes/mappers/benefit-renewal-state-mapper';
import type { BenefitRenewalAdultState, BenefitRenewalChildState, BenefitRenewalFamilyState } from '~/.server/routes/mappers/benefit-renewal-state-mapper';

const applicantInformation = { firstName: 'Test', lastName: 'Applicant', dateOfBirth: '1980-01-01', socialInsuranceNumber: '800000002' };
const childInformation = { firstName: 'Test', lastName: 'Child', dateOfBirth: '2018-01-01', isParent: false };
const state = {
  id: 'c48267e0-f11c-4624-bba2-3501b2c33aa1',
  channelCode: 'public',
  applicantInformation,
  applicationYear: { applicationYearId: 'year', taxYear: '2024', dependentEligibilityEndDate: '2025-06-30' },
  clientApplication: {
    applicationCategoryCodeName: 'Renewal',
    applicationYearId: 'year',
    applicantInformation: { ...applicantInformation, clientId: 'client', clientNumber: 'number' },
    children: [
      {
        information: { ...childInformation, clientId: 'child-client', clientNumber: 'child-number' },
        dentalBenefits: [],
        privateDentalInsurance: false,
      },
    ],
    communicationPreferences: { preferredLanguage: 'en', preferredMethodSunLife: 'mail', preferredMethodGovernmentOfCanada: 'mail' },
    contactInformation: { copyMailingAddress: true, mailingAddress: { address: '123 Test St', city: 'Ottawa', country: 'CA' } },
    dateOfBirth: applicantInformation.dateOfBirth,
    typeOfApplication: 'family',
  },
  children: [
    {
      id: 'child',
      information: { ...childInformation, memberId: 'child-number', hasSocialInsuranceNumber: false },
      dentalInsurance: { hasDentalInsurance: false },
    },
  ],
  communicationPreferences: { hasChanged: false },
  phoneNumber: { hasChanged: false },
  dentalInsurance: { hasDentalInsurance: false },
  termsAndConditions: { acknowledgeTerms: true, acknowledgePrivacy: true, shareData: true },
} as const satisfies BenefitRenewalAdultState & BenefitRenewalFamilyState & BenefitRenewalChildState;

describe('DefaultBenefitRenewalStateMapper', () => {
  const mapper = new DefaultBenefitRenewalStateMapper();

  it.each([
    ['adult', (id: string) => mapper.mapBenefitRenewalAdultStateToBenefitRenewalDto({ ...state, id })],
    ['family', (id: string) => mapper.mapBenefitRenewalFamilyStateToBenefitRenewalDto({ ...state, id })],
    ['children', (id: string) => mapper.mapBenefitRenewalChildStateToBenefitRenewalDto({ ...state, id })],
  ])('maps the %s renewal flow ID into the DTO', (_name, mapState) => {
    expect(mapState(state.id).applicationId).toBe(state.id);
    const anotherId = '8264181c-e8ec-4d60-a57c-815af94394f2';
    expect(mapState(anotherId).applicationId).toBe(anotherId);
  });
});
