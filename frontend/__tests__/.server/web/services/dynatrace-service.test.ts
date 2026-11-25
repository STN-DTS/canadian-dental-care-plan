import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { DefaultDynatraceDtoMapper } from '~/.server/web/mappers/dynatrace-dto-mapper';
import type { DynatraceRepository } from '~/.server/web/repositories';
import { DefaultDynatraceService } from '~/.server/web/services/dynatrace-service';

function createService() {
  const repository = mock<DynatraceRepository>();
  const service = new DefaultDynatraceService(new DefaultDynatraceDtoMapper(), repository, {
    DYNATRACE_API_RUM_SCRIPT_URI_CACHE_TTL_SECONDS: 2,
  });
  return { repository, service };
}

describe('DefaultDynatraceService cache', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-11-25T00:00:00Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes the cached script after the configured TTL in seconds', async () => {
    const { repository, service } = createService();
    repository.findDynatraceRumScript.mockResolvedValueOnce('<script src="/first.js" data-dtconfig="first"></script>').mockResolvedValueOnce('<script src="/second.js" data-dtconfig="second"></script>');

    const first = await service.findDynatraceRumScript();
    expect(first).toEqual({ src: '/first.js', 'data-dtconfig': 'first' });

    await vi.advanceTimersByTimeAsync(1999);
    await expect(service.findDynatraceRumScript()).resolves.toBe(first);
    expect(repository.findDynatraceRumScript).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(2);
    await expect(service.findDynatraceRumScript()).resolves.toEqual({ src: '/second.js', 'data-dtconfig': 'second' });
    expect(repository.findDynatraceRumScript).toHaveBeenCalledTimes(2);
  });

  it('caches failed retrievals until TTL expiry, then retries', async () => {
    const { repository, service } = createService();
    repository.findDynatraceRumScript.mockRejectedValueOnce(new Error('Synthetic retrieval failure')).mockResolvedValueOnce('<script src="/recovered.js" data-dtconfig="recovered"></script>');

    await expect(service.findDynatraceRumScript()).resolves.toBeNull();

    await vi.advanceTimersByTimeAsync(1999);
    await expect(service.findDynatraceRumScript()).resolves.toBeNull();
    expect(repository.findDynatraceRumScript).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(2);
    await expect(service.findDynatraceRumScript()).resolves.toEqual({ src: '/recovered.js', 'data-dtconfig': 'recovered' });
    expect(repository.findDynatraceRumScript).toHaveBeenCalledTimes(2);
  });

  it('expires cached not-found results', async () => {
    const { repository, service } = createService();
    repository.findDynatraceRumScript.mockResolvedValueOnce(null).mockResolvedValueOnce('<script src="/available.js" data-dtconfig="available"></script>');

    await expect(service.findDynatraceRumScript()).resolves.toBeNull();

    await vi.advanceTimersByTimeAsync(1999);
    await expect(service.findDynatraceRumScript()).resolves.toBeNull();
    expect(repository.findDynatraceRumScript).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(2);
    await expect(service.findDynatraceRumScript()).resolves.toEqual({ src: '/available.js', 'data-dtconfig': 'available' });
    expect(repository.findDynatraceRumScript).toHaveBeenCalledTimes(2);
  });
});
