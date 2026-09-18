import { describe, expect, it, vi } from 'vitest';

import { applicantMiddleware } from '~/middlewares/applicant.server';
import { createFeatureMiddleware } from '~/middlewares/feature.server';

vi.mock(import('~/middlewares/applicant.server'));
vi.mock(import('~/middlewares/feature.server'));

describe('letters layout middleware', () => {
  it('validates the feature before resolving the applicant', async () => {
    const featureMiddleware = vi.fn();
    vi.mocked(createFeatureMiddleware).mockReturnValue(featureMiddleware);

    const { middleware } = await import('~/routes/protected/letters/layout');

    expect(vi.mocked(createFeatureMiddleware)).toHaveBeenCalledWith('view-letters');
    expect(middleware).toEqual([featureMiddleware, applicantMiddleware]);
  });
});
