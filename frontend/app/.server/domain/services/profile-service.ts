import { inject, injectable } from 'inversify';

import { AUDIT_EVENT_PROFILE_UPDATE_COMMUNICATION_PREFERENCES_POST, AUDIT_EVENT_PROFILE_UPDATE_EMAIL_ADDRESS_POST, AUDIT_EVENT_PROFILE_UPDATE_PHONE_NUMBERS_POST } from '~/.server/audit/audit-event-ids';
import type { AuditService } from '~/.server/audit/audit-service';
import { TYPES } from '~/.server/constants';
import type { UpdateAddressRequestDto, UpdateCommunicationPreferenceRequestDto, UpdateDentalBenefitsRequestDto, UpdateEmailAddressRequestDto, UpdatePhoneNumbersRequestDto } from '~/.server/domain/dtos';
import type { ProfileDtoMapper } from '~/.server/domain/mappers';
import type { ProfileRepository } from '~/.server/domain/repositories';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { userLogAttributes } from '~/.server/logging/user-log-attributes';
import { Traced } from '~/.server/observability/decorator';

export interface ProfileService {
  /**
   * Updates communication preferences for a user in the protected route.
   *
   * @param updateCommunicationPreferenceRequestDto The update communication preference request dto
   * @returns A Promise that resolves when the update is complete
   */
  updateCommunicationPreferences(updateCommunicationPreferenceRequestDto: UpdateCommunicationPreferenceRequestDto): Promise<void>;

  /**
   * Updates phone numbers for a user in the protected route.
   *
   * @param updatePhoneNumbersRequestDto The update phone numbers request dto
   * @returns A Promise that resolves when the update is complete
   */
  updatePhoneNumbers(updatePhoneNumbersRequestDto: UpdatePhoneNumbersRequestDto): Promise<void>;

  /**
   * Updates dental benefits for a user in the protected route.
   *
   * @param dentalBenefitsDto The update dental benefits request dto
   * @returns A Promise that resolves when the update is complete
   */
  updateDentalBenefits(updateDentalBenefitsRequestDto: UpdateDentalBenefitsRequestDto): Promise<void>;

  /**
   * Updates email address for a user in the protected route.
   *
   * @param emailAddressDto The email address dto
   * @returns A Promise that resolves when the update is complete
   */
  updateEmailAddress(emailAddressDto: UpdateEmailAddressRequestDto): Promise<void>;

  /**
   * Updates mailing and home addresses for a user in the protected route.
   *
   * @param updateAddressRequestDto The address dto
   * @returns A Promise that resolves when the update is complete
   */
  updateAddresses(updateAddressRequestDto: UpdateAddressRequestDto): Promise<void>;
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

  @Traced()
  async updateCommunicationPreferences(updateCommunicationPreferenceRequestDto: UpdateCommunicationPreferenceRequestDto): Promise<void> {
    this.log.trace('Updating communication preferences', userLogAttributes());

    this.auditService.createAudit(AUDIT_EVENT_PROFILE_UPDATE_COMMUNICATION_PREFERENCES_POST);

    const updateCommunicationPreferenceRequestEntity = this.profileDtoMapper.mapUpdateCommunicationPreferenceRequestDtoToUpdateCommunicationPreferenceRequestEntity(updateCommunicationPreferenceRequestDto);
    await this.profileRepository.updateCommunicationPreferences(updateCommunicationPreferenceRequestEntity);

    this.log.trace('Successfully updated communication preferences');
  }

  @Traced()
  async updatePhoneNumbers(updatePhoneNumbersRequestDto: UpdatePhoneNumbersRequestDto): Promise<void> {
    this.log.trace('Updating phone numbers', userLogAttributes());

    this.auditService.createAudit(AUDIT_EVENT_PROFILE_UPDATE_PHONE_NUMBERS_POST);

    const updatePhoneNumbersRequestEntity = this.profileDtoMapper.mapUpdatePhoneNumbersRequestDtoToUpdatePhoneNumbersRequestEntity(updatePhoneNumbersRequestDto);
    await this.profileRepository.updatePhoneNumbers(updatePhoneNumbersRequestEntity);

    this.log.trace('Successfully updated phone numbers');
  }

  @Traced()
  async updateDentalBenefits(updateDentalBenefitsRequestDto: UpdateDentalBenefitsRequestDto): Promise<void> {
    this.log.trace('Updating dental benefits');

    const updateDentalBenefitsRequestEntity = this.profileDtoMapper.mapUpdateDentalBenefitsRequestDtoToUpdateDentalBenefitsRequestEntity(updateDentalBenefitsRequestDto);
    await this.profileRepository.updateDentalBenefits(updateDentalBenefitsRequestEntity);

    this.log.trace('Successfully updated dental benefits');
  }

  @Traced()
  async updateEmailAddress(updateEmailAddressRequestDto: UpdateEmailAddressRequestDto): Promise<void> {
    this.log.trace('Updating email address', userLogAttributes());

    this.auditService.createAudit(AUDIT_EVENT_PROFILE_UPDATE_EMAIL_ADDRESS_POST);

    const updateEmailAddressRequestEntity = this.profileDtoMapper.mapUpdateEmailAddressRequestDtoToUpdateEmailAddressRequestEntity(updateEmailAddressRequestDto);
    await this.profileRepository.updateEmailAddress(updateEmailAddressRequestEntity);

    this.log.trace('Successfully updated email address');
  }

  @Traced()
  async updateAddresses(updateAddressRequestDto: UpdateAddressRequestDto): Promise<void> {
    this.log.trace('Updating mailing and home addresses');

    const updateAddressRequestEntity = this.profileDtoMapper.mapUpdateAddressRequestDtoToUpdateAddressRequestEntity(updateAddressRequestDto);
    await this.profileRepository.updateAddresses(updateAddressRequestEntity);

    this.log.trace('Successfully updated mailing and home addresses');
  }
}
