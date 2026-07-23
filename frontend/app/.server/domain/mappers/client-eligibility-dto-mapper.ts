import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ClientEligibilityDto, ClientEligibilityRequestDto } from '~/.server/domain/dtos/client-eligibility-dto';
import type { ClientEligibilityEntity, ClientEligibilityRequestEntity } from '~/.server/domain/entities/client-eligibility-entity';
import { isValidCoverageCopayTierCode } from '~/.server/utils/coverage-utils';
import { expectDefined } from '~/utils/assert-utils';

export interface ClientEligibilityDtoMapper {
  mapClientEligibilityEntityToClientEligibilityDto(clientEligibilityEntity: ClientEligibilityEntity): ClientEligibilityDto;
  mapClientEligibilityRequestDtoToClientEligibilityRequestEntity(clientEligibilityRequestDto: ClientEligibilityRequestDto): ClientEligibilityRequestEntity;
}

type DefaultClientEligibilityDtoMapperServerConfig = Pick<ServerConfig, 'COVERAGE_CATEGORY_CODE_COPAY_TIER_TPC'>;

@injectable()
export class DefaultClientEligibilityDtoMapper implements ClientEligibilityDtoMapper {
  readonly serverConfig: DefaultClientEligibilityDtoMapperServerConfig;

  constructor(@inject(TYPES.ServerConfig) serverConfig: DefaultClientEligibilityDtoMapperServerConfig) {
    this.serverConfig = serverConfig;
  }

  mapClientEligibilityEntityToClientEligibilityDto(clientEligibilityEntity: ClientEligibilityEntity): ClientEligibilityDto {
    const applicant = clientEligibilityEntity.Applicant;

    return {
      clientId: expectDefined(applicant.ClientIdentification.find(({ IdentificationCategoryText }) => IdentificationCategoryText === 'Client ID')?.IdentificationID, 'Client ID not found'),
      clientNumber: expectDefined(applicant.ClientIdentification.find(({ IdentificationCategoryText }) => IdentificationCategoryText === 'Client Number')?.IdentificationID, 'Client Number not found'),
      firstName: expectDefined(applicant.PersonName[0]?.PersonGivenName[0], 'First name not found'),
      lastName: expectDefined(applicant.PersonName[0]?.PersonSurName, 'Last name not found'),
      earnings: applicant.ApplicantEarning.map((earning) => this.mapApplicantEarningToClientEligibilityEarning(earning)),
      eligibilityStatusCode: applicant.BenefitEligibilityStatus?.StatusCode?.ReferenceDataID,
      eligibilityStatusCodeNextYear: applicant.BenefitEligibilityNextYearStatus?.StatusCode?.ReferenceDataID,
      enrollmentStatusCode: applicant.ApplicantEnrollmentStatus?.StatusCode?.ReferenceDataID,
    };
  }

  private mapApplicantEarningToClientEligibilityEarning(earning: ClientEligibilityEntity['Applicant']['ApplicantEarning'][number]): ClientEligibilityDto['earnings'][number] {
    const eligibilityStatusCode = earning.BenefitEligibilityStatus.StatusCode.ReferenceDataID;
    const earningCopayTierTpcCoverage = earning.Coverage.find((coverage) => {
      return (
        coverage.CoverageCategoryCode.ReferenceDataName === this.serverConfig.COVERAGE_CATEGORY_CODE_COPAY_TIER_TPC && //
        typeof coverage.CoverageCategoryCode.CoverageTierCode.ReferenceDataID === 'string' &&
        isValidCoverageCopayTierCode(coverage.CoverageCategoryCode.CoverageTierCode.ReferenceDataID)
      );
    });

    return {
      applicationYearId: earning.BenefitApplicationYearIdentification.IdentificationID,
      coverageCopayTierTpcCode: earningCopayTierTpcCoverage?.CoverageCategoryCode.CoverageTierCode.ReferenceDataID,
      eligibilityStatusCode: eligibilityStatusCode,
      taxationYear: Number.parseInt(earning.EarningTaxationYear.YearDate),
    };
  }

  mapClientEligibilityRequestDtoToClientEligibilityRequestEntity(clientEligibilityRequestDto: ClientEligibilityRequestDto): ClientEligibilityRequestEntity {
    return clientEligibilityRequestDto.map((dto) => ({
      Applicant: {
        PersonClientNumberIdentification: {
          IdentificationID: dto.clientNumber,
          IdentificationCategoryText: 'Client Number',
        },
      },
    }));
  }
}
