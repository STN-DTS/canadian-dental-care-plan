import type { TransformableInfo } from 'logform';
import { MESSAGE } from 'triple-beam';
import { describe, expect, it } from 'vitest';

import { DefaultLogger } from '~/.server/logging/logger-default';
import { defaultsConfig } from '~/.server/logging/logging-config';
import { createWinstonInstance } from '~/.server/logging/winston-factory';

describe('DefaultLogger', () => {
  it('emits info request logs and more severe levels while filtering diagnostics', async () => {
    const winston = createWinstonInstance({ ...defaultsConfig, LOG_LEVEL: 'info', AUDIT_LOG_ENABLED: false });
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
      logger.info('request-event');
      logger.debug('debug-event');
      logger.trace('trace-event');

      await new Promise<void>((resolve) => setImmediate(resolve));
      const output = messages.join('');
      expect(output).toContain('audit-event');
      expect(output).toContain('error-event');
      expect(output).toContain('warn-event');
      expect(output).toContain('request-event');
      expect(output).not.toContain('debug-event');
      expect(output).not.toContain('trace-event');
      expect(logger).not.toHaveProperty('http');
      expect(winston.levels).not.toHaveProperty('http');
    } finally {
      winston.close();
    }
  });
});
