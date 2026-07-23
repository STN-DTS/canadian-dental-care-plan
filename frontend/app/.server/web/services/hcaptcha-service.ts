import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { AuditService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import type { HCaptchaVerifyRequestDto, HCaptchaVerifyResponseDto } from '~/.server/web/dtos';
import type { HCaptchaDtoMapper } from '~/.server/web/mappers';
import type { HCaptchaRepository } from '~/.server/web/repositories';

export interface HCaptchaService {
  /**
   * Verifies a user's hCaptcha response.
   *
   * @param hCaptchaVerifyRequestDto The hCaptcha verify request dto that includes the hCaptcha response token, optional IP address and userId for auditing
   * @returns A Promise that resolves to the hCaptcha verify response dto that includes the success status and score if successful.
   */
  verifyHCaptchaResponse(hCaptchaVerifyRequestDto: HCaptchaVerifyRequestDto): Promise<HCaptchaVerifyResponseDto>;
}

@injectable()
export class DefaultHCaptchaService implements HCaptchaService {
  private readonly log: Logger;
  private readonly hCaptchaDtoMapper: HCaptchaDtoMapper;
  private readonly hCaptchaRepository: HCaptchaRepository;
  private readonly auditService: AuditService;

  constructor(@inject(TYPES.HCaptchaDtoMapper) hCaptchaDtoMapper: HCaptchaDtoMapper, @inject(TYPES.HCaptchaRepository) hCaptchaRepository: HCaptchaRepository, @inject(TYPES.AuditService) auditService: AuditService) {
    this.log = createLogger('DefaultHCaptchaService');
    this.hCaptchaDtoMapper = hCaptchaDtoMapper;
    this.hCaptchaRepository = hCaptchaRepository;
    this.auditService = auditService;
  }

  async verifyHCaptchaResponse(hCaptchaVerifyRequestDto: HCaptchaVerifyRequestDto): Promise<HCaptchaVerifyResponseDto> {
    this.log.trace('Verifying hCaptcha with request [%j]', hCaptchaVerifyRequestDto);

    this.auditService.createAudit('hcaptcha.verify', { userId: hCaptchaVerifyRequestDto.userId });

    const hCaptchaVerifyRequestEntity = this.hCaptchaDtoMapper.mapHCaptchaVerifyRequestDtoToHCaptchaVerifyRequestEntity(hCaptchaVerifyRequestDto);
    const hCaptchaVerifyResponseEntity = await this.hCaptchaRepository.verifyHCaptchaResponse(hCaptchaVerifyRequestEntity);
    const hCaptchaVerifyResponseDto = this.hCaptchaDtoMapper.mapHCaptchaVerifyResponseEntityToHCaptchaVerifyResponseDto(hCaptchaVerifyResponseEntity);

    this.log.trace('Returning hCaptcha verify result: [%j]', hCaptchaVerifyResponseDto);
    return hCaptchaVerifyResponseDto;
  }
}
