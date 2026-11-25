import { inject, injectable } from 'inversify';

import { AUDIT_EVENT_VERIFICATION_CODE_EMAIL_POST, AUDIT_EVENT_VERIFICATION_CODE_POST } from '~/.server/audit/audit-event-ids';
import type { AuditService } from '~/.server/audit/audit-service';
import { TYPES } from '~/.server/constants';
import type { VerificationCodeEmailRequestDto } from '~/.server/domain/dtos';
import type { VerificationCodeDtoMapper } from '~/.server/domain/mappers';
import type { VerificationCodeRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { userLogAttributes } from '~/.server/logging/user-log-attributes';
import { Traced } from '~/.server/observability/decorator';
import { randomString } from '~/utils/string-utils';

export interface VerificationCodeService {
  /**
   * Generates a random 5-digit verification code.
   *
   * @returns A 5-digit verification code.
   */
  createVerificationCode(): string;

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
  createVerificationCode(): string {
    this.log.trace('Creating verification code', userLogAttributes());
    this.auditService.createAudit(AUDIT_EVENT_VERIFICATION_CODE_POST);

    const verificationCode = randomString(5, '0123456789');
    this.log.trace('Verification code created', userLogAttributes());

    return verificationCode;
  }

  @Traced()
  async sendVerificationCodeEmail(verificationCodeEmailRequestDto: VerificationCodeEmailRequestDto): Promise<void> {
    this.log.trace('Sending verification code email', userLogAttributes());

    this.auditService.createAudit(AUDIT_EVENT_VERIFICATION_CODE_EMAIL_POST);

    const verificationCodeEmailRequestEntity = this.verificationCodeDtoMapper.mapVerificationCodeEmailRequestDtoToVerificationCodeEmailRequestEntity(verificationCodeEmailRequestDto);
    await this.verificationCodeRepository.sendVerificationCodeEmail(verificationCodeEmailRequestEntity);

    this.log.trace('Verification code email sent', userLogAttributes());
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
  createVerificationCode(): string {
    this.log.trace('Creating stub verification code', userLogAttributes());

    const verificationCode = '12345';
    this.log.trace('Stub verification code created', userLogAttributes());

    return verificationCode;
  }
}
