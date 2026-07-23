import { inject, injectable, optional } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { RedisService } from '~/.server/data';
import type { BenefitRenewalDto } from '~/.server/domain/dtos';
import type { BenefitRenewalDtoMapper } from '~/.server/domain/mappers';
import type { BenefitRenewalRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services';
import { KILLSWITCH_KEY } from '~/.server/domain/services';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { AppError, isAppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

export interface BenefitRenewalService {
  /**
   * Submits a public benefit renewal request.
   *
   * @param benefitRenewalDto The benefit renewal request dto
   * @returns A Promise that resolves to the benefit renewal application code
   */
  createPublicBenefitRenewal(benefitRenewalDto: BenefitRenewalDto): Promise<string>;

  /**
   * Submits a protected benefit renewal request.
   *
   * @param benefitRenewalDto The benefit renewal request dto
   * @returns A Promise that resolves to the benefit renewal application code
   */
  createProtectedBenefitRenewal(benefitRenewalDto: BenefitRenewalDto): Promise<string>;
}

@injectable()
export class DefaultBenefitRenewalService implements BenefitRenewalService {
  private readonly log: Logger;
  private readonly benefitRenewalDtoMapper: BenefitRenewalDtoMapper;
  private readonly benefitRenewalRepository: BenefitRenewalRepository;
  private readonly auditService: AuditService;
  private readonly serverConfig: ServerConfig;

  // TODO :: GjB :: the redis service is temporary.. it should be removed when HTTP429 mitigation is removed
  private readonly redisService?: RedisService;

  constructor(
    @inject(TYPES.BenefitRenewalDtoMapper) benefitRenewalDtoMapper: BenefitRenewalDtoMapper,
    @inject(TYPES.BenefitRenewalRepository) benefitRenewalRepository: BenefitRenewalRepository,
    @inject(TYPES.AuditService) auditService: AuditService,
    @inject(TYPES.ServerConfig) serverConfig: ServerConfig,
    @inject(TYPES.RedisService) @optional() redisService?: RedisService,
  ) {
    this.log = createLogger('DefaultBenefitRenewalService');
    this.benefitRenewalDtoMapper = benefitRenewalDtoMapper;
    this.benefitRenewalRepository = benefitRenewalRepository;
    this.auditService = auditService;
    this.serverConfig = serverConfig;

    // TODO :: GjB :: the redis service is temporary.. it should be removed when HTTP429 mitigation is removed
    this.redisService = redisService;

    this.init();
  }

  private init(): void {
    this.log.debug('DefaultBenefitRenewalService initiated.');
  }

  async createPublicBenefitRenewal(benefitRenewalDto: BenefitRenewalDto): Promise<string> {
    this.log.trace('Creating benefit renewal for request [%j]', benefitRenewalDto);

    const killswitchEngaged = await this.redisService?.get(KILLSWITCH_KEY);

    if (killswitchEngaged) {
      this.log.error('Request to renew benefit application is unavailable (killswitch engaged).');
      throw new AppError('Request to renew benefit application is unavailable (killswitch engaged)', ErrorCodes.XAPI_TOO_MANY_REQUESTS);
    }

    if (benefitRenewalDto.applicationChannelCode !== 'public') {
      this.log.error('Received request to create public benefit renewal with invalid application channel code: [%s]', benefitRenewalDto.applicationChannelCode);
      throw new AppError(`Invalid application channel code [${benefitRenewalDto.applicationChannelCode}]`, ErrorCodes.INVALID_REQUEST);
    }

    this.auditService.createAudit('benefit-renewal-submit.post', { userId: benefitRenewalDto.userId });

    try {
      const benefitRenewalRequestEntity = this.benefitRenewalDtoMapper.mapBenefitRenewalDtoToBenefitRenewalRequestEntity(benefitRenewalDto);
      const benefitRenewalResponseEntity = await this.benefitRenewalRepository.createBenefitRenewal(benefitRenewalRequestEntity);
      const applicationCode = this.benefitRenewalDtoMapper.mapBenefitRenewalResponseEntityToApplicationCode(benefitRenewalResponseEntity);

      this.log.trace('Returning application code: [%s]', applicationCode);
      return applicationCode;
    } catch (error) {
      if (isAppError(error) && error.errorCode === ErrorCodes.XAPI_TOO_MANY_REQUESTS) {
        this.log.warn('Received XAPI_TOO_MANY_REQUESTS; killswitch engage!');
        await this.redisService?.set(KILLSWITCH_KEY, true, this.serverConfig.APPLICATION_KILLSWITCH_TTL_SECONDS);
      }

      throw error;
    }
  }

  async createProtectedBenefitRenewal(benefitRenewalDto: BenefitRenewalDto): Promise<string> {
    this.log.trace('Creating protected benefit renewal for request [%j]', benefitRenewalDto);

    const killswitchEngaged = await this.redisService?.get(KILLSWITCH_KEY);

    if (killswitchEngaged) {
      this.log.error('Request to renew protected benefit application is unavailable (killswitch engaged).');
      throw new AppError('Request to renew protected benefit application is unavailable (killswitch engaged)', ErrorCodes.XAPI_TOO_MANY_REQUESTS);
    }

    if (benefitRenewalDto.applicationChannelCode !== 'protected') {
      this.log.error('Received request to create protected benefit renewal with invalid application channel code: [%s]', benefitRenewalDto.applicationChannelCode);
      throw new AppError('Invalid application channel code', ErrorCodes.INVALID_REQUEST);
    }

    this.auditService.createAudit('protected-renewal-submit.post', { userId: benefitRenewalDto.userId });

    try {
      const benefitRenewalRequestEntity = this.benefitRenewalDtoMapper.mapBenefitRenewalDtoToBenefitRenewalRequestEntity(benefitRenewalDto);
      const benefitRenewalResponseEntity = await this.benefitRenewalRepository.createBenefitRenewal(benefitRenewalRequestEntity);
      const applicationCode = this.benefitRenewalDtoMapper.mapBenefitRenewalResponseEntityToApplicationCode(benefitRenewalResponseEntity);

      this.log.trace('Returning application code: [%s]', applicationCode);
      return applicationCode;
    } catch (error) {
      if (isAppError(error) && error.errorCode === ErrorCodes.XAPI_TOO_MANY_REQUESTS) {
        this.log.warn('Received XAPI_TOO_MANY_REQUESTS; killswitch engage!');
        await this.redisService?.set(KILLSWITCH_KEY, true, this.serverConfig.APPLICATION_KILLSWITCH_TTL_SECONDS);
      }

      throw error;
    }
  }
}
