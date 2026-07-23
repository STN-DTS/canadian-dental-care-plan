// generate unit tests for app/.server/domain/mappers/client-eligibility.dto.mapper.ts with vitest
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClientEligibilityDto } from '~/.server/domain/dtos';
import type { ClientEligibilityEntity } from '~/.server/domain/entities/client-eligibility-entity';
import { DefaultClientEligibilityDtoMapper } from '~/.server/domain/mappers/client-eligibility-dto-mapper';
import { isValidCoverageCopayTierCode } from '~/.server/utils/coverage-utils';

vi.mock('~/.server/utils/coverage-utils');

describe('DefaultClientEligibilityDtoMapper', () => {
  let mapper: DefaultClientEligibilityDtoMapper;

  beforeEach(() => {
    const serverConfig = { COVERAGE_CATEGORY_CODE_COPAY_TIER_TPC: 'Co-Pay Tier (TPC)' };
    mapper = new DefaultClientEligibilityDtoMapper(serverConfig);
  });

  describe('mapClientEligibilityEntityToClientEligibilityDto', () => {
    it('should map ClientEligibilityEntity to ClientEligibilityDto correctly', () => {
      vi.mocked(isValidCoverageCopayTierCode).mockReturnValueOnce(true).mockReturnValueOnce(false);

      const clientEligibilityEntity: ClientEligibilityEntity = {
        Applicant: {
          ClientIdentification: [
            { IdentificationCategoryText: 'Client ID', IdentificationID: '12345' },
            { IdentificationCategoryText: 'Client Number', IdentificationID: '67890' },
          ],
          PersonName: [{ PersonGivenName: ['John'], PersonSurName: 'Doe' }],
          ApplicantEarning: [
            {
              EarningTaxationYear: { YearDate: '2022' },
              BenefitEligibilityStatus: { StatusCode: { ReferenceDataID: 'status-001' } },
              Coverage: [
                {
                  CoverageCategoryCode: {
                    ReferenceDataName: 'Co-Pay Tier (TPC)',
                    CoverageTierCode: { ReferenceDataID: 'coverage-tier-01' },
                  },
                },
              ],
              BenefitApplicationYearIdentification: {
                IdentificationID: '2022',
                IdentificationCategoryText: 'Benefit Application Year',
              },
              EarningIdentification: [
                {
                  IdentificationCategoryText: 'Earning ID',
                  IdentificationID: 'earning-001',
                },
              ],
              PrivateDentalInsuranceIndicator: false,
            },
            {
              EarningTaxationYear: { YearDate: '2023' },
              BenefitEligibilityStatus: { StatusCode: { ReferenceDataID: 'status-002' } },
              Coverage: [
                {
                  CoverageCategoryCode: {
                    ReferenceDataName: 'Other Tier',
                    CoverageTierCode: { ReferenceDataID: 'coverage-tier-98' },
                  },
                },
              ],
              BenefitApplicationYearIdentification: {
                IdentificationID: '2023',
                IdentificationCategoryText: 'Benefit Application Year',
              },
              EarningIdentification: [
                {
                  IdentificationCategoryText: 'Earning ID',
                  IdentificationID: 'earning-002',
                },
              ],
              PrivateDentalInsuranceIndicator: true,
            },
          ],
          ApplicantCategoryCode: {
            ReferenceDataID: 'applicant-category-001',
          },

          ApplicantEnrollmentStatus: {
            StatusCode: {
              ReferenceDataID: 'enrollment-status-001',
            },
          },
          BenefitEligibilityStatus: {
            StatusCode: {
              ReferenceDataID: 'status-001',
            },
          },
          BenefitEligibilityNextYearStatus: {
            StatusCode: {
              ReferenceDataID: 'status-001',
            },
          },
          BenefitApplicationYearIdentification: {
            IdentificationID: 'benefit-application-year-identification-001',
            IdentificationCategoryText: 'Benefit Application Year',
          },
        },
      };

      const result = mapper.mapClientEligibilityEntityToClientEligibilityDto(clientEligibilityEntity);

      expect(result).toEqual<ClientEligibilityDto>({
        clientId: '12345',
        clientNumber: '67890',
        earnings: [
          {
            applicationYearId: '2022',
            coverageCopayTierTpcCode: 'coverage-tier-01',
            eligibilityStatusCode: 'status-001',
            taxationYear: 2022,
          },
          {
            applicationYearId: '2023',
            coverageCopayTierTpcCode: undefined,
            eligibilityStatusCode: 'status-002',
            taxationYear: 2023,
          },
        ],
        eligibilityStatusCode: 'status-001',
        eligibilityStatusCodeNextYear: 'status-001',
        enrollmentStatusCode: 'enrollment-status-001',
        firstName: 'John',
        lastName: 'Doe',
      });
    });
  });

  describe('mapClientEligibilityRequestDtoToClientEligibilityRequestEntity', () => {
    it('should map ClientEligibilityRequestDto to ClientEligibilityRequestEntity correctly', () => {
      const clientEligibilityRequestDto = [{ clientNumber: '67890' }];

      const result = mapper.mapClientEligibilityRequestDtoToClientEligibilityRequestEntity(clientEligibilityRequestDto);

      expect(result).toEqual([
        {
          Applicant: {
            PersonClientNumberIdentification: {
              IdentificationID: '67890',
              IdentificationCategoryText: 'Client Number',
            },
          },
        },
      ]);
    });
  });
});
