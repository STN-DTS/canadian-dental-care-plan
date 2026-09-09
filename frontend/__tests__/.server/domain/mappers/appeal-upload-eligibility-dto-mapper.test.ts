import { describe, expect, it } from 'vitest';

import type { AppealUploadEligibilityResponseEntity } from '~/.server/domain/entities';
import { DefaultAppealUploadEligibilityDtoMapper } from '~/.server/domain/mappers/appeal-upload-eligibility-dto-mapper';

function createResponseEntity(applications: AppealUploadEligibilityResponseEntity['esdc_esdc_dentalapplicant_Clientid_esdc_client']): AppealUploadEligibilityResponseEntity {
  return {
    esdc_applicanttype: 775170000,
    esdc_clientid: 'client-id',
    esdc_clientnumber: 'client-number',
    esdc_esdc_dentalapplicant_Clientid_esdc_client: applications,
    esdc_socialinsurancenumber: 'sin',
    esdc_suspendedon: null,
    statecode: 0,
    statuscode: 1,
  };
}

describe('DefaultAppealUploadEligibilityDtoMapper', () => {
  const mapper = new DefaultAppealUploadEligibilityDtoMapper();

  it('denies upload when client profile has no applications', () => {
    const responseEntity = createResponseEntity([]);

    expect(mapper.mapAppealUploadEligibilityResponseEntityToAppealUploadEligibilityDto(responseEntity)).toStrictEqual({
      canUploadAppealDocuments: false,
      clientId: 'client-id',
      clientNumber: 'client-number',
    });
  });

  it('allows upload when client profile has an application', () => {
    const responseEntity = createResponseEntity([
      {
        _esdc_dentalapplicationid_value: 'application-id',
        _esdc_pendingstatusid_value: null,
        esdc_dentalapplicantid: 'dental-applicant-id',
      },
    ]);

    expect(mapper.mapAppealUploadEligibilityResponseEntityToAppealUploadEligibilityDto(responseEntity)).toStrictEqual({
      canUploadAppealDocuments: true,
      clientId: 'client-id',
      clientNumber: 'client-number',
    });
  });
});
