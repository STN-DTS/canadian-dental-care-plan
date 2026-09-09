import { injectable } from 'inversify';

import type { AppealUploadEligibilityDto } from '~/.server/domain/dtos';
import type { AppealUploadEligibilityResponseEntity } from '~/.server/domain/entities';

export interface AppealUploadEligibilityDtoMapper {
  /**
   * Maps the response entity returned by the appeal-upload eligibility lookup to its DTO.
   *
   * The client is eligible to upload evidentiary documentation when the entity contains at least one application paused due to a T4 mismatch.
   *
   * @param entity - Response entity containing the client identifiers and paused applications.
   * @returns DTO containing the client identifiers and upload eligibility.
   */
  mapAppealUploadEligibilityResponseEntityToAppealUploadEligibilityDto(entity: AppealUploadEligibilityResponseEntity): AppealUploadEligibilityDto;
}

@injectable()
export class DefaultAppealUploadEligibilityDtoMapper implements AppealUploadEligibilityDtoMapper {
  mapAppealUploadEligibilityResponseEntityToAppealUploadEligibilityDto(entity: AppealUploadEligibilityResponseEntity): AppealUploadEligibilityDto {
    return {
      clientId: entity.esdc_clientid,
      clientNumber: entity.esdc_clientnumber,
      canUploadAppealDocuments: entity.esdc_esdc_dentalapplicant_Clientid_esdc_client.length > 0,
    };
  }
}
