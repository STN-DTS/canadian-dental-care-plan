import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteSingleton } from '~/.server/utils/instance-registry';

async function transformInfoRecord(environment: string) {
  vi.stubEnv('NODE_ENV', environment);
  const { LEVEL } = await import('triple-beam');
  const { defaultsConfig } = await import('~/.server/logging/logging-config');
  const { createWinstonInstance } = await import('~/.server/logging/winston-factory');
  const winston = createWinstonInstance({ ...defaultsConfig, AUDIT_LOG_ENABLED: false });
  const info = winston.format.transform({ level: 'info', message: 'Test', [LEVEL]: 'info' });

  winston.close();
  return info;
}

afterEach(() => {
  deleteSingleton('loggingConfig');
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('logging configuration', () => {
  it.each([
    ['production', 'info'],
    ['development', 'debug'],
    ['test', 'debug'],
  ])('uses the %s default of %s', async (environment, level) => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', environment);
    vi.stubEnv('LOG_LEVEL', undefined);
    const { getLoggingConfig } = await import('~/.server/logging/logging-config');

    expect(getLoggingConfig().LOG_LEVEL).toBe(level);
  });

  it.each(['audit', 'error', 'warn', 'http', 'info', 'debug', 'trace'])('accepts explicit %s logging', async (level) => {
    vi.resetModules();
    vi.stubEnv('LOG_LEVEL', level);
    const { getLoggingConfig } = await import('~/.server/logging/logging-config');

    expect(getLoggingConfig().LOG_LEVEL).toBe(level);
  });

  it('rejects info2 as a source level', async () => {
    vi.resetModules();
    vi.stubEnv('LOG_LEVEL', 'info2');
    const { getLoggingConfig } = await import('~/.server/logging/logging-config');

    expect(() => getLoggingConfig()).toThrow();
  });

  it.each(['warn', 'error'] as const)('still emits audit records at LOG_LEVEL=%s', async (level) => {
    const { defaultsConfig } = await import('~/.server/logging/logging-config');
    const { createWinstonInstance } = await import('~/.server/logging/winston-factory');
    const winston = createWinstonInstance({ ...defaultsConfig, LOG_LEVEL: level, AUDIT_LOG_ENABLED: false });

    expect(winston.isLevelEnabled('audit')).toBe(true);
    expect(winston.isLevelEnabled('info')).toBe(false);
    winston.close();
  });

  it('adds severity fields in production', async () => {
    expect(await transformInfoRecord('production')).toEqual(expect.objectContaining({ severityNumber: 9, severityText: 'INFO', logLevel: 'INFO' }));
  });

  it.each(['development', 'test'])('omits severity fields when NODE_ENV=%s', async (environment) => {
    const info = await transformInfoRecord(environment);

    expect(info).not.toHaveProperty('severityNumber');
    expect(info).not.toHaveProperty('severityText');
    expect(info).not.toHaveProperty('logLevel');
  });
});
