declare const logger: {
  emit(event: Record<string, unknown>): void;
};

export function rejectRequest(requestId: string, method: string, routeTemplate: string, body: unknown, startedAt: number): number {
  logger.emit({
    category: 'access',
    event: 'request_started',
    requestId,
    method,
  });
  logger.emit({
    category: 'application',
    event: 'validation_failed',
    requestId,
    body,
  });
  void routeTemplate;
  void startedAt;
  return 422;
}
