import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';
import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { AddressCorrectionRequestDto, AddressCorrectionResultDto } from '~/.server/domain/dtos';
import type { AddressValidationDtoMapper } from '~/.server/domain/mappers';
import type { AddressValidationRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services/audit-service';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_USER_ID } from '~/.server/logging/log-attributes';

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
    this.log.trace('Getting address correction results', { [ATTR_CDCP_USER_ID]: addressCorrectionRequestDto.userId });
    this.auditService.createAudit('address-validation.get-address-correction-result', { userId: addressCorrectionRequestDto.userId });

    try {
      const addressCorrectionResultEntity = await this.addressValidationRepository.getAddressCorrectionResult(addressCorrectionRequestDto);
      const addressCorrectionResultDto = this.addressValidationDtoMapper.mapAddressCorrectionResultEntityToAddressCorrectionResultDto(addressCorrectionResultEntity);
      this.log.trace('Address correction result mapped');
      return addressCorrectionResultDto;
    } catch {
      this.log.warn('Address correction unavailable; using fallback result', { [ATTR_ERROR_TYPE]: 'address_correction_failed' });
      const addressCorrectionResultDto = this.addressValidationDtoMapper.mapAddressCorrectionRequestDtoToAddressCorrectionResultDto(addressCorrectionRequestDto, 'service-unavailable');
      this.log.trace('Address correction fallback result mapped');
      return addressCorrectionResultDto;
    }
  }
}
