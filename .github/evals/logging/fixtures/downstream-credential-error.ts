declare const logger: {
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
};

type DownstreamResponse = { status: number; body: string };

declare function post(url: string, headers: Record<string, string>, body: unknown): Promise<DownstreamResponse>;

export async function submitEligibility(apiKey: string, applicantId: string): Promise<boolean> {
  const url = `https://eligibility.example/api/check?applicant=${applicantId}`;
  const headers = { 'Ocp-Apim-Subscription-Key': apiKey };
  const response = await post(url, headers, { applicantId });
  if (response.status === 401 || response.status === 403) {
    logger.warn('Eligibility API rejected request', { url, headers, response });
    return false;
  }
  logger.info('Eligibility checked', { url, status: response.status });
  return response.status === 200;
}
