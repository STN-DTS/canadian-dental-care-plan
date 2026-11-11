import { vi } from 'vitest';

import type { Traced as TracedDecorator } from '~/.server/observability/decorator';

export const Traced = vi.fn<typeof TracedDecorator>(() => vi.fn());
