import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AuditService } from '~/.server/audit/audit-service';
import type { ServerConfig } from '~/.server/configs';
import type { RedisService } from '~/.server/data/redis-service';
import type { BenefitApplicationDto, BenefitRenewalDto } from '~/.server/domain/dtos';
import type { BenefitApplicationDtoMapper, BenefitRenewalDtoMapper } from '~/.server/domain/mappers';
import type { BenefitApplicationRepository, BenefitRenewalRepository } from '~/.server/domain/repositories';
import { KILLSWITCH_KEY } from '~/.server/domain/services';
import { DefaultBenefitApplicationService } from '~/.server/domain/services/benefit-application-service';
import { DefaultBenefitRenewalService } from '~/.server/domain/services/benefit-renewal-service';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

const applicationId = 'c48267e0-f11c-4624-bba2-3501b2c33aa1';

describe('benefit submission rate limits', () => {
  it.each([
    ['public application', 'application', 'public'],
    ['public renewal', 'renewal', 'public'],
    ['protected renewal', 'renewal', 'protected'],
  ] as const)('%s activates the kill switch for a rate limit and rethrows', async (_name, operation, channel) => {
    const redis = mock<RedisService>();
    const config = mock<ServerConfig>({ APPLICATION_KILLSWITCH_TTL_SECONDS: 120 });
    const error = new AppError('Rate limited', ErrorCodes.API_BENEFIT_RENEWAL_CREATE_RATE_LIMITED);
    let submission: Promise<string>;

    if (operation === 'application') {
      const repository = mock<BenefitApplicationRepository>();
      repository.createBenefitApplication.mockRejectedValue(error);
      const service = new DefaultBenefitApplicationService(mock<BenefitApplicationDtoMapper>(), repository, mock<AuditService>(), config, redis);
      const request = mock<BenefitApplicationDto>({ applicationChannelCode: channel, applicationId });

      submission = service.createPublicBenefitApplication(request);
    } else {
      const repository = mock<BenefitRenewalRepository>();
      repository.createBenefitRenewal.mockRejectedValue(error);
      const service = new DefaultBenefitRenewalService(mock<BenefitRenewalDtoMapper>(), repository, mock<AuditService>(), config, redis);
      const request = mock<BenefitRenewalDto>({ applicationChannelCode: channel, applicationId });

      submission = channel === 'public' ? service.createPublicBenefitRenewal(request) : service.createProtectedBenefitRenewal(request);
    }

    await expect(submission).rejects.toBe(error);
    expect(redis.set).toHaveBeenCalledExactlyOnceWith(KILLSWITCH_KEY, true, 120);
  });

  it('does not activate the kill switch for another upstream failure', async () => {
    const redis = mock<RedisService>();
    const repository = mock<BenefitApplicationRepository>();
    const error = new AppError('Upstream failure', ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED);
    repository.createBenefitApplication.mockRejectedValue(error);
    const service = new DefaultBenefitApplicationService(mock<BenefitApplicationDtoMapper>(), repository, mock<AuditService>(), mock<ServerConfig>(), redis);
    const request = mock<BenefitApplicationDto>({ applicationChannelCode: 'public', applicationId });

    await expect(service.createPublicBenefitApplication(request)).rejects.toBe(error);
    expect(redis.set).not.toHaveBeenCalled();
  });
});
