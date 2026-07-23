import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { AddressCorrectionRequestDto, AddressCorrectionResultDto } from '~/.server/domain/dtos';
import type { AddressValidationDtoMapper } from '~/.server/domain/mappers';
import type { AddressValidationRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services/audit-service';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

export interface AddressValidationService {
  /**
   * Corrects the provided address using the data passed in the `AddressCorrectionRequest` object.
   *
   * @param addressCorrectionRequestDto The request DTO object containing the address details that need to be corrected
   * @returns A promise that resolves to a `AddressCorrectionResultDto` object containing corrected address results
   */
  getAddressCorrectionResult(addressCorrectionRequestDto: AddressCorrectionRequestDto): Promise<AddressCorrectionResultDto>;
}

@injectable()
export class DefaultAddressValidationService implements AddressValidationService {
  private readonly log: Logger;
  private readonly addressValidationDtoMapper: AddressValidationDtoMapper;
  private readonly addressValidationRepository: AddressValidationRepository;
  private readonly auditService: AuditService;

  constructor(
    @inject(TYPES.AddressValidationDtoMapper) addressValidationDtoMapper: AddressValidationDtoMapper,
    @inject(TYPES.AddressValidationRepository) addressValidationRepository: AddressValidationRepository,
    @inject(TYPES.AuditService) auditService: AuditService,
  ) {
    this.log = createLogger('DefaultAddressValidationService');
    this.addressValidationDtoMapper = addressValidationDtoMapper;
    this.addressValidationRepository = addressValidationRepository;
    this.auditService = auditService;
    this.init();
  }

  private init(): void {
    this.log.debug('DefaultAddressValidationService initiated.');
  }

  async getAddressCorrectionResult(addressCorrectionRequestDto: AddressCorrectionRequestDto): Promise<AddressCorrectionResultDto> {
    this.log.trace('Getting address correction results with addressCorrectionRequest: [%j]', addressCorrectionRequestDto);
    this.auditService.createAudit('address-validation.get-address-correction-result', { userId: addressCorrectionRequestDto.userId });

    try {
      const addressCorrectionResultEntity = await this.addressValidationRepository.getAddressCorrectionResult(addressCorrectionRequestDto);
      const addressCorrectionResultDto = this.addressValidationDtoMapper.mapAddressCorrectionResultEntityToAddressCorrectionResultDto(addressCorrectionResultEntity);
      this.log.trace('Returning address correction result: [%j]', addressCorrectionResultDto);
      return addressCorrectionResultDto;
    } catch (error) {
      this.log.warn('Unexpected error occurred while getting address correction results. [%s]', error);
      const addressCorrectionResultDto = this.addressValidationDtoMapper.mapAddressCorrectionRequestDtoToAddressCorrectionResultDto(addressCorrectionRequestDto, 'service-unavailable');
      this.log.trace('Service unavailable, returning address correction result: [%j]', addressCorrectionResultDto);
      return addressCorrectionResultDto;
    }
  }
}
