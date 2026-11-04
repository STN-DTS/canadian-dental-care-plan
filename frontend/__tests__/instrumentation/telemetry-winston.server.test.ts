import { afterEach, expect, test, vi } from 'vitest';

const { captureInstrumentations, captureSdkOptions } = vi.hoisted(() => ({
  captureInstrumentations: vi.fn(),
  captureSdkOptions: vi.fn(),
}));

vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: captureInstrumentations,
}));

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: class {
    constructor(options: unknown) {
      captureSdkOptions(options);
    }

    start() {}
    async shutdown() {}
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  captureInstrumentations.mockClear();
  captureSdkOptions.mockClear();
});

test.each([
  { endpoint: undefined, disabled: true, hasProcessor: false },
  { endpoint: 'http://127.0.0.1:4318/v1/logs', disabled: false, hasProcessor: true },
])('Winston log sending is disabled=$disabled when logs endpoint is $endpoint', async ({ endpoint, disabled, hasProcessor }) => {
  const beforeExitListeners = new Set(process.listeners('beforeExit'));
  vi.stubEnv('OTEL_LOGS_ENDPOINT', endpoint);
  vi.stubEnv('OTEL_API_KEY', endpoint ? 'test' : undefined);

  try {
    await import('../../app/instrumentation/telemetry.server');

    expect(captureInstrumentations).toHaveBeenCalledWith({
      '@opentelemetry/instrumentation-winston': expect.objectContaining({ disableLogSending: disabled }),
    });
    expect(captureSdkOptions.mock.lastCall?.[0].logRecordProcessors?.length ?? 0).toBe(hasProcessor ? 1 : 0);
  } finally {
    for (const listener of process.listeners('beforeExit')) {
      if (!beforeExitListeners.has(listener)) {
        process.removeListener('beforeExit', listener);
      }
    }
  }
});
