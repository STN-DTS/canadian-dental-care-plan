declare const logger: {
  warn(message: string, value: unknown): void;
  emit(event: Record<string, unknown>): void;
};

export function createUser(requestId: string, body: unknown): number {
  if (!isValid(body)) {
    logger.warn('Invalid body: %j', body);
    logger.emit({
      category: 'access',
      severityText: 'ERROR',
      severityNumber: 17,
      requestId,
      status: 400,
    });
    return 400;
  }

  return 201;
}

function isValid(body: unknown): boolean {
  return typeof body === 'object' && body !== null;
}
