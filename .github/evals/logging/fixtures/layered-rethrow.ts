declare const logger: {
  error(message: string, meta?: Record<string, unknown>): void;
};

declare function sql(query: string, params: unknown[]): Promise<unknown>;

export class ApplicationRepository {
  async save(application: unknown): Promise<void> {
    try {
      await sql('insert into applications values ($1)', [application]);
    } catch (error) {
      logger.error('Repository save failed', { error, application });
      throw error;
    }
  }
}

export class ApplicationService {
  constructor(private readonly repository: ApplicationRepository) {}

  async submit(application: unknown): Promise<void> {
    try {
      await this.repository.save(application);
    } catch (error) {
      logger.error('Service submit failed', { error });
      throw error;
    }
  }
}

export async function handleSubmit(service: ApplicationService, requestId: string, application: unknown): Promise<number> {
  try {
    await service.submit(application);
    return 201;
  } catch (error) {
    logger.error('Submit request failed', { requestId, error });
    return 500;
  }
}
