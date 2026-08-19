import { injectable } from 'inversify';

import type { AppealUploadEligibilityDto } from '~/.server/domain/dtos';
import type { AppealUploadEligibilityResponseEntity } from '~/.server/domain/entities';

export interface AppealUploadEligibilityDtoMapper {
  mapAppealUploadEligibilityResponseEntityToAppealUploadEligibilityDto(appealUploadEligibilityResponseEntity: AppealUploadEligibilityResponseEntity): AppealUploadEligibilityDto;
}

@injectable()
export class DefaultAppealUploadEligibilityDtoMapper implements AppealUploadEligibilityDtoMapper {
  mapAppealUploadEligibilityResponseEntityToAppealUploadEligibilityDto(appealUploadEligibilityResponseEntity: AppealUploadEligibilityResponseEntity): AppealUploadEligibilityDto {
    // Acceptance criteria: a client is eligible to upload evidentiary documentation when their
    // profile has at least one application paused due to a T4 mismatch.
    const hasT4MismatchPausedApplication = appealUploadEligibilityResponseEntity.esdc_esdc_dentalapplicant_Clientid_esdc_client.length > 0;

    return {
      clientId: appealUploadEligibilityResponseEntity.esdc_clientid,
      clientNumber: appealUploadEligibilityResponseEntity.esdc_clientnumber,
      eligible: hasT4MismatchPausedApplication,
    };
  }
}
