declare const logger: {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
};

type Session = { id: string; userId: string; email: string; roles: string[] };

declare function findSession(id: string): Promise<Session | undefined>;

export async function getSession(sessionId: string, requestId: string): Promise<Session | undefined> {
  logger.debug(`Looking up session ${sessionId}`);
  const session = await findSession(sessionId);
  if (!session) {
    logger.info('Session not found', { sessionId, requestId });
    return undefined;
  }
  logger.debug('Session loaded', { session });
  return session;
}
