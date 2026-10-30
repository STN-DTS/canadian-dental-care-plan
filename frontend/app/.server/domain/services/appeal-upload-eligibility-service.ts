import { Option } from 'effect';
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
   * @returns `Some` containing the eligibility DTO, or `None` if no matching client was found.
   */
  findAppealUploadEligibility(clientNumber: string): Promise<Option.Option<AppealUploadEligibilityDto>>;
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

  async findAppealUploadEligibility(clientNumber: string): Promise<Option.Option<AppealUploadEligibilityDto>> {
    this.log.trace('Getting appeal upload eligibility for client number: [%s]', clientNumber);

    const appealUploadEligibilityResponseEntityOption = await this.appealUploadEligibilityRepository.findAppealUploadEligibilityByClientNumber(clientNumber);

    if (Option.isNone(appealUploadEligibilityResponseEntityOption)) {
      this.log.debug('No client record found; treating as ineligible; clientNumber: [%s]', clientNumber);
      return Option.none();
    }

    const appealUploadEligibilityDto = this.appealUploadEligibilityDtoMapper.mapAppealUploadEligibilityResponseEntityToAppealUploadEligibilityDto(Option.getOrThrow(appealUploadEligibilityResponseEntityOption));

    this.log.trace('Returning appeal upload eligibility: [%j]', appealUploadEligibilityDto);
    return Option.some(appealUploadEligibilityDto);
  }
}
