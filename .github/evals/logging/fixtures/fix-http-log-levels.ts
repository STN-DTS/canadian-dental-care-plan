declare const logger: {
  emit(event: Record<string, unknown>): void;
};

export function logCompletion(requestId: string, status: number): void {
  if (status >= 500) {
    logger.emit({
      category: 'access',
      severityText: 'WARN',
      severityNumber: 13,
      requestId,
      status,
    });
    return;
  }

  logger.emit({
    category: 'access',
    severityText: 'INFO',
    severityNumber: 9,
    requestId,
    status,
  });
}
