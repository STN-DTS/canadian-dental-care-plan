type FailedRequest = {
  requestId: string;
  operation: string;
  status: number;
  reasonCode: string;
  token: string;
  email: string;
  sessionId: string;
  rawUrl: string;
  body: unknown;
};

declare const logger: {
  emit(event: Record<string, unknown>): void;
};

export function logFailure(request: FailedRequest): void {
  logger.emit({
    category: 'application',
    severityText: 'WARN',
    severityNumber: 13,
    request,
  });
}
