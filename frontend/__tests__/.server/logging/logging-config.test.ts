import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteSingleton } from '~/.server/utils/instance-registry';

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

  it('accepts audit even though its Winston priority is zero', async () => {
    const { defaultsConfig } = await import('~/.server/logging/logging-config');
    const { getLevelsConfig } = await import('~/.server/logging/winston-levels-config');

    expect(getLevelsConfig({ ...defaultsConfig, LOG_LEVEL: 'audit' }).levels.audit).toBe(0);
  });
});
