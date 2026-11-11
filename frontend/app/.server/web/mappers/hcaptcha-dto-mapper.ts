import { injectable } from 'inversify';

import { Traced } from '~/.server/observability/decorator';
import type { HCaptchaVerifyRequestDto, HCaptchaVerifyResponseDto } from '~/.server/web/dtos';
import type { HCaptchaVerifyRequestEntity, HCaptchaVerifyResponseEntity } from '~/.server/web/entities';

export interface HCaptchaDtoMapper {
  mapHCaptchaVerifyRequestDtoToHCaptchaVerifyRequestEntity(hCaptchaVerifyRequestDto: HCaptchaVerifyRequestDto): HCaptchaVerifyRequestEntity;
  mapHCaptchaVerifyResponseEntityToHCaptchaVerifyResponseDto(hCaptchaVerifyResponseEntity: HCaptchaVerifyResponseEntity): HCaptchaVerifyResponseDto;
}

@injectable()
export class DefaultHCaptchaDtoMapper implements HCaptchaDtoMapper {
  @Traced()
  mapHCaptchaVerifyRequestDtoToHCaptchaVerifyRequestEntity({ hCaptchaResponse, ipAddress }: HCaptchaVerifyRequestDto): HCaptchaVerifyRequestEntity {
    return { hCaptchaResponse, ipAddress };
  }

  @Traced()
  mapHCaptchaVerifyResponseEntityToHCaptchaVerifyResponseDto({ success, score }: HCaptchaVerifyResponseEntity): HCaptchaVerifyResponseDto {
    return { success, score };
  }
}
