import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { AppealUploadEligibilityDto } from '~/.server/domain/dtos';
import type { AppealUploadEligibilityDtoMapper } from '~/.server/domain/mappers';
import type { AppealUploadEligibilityRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * Service interface for determining appeal document upload eligibility.
 */
export interface AppealUploadEligibilityService {
  /**
   * Determines whether a client is eligible to upload appeal documents.
   *
   * @param clientNumber - The client number to check eligibility for.
   * @returns The eligibility DTO, or `null` if no matching client was found.
   */
  getAppealUploadEligibility(clientNumber: string): Promise<AppealUploadEligibilityDto | null>;
}

@injectable()
export class DefaultAppealUploadEligibilityService implements AppealUploadEligibilityService {
  private readonly log: Logger;
  private readonly appealUploadEligibilityDtoMapper: AppealUploadEligibilityDtoMapper;
  private readonly appealUploadEligibilityRepository: AppealUploadEligibilityRepository;

  constructor(@inject(TYPES.AppealUploadEligibilityDtoMapper) appealUploadEligibilityDtoMapper: AppealUploadEligibilityDtoMapper, @inject(TYPES.AppealUploadEligibilityRepository) appealUploadEligibilityRepository: AppealUploadEligibilityRepository) {
    this.log = createLogger('DefaultAppealUploadEligibilityService');
    this.appealUploadEligibilityDtoMapper = appealUploadEligibilityDtoMapper;
    this.appealUploadEligibilityRepository = appealUploadEligibilityRepository;
  }

  async getAppealUploadEligibility(clientNumber: string): Promise<AppealUploadEligibilityDto | null> {
    this.log.trace('Getting appeal upload eligibility for client number: [%s]', clientNumber);

    // TODO: consider memoized caching (see DefaultEvidentiaryDocumentTypeService) if eligibility
    // lookups become hot; requires an appropriate cache TTL config value.
    const appealUploadEligibilityResponseEntityOption = await this.appealUploadEligibilityRepository.findAppealUploadEligibilityByClientNumber(clientNumber);

    if (appealUploadEligibilityResponseEntityOption.isNone()) {
      this.log.debug('No client record found; treating as ineligible; clientNumber: [%s]', clientNumber);
      return null;
    }

    const appealUploadEligibilityDto = this.appealUploadEligibilityDtoMapper.mapAppealUploadEligibilityResponseEntityToAppealUploadEligibilityDto(appealUploadEligibilityResponseEntityOption.unwrap());

    this.log.trace('Returning appeal upload eligibility: [%j]', appealUploadEligibilityDto);
    return appealUploadEligibilityDto;
  }
}
