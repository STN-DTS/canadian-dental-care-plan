export type HCaptchaVerifyRequestEntity = Readonly<{
  hCaptchaResponse: string;
  ipAddress?: string;
}>;

export type HCaptchaVerifyResponseEntity = Readonly<{
  success: boolean;
  score?: number;
}>;
