declare const logger: {
  emit(event: Record<string, unknown>): void;
};

export function logRetry(attempt: number, delayMs: number): void {
  logger.emit({
    category: 'application',
    severityText: 'WARN',
    severityNumber: 13,
    operation: 'send_invoice',
    attempt,
    delayMs,
  });
}
