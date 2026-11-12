import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { VerificationCodeEmailRequestDto } from '~/.server/domain/dtos';
import type { VerificationCodeEmailRequestEntity } from '~/.server/domain/entities';

export interface VerificationCodeDtoMapper {
  mapVerificationCodeEmailRequestDtoToVerificationCodeEmailRequestEntity(verificationCodeEmailRequestDto: VerificationCodeEmailRequestDto): VerificationCodeEmailRequestEntity;
}

@injectable()
export class DefaultVerificationCodeDtoMapper implements VerificationCodeDtoMapper {
  private readonly serverConfig: Pick<ServerConfig, 'GC_NOTIFY_ENGLISH_TEMPLATE_ID' | 'GC_NOTIFY_FRENCH_TEMPLATE_ID'>;

  constructor(@inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'GC_NOTIFY_ENGLISH_TEMPLATE_ID' | 'GC_NOTIFY_FRENCH_TEMPLATE_ID'>) {
    this.serverConfig = serverConfig;
  }

  mapVerificationCodeEmailRequestDtoToVerificationCodeEmailRequestEntity(verificationCodeEmailRequestDto: VerificationCodeEmailRequestDto): VerificationCodeEmailRequestEntity {
    return {
      email_address: verificationCodeEmailRequestDto.email,
      template_id: verificationCodeEmailRequestDto.preferredLanguage === 'fr' ? this.serverConfig.GC_NOTIFY_FRENCH_TEMPLATE_ID : this.serverConfig.GC_NOTIFY_ENGLISH_TEMPLATE_ID,
      personalisation: {
        EmailVerificationCode: verificationCodeEmailRequestDto.verificationCode,
      },
    };
  }
}
