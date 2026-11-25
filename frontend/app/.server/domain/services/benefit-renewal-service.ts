import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';
import { inject, injectable, optional } from 'inversify';

import type { AuditService } from '~/.server/audit/audit-service';
import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { RedisService } from '~/.server/data';
import type { BenefitRenewalDto } from '~/.server/domain/dtos';
import type { BenefitRenewalDtoMapper } from '~/.server/domain/mappers';
import type { BenefitRenewalRepository } from '~/.server/domain/repositories';
import { KILLSWITCH_KEY } from '~/.server/domain/services';
import type { Logger } from '~/.server/logging';
import { createLogger, maskApplicationConfirmationCode } from '~/.server/logging';
import { ATTR_CDCP_APPLICATION_CHANNEL, ATTR_CDCP_APPLICATION_CONFIRMATION_CODE } from '~/.server/logging/log-attributes';
import { userLogAttributes } from '~/.server/logging/user-log-attributes';
import { Traced } from '~/.server/observability/decorator';
import { throwAppError } from '~/.server/utils/error-utils';
import { ErrorCodes } from '~/errors/error-codes';
import { isUpstreamRateLimitedError } from '~/errors/error-predicates';

export interface BenefitRenewalService {
  /**
   * Submits a public benefit renewal request.
   *
   * @param benefitRenewalSubmissionDto The benefit renewal request and application flow ID.
   * @returns A Promise that resolves to the benefit renewal application code
   */
  createPublicBenefitRenewal(benefitRenewalSubmissionDto: BenefitRenewalDto): Promise<string>;

  /**
   * Submits a protected benefit renewal request.
   *
   * @param benefitRenewalSubmissionDto The benefit renewal request and application flow ID.
   * @returns A Promise that resolves to the benefit renewal application code
   */
  createProtectedBenefitRenewal(benefitRenewalSubmissionDto: BenefitRenewalDto): Promise<string>;
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

  @Traced()
  async createPublicBenefitRenewal(benefitRenewalSubmissionDto: BenefitRenewalDto): Promise<string> {
    this.log.trace('Creating public benefit renewal', userLogAttributes());

    const killswitchEngaged = await this.redisService?.get(KILLSWITCH_KEY);

    if (killswitchEngaged) {
      throwAppError('Request to renew benefit application is unavailable (killswitch engaged)', ErrorCodes.APP_SUBM_PUBLIC_RENEWAL_KILLSWITCH_ENGAGED);
    }

    if (benefitRenewalSubmissionDto.applicationChannelCode !== 'public') {
      throwAppError('Invalid renewal application channel.', ErrorCodes.APP_SUBM_PUBLIC_RENEWAL_CHANNEL_INVALID);
    }

    this.auditService.createAudit('benefit-renewal-submit.post');

    try {
      const benefitRenewalRequestEntity = this.benefitRenewalDtoMapper.mapBenefitRenewalDtoToBenefitRenewalRequestEntity(benefitRenewalSubmissionDto);
      const benefitRenewalSubmissionEntity = { ...benefitRenewalRequestEntity, applicationId: benefitRenewalSubmissionDto.applicationId };
      const benefitRenewalResponseEntity = await this.benefitRenewalRepository.createBenefitRenewal(benefitRenewalSubmissionEntity);
      const applicationCode = this.benefitRenewalDtoMapper.mapBenefitRenewalResponseEntityToApplicationCode(benefitRenewalResponseEntity);

      this.log.info('Benefit renewal confirmation received', {
        [ATTR_CDCP_APPLICATION_CONFIRMATION_CODE]: maskApplicationConfirmationCode(applicationCode),
        [ATTR_CDCP_APPLICATION_CHANNEL]: 'public',
        ...userLogAttributes(),
      });
      return applicationCode;
    } catch (error) {
      if (isUpstreamRateLimitedError(error)) {
        this.log.error(error, { [ATTR_ERROR_TYPE]: 'upstream_rate_limited' });
        await this.redisService?.set(KILLSWITCH_KEY, true, this.serverConfig.APPLICATION_KILLSWITCH_TTL_SECONDS);
      }

      throw error;
    }
  }

  @Traced()
  async createProtectedBenefitRenewal(benefitRenewalSubmissionDto: BenefitRenewalDto): Promise<string> {
    this.log.trace('Creating protected benefit renewal', userLogAttributes());

    const killswitchEngaged = await this.redisService?.get(KILLSWITCH_KEY);

    if (killswitchEngaged) {
      throwAppError('Request to renew protected benefit application is unavailable (killswitch engaged)', ErrorCodes.APP_SUBM_PROTECTED_RENEWAL_KILLSWITCH_ENGAGED);
    }

    if (benefitRenewalSubmissionDto.applicationChannelCode !== 'protected') {
      throwAppError('Invalid application channel code', ErrorCodes.APP_SUBM_PROTECTED_RENEWAL_CHANNEL_INVALID);
    }

    this.auditService.createAudit('protected-renewal-submit.post');

    try {
      const benefitRenewalRequestEntity = this.benefitRenewalDtoMapper.mapBenefitRenewalDtoToBenefitRenewalRequestEntity(benefitRenewalSubmissionDto);
      const benefitRenewalSubmissionEntity = { ...benefitRenewalRequestEntity, applicationId: benefitRenewalSubmissionDto.applicationId };
      const benefitRenewalResponseEntity = await this.benefitRenewalRepository.createBenefitRenewal(benefitRenewalSubmissionEntity);
      const applicationCode = this.benefitRenewalDtoMapper.mapBenefitRenewalResponseEntityToApplicationCode(benefitRenewalResponseEntity);

      this.log.info('Benefit renewal confirmation received', {
        [ATTR_CDCP_APPLICATION_CONFIRMATION_CODE]: maskApplicationConfirmationCode(applicationCode),
        [ATTR_CDCP_APPLICATION_CHANNEL]: 'protected',
        ...userLogAttributes(),
      });
      return applicationCode;
    } catch (error) {
      if (isUpstreamRateLimitedError(error)) {
        this.log.error(error, { [ATTR_ERROR_TYPE]: 'upstream_rate_limited' });
        await this.redisService?.set(KILLSWITCH_KEY, true, this.serverConfig.APPLICATION_KILLSWITCH_TTL_SECONDS);
      }

      throw error;
    }
  }
}
