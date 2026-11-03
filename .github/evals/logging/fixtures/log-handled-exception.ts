declare const logger: {
  error(message: string, error: unknown): void;
  emit(event: Record<string, unknown>): void;
};

declare function queryDatabase(): Promise<void>;

export async function handleRequest(requestId: string): Promise<number> {
  try {
    await queryDatabase();
    return 204;
  } catch (error) {
    logger.error('Database request failed', error);
    logger.emit({
      category: 'application',
      requestId,
      status: 500,
      error,
    });
    return 500;
  }
}
