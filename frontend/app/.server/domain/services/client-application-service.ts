import { Option } from 'effect';
import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { ClientApplicationBasicInfoAndSinRequestDto, ClientApplicationBasicInfoRequestDto, ClientApplicationDto, ClientApplicationSinRequestDto } from '~/.server/domain/dtos';
import type { ClientApplicationDtoMapper } from '~/.server/domain/mappers';
import type { ClientApplicationRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_USER_ID } from '~/.server/logging/log-attributes';
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
  findClientApplicationByBasicInfo(clientApplicationBasicInfoRequestDto: ClientApplicationBasicInfoRequestDto): Promise<Option.Option<ClientApplicationDto>>;

  /**
   * Finds a client application by basic info and SIN.
   *
   * @param clientApplicationBasicInfoAndSinRequestDto The basic info and SIN request dto.
   * @returns A Promise that resolves to the client application dto if found, or `null` otherwise.
   */
  findClientApplicationByBasicInfoAndSin(clientApplicationBasicInfoAndSinRequestDto: ClientApplicationBasicInfoAndSinRequestDto): Promise<Option.Option<ClientApplicationDto>>;

  /**
   * Finds a client application by SIN.
   *
   * @param clientApplicationSinRequestDto The SIN request dto.
   * @returns A Promise that resolves to the client application dto if found, or `null` otherwise.
   */
  findClientApplicationBySin(clientApplicationSinRequestDto: ClientApplicationSinRequestDto): Promise<Option.Option<ClientApplicationDto>>;
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

  async findClientApplicationByBasicInfo(clientApplicationBasicInfoRequestDto: ClientApplicationBasicInfoRequestDto): Promise<Option.Option<ClientApplicationDto>> {
    this.log.trace('Finding client application by basic info', { [ATTR_CDCP_USER_ID]: clientApplicationBasicInfoRequestDto.userId });

    this.auditService.createAudit('client-application.basic-info.get', { userId: clientApplicationBasicInfoRequestDto.userId });

    const clientApplicationBasicInfoRequestEntity = this.clientApplicationDtoMapper.mapClientApplicationBasicInfoRequestDtoToClientApplicationBasicInfoRequestEntity(clientApplicationBasicInfoRequestDto);
    const clientApplicationEntity = await this.clientApplicationRepository.findClientApplicationByBasicInfo(clientApplicationBasicInfoRequestEntity);

    if (Option.isNone(clientApplicationEntity)) {
      this.log.trace('No client application found by basic info', { [ATTR_CDCP_USER_ID]: clientApplicationBasicInfoRequestDto.userId });
      return Option.none();
    }

    const clientApplicationDto = this.clientApplicationDtoMapper.mapClientApplicationEntityToClientApplicationDto(Option.getOrThrow(clientApplicationEntity));
    this.log.trace('Returning client application', { [ATTR_CDCP_USER_ID]: clientApplicationBasicInfoRequestDto.userId });
    return Option.some(clientApplicationDto);
  }

  async findClientApplicationByBasicInfoAndSin(clientApplicationBasicInfoAndSinRequestDto: ClientApplicationBasicInfoAndSinRequestDto): Promise<Option.Option<ClientApplicationDto>> {
    const { sin, ...basicInfoRequestDto } = clientApplicationBasicInfoAndSinRequestDto;
    const clientApplicationOption = await this.findClientApplicationByBasicInfo(basicInfoRequestDto);

    if (Option.isNone(clientApplicationOption)) {
      this.log.trace('No client application found by basic info', { [ATTR_CDCP_USER_ID]: basicInfoRequestDto.userId });
      return Option.none();
    }

    // Note: We compare the SINs by removing all non-digit characters to ensure that formatting differences do not
    // affect the comparison.
    const clientApplication = Option.getOrThrow(clientApplicationOption);

    if (sanitizeSin(clientApplication.applicantInformation.socialInsuranceNumber) !== sanitizeSin(sin)) {
      this.log.trace('Client application identity check did not match', { [ATTR_CDCP_USER_ID]: basicInfoRequestDto.userId });
      return Option.none();
    }

    this.log.trace('Client application identity check matched', { [ATTR_CDCP_USER_ID]: basicInfoRequestDto.userId });
    return Option.some(clientApplication);
  }

  async findClientApplicationBySin(clientApplicationSinRequestDto: ClientApplicationSinRequestDto): Promise<Option.Option<ClientApplicationDto>> {
    this.log.trace('Finding client application by SIN', { [ATTR_CDCP_USER_ID]: clientApplicationSinRequestDto.userId });

    this.auditService.createAudit('client-application.sin.get', { userId: clientApplicationSinRequestDto.userId });

    const clientApplicationSinRequestEntity = this.clientApplicationDtoMapper.mapClientApplicationSinRequestDtoToClientApplicationSinRequestEntity(clientApplicationSinRequestDto);
    const clientApplicationEntity = await this.clientApplicationRepository.findClientApplicationBySin(clientApplicationSinRequestEntity);

    if (Option.isNone(clientApplicationEntity)) {
      this.log.trace('No client application found by SIN', { [ATTR_CDCP_USER_ID]: clientApplicationSinRequestDto.userId });
      return Option.none();
    }

    const clientApplicationDto = this.clientApplicationDtoMapper.mapClientApplicationEntityToClientApplicationDto(Option.getOrThrow(clientApplicationEntity));
    this.log.trace('Returning client application', { [ATTR_CDCP_USER_ID]: clientApplicationSinRequestDto.userId });
    return Option.some(clientApplicationDto);
  }
}
