import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import type { HCaptchaVerifyRequestDto } from '~/.server/web/dtos';
import type { HCaptchaService } from '~/.server/web/services';

/**
 * Parameters for hCaptcha validation.
 */
export interface ValidateHCaptchaResponseParams {
  /**
   * The hCaptcha response token provided by the client.
   */
  hCaptchaResponse: string;

  /**
   * The client's IP address (optional).
   */
  ipAddress?: string;

  /**
   * The ID of the user attempting the request. Defaults to 'anonymous'.
   */
  userId?: string;
}

/**
 * Result of hCaptcha validation.
 */
export type ValidateHCaptchaResponseResult = { isValid: true } | { isValid: false; errorMessage: string };

/**
 * Interface for validating hCaptcha responses.
 */
export interface HCaptchaValidator {
  /**
   * Validates the hCaptcha response.
   *
   * @param params - The validation parameters including the hCaptcha response, user ID, and IP address.
   * @returns The result of the validation.
   */
  validateHCaptchaResponse(params: ValidateHCaptchaResponseParams): Promise<ValidateHCaptchaResponseResult>;
}

@injectable()
export class DefaultHCaptchaValidator implements HCaptchaValidator {
  private readonly log: Logger;
  private readonly serverConfig: Pick<ServerConfig, 'HCAPTCHA_MAX_SCORE'>;
  private readonly hCaptchaService: HCaptchaService;

  constructor(@inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'HCAPTCHA_MAX_SCORE'>, @inject(TYPES.HCaptchaService) hCaptchaService: HCaptchaService) {
    this.log = createLogger('DefaultHCaptchaValidator');
    this.serverConfig = serverConfig;
    this.hCaptchaService = hCaptchaService;
  }

  async validateHCaptchaResponse({ hCaptchaResponse, ipAddress, userId = 'anonymous' }: ValidateHCaptchaResponseParams): Promise<ValidateHCaptchaResponseResult> {
    this.log.debug('Starting hCaptcha response validation for user: %s, IP: %s', userId, ipAddress);

    if (!hCaptchaResponse) {
      this.log.warn('hCaptcha response not found for user: %s; gracefully passing validation', userId);
      return { isValid: true };
    }

    try {
      const hCaptchaVerifyRequestDto: HCaptchaVerifyRequestDto = { hCaptchaResponse, ipAddress, userId };
      const { score } = await this.hCaptchaService.verifyHCaptchaResponse(hCaptchaVerifyRequestDto);
      this.log.trace('hCaptcha verification score for user %s: %s', userId, score);

      if (score && score > this.serverConfig.HCAPTCHA_MAX_SCORE) {
        this.log.warn('hCaptcha score exceeds max threshold for user: %s, score: %s', userId, score);
        return {
          isValid: false,
          errorMessage: 'hCaptcha response validation failed; hCaptcha score exceeds threshold.',
        };
      }

      this.log.debug('hCaptcha response validated successfully for user: %s', userId);
      return { isValid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : error;
      this.log.warn('Error during hCaptcha response validation for user: %s; gracefully passing validation; error: %s', userId, errorMessage);
      // Gracefully pass the validation if there's an issue with the external service
      return { isValid: true };
    }
  }
}
