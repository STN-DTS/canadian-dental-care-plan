import type { TransformableInfo } from 'logform';
import { MESSAGE, SPLAT } from 'triple-beam';
import { describe, expect, it, vi } from 'vitest';

import type { Logger } from '~/.server/logging/logger';
import { DefaultLogger } from '~/.server/logging/logger-default';
import { defaultsConfig } from '~/.server/logging/logging-config';
import { createWinstonInstance } from '~/.server/logging/winston-factory';

describe('DefaultLogger', () => {
  it.each(['development', 'production'])('retains a fixed message and typed structured fields in %s console output', async (environment) => {
    vi.stubEnv('NODE_ENV', environment);
    const winston = createWinstonInstance({ ...defaultsConfig, LOG_LEVEL: 'info', AUDIT_LOG_ENABLED: false });
    const transport = winston.transports[0];

    if (!transport) {
      throw new Error('Expected a console transport');
    }

    try {
      const entries: TransformableInfo[] = [];
      transport.on('logged', (info: TransformableInfo) => entries.push(info));
      const logger: Logger = new DefaultLogger(winston, 'structured-event');

      const fields = Object.freeze({
        'org.event.category': 'application',
        'org.operation.outcome': 'success',
        'org.retry.count': 2,
        'url.path': '/en/documents/upload',
      });
      logger.info('Dependency request finished', fields);

      await new Promise<void>((resolve) => setImmediate(resolve));
      const entry = entries.find((info) => info.message === 'Dependency request finished');
      expect(entry).toMatchObject({
        message: 'Dependency request finished',
        'org.event.category': 'application',
        'org.operation.outcome': 'success',
        'org.retry.count': 2,
        'url.path': '/en/documents/upload',
      });
      expect(String(entry?.[MESSAGE])).toContain('Dependency request finished');
      expect(String(entry?.[MESSAGE])).toContain('org.retry.count');
      expect(Object.getOwnPropertySymbols(entry ?? {})).not.toContain(SPLAT);
      expect(fields['url.path']).toBe('/en/documents/upload');
      expect(String(entry?.[MESSAGE])).toContain('/en/documents/upload');

      const metadata = environment === 'production' ? JSON.parse(String(entry?.[MESSAGE])) : entry;
      expect(metadata).toMatchObject({ 'org.retry.count': 2 });
    } finally {
      winston.close();
      vi.unstubAllEnvs();
    }
  });

  it.each(['info', 'http'] as const)('filters successful HTTP completions only at the info threshold, using %s', async (level) => {
    const winston = createWinstonInstance({ ...defaultsConfig, LOG_LEVEL: level, AUDIT_LOG_ENABLED: false });
    const transport = winston.transports[0];

    if (!transport) {
      throw new Error('Expected a console transport');
    }

    try {
      const messages: string[] = [];
      transport.on('logged', (info: TransformableInfo) => messages.push(String(info[MESSAGE])));
      const logger = new DefaultLogger(winston, 'requestLoggerMiddleware');

      logger.audit('audit-event');
      logger.error('error-event');
      logger.warn('warn-event');
      logger.http('request-event');
      logger.info('info-event');
      logger.debug('debug-event');
      logger.trace('trace-event');

      await new Promise<void>((resolve) => setImmediate(resolve));
      const output = messages.join('');
      expect(output).toContain('audit-event');
      expect(output).toContain('error-event');
      expect(output).toContain('warn-event');
      expect(output.includes('request-event')).toBe(level === 'http');
      expect(output).toContain('info-event');
      expect(output).not.toContain('debug-event');
      expect(output).not.toContain('trace-event');
      expect(logger.http).toBeTypeOf('function');
      expect(winston.levels).toHaveProperty('http');
    } finally {
      winston.close();
    }
  });
});
