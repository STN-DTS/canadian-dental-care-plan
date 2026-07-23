import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { MockProxy } from 'vitest-mock-extended';

import type { ApplicantDto, ClientApplicationDto, ClientChildDto, ClientEligibilityDto } from '~/.server/domain/dtos';
import type { ClientApplicationDtoMapper } from '~/.server/domain/mappers';
import { DefaultClientApplicationRenewalEligibilityDtoMapper } from '~/.server/domain/mappers/client-application-renewal-eligibility-dto-mapper';
import type { ClientEligibilityService } from '~/.server/domain/services';
import { isChildOrYouth } from '~/.server/routes/helpers/base-application-route-helpers';
import { isValidCoverageCopayTierCode } from '~/.server/utils/coverage-utils';

vi.mock('~/.server/routes/helpers/base-application-route-helpers');
vi.mock('~/.server/utils/coverage-utils');

const SERVER_CONFIG = {
  ELIGIBILITY_STATUS_CODE_ELIGIBLE: 'eligible',
  ENROLLMENT_STATUS_CODE_ENROLLED: 'enrolled',
};

const APPLICATION_YEAR = { applicationYearId: 'year-2024', taxYear: '2025' };

/** Builds a minimal adult ClientApplicationDto with optional overrides. */
function makeClientApplication(overrides: Partial<ClientApplicationDto> = {}): ClientApplicationDto {
  return {
    applicationYearId: 'year-2024',
    typeOfApplication: 'adult',
    applicantInformation: {
      clientNumber: 'client-001',
      clientId: 'id-001',
      firstName: 'John',
      lastName: 'Doe',
      socialInsuranceNumber: '000-000-000',
    },
    children: [],
    communicationPreferences: {
      preferredLanguage: 'en',
      preferredMethodSunLife: 'email',
      preferredMethodGovernmentOfCanada: 'email',
    },
    contactInformation: {
      copyMailingAddress: false,
      mailingAddress: {
        address: '123 Main St',
        city: 'Ottawa',
        country: 'CA',
      },
    },
    dateOfBirth: '1980-01-01',
    dentalBenefits: [],
    ...overrides,
  };
}

/** Builds a minimal ClientChildDto. */
function makeChild(clientNumber: string, dateOfBirth = '2015-01-01'): ClientChildDto {
  return {
    dentalBenefits: [],
    privateDentalInsurance: false,
    information: {
      clientNumber,
      clientId: `id-${clientNumber}`,
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth,
      isParent: false,
      socialInsuranceNumber: '111-111-111',
    },
  };
}

/**
 * Builds a ClientEligibilityDto with sensible defaults for an enrolled, eligible client.
 *
 * `eligibilityStatusCode` uses a key-in-options check so that passing
 * `{ eligibilityStatusCode: undefined }` explicitly produces `undefined` in the returned object
 * rather than falling back to the eligible default.
 */
function makeEligibility(
  clientNumber: string,
  options: {
    enrollmentStatusCode?: string;
    eligibilityStatusCode?: string;
  } = {},
): ClientEligibilityDto {
  const enrollmentStatusCode = options.enrollmentStatusCode ?? SERVER_CONFIG.ENROLLMENT_STATUS_CODE_ENROLLED;
  const eligibilityStatusCode = 'eligibilityStatusCode' in options ? options.eligibilityStatusCode : SERVER_CONFIG.ELIGIBILITY_STATUS_CODE_ELIGIBLE;

  return {
    clientId: `id-${clientNumber}`,
    clientNumber,
    firstName: 'John',
    lastName: 'Doe',
    eligibilityStatusCode,
    enrollmentStatusCode,
    earnings: [],
  };
}

/** Builds a minimal ApplicantDto with optional overrides. */
function makeApplicant(overrides: Partial<ApplicantDto> = {}): ApplicantDto {
  return {
    clientId: 'id-001',
    clientNumber: 'client-001',
    dateOfBirth: '2008-04-15', // turns 18 on 2026-04-15 (the faked clock date)
    firstName: 'John',
    lastName: 'Doe',
    communicationPreferences: {},
    contactInformation: {
      mailingAddress: {
        address: '123 Main St',
        city: 'Ottawa',
        country: 'CA',
      },
    },
    ...overrides,
  };
}

describe('DefaultClientApplicationRenewalEligibilityDtoMapper', () => {
  let mockClientApplicationDtoMapper: MockProxy<ClientApplicationDtoMapper>;
  let mockClientEligibilityService: MockProxy<ClientEligibilityService>;
  let mapper: DefaultClientApplicationRenewalEligibilityDtoMapper;

  beforeEach(() => {
    // Pin the clock to a fixed date so that age-category calculations in isChildOrYouth
    // (and any other time-sensitive logic) produce deterministic results regardless of
    // when the test suite is actually run.
    vi.useFakeTimers({ now: new Date('2026-04-15') });

    mockClientApplicationDtoMapper = mock<ClientApplicationDtoMapper>({
      mapApplicantDtoToClientApplicationDto: vi.fn(),
    });

    mockClientEligibilityService = mock<ClientEligibilityService>({
      listClientEligibilitiesByClientNumbers: vi.fn(),
    });

    mapper = new DefaultClientApplicationRenewalEligibilityDtoMapper(mockClientApplicationDtoMapper, mockClientEligibilityService, SERVER_CONFIG);

    vi.mocked(isChildOrYouth).mockReturnValue(true);
    vi.mocked(isValidCoverageCopayTierCode).mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('mapApplicantDtoToClientApplicationRenewalEligibilityDto', () => {
    describe('INELIGIBLE-APPLICANT-IS-CHILD-OR-YOUTH-AT-INTAKE', () => {
      it('returns INELIGIBLE-APPLICANT-IS-CHILD-OR-YOUTH-AT-INTAKE when isChildOrYouth returns true for intake', async () => {
        vi.mocked(isChildOrYouth).mockReturnValue(true);
        const result = await mapper.mapApplicantDtoToClientApplicationRenewalEligibilityDto(makeApplicant(), APPLICATION_YEAR);
        expect(result.result).toBe('INELIGIBLE-APPLICANT-IS-CHILD-OR-YOUTH-AT-INTAKE');
      });

      it('calls isChildOrYouth with the applicant date of birth and intake context', async () => {
        vi.mocked(isChildOrYouth).mockReturnValue(true);
        await mapper.mapApplicantDtoToClientApplicationRenewalEligibilityDto(makeApplicant({ dateOfBirth: '2010-05-20' }), APPLICATION_YEAR);
        expect(isChildOrYouth).toHaveBeenCalledWith('2010-05-20', APPLICATION_YEAR);
      });

      it('does not include clientApplication in the result', async () => {
        vi.mocked(isChildOrYouth).mockReturnValue(true);
        const result = await mapper.mapApplicantDtoToClientApplicationRenewalEligibilityDto(makeApplicant(), APPLICATION_YEAR);
        assert(result.result === 'INELIGIBLE-APPLICANT-IS-CHILD-OR-YOUTH-AT-INTAKE');
        expect(result.clientApplication).toBeUndefined();
      });
    });

    describe('delegation to mapClientApplicationDtoToClientApplicationRenewalEligibilityDto', () => {
      it('delegates when applicant is not a child or youth at intake and passes the downstream result through', async () => {
        vi.mocked(isChildOrYouth).mockReturnValue(false);
        const applicantDto = makeApplicant();
        const clientApplicationDto = makeClientApplication();
        mockClientApplicationDtoMapper.mapApplicantDtoToClientApplicationDto.mockReturnValue(clientApplicationDto);
        mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001')]]));

        const result = await mapper.mapApplicantDtoToClientApplicationRenewalEligibilityDto(applicantDto, APPLICATION_YEAR);

        expect(mockClientApplicationDtoMapper.mapApplicantDtoToClientApplicationDto).toHaveBeenCalledWith({ applicantDto, applicationYearId: 'year-2024', typeOfApplication: 'adult' });
        expect(result.result).toBe('ELIGIBLE');
      });

      it('sets applicationCategoryCodeName to New when coming through mapApplicantDtoToClientApplicationRenewalEligibilityDto', async () => {
        vi.mocked(isChildOrYouth).mockReturnValue(false);
        const applicantDto = makeApplicant();
        const clientApplicationDto = makeClientApplication();
        mockClientApplicationDtoMapper.mapApplicantDtoToClientApplicationDto.mockReturnValue(clientApplicationDto);
        mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001')]]));

        const result = await mapper.mapApplicantDtoToClientApplicationRenewalEligibilityDto(applicantDto, APPLICATION_YEAR);

        assert(result.result === 'ELIGIBLE');
        expect(result.clientApplication.applicationCategoryCodeName).toBe('New');
      });

      it('passes a downstream ineligible result through unchanged', async () => {
        vi.mocked(isChildOrYouth).mockReturnValue(false);
        const applicantDto = makeApplicant();
        mockClientApplicationDtoMapper.mapApplicantDtoToClientApplicationDto.mockReturnValue(makeClientApplication());
        mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001', { enrollmentStatusCode: 'not-enrolled' })]]));

        const result = await mapper.mapApplicantDtoToClientApplicationRenewalEligibilityDto(applicantDto, APPLICATION_YEAR);

        expect(result.result).toBe('INELIGIBLE-NOT-ENROLLED');
      });
    });
  });

  describe('mapClientApplicationDtoToClientApplicationRenewalEligibilityDto', () => {
    describe('INELIGIBLE-ALREADY-RENEWED', () => {
      it('returns INELIGIBLE-ALREADY-RENEWED when previousApplication is true', async () => {
        const clientApplicationDto = makeClientApplication({ previousApplication: true });
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(clientApplicationDto, APPLICATION_YEAR);
        expect(result.result).toBe('INELIGIBLE-ALREADY-RENEWED');
      });

      it('includes the clientApplication in the result when previousApplication is true', async () => {
        const clientApplicationDto = makeClientApplication({ previousApplication: true });
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(clientApplicationDto, APPLICATION_YEAR);
        assert(result.result === 'INELIGIBLE-ALREADY-RENEWED');
        expect(result.clientApplication).toBe(clientApplicationDto);
      });

      it('does not return INELIGIBLE-ALREADY-RENEWED when previousApplication is false', async () => {
        mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001')]]));
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication({ previousApplication: false }), APPLICATION_YEAR);
        expect(result.result).not.toBe('INELIGIBLE-ALREADY-RENEWED');
      });

      it('does not return INELIGIBLE-ALREADY-RENEWED when previousApplication is absent', async () => {
        mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001')]]));
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication(), APPLICATION_YEAR);
        expect(result.result).not.toBe('INELIGIBLE-ALREADY-RENEWED');
      });
    });

    describe('INELIGIBLE-NO-CLIENT-NUMBERS', () => {
      it('returns INELIGIBLE-NO-CLIENT-NUMBERS for a children application with no children', async () => {
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication({ typeOfApplication: 'children', children: [] }), APPLICATION_YEAR);
        expect(result.result).toBe('INELIGIBLE-NO-CLIENT-NUMBERS');
      });

      it('includes the clientApplication in the result', async () => {
        const clientApplicationDto = makeClientApplication({ typeOfApplication: 'children', children: [] });
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(clientApplicationDto, APPLICATION_YEAR);
        assert(result.result === 'INELIGIBLE-NO-CLIENT-NUMBERS');
        expect(result.clientApplication).toBe(clientApplicationDto);
      });

      it('returns INELIGIBLE-NO-CLIENT-NUMBERS when all children are filtered out by isChildOrYouth', async () => {
        vi.mocked(isChildOrYouth).mockReturnValue(false);
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication({ typeOfApplication: 'children', children: [makeChild('child-001'), makeChild('child-002')] }), APPLICATION_YEAR);
        expect(result.result).toBe('INELIGIBLE-NO-CLIENT-NUMBERS');
      });
    });

    describe('INELIGIBLE-NO-ELIGIBILITIES', () => {
      it('returns INELIGIBLE-NO-ELIGIBILITIES when no eligibilities exist for any client number', async () => {
        mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map());
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication(), APPLICATION_YEAR);
        expect(result.result).toBe('INELIGIBLE-NO-ELIGIBILITIES');
      });

      it('includes the clientApplication in the result', async () => {
        mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map());
        const clientApplicationDto = makeClientApplication();
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(clientApplicationDto, APPLICATION_YEAR);
        assert(result.result === 'INELIGIBLE-NO-ELIGIBILITIES');
        expect(result.clientApplication).toBe(clientApplicationDto);
      });
    });

    describe('INELIGIBLE-NOT-ENROLLED', () => {
      it('returns INELIGIBLE-NOT-ENROLLED when the client is not enrolled', async () => {
        mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001', { enrollmentStatusCode: 'not-enrolled' })]]));
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication(), APPLICATION_YEAR);
        expect(result.result).toBe('INELIGIBLE-NOT-ENROLLED');
      });

      it('returns INELIGIBLE-NOT-ENROLLED when enrolled but profile eligibility status is not eligible', async () => {
        mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001', { eligibilityStatusCode: 'not-eligible' })]]));
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication(), APPLICATION_YEAR);
        expect(result.result).toBe('INELIGIBLE-NOT-ENROLLED');
      });

      it('returns INELIGIBLE-NOT-ENROLLED when enrolled and profile eligibility status is absent (undefined)', async () => {
        mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001', { eligibilityStatusCode: undefined })]]));
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication(), APPLICATION_YEAR);
        expect(result.result).toBe('INELIGIBLE-NOT-ENROLLED');
      });

      it('returns INELIGIBLE-NOT-ENROLLED when enrolled and profile eligibility status is an empty string', async () => {
        // An empty string is !== undefined but also !== ELIGIBILITY_STATUS_CODE_ELIGIBLE,
        // so the client is skipped in Step 2.
        mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001', { eligibilityStatusCode: '' })]]));
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication(), APPLICATION_YEAR);
        expect(result.result).toBe('INELIGIBLE-NOT-ENROLLED');
      });

      it('includes the clientApplication in the result', async () => {
        mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001', { enrollmentStatusCode: 'not-enrolled' })]]));
        const clientApplicationDto = makeClientApplication();
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(clientApplicationDto, APPLICATION_YEAR);
        assert(result.result === 'INELIGIBLE-NOT-ENROLLED');
        expect(result.clientApplication).toBe(clientApplicationDto);
      });
    });

    describe('ELIGIBLE', () => {
      it('returns ELIGIBLE when enrolled and profile eligibility status is eligible', async () => {
        mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001')]]));
        const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication(), APPLICATION_YEAR);
        expect(result.result).toBe('ELIGIBLE');
      });

      it('throws on an unrecognised typeOfApplication (exhaustive guard)', async () => {
        await expect(
          mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            makeClientApplication({ typeOfApplication: 'unknown' as any }),
            APPLICATION_YEAR,
          ),
        ).rejects.toThrow("Unexpected typeOfApplication: 'unknown'");
      });

      describe('typeOfApplication: adult', () => {
        it('includes only the applicant client number in eligibleClientNumbers', async () => {
          mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001')]]));
          const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication(), APPLICATION_YEAR);
          assert(result.result === 'ELIGIBLE');
          expect(result.clientApplication.eligibleClientNumbers).toEqual(['client-001']);
        });
      });

      describe('typeOfApplication: children', () => {
        it('includes only child client numbers in eligibleClientNumbers', async () => {
          mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(
            new Map([
              ['child-001', makeEligibility('child-001')],
              ['child-002', makeEligibility('child-002')],
            ]),
          );
          const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication({ typeOfApplication: 'children', children: [makeChild('child-001'), makeChild('child-002')] }), APPLICATION_YEAR);
          assert(result.result === 'ELIGIBLE');
          expect(result.clientApplication.eligibleClientNumbers).toEqual(['child-001', 'child-002']);
        });

        it('only includes children that pass the isChildOrYouth age check', async () => {
          vi.mocked(isChildOrYouth).mockImplementation((dob) => dob === '2015-01-01');
          mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['child-001', makeEligibility('child-001')]]));
          const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(
            makeClientApplication({
              typeOfApplication: 'children',
              children: [makeChild('child-001', '2015-01-01'), makeChild('child-002', '2006-06-01')],
            }),
            APPLICATION_YEAR,
          );
          assert(result.result === 'ELIGIBLE');
          expect(result.clientApplication.eligibleClientNumbers).toEqual(['child-001']);
        });
      });

      describe('typeOfApplication: family', () => {
        it('includes the applicant and child client numbers in eligibleClientNumbers', async () => {
          mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(
            new Map([
              ['client-001', makeEligibility('client-001')],
              ['child-001', makeEligibility('child-001')],
            ]),
          );
          const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication({ typeOfApplication: 'family', children: [makeChild('child-001')] }), APPLICATION_YEAR);
          assert(result.result === 'ELIGIBLE');
          expect(result.clientApplication.eligibleClientNumbers).toEqual(['client-001', 'child-001']);
        });

        it('only includes children that pass the isChildOrYouth age check', async () => {
          vi.mocked(isChildOrYouth).mockImplementation((dob) => dob === '2015-01-01');
          mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(
            new Map([
              ['client-001', makeEligibility('client-001')],
              ['child-001', makeEligibility('child-001')],
            ]),
          );
          const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(
            makeClientApplication({
              typeOfApplication: 'family',
              children: [makeChild('child-001', '2015-01-01'), makeChild('child-002', '2006-06-01')],
            }),
            APPLICATION_YEAR,
          );
          assert(result.result === 'ELIGIBLE');
          expect(result.clientApplication.eligibleClientNumbers).toEqual(['client-001', 'child-001']);
        });
      });

      describe('applicationCategoryCodeName', () => {
        it('defaults to Renewal when applicationCategoryCodeName is not passed', async () => {
          mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001')]]));
          const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication(), APPLICATION_YEAR);
          assert(result.result === 'ELIGIBLE');
          expect(result.clientApplication.applicationCategoryCodeName).toBe('Renewal');
        });

        it('sets applicationCategoryCodeName to New when explicitly passed', async () => {
          mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001')]]));
          const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication(), APPLICATION_YEAR, 'New');
          assert(result.result === 'ELIGIBLE');
          expect(result.clientApplication.applicationCategoryCodeName).toBe('New');
        });
      });

      describe('inputModel', () => {
        it('returns simplified when the application has a valid coverage copay tier code', async () => {
          mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001')]]));
          const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication({ coverageCopayTierCode: 'tier-1' }), APPLICATION_YEAR);
          assert(result.result === 'ELIGIBLE');
          expect(result.clientApplication.inputModel).toBe('simplified');
        });

        it('returns simplified for a family application when the application has a valid coverage copay tier code', async () => {
          mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(
            new Map([
              ['client-001', makeEligibility('client-001')],
              ['child-001', makeEligibility('child-001')],
            ]),
          );
          const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication({ typeOfApplication: 'family', children: [makeChild('child-001')], coverageCopayTierCode: 'tier-1' }), APPLICATION_YEAR);
          assert(result.result === 'ELIGIBLE');
          expect(result.clientApplication.inputModel).toBe('simplified');
        });

        it('returns full when the application has no coverage copay tier code', async () => {
          mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001')]]));
          const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication(), APPLICATION_YEAR);
          assert(result.result === 'ELIGIBLE');
          expect(result.clientApplication.inputModel).toBe('full');
        });

        it('returns full when the application has an unrecognised coverage copay tier code', async () => {
          vi.mocked(isValidCoverageCopayTierCode).mockReturnValue(false);
          mockClientEligibilityService.listClientEligibilitiesByClientNumbers.mockResolvedValue(new Map([['client-001', makeEligibility('client-001')]]));
          const result = await mapper.mapClientApplicationDtoToClientApplicationRenewalEligibilityDto(makeClientApplication({ coverageCopayTierCode: 'tier-unknown' }), APPLICATION_YEAR);
          assert(result.result === 'ELIGIBLE');
          expect(result.clientApplication.inputModel).toBe('full');
        });
      });
    });
  });
});
