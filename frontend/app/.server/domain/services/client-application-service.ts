import { inject, injectable } from 'inversify';
import { None, Some } from 'oxide.ts';
import type { Option } from 'oxide.ts';

import { TYPES } from '~/.server/constants';
import type { ClientApplicationBasicInfoAndSinRequestDto, ClientApplicationBasicInfoRequestDto, ClientApplicationDto, ClientApplicationSinRequestDto } from '~/.server/domain/dtos';
import type { ClientApplicationDtoMapper } from '~/.server/domain/mappers';
import type { ClientApplicationRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { sanitizeSin } from '~/utils/sin-utils';

/**
 * A service that provides access to client application data.
 */
export interface ClientApplicationService {
  /**
   * Finds a client application by basic info.
   *
   * @param clientApplicationBasicInfoRequestDto The basic info request dto.
   * @returns A Promise that resolves to the client application dto if found, or `null` otherwise.
   */
  findClientApplicationByBasicInfo(clientApplicationBasicInfoRequestDto: ClientApplicationBasicInfoRequestDto): Promise<Option<ClientApplicationDto>>;

  /**
   * Finds a client application by basic info and SIN.
   *
   * @param clientApplicationBasicInfoAndSinRequestDto The basic info and SIN request dto.
   * @returns A Promise that resolves to the client application dto if found, or `null` otherwise.
   */
  findClientApplicationByBasicInfoAndSin(clientApplicationBasicInfoAndSinRequestDto: ClientApplicationBasicInfoAndSinRequestDto): Promise<Option<ClientApplicationDto>>;

  /**
   * Finds a client application by SIN.
   *
   * @param clientApplicationSinRequestDto The SIN request dto.
   * @returns A Promise that resolves to the client application dto if found, or `null` otherwise.
   */
  findClientApplicationBySin(clientApplicationSinRequestDto: ClientApplicationSinRequestDto): Promise<Option<ClientApplicationDto>>;
}

@injectable()
export class DefaultClientApplicationService implements ClientApplicationService {
  private readonly log: Logger;
  private readonly clientApplicationDtoMapper: ClientApplicationDtoMapper;
  private readonly clientApplicationRepository: ClientApplicationRepository;
  private readonly auditService: AuditService;

  constructor(
    @inject(TYPES.ClientApplicationDtoMapper) clientApplicationDtoMapper: ClientApplicationDtoMapper,
    @inject(TYPES.ClientApplicationRepository) clientApplicationRepository: ClientApplicationRepository,
    @inject(TYPES.AuditService) auditService: AuditService,
  ) {
    this.log = createLogger('DefaultClientApplicationService');
    this.clientApplicationDtoMapper = clientApplicationDtoMapper;
    this.clientApplicationRepository = clientApplicationRepository;
    this.auditService = auditService;
    this.init();
  }

  private init(): void {
    this.log.debug('DefaultClientApplicationService initiated.');
  }

  async findClientApplicationByBasicInfo(clientApplicationBasicInfoRequestDto: ClientApplicationBasicInfoRequestDto): Promise<Option<ClientApplicationDto>> {
    this.log.trace('Get client application by basic info: [%j]', clientApplicationBasicInfoRequestDto);

    this.auditService.createAudit('client-application.basic-info.get', { userId: clientApplicationBasicInfoRequestDto.userId });

    const clientApplicationBasicInfoRequestEntity = this.clientApplicationDtoMapper.mapClientApplicationBasicInfoRequestDtoToClientApplicationBasicInfoRequestEntity(clientApplicationBasicInfoRequestDto);
    const clientApplicationEntity = await this.clientApplicationRepository.findClientApplicationByBasicInfo(clientApplicationBasicInfoRequestEntity);

    if (clientApplicationEntity.isNone()) {
      this.log.trace('No client application found with basic info: [%j]', clientApplicationBasicInfoRequestDto);
      return None;
    }

    const clientApplicationDto = this.clientApplicationDtoMapper.mapClientApplicationEntityToClientApplicationDto(clientApplicationEntity.unwrap());
    this.log.trace('Returning client application: [%j]', clientApplicationDto);
    return Some(clientApplicationDto);
  }

  async findClientApplicationByBasicInfoAndSin(clientApplicationBasicInfoAndSinRequestDto: ClientApplicationBasicInfoAndSinRequestDto): Promise<Option<ClientApplicationDto>> {
    const { sin, ...basicInfoRequestDto } = clientApplicationBasicInfoAndSinRequestDto;
    const clientApplicationOption = await this.findClientApplicationByBasicInfo(basicInfoRequestDto);

    if (clientApplicationOption.isNone()) {
      this.log.trace('No client application found with basic info: [%j]', basicInfoRequestDto);
      return None;
    }

    // Note: We compare the SINs by removing all non-digit characters to ensure that formatting differences do not
    // affect the comparison.
    const clientApplication = clientApplicationOption.unwrap();

    if (sanitizeSin(clientApplication.applicantInformation.socialInsuranceNumber) !== sanitizeSin(sin)) {
      this.log.trace('Client application found with basic info, but SIN does not match. Basic info: [%j], SIN: [***-***-%s]', basicInfoRequestDto, sin.slice(-3));
      return None;
    }

    this.log.trace('Client application found with basic info and SIN: [%j]', clientApplication);
    return Some(clientApplication);
  }

  async findClientApplicationBySin(clientApplicationSinRequestDto: ClientApplicationSinRequestDto): Promise<Option<ClientApplicationDto>> {
    this.log.trace('Get client application with sin: [%j]', clientApplicationSinRequestDto);

    this.auditService.createAudit('client-application.sin.get', { userId: clientApplicationSinRequestDto.userId });

    const clientApplicationSinRequestEntity = this.clientApplicationDtoMapper.mapClientApplicationSinRequestDtoToClientApplicationSinRequestEntity(clientApplicationSinRequestDto);
    const clientApplicationEntity = await this.clientApplicationRepository.findClientApplicationBySin(clientApplicationSinRequestEntity);

    if (clientApplicationEntity.isNone()) {
      this.log.trace('No client application found with SIN: [%j]', clientApplicationSinRequestDto);
      return None;
    }

    const clientApplicationDto = this.clientApplicationDtoMapper.mapClientApplicationEntityToClientApplicationDto(clientApplicationEntity.unwrap());
    this.log.trace('Returning client application: [%j]', clientApplicationDto);
    return Some(clientApplicationDto);
  }
}
