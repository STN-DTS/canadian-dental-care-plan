import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { VerificationCodeEmailRequestDto } from '~/.server/domain/dtos';
import type { VerificationCodeDtoMapper } from '~/.server/domain/mappers';
import type { VerificationCodeRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services/audit-service';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
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

  createVerificationCode(userId: string): string {
    this.log.trace('Creating verification code for userId [%s]', userId);
    this.auditService.createAudit('verification-code.post', { userId });

    const verificationCode = randomString(5, '0123456789');
    this.log.trace('Returning verification code [%s] for userId [%s]', verificationCode, userId);

    return verificationCode;
  }

  async sendVerificationCodeEmail(verificationCodeEmailRequestDto: VerificationCodeEmailRequestDto): Promise<void> {
    this.log.trace('Sending verification code email for request [%j]', verificationCodeEmailRequestDto);

    this.auditService.createAudit('verification-code-email.post', { userId: verificationCodeEmailRequestDto.userId });

    const verificationCodeEmailRequestEntity = this.verificationCodeDtoMapper.mapVerificationCodeEmailRequestDtoToVerificationCodeEmailRequestEntity(verificationCodeEmailRequestDto);
    await this.verificationCodeRepository.sendVerificationCodeEmail(verificationCodeEmailRequestEntity);

    this.log.trace('Verification code email successfully sent for request [%j]', verificationCodeEmailRequestDto);
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

  createVerificationCode(userId: string): string {
    this.log.trace('Creating verification code for userId [%s]', userId);

    const verificationCode = '12345';
    this.log.trace('Returning verification code [%s] for userId [%s]', verificationCode, userId);

    return verificationCode;
  }
}
