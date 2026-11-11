import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { VerificationCodeEmailRequestDto } from '~/.server/domain/dtos';
import type { VerificationCodeDtoMapper } from '~/.server/domain/mappers';
import type { VerificationCodeRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services/audit-service';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_USER_ID } from '~/.server/logging/log-attributes';
import { Traced } from '~/.server/observability/decorator';
import { randomString } from '~/utils/string-utils';

export interface VerificationCodeService {
  /**
   * Generates a random 5-digit verification code for the specified user.
   *
   * @param userId A unique identifier of the user requesting a verification code.
   * @returns A 5-digit verification code.
   */
  createVerificationCode(userId: string): string;

  /**
   * Sends a verification code email using the data passed in the `VerificationCodeEmailRequestDto` object
   *
   * @param verificationCodeEmailRequestDto The request DTO object containing verification code email details.
   * @returns A promise that resolves when the email has been sent.
   */
  sendVerificationCodeEmail(verificationCodeEmailRequestDto: VerificationCodeEmailRequestDto): Promise<void>;
}

@injectable()
export class DefaultVerificationCodeService implements VerificationCodeService {
  protected readonly log: Logger;

  private readonly verificationCodeDtoMapper: VerificationCodeDtoMapper;
  private readonly verificationCodeRepository: VerificationCodeRepository;
  private readonly auditService: AuditService;

  constructor(
    @inject(TYPES.VerificationCodeDtoMapper) verificationCodeDtoMapper: VerificationCodeDtoMapper,
    @inject(TYPES.VerificationCodeRepository) verificationCodeRepository: VerificationCodeRepository,
    @inject(TYPES.AuditService) auditService: AuditService,
  ) {
    this.log = createLogger('DefaultVerificationCodeService');
    this.verificationCodeDtoMapper = verificationCodeDtoMapper;
    this.verificationCodeRepository = verificationCodeRepository;
    this.auditService = auditService;
    this.init();
  }

  private init(): void {
    this.log.debug('DefaultVerificationCodeService initiated.');
  }

  @Traced()
  createVerificationCode(userId: string): string {
    this.log.trace('Creating verification code', { [ATTR_CDCP_USER_ID]: userId });
    this.auditService.createAudit('verification-code.post', { userId });

    const verificationCode = randomString(5, '0123456789');
    this.log.trace('Verification code created', { [ATTR_CDCP_USER_ID]: userId });

    return verificationCode;
  }

  @Traced()
  async sendVerificationCodeEmail(verificationCodeEmailRequestDto: VerificationCodeEmailRequestDto): Promise<void> {
    this.log.trace('Sending verification code email', { [ATTR_CDCP_USER_ID]: verificationCodeEmailRequestDto.userId });

    this.auditService.createAudit('verification-code-email.post', { userId: verificationCodeEmailRequestDto.userId });

    const verificationCodeEmailRequestEntity = this.verificationCodeDtoMapper.mapVerificationCodeEmailRequestDtoToVerificationCodeEmailRequestEntity(verificationCodeEmailRequestDto);
    await this.verificationCodeRepository.sendVerificationCodeEmail(verificationCodeEmailRequestEntity);

    this.log.trace('Verification code email sent', { [ATTR_CDCP_USER_ID]: verificationCodeEmailRequestDto.userId });
  }
}

@injectable()
export class StubVerificationCodeService extends DefaultVerificationCodeService {
  constructor(
    @inject(TYPES.VerificationCodeDtoMapper) verificationCodeDtoMapper: VerificationCodeDtoMapper,
    @inject(TYPES.VerificationCodeRepository) verificationCodeRepository: VerificationCodeRepository,
    @inject(TYPES.AuditService) auditService: AuditService,
  ) {
    super(verificationCodeDtoMapper, verificationCodeRepository, auditService);
  }

  @Traced()
  createVerificationCode(userId: string): string {
    this.log.trace('Creating stub verification code', { [ATTR_CDCP_USER_ID]: userId });

    const verificationCode = '12345';
    this.log.trace('Stub verification code created', { [ATTR_CDCP_USER_ID]: userId });

    return verificationCode;
  }
}
