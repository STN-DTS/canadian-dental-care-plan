import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { UpdateAddressRequestDto, UpdateCommunicationPreferenceRequestDto, UpdateDentalBenefitsRequestDto, UpdateEmailAddressRequestDto, UpdatePhoneNumbersRequestDto } from '~/.server/domain/dtos';
import type { ProfileDtoMapper } from '~/.server/domain/mappers';
import type { ProfileRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';

export interface ProfileService {
  /**
   * Updates communication preferences for a user in the protected route.
   *
   * @param updateCommunicationPreferenceRequestDto The update communication preference request dto
   * @param userId The current logged in user ID
   * @returns A Promise that resolves when the update is complete
   */
  updateCommunicationPreferences(updateCommunicationPreferenceRequestDto: UpdateCommunicationPreferenceRequestDto, userId: string): Promise<void>;

  /**
   * Updates phone numbers for a user in the protected route.
   *
   * @param updatePhoneNumbersRequestDto The update phone numbers request dto
   * @param userId The current logged in user ID
   * @returns A Promise that resolves when the update is complete
   */
  updatePhoneNumbers(updatePhoneNumbersRequestDto: UpdatePhoneNumbersRequestDto, userId: string): Promise<void>;

  /**
   * Updates dental benefits for a user in the protected route.
   *
   * @param dentalBenefitsDto The update dental benefits request dto
   * @returns A Promise that resolves when the update is complete
   */
  updateDentalBenefits(updateDentalBenefitsRequestDto: UpdateDentalBenefitsRequestDto, userId: string): Promise<void>;

  /**
   * Updates email address for a user in the protected route.
   *
   * @param emailAddressDto The email address dto
   * @param userId The current logged in user ID
   * @returns A Promise that resolves when the update is complete
   */
  updateEmailAddress(emailAddressDto: UpdateEmailAddressRequestDto, userId: string): Promise<void>;

  /**
   * Updates mailing and home addresses for a user in the protected route.
   *
   * @param updateAddressRequestDto The address dto
   * @param userId The current logged in user ID
   * @returns A Promise that resolves when the update is complete
   */
  updateAddresses(updateAddressRequestDto: UpdateAddressRequestDto, userId: string): Promise<void>;
}

@injectable()
export class DefaultProfileService implements ProfileService {
  private readonly log: Logger;
  private readonly auditService: AuditService;
  private readonly profileDtoMapper: ProfileDtoMapper;
  private readonly profileRepository: ProfileRepository;

  constructor(
    @inject(TYPES.AuditService) auditService: AuditService,
    @inject(TYPES.ProfileDtoMapper) profileDtoMapper: ProfileDtoMapper,
    @inject(TYPES.ProfileRepository) profileRepository: ProfileRepository, //
  ) {
    this.log = createLogger('DefaultProfileService');
    this.auditService = auditService;
    this.profileDtoMapper = profileDtoMapper;
    this.profileRepository = profileRepository;
    this.init();
  }

  private init(): void {
    this.log.debug('DefaultProfileService initiated.');
  }

  async updateCommunicationPreferences(updateCommunicationPreferenceRequestDto: UpdateCommunicationPreferenceRequestDto, userId: string): Promise<void> {
    this.log.trace('Updating communication preferences for request [%j]', updateCommunicationPreferenceRequestDto);

    this.auditService.createAudit('profile-update.communication-preferences.post', { userId });

    const updateCommunicationPreferenceRequestEntity = this.profileDtoMapper.mapUpdateCommunicationPreferenceRequestDtoToUpdateCommunicationPreferenceRequestEntity(updateCommunicationPreferenceRequestDto);
    await this.profileRepository.updateCommunicationPreferences(updateCommunicationPreferenceRequestEntity);

    this.log.trace('Successfully updated communication preferences');
  }

  async updatePhoneNumbers(updatePhoneNumbersRequestDto: UpdatePhoneNumbersRequestDto, userId: string): Promise<void> {
    this.log.trace('Updating phone numbers for request [%j]', updatePhoneNumbersRequestDto);

    this.auditService.createAudit('profile-update.phone-numbers.post', { userId });

    const updatePhoneNumbersRequestEntity = this.profileDtoMapper.mapUpdatePhoneNumbersRequestDtoToUpdatePhoneNumbersRequestEntity(updatePhoneNumbersRequestDto);
    await this.profileRepository.updatePhoneNumbers(updatePhoneNumbersRequestEntity);

    this.log.trace('Successfully updated phone numbers');
  }

  async updateDentalBenefits(updateDentalBenefitsRequestDto: UpdateDentalBenefitsRequestDto): Promise<void> {
    this.log.trace('Updating dental benefits for request [%j]', updateDentalBenefitsRequestDto);

    const updateDentalBenefitsRequestEntity = this.profileDtoMapper.mapUpdateDentalBenefitsRequestDtoToUpdateDentalBenefitsRequestEntity(updateDentalBenefitsRequestDto);
    await this.profileRepository.updateDentalBenefits(updateDentalBenefitsRequestEntity);

    this.log.trace('Successfully updated dental benefits');
  }

  async updateEmailAddress(updateEmailAddressRequestDto: UpdateEmailAddressRequestDto, userId: string): Promise<void> {
    this.log.trace('Updating email address for request [%j]', updateEmailAddressRequestDto);

    this.auditService.createAudit('profile-update.email-address.post', { userId });

    const updateEmailAddressRequestEntity = this.profileDtoMapper.mapUpdateEmailAddressRequestDtoToUpdateEmailAddressRequestEntity(updateEmailAddressRequestDto);
    await this.profileRepository.updateEmailAddress(updateEmailAddressRequestEntity);

    this.log.trace('Successfully updated email address');
  }

  async updateAddresses(updateAddressRequestDto: UpdateAddressRequestDto): Promise<void> {
    this.log.trace('Updating mailing and home addresses for request [%j]', updateAddressRequestDto);

    const updateAddressRequestEntity = this.profileDtoMapper.mapUpdateAddressRequestDtoToUpdateAddressRequestEntity(updateAddressRequestDto);
    await this.profileRepository.updateAddresses(updateAddressRequestEntity);

    this.log.trace('Successfully updated mailing and home addresses');
  }
}
