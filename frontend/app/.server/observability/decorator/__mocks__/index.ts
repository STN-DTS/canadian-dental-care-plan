import { vi } from 'vitest';

import type { Traced as TracedDecorator, TracedHttpRequest as TracedHttpRequestDecorator } from '~/.server/observability/decorator';

export const Traced = vi.fn<typeof TracedDecorator>(() => vi.fn());
export const TracedHttpRequest = vi.fn<typeof TracedHttpRequestDecorator>(() => vi.fn());
