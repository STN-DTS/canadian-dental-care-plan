/**
 * Represents a Data Transfer Object (DTO) for an hCaptcha verify request.
 */
export type HCaptchaVerifyRequestDto = Readonly<{
  /** The user's hCaptcha response token to verify. */
  hCaptchaResponse: string;

  /** The user's IP address. */
  ipAddress?: string;
}>;

/**
 * Represents a Data Transfer Object (DTO) for an hCaptcha verify response.
 */
export type HCaptchaVerifyResponseDto = Readonly<{
  /** Whether the hCaptcha response is successful verified. */
  success: boolean;

  /** The score denoting malicious activity. */
  score?: number;
}>;
