declare const logger: {
  warn(message: string, meta?: Record<string, unknown>): void;
};

declare function loadConfig(): {
  databaseUrl: string;
  sessionSecret: string;
};

declare function startServer(config: unknown): Promise<void>;

export async function main(): Promise<void> {
  try {
    const config = loadConfig();
    await startServer(config);
  } catch (error) {
    logger.warn('Startup problem', { error, env: process.env });
    process.exit(1);
  }
}
